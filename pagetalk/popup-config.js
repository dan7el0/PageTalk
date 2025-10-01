export const defaultConfig = {
  apiProvider: 'free',
  apiKey: '',
  language: 'auto',
  audioDeviceId: 'default',
  dashscopeModelId: 'qwen3-asr-flash',
  enable_itn: false,
  context: '',
  hotkey: 'Ctrl+/',
  cancelHotkey: 'Ctrl+.',
  insertMode: 'replaceSelection',
  uiScale: 1,
  transcribeSpeed: 1,
  clickToToggle: true,
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

export async function loadConfig() {
  const result = await chrome.storage.sync.get('pagetalk_config');
  return { ...defaultConfig, ...(result.pagetalk_config || {}) };
}
