// background.js

// Offscreen document path
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Store current scores per tab
const tabScores = new Map();

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

// Ensure the offscreen document is created when the extension is installed or starts
chrome.runtime.onInstalled.addListener(createOffscreenDocument);
chrome.runtime.onStartup.addListener(createOffscreenDocument);

// Clean up tab scores when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScores.delete(tabId);
});

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

  // Handle relevance check
  if (message.type === 'CHECK_RELEVANCE') {
    (async () => {
      try {
        await createOffscreenDocument();
        const response = await chrome.runtime.sendMessage({
          ...message,
          target: 'offscreen'
        });
        sendResponse(response);
      } catch (error) {
        console.error('Error forwarding to offscreen:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
});
