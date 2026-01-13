// background.js

// Offscreen document path
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

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
    reasons: ['BLOBS'], // Using BLOBS as a generic reason for computation/processing
    justification: 'To run TensorFlow.js for semantic similarity using Universal Sentence Encoder.'
  });
}

// Ensure the offscreen document is created when the extension is installed or starts
chrome.runtime.onInstalled.addListener(createOffscreenDocument);
chrome.runtime.onStartup.addListener(createOffscreenDocument);

// Relay messages from Content Script to Offscreen Document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_RELEVANCE') {
    // Forward the message to the offscreen document
    // We need to return true to keep the message channel open for async response
    (async () => {
      try {
        await createOffscreenDocument(); // Ensure it exists
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
