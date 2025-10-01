'use strict';

const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FREE_API_ENDPOINT = 'https://c0rpr74ughd0-deploy.space.z.ai/api/asr-inference';

const defaultConfig = {
  apiProvider: 'free',
  apiKey: '',
  language: 'auto',
  dashscopeModelId: 'qwen3-asr-flash',
  enable_itn: false,
  context: '',
  hotkey: 'Ctrl+/',
  cancelHotkey: 'Ctrl+.',
  insertMode: 'replaceSelection',
  uiScale: 1,
  transcribeSpeed: 1,
  clickToToggle: true,
  audioDeviceId: 'default',
  autoCopy: true,
  removeTrailingPeriod: false,
  enableStreaming: false,
  hideOnNoFocus: false,
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

// This will be populated by loadConfig
let cfg = { ...defaultConfig };
let isRecording = false;

const state = {
  apiProvider: cfg.apiProvider,
  apiKey: cfg.apiKey,
  language: cfg.language,
  dashscopeModelId: cfg.dashscopeModelId,
  enable_itn: cfg.enable_itn,
  context: cfg.context,
  insertMode: cfg.insertMode,
  clickToToggle: cfg.clickToToggle,
  audioDeviceId: cfg.audioDeviceId,
  autoCopy: cfg.autoCopy,
  uiScale: cfg.uiScale,
  transcribeSpeed: cfg.transcribeSpeed,
  removeTrailingPeriod: cfg.removeTrailingPeriod,
  enableStreaming: cfg.enableStreaming,
  hideOnNoFocus: cfg.hideOnNoFocus,
  enableOpenaiProcessing: cfg.enableOpenaiProcessing,
  openaiBaseUrl: cfg.openaiBaseUrl,
  openaiApiKey: cfg.openaiApiKey,
  openaiModelId: cfg.openaiModelId,
  openaiSystemPrompt: cfg.openaiSystemPrompt,
  enableConsoleControl: cfg.enableConsoleControl,
  consoleBaseUrl: cfg.consoleBaseUrl,
  consoleApiKey: cfg.consoleApiKey,
  consoleModelId: cfg.consoleModelId,
  consoleSystemPrompt: cfg.consoleSystemPrompt,
};


async function loadConfigFromStorage() {
  try {
    const result = await chrome.storage.sync.get('pagetalk_config');
    return { ...defaultConfig, ...(result.pagetalk_config || {}) };
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
    state.dashscopeModelId = newConfig.dashscopeModelId;
    state.enable_itn = newConfig.enable_itn;
    state.context = newConfig.context;
    state.insertMode = newConfig.insertMode;
    state.clickToToggle = newConfig.clickToToggle;
    state.audioDeviceId = newConfig.audioDeviceId;
    state.autoCopy = newConfig.autoCopy;
    state.removeTrailingPeriod = newConfig.removeTrailingPeriod;
    state.transcribeSpeed = newConfig.transcribeSpeed;
    state.enableStreaming = newConfig.enableStreaming;
    state.hideOnNoFocus = newConfig.hideOnNoFocus;
    state.enableOpenaiProcessing = newConfig.enableOpenaiProcessing;
    state.openaiBaseUrl = newConfig.openaiBaseUrl;
    state.openaiApiKey = newConfig.openaiApiKey;
    state.openaiModelId = newConfig.openaiModelId;
    state.openaiSystemPrompt = newConfig.openaiSystemPrompt;
    state.enableConsoleControl = newConfig.enableConsoleControl;
    state.consoleBaseUrl = newConfig.consoleBaseUrl;
    state.consoleApiKey = newConfig.consoleApiKey;
    state.consoleModelId = newConfig.consoleModelId;
    state.consoleSystemPrompt = newConfig.consoleSystemPrompt;

    // This function must be defined in cs-ui.js but called from here
    if (typeof updateUIAfterConfigChange === 'function') {
      updateUIAfterConfigChange(newConfig);
    }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.pagetalk_config) {
    const newConfig = { ...defaultConfig, ...changes.pagetalk_config.newValue };
    handleConfigChange(newConfig);
  }
});