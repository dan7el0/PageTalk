

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
      // By accessing chrome.runtime.lastError, we "check" it and prevent the
      // "Unchecked runtime.lastError" message from appearing in the logs.
      if (chrome.runtime.lastError) {
        console.log(`PageTalk: Keep-alive port disconnected: ${chrome.runtime.lastError.message}`);
      } else {
        console.log('PageTalk: Keep-alive port disconnected cleanly.');
      }
      port.onMessage.removeListener(messageListener);
      // The content script is responsible for reconnecting.
    });
  }
});

async function handleStreamingFetch(url, options, tabId) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API 错误: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = `API 错误: ${errorJson.code || response.status} - ${errorJson.message || '未知错误'}`;
      } catch (e) {
        errorMessage = `API 错误: ${response.status} - ${errorText || response.statusText}`;
      }
      chrome.tabs.sendMessage(tabId, { type: 'asrStreamError', error: errorMessage });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        chrome.tabs.sendMessage(tabId, { type: 'asrStreamEnd' });
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonString = line.substring(5).trim();
          if (jsonString) {
            try {
              const data = JSON.parse(jsonString);
              chrome.tabs.sendMessage(tabId, { type: 'asrStreamChunk', payload: data });
            } catch (e) {
              console.error('PageTalk: Error parsing stream JSON:', e, jsonString);
            }
          }
        }
      }
    }
  } catch (error) {
    chrome.tabs.sendMessage(tabId, { type: 'asrStreamError', error: error.message });
  }
}

// This function is injected into the page for 'page' target commands.
// It must be self-contained.
function pageCommandExecutor(command) {
  try {
    const { method, args = [] } = command;
    
    // Handle special methods that don't map 1:1
    if (method === 'window.scrollToBottom') {
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }
    if (method === 'window.scrollToTop') {
      window.scrollTo(0, 0);
      return;
    }
    
    const parts = method.split('.');
    let obj = window;
    let func = null;

    if (parts.length === 2) {
      const [targetName, funcName] = parts;
      switch(targetName) {
        case 'history': obj = history; break;
        case 'location': obj = location; break;
        case 'window': obj = window; break;
        case 'document': obj = document; break;
        default: throw new Error(`Unsupported page target: ${targetName}`);
      }
      func = obj[funcName];
    }

    if (typeof func === 'function') {
      func.apply(obj, args);
    } else {
      throw new Error(`Method '${method}' not found or not a function on the page.`);
    }
  } catch (e) {
    console.error("PageTalk: Failed to execute page command.", { command, error: e.message });
  }
}

async function executePageCommand(tabId, command) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: pageCommandExecutor,
      args: [command],
      world: 'MAIN'
    });
  } catch (err) {
    console.error(`PageTalk: executePageCommand failed.`, { command, err });
  }
}

async function executeTabsCommand(tabId, command) {
  const { method, args = [] } = command;
  try {
    switch(method) {
      case 'create':
        chrome.tabs.create(args[0] || {});
        break;
      case 'remove':
        chrome.tabs.remove(tabId);
        break;
      case 'reload':
        chrome.tabs.reload(tabId);
        break;
      case 'duplicate':
        chrome.tabs.duplicate(tabId);
        break;
      default:
        console.warn(`PageTalk: Unsupported tabs method '${method}'`);
    }
  } catch(err) {
      console.error(`PageTalk: executeTabsCommand failed.`, { command, err });
  }
}


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
  } else if (request.type === 'callStreamingASRAPI') {
    const { url, options } = request.payload;
    if (sender.tab && sender.tab.id) {
        handleStreamingFetch(url, options, sender.tab.id);
    }
    // This is a streaming request, so we don't use sendResponse.
    return false;
  } else if (request.type === 'callOpenAIAPI') {
    const { url, apiKey, model, text, systemPrompt } = request.payload;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: text }
        ],
        stream: false,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 1,
      })
    };

    fetch(url, options)
      .then(response => {
        if (!response.ok) {
          return response.text().then(errorText => {
            let errorMessage;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = `API 错误: ${errorJson.error?.code || response.status} - ${errorJson.error?.message || '未知错误'}`;
            } catch (e) {
              errorMessage = `API 错误: ${response.status} - ${errorText || response.statusText}`;
            }
            throw new Error(errorMessage);
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
    return true; // async response
  } else if (request.type === 'callConsoleAPI') {
    const { url, apiKey, model, text, systemPrompt } = request.payload;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: text }
        ],
        stream: false,
        max_tokens: 1024,
        temperature: 0.2,
        top_p: 1,
      })
    };

    fetch(url, options)
      .then(response => {
        if (!response.ok) {
          return response.text().then(errorText => {
            let errorMessage;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = `API 错误: ${errorJson.error?.code || response.status} - ${errorJson.error?.message || '未知错误'}`;
            } catch (e) {
              errorMessage = `API 错误: ${response.status} - ${errorText || response.statusText}`;
            }
            throw new Error(errorMessage);
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
    return true; // async response
  } else if (request.type === 'executeConsoleCommand') {
    const tabId = sender.tab?.id;
    const commandStr = request.payload?.command;
    if (!tabId || !commandStr) return false;

    try {
      const command = JSON.parse(commandStr);
      switch (command.target) {
        case 'page':
          executePageCommand(tabId, command);
          break;
        case 'tabs':
          executeTabsCommand(tabId, command);
          break;
        default:
          console.warn(`PageTalk: Unknown command target '${command.target}'`);
      }
    } catch(e) {
      console.error('PageTalk: Failed to parse or route command', { commandStr, error: e.message });
    }
    return false; // No response needed
  } else if (request.type === 'listOpenAIModels') {
    const { baseUrl, apiKey } = request.payload;
    const modelsUrl = new URL('models', baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').href;

    fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(errorText => {
          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = `API 错误: ${errorJson.error?.code || response.status} - ${errorJson.error?.message || '未知错误'}`;
          } catch (e) {
            errorMessage = `API 错误: ${response.status} - ${errorText || response.statusText}`;
          }
          throw new Error(errorMessage);
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
    return true; // async response
  } else if (request.type === 'openTranscriptionPage') {
    chrome.tabs.create({ url: 'transcribe.html' });
  } else if (request.type === 'saveToHistory') {
    (async () => {
      try {
        const { pagetalk_history = [] } = await chrome.storage.local.get('pagetalk_history');
        const newHistory = [request.payload, ...pagetalk_history];
        
        if (newHistory.length > 100) {
          newHistory.length = 100;
        }

        await chrome.storage.local.set({ pagetalk_history: newHistory });
      } catch (e) {
        console.error('PageTalk: Error saving to history:', e);
      }
    })();
    return false; // No response needed
  }
});