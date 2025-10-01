import { uiElements, toast } from './transcribe-ui.js';

const defaultConfig = {
  apiProvider: 'free',
  apiKey: '',
  language: 'auto',
  dashscopeModelId: 'qwen3-asr-flash',
  enable_itn: false,
  context: '',
  audioDeviceId: 'default',
  autoCopy: true,
  removeTrailingPeriod: false,
  transcribeSpeed: 1,
  enableStreaming: false,
  enableOpenaiProcessing: false,
  openaiBaseUrl: 'https://api.cerebras.ai/v1',
  openaiApiKey: '',
  openaiModelId: 'gpt-oss-120b',
  openaiSystemPrompt: 'You are a helpful assistant that refines transcribed text. Correct any transcription errors, improve punctuation and formatting, but do not change the core meaning.',
  enableConsoleControl: false,
  consoleBaseUrl: 'https://api.cerebras.ai/v1',
  consoleApiKey: '',
  consoleModelId: 'gpt-oss-120b',
  consoleSystemPrompt: 'You are a browser automation assistant. Convert user commands into a specific JSON format: {"target": "...", "method": "...", "args": [...]}.\nSupported targets:\n1. "page": For actions on the current page. Methods can be "history.back", "history.forward", "location.reload", "window.scrollToBottom", "window.scrollToTop".\n2. "tabs": For browser tab actions. Methods can be "create", "remove", "reload", "duplicate".\n\nExamples:\n- "go back" -> {"target": "page", "method": "history.back", "args": []}\n- "scroll to bottom" -> {"target": "page", "method": "window.scrollToBottom", "args": []}\n- "reload this page" -> {"target": "page", "method": "location.reload", "args": []}\n- "new tab" -> {"target": "tabs", "method": "create", "args": [{}]}\n- "open google" -> {"target": "tabs", "method": "create", "args": [{"url": "https://google.com"}]}\n- "show my extensions" -> {"target": "tabs", "method": "create", "args": [{"url": "chrome://extensions"}]}\n- "close this tab" -> {"target": "tabs", "method": "remove", "args": []}\n- "duplicate this tab" -> {"target": "tabs", "method": "duplicate", "args": []}\n\nOnly output the raw JSON object.',
};

export let currentConfig = { ...defaultConfig };

export function toggleProviderSpecificRows() {
  const isDashScope = uiElements.providerSelect.value === 'dashscope';
  uiElements.apiKeyRow.style.display = isDashScope ? 'flex' : 'none';
  uiElements.dashscopeModelRow.style.display = isDashScope ? 'flex' : 'none';
  uiElements.streamingRow.style.display = isDashScope ? 'flex' : 'none';
  if (!isDashScope && currentConfig.enableStreaming) {
    uiElements.streamingCheckbox.checked = false;
    saveConfig();
  }
}

export async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('pagetalk_config');
    const storedConfig = result.pagetalk_config || {};
    currentConfig = { ...defaultConfig, ...storedConfig };

    uiElements.providerSelect.value = currentConfig.apiProvider;
    uiElements.apiKeyInput.value = currentConfig.apiKey;
    uiElements.dashscopeModelSelect.value = currentConfig.dashscopeModelId;
    uiElements.langSelect.value = currentConfig.language;
    uiElements.micSelect.value = currentConfig.audioDeviceId;
    uiElements.itnCheckbox.checked = currentConfig.enable_itn;
    uiElements.streamingCheckbox.checked = currentConfig.enableStreaming;
    uiElements.autoCopyCheckbox.checked = currentConfig.autoCopy;
    uiElements.removePeriodCheckbox.checked = currentConfig.removeTrailingPeriod;
    uiElements.ctxInput.value = currentConfig.context;
    uiElements.speedSlider.value = String(currentConfig.transcribeSpeed);
    if (uiElements.speedValue) {
      uiElements.speedValue.textContent = `${Number(currentConfig.transcribeSpeed).toFixed(2)}x`;
    }
    
    uiElements.openaiProcessingCheckbox.checked = currentConfig.enableOpenaiProcessing;
    uiElements.openaiBaseUrlInput.value = currentConfig.openaiBaseUrl;
    uiElements.openaiApiKeyInput.value = currentConfig.openaiApiKey;
    uiElements.openaiModelIdInput.value = currentConfig.openaiModelId;
    uiElements.openaiSystemPromptTextarea.value = currentConfig.openaiSystemPrompt;

    uiElements.consoleControlCheckbox.checked = currentConfig.enableConsoleControl;
    uiElements.consoleBaseUrlInput.value = currentConfig.consoleBaseUrl;
    uiElements.consoleApiKeyInput.value = currentConfig.consoleApiKey;
    uiElements.consoleModelIdInput.value = currentConfig.consoleModelId;
    uiElements.consoleSystemPromptTextarea.value = currentConfig.consoleSystemPrompt;

    toggleProviderSpecificRows();
  } catch (e) {
    console.error("Error loading config:", e);
    toast('加载配置失败！');
  }
}

export function saveConfig() {
  const configToSave = {
    apiProvider: uiElements.providerSelect.value,
    apiKey: uiElements.apiKeyInput.value.trim(),
    language: uiElements.langSelect.value,
    dashscopeModelId: uiElements.dashscopeModelSelect.value,
    audioDeviceId: uiElements.micSelect.value,
    enable_itn: uiElements.itnCheckbox.checked,
    enableStreaming: uiElements.streamingCheckbox.checked,
    autoCopy: uiElements.autoCopyCheckbox.checked,
    removeTrailingPeriod: uiElements.removePeriodCheckbox.checked,
    context: uiElements.ctxInput.value,
    transcribeSpeed: Number(uiElements.speedSlider.value) || 1,
    enableOpenaiProcessing: uiElements.openaiProcessingCheckbox.checked,
    openaiBaseUrl: uiElements.openaiBaseUrlInput.value.trim(),
    openaiApiKey: uiElements.openaiApiKeyInput.value.trim(),
    openaiModelId: uiElements.openaiModelIdInput.value.trim(),
    openaiSystemPrompt: uiElements.openaiSystemPromptTextarea.value.trim(),
    enableConsoleControl: uiElements.consoleControlCheckbox.checked,
    consoleBaseUrl: uiElements.consoleBaseUrlInput.value.trim(),
    consoleApiKey: uiElements.consoleApiKeyInput.value.trim(),
    consoleModelId: uiElements.consoleModelIdInput.value.trim(),
    consoleSystemPrompt: uiElements.consoleSystemPromptTextarea.value.trim(),
  };
  
  currentConfig = { ...currentConfig, ...configToSave };

  chrome.storage.sync.set({ pagetalk_config: configToSave }, () => {
    if (chrome.runtime.lastError) {
      toast('保存设置失败！');
      console.error("Error saving config:", chrome.runtime.lastError);
    } else {
      toast('设置已保存！');
    }
  });
}

export async function listMicrophones() {
    const { micSelect } = uiElements;

    const populateDeviceList = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(d => d.kind === 'audioinput');

            if (audioInputDevices.length === 0) {
                micSelect.innerHTML = '<option value="error" disabled>未找到麦克风</option>';
                return;
            }
            
            micSelect.innerHTML = '<option value="default">默认设备</option>';
            audioInputDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `麦克风 ${micSelect.options.length}`;
                micSelect.appendChild(option);
            });

            // Restore selection from currentConfig
            if ([...micSelect.options].some(o => o.value === currentConfig.audioDeviceId)) {
                micSelect.value = currentConfig.audioDeviceId;
            } else {
                micSelect.value = 'default';
            }
        } catch (err) {
            console.error('Error populating device list:', err);
            micSelect.innerHTML = `<option value="error" disabled>加载设备失败</option>`;
        }
    };

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            micSelect.innerHTML = '<option value="error" disabled>不支持设备选择</option>';
            return;
        }

        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });

        if (permissionStatus.state === 'granted') {
            await populateDeviceList();
        } else if (permissionStatus.state === 'prompt') {
            micSelect.innerHTML = `<option value="prompt">点击授权麦克风</option>`;
            micSelect.onclick = async () => {
                try {
                    micSelect.onclick = null;
                    micSelect.innerHTML = `<option value="default">正在授权...</option>`;
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                    await populateDeviceList();
                } catch (err) {
                    console.error('getUserMedia on transcribe page failed:', err);
                    toast(`授权失败: ${err.message}`);
                    micSelect.innerHTML = `<option value="error" disabled>授权失败</option>`;
                    setTimeout(listMicrophones, 100);
                }
            };
        } else { // 'denied'
            micSelect.innerHTML = `<option value="error" disabled>权限已拒绝</option>`;
        }
    } catch (err) {
        console.error('Error querying permissions:', err);
        micSelect.innerHTML = `<option value="error" disabled>加载设备失败</option>`;
    }
}