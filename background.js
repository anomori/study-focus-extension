// background.js

// Offscreen document path
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Store current scores per tab
const tabScores = new Map();

// Store active browsing sessions per tab
const activeSessions = new Map();

// Session save interval (30 seconds)
const SESSION_SAVE_INTERVAL = 30 * 1000;

// Create the offscreen document if it doesn't already exist
async function createOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['BLOBS'],
    justification: 'To run Transformers.js for semantic similarity using multilingual embeddings.'
  });
}

// Check and show first-run dialog
async function checkFirstRunDialog() {
  const data = await chrome.storage.local.get('recordingSettings');
  const settings = data.recordingSettings || {};

  if (!settings.hasShownInitialPrompt) {
    chrome.tabs.create({ url: 'first-run-dialog.html' });
  }
}

// Ensure the offscreen document is created when the extension is installed or starts
chrome.runtime.onInstalled.addListener(() => {
  createOffscreenDocument();
  checkFirstRunDialog();
});
chrome.runtime.onStartup.addListener(createOffscreenDocument);

// Clean up tab scores and sessions when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabScores.delete(tabId);
  await endSession(tabId);
});

// Track tab activation changes for browsing time
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // End previous active sessions for this window
  const tabs = await chrome.tabs.query({ windowId: activeInfo.windowId });
  for (const tab of tabs) {
    if (tab.id !== activeInfo.tabId) {
      await endSession(tab.id);
    }
  }

  // Start new session for active tab
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await startSession(activeInfo.tabId, tab.url);
  }
});

// Track URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await endSession(tabId);
    await startSession(tabId, changeInfo.url);
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus - end all sessions
    for (const tabId of activeSessions.keys()) {
      await endSession(tabId);
    }
  } else {
    // Window gained focus - start session for active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab && tab.url) {
      await startSession(tab.id, tab.url);
    }
  }
});

// Session management functions
async function startSession(tabId, url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check if already tracking this tab
    if (activeSessions.has(tabId)) {
      return;
    }

    // Get blocking state
    const settings = await chrome.storage.local.get('extensionEnabled');
    const isBlockingEnabled = settings.extensionEnabled !== false;

    activeSessions.set(tabId, {
      domain,
      startTime: Date.now(),
      isBlockingEnabled,
      lastSaveTime: Date.now()
    });
  } catch (e) {
    // Invalid URL, ignore
  }
}

async function endSession(tabId) {
  const session = activeSessions.get(tabId);
  if (!session) return;

  activeSessions.delete(tabId);

  // Record the session
  await recordBrowsingSession(session);
}

async function recordBrowsingSession(session) {
  try {
    // Get recording settings
    const data = await chrome.storage.local.get('recordingSettings');
    const settings = data.recordingSettings || {};

    if (!settings.enabled) return;
    if (!settings.recordBrowsingTime && !settings.recordSnsTimeOnly) return;

    // Check if should record this domain
    const SNS_DOMAINS = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'threads.net', 'reddit.com'];
    const isSNS = SNS_DOMAINS.some(sns => session.domain.includes(sns));

    if (!settings.recordBrowsingTime && settings.recordSnsTimeOnly && !isSNS) return;

    const endTime = Date.now();
    const duration = endTime - session.startTime;

    if (duration < 1000) return; // Less than 1 second, ignore

    const d = new Date(session.startTime);
    // UTCで記録（表示時にタイムゾーン変換）
    const date = d.toISOString().split('T')[0];
    const hour = d.getUTCHours();

    const statsData = await chrome.storage.local.get('stats_browsing');
    const sessions = statsData.stats_browsing || [];

    sessions.push({
      domain: session.domain,
      startTime: session.startTime,
      endTime,
      duration,
      isBlockingEnabled: session.isBlockingEnabled,
      date,
      hour
    });

    await chrome.storage.local.set({ stats_browsing: sessions });
  } catch (e) {
    console.error('Error recording session:', e);
  }
}

// Periodic session save (every 30 seconds)
setInterval(async () => {
  const now = Date.now();

  for (const [tabId, session] of activeSessions.entries()) {
    if (now - session.lastSaveTime >= SESSION_SAVE_INTERVAL) {
      // Save intermediate session
      const intermediateSession = {
        ...session,
        startTime: session.lastSaveTime
      };
      await recordBrowsingSession(intermediateSession);

      // Update last save time
      session.lastSaveTime = now;
    }
  }
}, SESSION_SAVE_INTERVAL);

// Relay messages from Content Script to Offscreen Document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle score report from content script
  if (message.type === 'REPORT_SCORE') {
    if (sender.tab && sender.tab.id) {
      tabScores.set(sender.tab.id, {
        score: message.score,
        rawScore: message.rawScore,
        timestamp: Date.now()
      });
    }
    return;
  }

  // Handle score request from popup
  if (message.type === 'GET_CURRENT_SCORE') {
    const tabId = message.tabId;
    const scoreData = tabScores.get(tabId);

    if (scoreData) {
      sendResponse({
        score: scoreData.score,
        rawScore: scoreData.rawScore
      });
    } else {
      sendResponse({
        message: "判定待ち..."
      });
    }
    return;
  }

  // Handle site settings check
  if (message.type === 'CHECK_SITE_SETTINGS') {
    (async () => {
      try {
        const data = await chrome.storage.local.get('siteSettings');
        const settings = data.siteSettings || {
          allowlist: [],
          blocklist: ['instagram.com', 'www.instagram.com'],
          blockedPatterns: [
            { domain: 'youtube.com', pathPattern: '/shorts' },
            { domain: 'www.youtube.com', pathPattern: '/shorts' }
          ]
        };

        const url = message.url;
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');

        // Check allowlist
        const isAllowed = settings.allowlist.some(allowed =>
          domain === allowed || domain === 'www.' + allowed
        );

        if (isAllowed) {
          sendResponse({ allowed: true, blocked: false });
          return;
        }

        // Check blocked patterns
        for (const pattern of settings.blockedPatterns) {
          const patternDomain = pattern.domain.replace(/^www\./, '');
          if ((domain === patternDomain || domain === 'www.' + patternDomain) &&
            urlObj.pathname.startsWith(pattern.pathPattern)) {
            sendResponse({ allowed: false, blocked: true, reason: `${pattern.domain}${pattern.pathPattern}` });
            return;
          }
        }

        // Check blocklist
        for (const blocked of settings.blocklist) {
          const blockedDomain = blocked.replace(/^www\./, '');
          if (domain === blockedDomain || domain === 'www.' + blockedDomain) {
            sendResponse({ allowed: false, blocked: true, reason: blocked });
            return;
          }
        }

        sendResponse({ allowed: false, blocked: false });
      } catch (e) {
        sendResponse({ allowed: false, blocked: false, error: e.message });
      }
    })();
    return true;
  }

  // Handle patience event recording
  if (message.type === 'RECORD_PATIENCE') {
    (async () => {
      try {
        const data = await chrome.storage.local.get('recordingSettings');
        const settings = data.recordingSettings || {};

        if (!settings.enabled || !settings.recordPatienceCount) {
          sendResponse({ recorded: false });
          return;
        }

        const statsData = await chrome.storage.local.get('stats_patience');
        const events = statsData.stats_patience || [];

        const timestamp = Date.now();
        // UTCで記録
        const date = new Date(timestamp).toISOString().split('T')[0];

        events.push({
          domain: message.domain,
          timestamp,
          date
        });

        await chrome.storage.local.set({ stats_patience: events });
        sendResponse({ recorded: true });
      } catch (e) {
        sendResponse({ recorded: false, error: e.message });
      }
    })();
    return true;
  }

  // Handle relevance check
  if (message.type === 'CHECK_RELEVANCE') {
    (async () => {
      try {
        await createOffscreenDocument();

        // タイムアウト付きでoffscreenにメッセージを送信
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Offscreen response timeout')), 10000)
        );

        const messagePromise = chrome.runtime.sendMessage({
          ...message,
          target: 'offscreen'
        });

        const response = await Promise.race([messagePromise, timeoutPromise]);
        sendResponse(response || { score: 0 });
      } catch (error) {
        console.error('Error forwarding to offscreen:', error);
        // エラー時はスコア0を返してcontent.jsがクラッシュしないようにする
        sendResponse({ score: 0, error: error.message });
      }
    })();
    return true;
  }
});
