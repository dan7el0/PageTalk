document.addEventListener('DOMContentLoaded', () => {
  const defaultConfig = {
    apiProvider: 'free',
    apiKey: '',
    language: 'auto',
    audioDeviceId: 'default',
    enable_itn: false,
    context: '',
    hotkey: 'Ctrl+/',
    cancelHotkey: 'Ctrl+.',
    insertMode: 'replaceSelection',
    uiScale: 1,
    clickToToggle: true,
    autoCopy: true,
  };

  const providerSelect = document.getElementById('voiceui-provider');
  const apiKeyInput = document.getElementById('voiceui-apikey');
  const apiKeyRow = apiKeyInput.closest('.voiceui-row');
  const langSelect = document.getElementById('voiceui-lang');
  const micSelect = document.getElementById('voiceui-mic');
  const itnCheckbox = document.getElementById('voiceui-itn');
  const autoCopyCheckbox = document.getElementById('voiceui-autocopy');
  const ctxInput = document.getElementById('voiceui-ctx');
  const clickSelect = document.getElementById('voiceui-click');
  const scaleSelect = document.getElementById('voiceui-scale');
  const hotkeyInput = document.getElementById('voiceui-hotkey');
  const cancelHotkeyInput = document.getElementById('voiceui-cancel-hotkey');
  const statusEl = document.getElementById('status');
  const versionEl = document.querySelector('.voiceui-version');

  // Dynamically set version
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = `版本: ${manifest.version}`;
  }

  function toggleApiKeyVisibility() {
    if (providerSelect.value === 'free') {
      apiKeyRow.style.display = 'none';
    } else {
      apiKeyRow.style.display = 'flex';
    }
  }

  function listMicrophones() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      micSelect.innerHTML = '<option value="error" disabled>不支持设备选择</option>';
      return;
    }

    // Temporarily request stream to get permission and device labels
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        // We don't need the stream, just the permission. Stop tracks immediately.
        stream.getTracks().forEach(track => track.stop());

        return navigator.mediaDevices.enumerateDevices();
      })
      .then(devices => {
        const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
        const currentValue = micSelect.value;
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
      })
      .catch(err => {
        console.error("Error listing microphones:", err);
        const errorMsg = err.name === 'NotAllowedError' ? '需要麦克风权限' : '无法获取麦克风';
        micSelect.innerHTML = `<option value="error" disabled>${errorMsg}</option>`;
      });
  }

  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get('voiceui_config');
      const config = { ...defaultConfig, ...(result.voiceui_config || {}) };

      providerSelect.value = config.apiProvider;
      apiKeyInput.value = config.apiKey;
      langSelect.value = config.language;
      micSelect.value = config.audioDeviceId;
      itnCheckbox.checked = config.enable_itn;
      autoCopyCheckbox.checked = config.autoCopy;
      ctxInput.value = config.context;
      clickSelect.value = String(config.clickToToggle);
      scaleSelect.value = String(config.uiScale);
      hotkeyInput.value = config.hotkey;
      cancelHotkeyInput.value = config.cancelHotkey;

      toggleApiKeyVisibility();
    } catch (e) {
      console.error("Error loading config:", e);
      statusEl.textContent = '加载配置失败！';
    }
  }

  function saveConfig() {
    const configToSave = {
      apiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      language: langSelect.value,
      audioDeviceId: micSelect.value,
      enable_itn: itnCheckbox.checked,
      autoCopy: autoCopyCheckbox.checked,
      context: ctxInput.value,
      insertMode: 'replaceSelection',
      clickToToggle: clickSelect.value === 'true',
      uiScale: Number(scaleSelect.value) || 1,
      hotkey: hotkeyInput.value.trim(),
      cancelHotkey: cancelHotkeyInput.value.trim()
    };

    chrome.storage.sync.set({ voiceui_config: configToSave }, () => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = '保存失败！';
        statusEl.style.color = '#ef4444';
        console.error("Error saving config:", chrome.runtime.lastError);
      } else {
        statusEl.textContent = '已保存！';
        statusEl.style.color = '#22c55e';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 2000);
      }
    });
  }

  function setupHotkeyInput(inputElement) {
    let originalHotkey = '';
    inputElement.addEventListener('focus', (e) => {
        originalHotkey = e.target.value;
        e.target.value = '';
        e.target.placeholder = '请按下快捷键组合...';
    });

    inputElement.addEventListener('blur', (e) => {
        if (!e.target.value) {
            e.target.value = originalHotkey;
        }
        e.target.placeholder = '';
    });

    inputElement.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        // metaKey is not supported by the content script hotkey checker.

        const key = e.key;
        const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(key);

        if (isModifier) {
            // Show currently held down modifiers for user feedback.
            inputElement.value = parts.join('+') + (parts.length > 0 ? '+' : '');
            return;
        }

        let displayKey;
        switch (key) {
            case ' ':
                displayKey = 'Space';
                break;
            default:
                if (key.length === 1 && /[a-zA-Z]/.test(key)) {
                    displayKey = key.toUpperCase();
                } else {
                    displayKey = key;
                }
                break;
        }
        
        parts.push(displayKey);
        inputElement.value = parts.join('+');
        saveConfig();
    });
  }
  
  loadConfig();
  listMicrophones();
  
  [providerSelect, apiKeyInput, langSelect, micSelect, itnCheckbox, autoCopyCheckbox, ctxInput, clickSelect, scaleSelect, hotkeyInput, cancelHotkeyInput].forEach(input => {
    input.addEventListener('change', saveConfig);
  });

  providerSelect.addEventListener('change', toggleApiKeyVisibility);

  setupHotkeyInput(hotkeyInput);
  setupHotkeyInput(cancelHotkeyInput);
});