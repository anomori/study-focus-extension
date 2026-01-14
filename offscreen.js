// offscreen.js - Bridge between Chrome runtime and sandboxed iframe
console.log("Offscreen bridge loaded.");

let iframe = null;
let pendingRequests = {};

document.addEventListener('DOMContentLoaded', () => {
    iframe = document.getElementById('sandbox-frame');
    console.log("Offscreen: iframe found", iframe);

    // Listen for messages from the sandbox iframe
    window.addEventListener('message', (event) => {
        if (!iframe || event.source !== iframe.contentWindow) return;

        const message = event.data;

        // Handle Status Check Result
        if (message.type === 'CHECK_STATUS_RESULT') {
            const { requestId, result } = message;
            if (pendingRequests[requestId]) {
                pendingRequests[requestId](result);
                delete pendingRequests[requestId];
            }
            return;
        }

        // Handle Relevance Check Result
        if (message.type === 'CHECK_RELEVANCE_RESULT') {
            const { requestId, result, error } = message;
            if (pendingRequests[requestId]) {
                const sendResponse = pendingRequests[requestId];
                if (error) {
                    sendResponse({ error });
                } else {
                    sendResponse(result);
                }
                delete pendingRequests[requestId];
            }
            return;
        }
    });
});

// Listen for messages from background/content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'CHECK_RELEVANCE') {
        if (!iframe) {
            console.error("Offscreen: iframe not ready yet");
            sendResponse({ error: "Offscreen not ready" });
            return;
        }

        const requestId = Math.random().toString(36).substring(7);
        pendingRequests[requestId] = sendResponse;

        iframe.contentWindow.postMessage({
            type: 'CHECK_RELEVANCE',
            requestId: requestId,
            data: message.data
        }, '*');

        return true; // Keep channel open for async response
    }

    if (message.type === 'CHECK_STATUS') {
        if (!iframe) {
            sendResponse({ loaded: false, error: "Offscreen not ready" });
            return;
        }

        const requestId = Math.random().toString(36).substring(7);
        pendingRequests[requestId] = sendResponse;

        iframe.contentWindow.postMessage({
            type: 'CHECK_STATUS',
            requestId: requestId
        }, '*');

        return true;
    }
});
