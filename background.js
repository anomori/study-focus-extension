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

// Auto-purge old statistics data (>90 days)
async function purgeOldStats() {
  try {
    const RETENTION_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const browsingData = await chrome.storage.local.get('stats_browsing');
    const patienceData = await chrome.storage.local.get('stats_patience');

    let sessions = browsingData.stats_browsing || [];
    let events = patienceData.stats_patience || [];

    const ob = sessions.length;
    const op = events.length;

    sessions = sessions.filter(s => s.date >= cutoffStr);
    events = events.filter(e => e.date >= cutoffStr);

    if (ob !== sessions.length || op !== events.length) {
      await chrome.storage.local.set({
        stats_browsing: sessions,
        stats_patience: events
      });
      console.log(`[AutoPurge] Purged ${ob - sessions.length} browsing, ${op - events.length} patience records (>${RETENTION_DAYS} days old)`);
    }
  } catch (e) {
    console.error('[AutoPurge] Error:', e);
  }
}

// Ensure the offscreen document is created when the extension is installed or starts
chrome.runtime.onInstalled.addListener(() => {
  createOffscreenDocument();
  checkFirstRunDialog();
  purgeOldStats();
  recheckTimers();
});
chrome.runtime.onStartup.addListener(() => {
  createOffscreenDocument();
  purgeOldStats();
  recheckTimers();
});

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
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await startSession(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // Tab may have been closed between activation event and get call
    console.warn('[onActivated] Tab no longer exists:', activeInfo.tabId);
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

    // Get both feature states
    const settings = await chrome.storage.local.get(['checkFeatureEnabled', 'blockFeatureEnabled']);
    const isCheckEnabled = settings.checkFeatureEnabled !== false;
    const isBlockEnabled = settings.blockFeatureEnabled !== false;

    activeSessions.set(tabId, {
      domain,
      startTime: Date.now(),
      isCheckEnabled,
      isBlockEnabled,
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
      isCheckEnabled: session.isCheckEnabled,
      isBlockEnabled: session.isBlockEnabled,
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
          allowlist: ['go.jp', 'ac.jp', 'ed.jp', 'lg.jp'],  // デフォルトで政府機関・教育機関・地方自治体を許可
          blocklist: ['instagram.com', 'www.instagram.com'],
          blockedPatterns: [
            { domain: 'youtube.com', pathPattern: '/shorts' },
            { domain: 'www.youtube.com', pathPattern: '/shorts' }
          ]
        };

        const url = message.url;
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');

        // Check allowlist (supports both exact match and suffix match for domains like .go.jp, .ac.jp)
        const isAllowed = settings.allowlist.some(allowed => {
          // Exact match or with www prefix
          if (domain === allowed || domain === 'www.' + allowed) {
            return true;
          }
          // Suffix match (e.g., mext.go.jp matches go.jp)
          if (domain.endsWith('.' + allowed)) {
            return true;
          }
          return false;
        });

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

  // Handle timer set from popup
  if (message.type === 'SET_TIMER') {
    (async () => {
      try {
        const alarmName = `feature-timer-${message.feature}`;
        await chrome.alarms.create(alarmName, { when: message.fireAt });
        sendResponse({ success: true });
      } catch (e) {
        console.error('[SET_TIMER] Error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // Handle timer cancel from popup
  if (message.type === 'CANCEL_TIMER') {
    (async () => {
      try {
        const alarmName = `feature-timer-${message.feature}`;
        await chrome.alarms.clear(alarmName);
        sendResponse({ success: true });
      } catch (e) {
        console.error('[CANCEL_TIMER] Error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // Handle relevance check
  if (message.type === 'CHECK_RELEVANCE') {
    (async () => {
      try {
        await createOffscreenDocument();

        // タイムアウト付きでoffscreenにメッセージを送信（初回モデルロード考慮で30秒）
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Offscreen response timeout')), 30000)
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

// ========== タイマー自動切替機能 ==========

// アラーム発火時のハンドラー
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('feature-timer-')) return;

  const feature = alarm.name.replace('feature-timer-', ''); // 'check' or 'block'
  const storageKey = `timer_${feature}`;
  const data = await chrome.storage.local.get(storageKey);
  const timer = data[storageKey];

  if (!timer) return;

  // 機能をON/OFF切替
  await applyTimerAction(feature, timer.action);

  console.log(`[Timer] ${feature} feature turned ${timer.action}`);

  // 繰り返しタイマーの場合：翌日の同時刻に再スケジュール
  if (timer.repeat && timer.repeatTime) {
    const [h, m] = timer.repeatTime.split(':').map(Number);
    const nextFire = new Date();
    nextFire.setDate(nextFire.getDate() + 1);
    nextFire.setHours(h, m, 0, 0);
    const newFireAt = nextFire.getTime();

    // ストレージ更新
    timer.fireAt = newFireAt;
    await chrome.storage.local.set({ [storageKey]: timer });

    // アラーム再登録
    const alarmName = `feature-timer-${feature}`;
    await chrome.alarms.create(alarmName, { when: newFireAt });

    console.log(`[Timer] Repeat timer re-scheduled: ${feature}, next at ${nextFire.toLocaleString()}`);
  } else {
    // タイマーデータをクリーンアップ
    await chrome.storage.local.remove(storageKey);
  }
});

// タイマーアクションを適用
async function applyTimerAction(feature, action) {
  const enabled = action === 'on';

  if (feature === 'check') {
    await chrome.storage.local.set({ checkFeatureEnabled: enabled });
    // 全タブに通知
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'CHECK_FEATURE_TOGGLED',
          enabled: enabled
        }).catch(() => {});
      }
    }
  } else if (feature === 'block') {
    await chrome.storage.local.set({ blockFeatureEnabled: enabled });
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'BLOCK_FEATURE_TOGGLED',
          enabled: enabled
        }).catch(() => {});
      }
    }
  }
}

// 起動時に未実行タイマーを再評価・再登録
async function recheckTimers() {
  const features = ['check', 'block'];
  const now = Date.now();

  for (const feature of features) {
    const storageKey = `timer_${feature}`;
    const data = await chrome.storage.local.get(storageKey);
    const timer = data[storageKey];

    if (!timer) continue;

    if (timer.fireAt <= now) {
      if (timer.repeat && timer.repeatTime) {
        // 繰り返しタイマー: 期限超過でも即時適用し、次回をスケジュール
        await applyTimerAction(feature, timer.action);

        const [h, m] = timer.repeatTime.split(':').map(Number);
        const nextFire = new Date();
        nextFire.setHours(h, m, 0, 0);
        // 今日の時刻がまだ先ならそれを使う。過ぎていたら翌日
        if (nextFire.getTime() <= now) {
          nextFire.setDate(nextFire.getDate() + 1);
        }
        timer.fireAt = nextFire.getTime();
        await chrome.storage.local.set({ [storageKey]: timer });

        const alarmName = `feature-timer-${feature}`;
        await chrome.alarms.create(alarmName, { when: timer.fireAt });
        console.log(`[Timer] Repeat timer re-scheduled on startup: ${feature}, next at ${nextFire.toLocaleString()}`);
      } else {
        // 一回限り: 期限超過 → 即時適用してクリーンアップ
        await applyTimerAction(feature, timer.action);
        await chrome.storage.local.remove(storageKey);
        console.log(`[Timer] Applying overdue timer: ${feature} → ${timer.action}`);
      }
    } else {
      // まだ到達していない → アラームを再登録
      const alarmName = `feature-timer-${feature}`;
      await chrome.alarms.create(alarmName, { when: timer.fireAt });
      console.log(`[Timer] Re-registered alarm: ${feature}, fires at ${new Date(timer.fireAt).toLocaleString()}`);
    }
  }
}
