'use strict';

const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FREE_API_ENDPOINT = 'https://c0rpr74ughd0-deploy.space.z.ai/api/asr-inference';

const defaultConfig = {
  apiProvider: 'free',
  apiKey: '',
  language: 'auto',
  enable_itn: false,
  context: '',
  hotkey: 'Ctrl+/',
  cancelHotkey: 'Ctrl+.',
  insertMode: 'replaceSelection',
  uiScale: 1,
  clickToToggle: true,
  audioDeviceId: 'default',
  autoCopy: true,
};

// This will be populated by loadConfig
let cfg = { ...defaultConfig };

const state = {
  apiProvider: cfg.apiProvider,
  apiKey: cfg.apiKey,
  language: cfg.language,
  enable_itn: cfg.enable_itn,
  context: cfg.context,
  insertMode: cfg.insertMode,
  clickToToggle: cfg.clickToToggle,
  audioDeviceId: cfg.audioDeviceId,
  autoCopy: cfg.autoCopy,
  uiScale: cfg.uiScale,
};


async function loadConfigFromStorage() {
  try {
    const result = await chrome.storage.sync.get('voiceui_config');
    return { ...defaultConfig, ...(result.voiceui_config || {}) };
  } catch (e) {
    console.error("Error loading config from chrome.storage:", e);
    return defaultConfig;
  }
}

function handleConfigChange(newConfig) {
    cfg = newConfig; // Update global cfg for hotkey

    state.apiProvider = newConfig.apiProvider;
    state.apiKey = newConfig.apiKey;
    state.language = newConfig.language;
    state.enable_itn = newConfig.enable_itn;
    state.context = newConfig.context;
    state.insertMode = newConfig.insertMode;
    state.clickToToggle = newConfig.clickToToggle;
    state.audioDeviceId = newConfig.audioDeviceId;
    state.autoCopy = newConfig.autoCopy;

    // This function must be defined in cs-ui.js but called from here
    if (typeof updateUIAfterConfigChange === 'function') {
      updateUIAfterConfigChange(newConfig);
    }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.voiceui_config) {
    const newConfig = { ...defaultConfig, ...changes.voiceui_config.newValue };
    handleConfigChange(newConfig);
  }
});