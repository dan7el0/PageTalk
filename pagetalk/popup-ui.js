export function setStatusMessage(message, isError, elements) {
    const { statusEl } = elements;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ef4444' : '#22c55e';
    if (!isError) {
        setTimeout(() => {
            statusEl.textContent = '';
        }, 2000);
    }
}

export function updateUIFromConfig(config, elements) {
    const {
        providerSelect, apiKeyInput, dashscopeModelSelect, langSelect, micSelect,
        itnCheckbox, streamingCheckbox, autoCopyCheckbox, removePeriodCheckbox,
        ctxInput, openaiProcessingCheckbox, openaiBaseUrlInput, openaiApiKeyInput,
        openaiModelIdInput, openaiSystemPromptTextarea, consoleControlCheckbox,
        consoleBaseUrlInput, consoleApiKeyInput, consoleModelIdInput,
        consoleSystemPromptTextarea, buttonModeSelect, scaleSelect, speedSlider,
        speedValue, hotkeyInput, cancelHotkeyInput
    } = elements;

    providerSelect.value = config.apiProvider;
    apiKeyInput.value = config.apiKey;
    dashscopeModelSelect.value = config.dashscopeModelId;
    langSelect.value = config.language;
    micSelect.value = config.audioDeviceId;
    itnCheckbox.checked = config.enable_itn;
    streamingCheckbox.checked = config.enableStreaming;
    autoCopyCheckbox.checked = config.autoCopy;
    removePeriodCheckbox.checked = config.removeTrailingPeriod;
    ctxInput.value = config.context;
    
    openaiProcessingCheckbox.checked = config.enableOpenaiProcessing;
    openaiBaseUrlInput.value = config.openaiBaseUrl;
    openaiApiKeyInput.value = config.openaiApiKey;
    openaiModelIdInput.value = config.openaiModelId;
    openaiSystemPromptTextarea.value = config.openaiSystemPrompt;

    consoleControlCheckbox.checked = config.enableConsoleControl;
    consoleBaseUrlInput.value = config.consoleBaseUrl;
    consoleApiKeyInput.value = config.consoleApiKey;
    consoleModelIdInput.value = config.consoleModelId;
    consoleSystemPromptTextarea.value = config.consoleSystemPrompt;

    if (!config.clickToToggle) {
        buttonModeSelect.value = 'hidden';
    } else if (config.hideOnNoFocus) {
        buttonModeSelect.value = 'auto';
    } else {
        buttonModeSelect.value = 'always';
    }
    
    scaleSelect.value = String(config.uiScale);
    speedSlider.value = String(config.transcribeSpeed);
    if (speedValue) {
        speedValue.textContent = `${Number(config.transcribeSpeed).toFixed(2)}x`;
    }
    hotkeyInput.value = config.hotkey;
    cancelHotkeyInput.value = config.cancelHotkey;

    toggleProviderSpecificRows(elements);
}

export function toggleProviderSpecificRows(elements) {
    const { providerSelect, apiKeyRow, apiKeyLinksRow, dashscopeModelRow, streamingRow, streamingCheckbox } = elements;
    const isDashScope = providerSelect.value === 'dashscope';
    apiKeyRow.style.display = isDashScope ? 'flex' : 'none';
    apiKeyLinksRow.style.display = isDashScope ? 'flex' : 'none';
    dashscopeModelRow.style.display = isDashScope ? 'flex' : 'none';
    streamingRow.style.display = isDashScope ? 'flex' : 'none';
    if (!isDashScope && streamingCheckbox.checked) {
      streamingCheckbox.checked = false;
      // The change event listener will trigger a save
    }
}

export async function listMicrophones(elements) {
    const { micSelect } = elements;

    // A helper function to populate the dropdown once permission is available.
    const populateDeviceList = async () => {
        try {
            const config = await chrome.storage.sync.get('pagetalk_config');
            const currentDeviceId = config.pagetalk_config?.audioDeviceId || 'default';
            
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
                // Labels are available now since we have permission.
                option.textContent = device.label || `麦克风 ${micSelect.options.length}`;
                micSelect.appendChild(option);
            });

            // Restore selection
            if ([...micSelect.options].some(o => o.value === currentDeviceId)) {
                micSelect.value = currentDeviceId;
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
            // Guide user to click to grant permission
            micSelect.innerHTML = `<option value="prompt">点击授权麦克风</option>`;
            micSelect.onclick = async () => {
                try {
                    // Temporarily disable the handler to prevent loops
                    micSelect.onclick = null;
                    micSelect.innerHTML = `<option value="default">正在授权...</option>`;
                    // Request permission. This will show the browser's permission prompt.
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // Immediately stop the tracks as we only needed the permission grant.
                    stream.getTracks().forEach(track => track.stop());
                    // Now that we have permission, repopulate the list.
                    await populateDeviceList();
                } catch (err) {
                    console.error('getUserMedia in popup failed:', err);
                    micSelect.innerHTML = `<option value="error" disabled>授权失败</option>`;
                    // Restore the click handler in case they want to try again
                    setTimeout(() => listMicrophones(elements), 100);
                }
            };
        } else { // 'denied'
             micSelect.innerHTML = `<option value="error" disabled>权限已拒绝</option>`;
        }
    } catch (err) {
        console.error('Error listing microphones:', err);
        micSelect.innerHTML = `<option value="error" disabled>加载设备失败</option>`;
    }
}

export function setupHotkeyInput(inputElement, saveCallback) {
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

        const key = e.key;
        const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(key);

        if (isModifier) {
            inputElement.value = parts.join('+') + (parts.length > 0 ? '+' : '');
            return;
        }

        let displayKey;
        if (key === ' ') {
            displayKey = 'Space';
        } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            displayKey = key.toUpperCase();
        } else {
            displayKey = key;
        }
        
        parts.push(displayKey);
        inputElement.value = parts.join('+');
        saveCallback();
    });
}

export function initModals(elements, saveCallback, loadAndApplyConfig) {
    const {
        ctxExpandBtn, ctxModal, ctxTextarea, ctxInput, ctxSaveBtn, ctxCancelBtn,
        openaiConfigBtn, openaiModal, openaiSaveBtn, openaiCancelBtn,
        consoleConfigBtn, consoleModal, consoleSaveBtn, consoleCancelBtn,
        fetchModelsBtn, openaiBaseUrlInput, openaiApiKeyInput, modelsDatalist,
        fetchConsoleModelsBtn, consoleBaseUrlInput, consoleApiKeyInput, consoleModelsDatalist
    } = elements;

    // Context Modal
    ctxExpandBtn.addEventListener('click', () => {
      ctxTextarea.value = ctxInput.value;
      ctxModal.style.display = 'flex';
      ctxTextarea.focus();
    });
    ctxCancelBtn.addEventListener('click', () => {
      ctxModal.style.display = 'none';
    });
    ctxSaveBtn.addEventListener('click', () => {
      ctxInput.value = ctxTextarea.value;
      saveCallback();
      ctxModal.style.display = 'none';
    });

    // OpenAI Modal
    openaiConfigBtn.addEventListener('click', () => {
      loadAndApplyConfig();
      openaiModal.style.display = 'flex';
    });
    openaiCancelBtn.addEventListener('click', () => {
      openaiModal.style.display = 'none';
      loadAndApplyConfig();
    });
    openaiSaveBtn.addEventListener('click', () => {
      saveCallback();
      openaiModal.style.display = 'none';
    });

    // Console Modal
    consoleConfigBtn.addEventListener('click', () => {
      loadAndApplyConfig();
      consoleModal.style.display = 'flex';
    });
    consoleCancelBtn.addEventListener('click', () => {
      consoleModal.style.display = 'none';
      loadAndApplyConfig();
    });
    consoleSaveBtn.addEventListener('click', () => {
      saveCallback();
      consoleModal.style.display = 'none';
    });

    // Fetch Models Logic
    const setupFetchModels = (button, baseUrlInput, apiKeyInput, datalist) => {
        if (!button) return;
        button.addEventListener('click', async () => {
            const baseUrl = baseUrlInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            if (!baseUrl || !apiKey) {
                alert('Please enter both Base URL and API Key before fetching models.');
                return;
            }

            const fetchIcon = button.querySelector('.icon-fetch');
            const spinnerIcon = button.querySelector('.icon-spinner');
            fetchIcon.style.display = 'none';
            spinnerIcon.style.display = 'block';
            button.disabled = true;

            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'listOpenAIModels',
                    payload: { baseUrl, apiKey }
                });
                if (response.success) {
                    const models = response.data?.data || [];
                    datalist.innerHTML = '';
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        datalist.appendChild(option);
                    });
                } else {
                    throw new Error(response.error || 'Failed to fetch models.');
                }
            } catch (error) {
                console.error('Error fetching models:', error);
                alert(`Could not fetch models: ${error.message}`);
            } finally {
                fetchIcon.style.display = 'block';
                spinnerIcon.style.display = 'none';
                button.disabled = false;
            }
        });
    };

    setupFetchModels(fetchModelsBtn, openaiBaseUrlInput, openaiApiKeyInput, modelsDatalist);
    setupFetchModels(fetchConsoleModelsBtn, consoleBaseUrlInput, consoleApiKeyInput, consoleModelsDatalist);
}