// Establishes and maintains a connection to the service worker to prevent
// it from becoming inactive, which causes the "context invalidated" error.
function connectToServiceWorker() {
  try {
    const port = chrome.runtime.connect({ name: 'keep-alive' });
    
    port.onDisconnect.addListener(() => {
      console.log("PageTalk: Disconnected from service worker, attempting to reconnect...");
      // Use a random delay to avoid thundering herd on extension update
      setTimeout(connectToServiceWorker, Math.random() * 2000 + 1000);
    });

    const keepAlive = () => {
      try {
        port.postMessage({ type: 'heartbeat' });
        setTimeout(keepAlive, 25000);
      } catch (e) {
        console.warn("PageTalk: Heartbeat failed, port may be closed.", e);
        // The onDisconnect listener will handle reconnection.
      }
    };
    
    keepAlive();
    console.log("PageTalk: Connected to service worker.");

  } catch(e) {
    console.error("PageTalk: Could not connect to service worker. Retrying...", e);
    setTimeout(connectToServiceWorker, 5000);
  }
}