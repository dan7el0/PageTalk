
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'keep-alive') {
    console.log('PageTalk: Keep-alive connection established.');
    const messageListener = (msg, senderPort) => {
      if (msg.type === 'heartbeat') {
        // This is just to keep the service worker alive. No action needed.
      }
    };
    port.onMessage.addListener(messageListener);

    port.onDisconnect.addListener(() => {
      port.onMessage.removeListener(messageListener);
      console.log('PageTalk: Keep-alive connection disconnected.');
      // The content script is responsible for reconnecting.
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'callASRAPI') {
    const { url, options } = request.payload;

    fetch(url, options)
      .then(response => {
        if (!response.ok) {
          // Try to parse error message from API if available
          return response.json().then(errorData => {
            throw new Error(`API 错误: ${errorData.code || response.status} - ${errorData.message || '未知错误'}`);
          }).catch(() => {
            // Fallback if the error response is not JSON
            throw new Error(`API 错误: ${response.status} - ${response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate you want to send a response asynchronously
    return true;
  }
});