import { loadConfig } from './popup-config.js';
import { elements } from './popup-dom.js';
import {
  updateUIFromConfig,
  toggleProviderSpecificRows,
  listMicrophones,
  setupHotkeyInput,
  initModals,
  setStatusMessage,
} from './popup-ui.js';

function getConfigFromUI() {
  const {
    providerSelect, apiKeyInput, langSelect, micSelect, dashscopeModelSelect,
    itnCheckbox, streamingCheckbox, autoCopyCheckbox, removePeriodCheckbox,
    ctxInput, openaiProcessingCheckbox, openaiBaseUrlInput, openaiApiKeyInput,
    openaiModelIdInput, openaiSystemPromptTextarea, consoleControlCheckbox,
    consoleBaseUrlInput, consoleApiKeyInput, consoleModelIdInput,
    consoleSystemPromptTextarea, buttonModeSelect, scaleSelect, speedSlider,
    hotkeyInput, cancelHotkeyInput,
  } = elements;

  const buttonMode = buttonModeSelect.value;
  let clickToToggle;
  let hideOnNoFocus;
  switch (buttonMode) {
    case 'always':
      clickToToggle = true;
      hideOnNoFocus = false;
      break;
    case 'auto':
      clickToToggle = true;
      hideOnNoFocus = true;
      break;
    case 'hidden':
    default:
      clickToToggle = false;
      hideOnNoFocus = false;
      break;
  }

  return {
    apiProvider: providerSelect.value,
    apiKey: apiKeyInput.value.trim(),
    language: langSelect.value,
    audioDeviceId: micSelect.value,
    dashscopeModelId: dashscopeModelSelect.value,
    enable_itn: itnCheckbox.checked,
    enableStreaming: streamingCheckbox.checked,
    autoCopy: autoCopyCheckbox.checked,
    removeTrailingPeriod: removePeriodCheckbox.checked,
    context: ctxInput.value,
    enableOpenaiProcessing: openaiProcessingCheckbox.checked,
    openaiBaseUrl: openaiBaseUrlInput.value.trim(),
    openaiApiKey: openaiApiKeyInput.value.trim(),
    openaiModelId: openaiModelIdInput.value.trim(),
    openaiSystemPrompt: openaiSystemPromptTextarea.value.trim(),
    enableConsoleControl: consoleControlCheckbox.checked,
    consoleBaseUrl: consoleBaseUrlInput.value.trim(),
    consoleApiKey: consoleApiKeyInput.value.trim(),
    consoleModelId: consoleModelIdInput.value.trim(),
    consoleSystemPrompt: consoleSystemPromptTextarea.value.trim(),
    insertMode: 'replaceSelection',
    clickToToggle: clickToToggle,
    hideOnNoFocus: hideOnNoFocus,
    uiScale: Number(scaleSelect.value) || 1,
    transcribeSpeed: Number(speedSlider.value) || 1,
    hotkey: hotkeyInput.value.trim(),
    cancelHotkey: cancelHotkeyInput.value.trim()
  };
}

function saveConfig() {
  const configToSave = getConfigFromUI();
  chrome.storage.sync.set({ pagetalk_config: configToSave }, () => {
    if (chrome.runtime.lastError) {
      setStatusMessage('保存失败！', true, elements);
      console.error("Error saving config:", chrome.runtime.lastError);
    } else {
      setStatusMessage('已保存！', false, elements);
    }
  });
}

async function loadAndApplyConfig() {
    try {
        const config = await loadConfig();
        updateUIFromConfig(config, elements);
    } catch(e) {
        setStatusMessage('加载配置失败！', true, elements);
    }
}


function initEventListeners() {
    const {
        providerSelect, apiKeyInput, dashscopeModelSelect, langSelect, micSelect,
        itnCheckbox, streamingCheckbox, autoCopyCheckbox, removePeriodCheckbox,
        ctxInput, buttonModeSelect, scaleSelect, speedSlider, speedValue, hotkeyInput,
        cancelHotkeyInput, openaiProcessingCheckbox, consoleControlCheckbox,
        transcribeLink, versionEl
    } = elements;

    const inputsForSave = [
        providerSelect, apiKeyInput, dashscopeModelSelect, langSelect, micSelect,
        itnCheckbox, streamingCheckbox, autoCopyCheckbox, removePeriodCheckbox,
        ctxInput, buttonModeSelect, scaleSelect, speedSlider, hotkeyInput,
        cancelHotkeyInput, openaiProcessingCheckbox, consoleControlCheckbox
    ];

    inputsForSave.forEach(input => {
        input.addEventListener('change', saveConfig);
    });

    openaiProcessingCheckbox.addEventListener('change', () => {
        if (openaiProcessingCheckbox.checked) {
            consoleControlCheckbox.checked = false;
        }
    });

    consoleControlCheckbox.addEventListener('change', () => {
        if (consoleControlCheckbox.checked) {
            openaiProcessingCheckbox.checked = false;
        }
    });

    speedSlider.addEventListener('input', () => {
        if (speedValue) {
            speedValue.textContent = `${Number(speedSlider.value).toFixed(2)}x`;
        }
    });

    providerSelect.addEventListener('change', () => toggleProviderSpecificRows(elements));
    navigator.mediaDevices?.addEventListener?.('devicechange', () => listMicrophones(elements));

    setupHotkeyInput(hotkeyInput, saveConfig);
    setupHotkeyInput(cancelHotkeyInput, saveConfig);
    
    initModals(elements, saveConfig, loadAndApplyConfig);

    if (transcribeLink) {
        transcribeLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'transcribe.html' });
            window.close();
        });
    }

    if (versionEl) {
        const manifest = chrome.runtime.getManifest();
        versionEl.textContent = `版本: ${manifest.version}`;
    }

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if(elements.ctxModal.style.display !== 'none') {
                elements.ctxModal.style.display = 'none';
            }
            if(elements.openaiModal.style.display !== 'none') {
                elements.openaiModal.style.display = 'none';
            }
            if(elements.consoleModal.style.display !== 'none') {
                elements.consoleModal.style.display = 'none';
            }
        }
    });
}

async function fetchAndDisplayGitHubStars() {
    const starCountEl = document.getElementById('github-stars-popup');
    if (!starCountEl) return;

    try {
        const response = await fetch('https://api.github.com/repos/yeahhe365/PageTalk');
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }
        const data = await response.json();
        const stars = data.stargazers_count;

        if (stars !== undefined) {
            const formattedStars = stars > 999 ? `${(stars / 1000).toFixed(1)}k` : stars;
            starCountEl.textContent = formattedStars;
            starCountEl.classList.add('loaded');
        }
    } catch (error) {
        console.error('PageTalk: Could not fetch GitHub stars:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadAndApplyConfig();
    await listMicrophones(elements);
    initEventListeners();
    fetchAndDisplayGitHubStars();
});