import { uiElements, toast } from './transcribe-ui.js';

const defaultConfig = {
  apiProvider: 'free',
  apiKey: '',
  language: 'auto',
  enable_itn: false,
  context: '',
  audioDeviceId: 'default',
  autoCopy: true,
  removeTrailingPeriod: false,
  transcribeSpeed: 1,
};

export let currentConfig = { ...defaultConfig };

export function toggleApiKeyVisibility() {
  uiElements.apiKeyRow.style.display = uiElements.providerSelect.value === 'free' ? 'none' : 'flex';
}

export async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('transcribe_config');
    const storedConfig = result.transcribe_config || {};
    currentConfig = { ...defaultConfig, ...storedConfig };

    uiElements.providerSelect.value = currentConfig.apiProvider;
    uiElements.apiKeyInput.value = currentConfig.apiKey;
    uiElements.langSelect.value = currentConfig.language;
    uiElements.micSelect.value = currentConfig.audioDeviceId;
    uiElements.itnCheckbox.checked = currentConfig.enable_itn;
    uiElements.autoCopyCheckbox.checked = currentConfig.autoCopy;
    uiElements.removePeriodCheckbox.checked = currentConfig.removeTrailingPeriod;
    uiElements.ctxInput.value = currentConfig.context;
    uiElements.speedSelect.value = String(currentConfig.transcribeSpeed);
    
    toggleApiKeyVisibility();
  } catch (e) {
    console.error("Error loading config:", e);
    toast('加载配置失败！');
  }
}

export function saveConfig() {
  let speed = Number(uiElements.speedSelect.value);
  if (isNaN(speed) || speed < 0.5 || speed > 4) {
      speed = 1.0;
      uiElements.speedSelect.value = "1.0";
      toast('倍速无效, 已重置为1.0x (范围0.5-4.0)');
  }

  const configToSave = {
    apiProvider: uiElements.providerSelect.value,
    apiKey: uiElements.apiKeyInput.value.trim(),
    language: uiElements.langSelect.value,
    audioDeviceId: uiElements.micSelect.value,
    enable_itn: uiElements.itnCheckbox.checked,
    autoCopy: uiElements.autoCopyCheckbox.checked,
    removeTrailingPeriod: uiElements.removePeriodCheckbox.checked,
    context: uiElements.ctxInput.value,
    transcribeSpeed: speed,
  };
  
  currentConfig = { ...currentConfig, ...configToSave };

  chrome.storage.sync.set({ transcribe_config: configToSave }, () => {
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
    const requestPermission = async () => {
        try {
            micSelect.innerHTML = `<option value="default">正在请求...</option>`;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            await listMicrophones();
        } catch (err) {
            console.error('getUserMedia failed:', err.name, err.message);
            toast(`授权失败: ${err.message}`);
            micSelect.innerHTML = `<option value="error" disabled>授权失败</option>`;
        }
    };

    const guideToRequest = (message) => {
        micSelect.innerHTML = `<option value="error" disabled>${message}</option>`;
        micSelect.removeEventListener('click', requestPermission);
        micSelect.addEventListener('click', requestPermission, { once: true });
    };

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            micSelect.innerHTML = '<option value="error" disabled>不支持设备选择</option>';
            return;
        }

        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });

        if (permissionStatus.state !== 'granted') {
            guideToRequest('需要权限(点击授权)');
            return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = devices.filter(d => d.kind === 'audioinput');

        if (audioInputDevices.length === 0) {
            micSelect.innerHTML = '<option value="error" disabled>未找到麦克风</option>';
            return;
        }

        if (!audioInputDevices.some(d => d.label)) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                // Recurse to repopulate after gaining label access
                return listMicrophones(); 
            } catch (e) {
                guideToRequest('需要权限(点击授权)');
                return;
            }
        }

        const currentValue = micSelect.value || currentConfig.audioDeviceId;
        micSelect.innerHTML = '<option value="default">默认设备</option>';

        audioInputDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `麦克风 ${micSelect.options.length}`;
            micSelect.appendChild(option);
        });

        if ([...micSelect.options].some(o => o.value === currentValue)) {
            micSelect.value = currentValue;
        } else {
            micSelect.value = 'default';
        }
    } catch (err) {
        console.error('Error listing microphones:', err.name, err.message);
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
            guideToRequest('需要权限(点击授权)');
        } else {
            micSelect.innerHTML = `<option value="error" disabled>错误: ${err.name || '未知'}</option>`;
        }
    }
}