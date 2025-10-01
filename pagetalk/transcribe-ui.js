// This module centralizes all DOM element selections and UI-related functions.

function query(selector) { return document.querySelector(selector); }
function queryId(id) { return document.getElementById(id); }

export const uiElements = {}; // Initially empty

export function initUIElements() {
  Object.assign(uiElements, {
    // Main panel and states
    mainPanel: query('.voiceui-panel-main'),
    transcribeArea: queryId('transcribe-area'),
    idleView: query('.voiceui-idle-view'),
    loadingTimer: query('.voiceui-loading-timer'),
    loadingFilename: query('.voiceui-loading-filename'),
    errorMessageEl: query('.voiceui-panel-error-message'),
    
    // Result elements
    resultText: queryId('result-text'),
    copyBtn: queryId('copy-btn'),
    retryBtn: queryId('retry-btn'),
    transcribeAnotherBtn: queryId('transcribe-another-btn'),
    
    // History elements
    historyView: query('.voiceui-history-view'),
    historyList: queryId('history-list'),
    clearHistoryBtn: queryId('clear-history-btn'),
    historyEmpty: queryId('history-empty'),

    // File input
    fileInput: queryId('file-input'),
    uploadLinkBtn: queryId('upload-link-btn'),
    
    // Settings elements
    settingsDetails: query('.voiceui-settings-details'),
    providerSelect: queryId('voiceui-provider'),
    apiKeyInput: queryId('voiceui-apikey'),
    apiKeyRow: queryId('api-key-row'),
    dashscopeModelSelect: queryId('voiceui-dashscope-model'),
    dashscopeModelRow: queryId('dashscope-model-row'),
    langSelect: queryId('voiceui-lang'),
    micSelect: queryId('voiceui-mic'),
    itnCheckbox: queryId('voiceui-itn'),
    streamingCheckbox: queryId('voiceui-streaming'),
    streamingRow: queryId('voiceui-streaming-row'),
    autoCopyCheckbox: queryId('voiceui-autocopy'),
    removePeriodCheckbox: queryId('voiceui-remove-period'),
    ctxInput: queryId('voiceui-ctx'),
    speedSlider: queryId('voiceui-speed'),
    speedValue: queryId('voiceui-speed-value'),

    // Modal elements
    ctxExpandBtn: queryId('voiceui-ctx-expand'),
    ctxModal: queryId('voiceui-ctx-modal'),
    ctxTextarea: queryId('voiceui-ctx-textarea'),
    ctxSaveBtn: queryId('voiceui-ctx-save'),
    ctxCancelBtn: queryId('voiceui-ctx-cancel'),
    
    openaiProcessingCheckbox: queryId('voiceui-openai-processing'),
    openaiConfigBtn: queryId('voiceui-openai-config-btn'),
    openaiModal: queryId('voiceui-openai-modal'),
    openaiBaseUrlInput: queryId('voiceui-openai-baseurl'),
    openaiApiKeyInput: queryId('voiceui-openai-apikey'),
    openaiModelIdInput: queryId('voiceui-openai-modelid'),
    openaiSystemPromptTextarea: queryId('voiceui-openai-systemprompt'),
    openaiSaveBtn: queryId('voiceui-openai-save'),
    openaiCancelBtn: queryId('voiceui-openai-cancel'),
    fetchModelsBtn: queryId('voiceui-fetch-models-btn'),
    modelsDatalist: queryId('voiceui-openai-models-list'),

    consoleControlCheckbox: queryId('voiceui-console-control'),
    consoleConfigBtn: queryId('voiceui-console-config-btn'),
    consoleModal: queryId('voiceui-console-modal'),
    consoleBaseUrlInput: queryId('voiceui-console-baseurl'),
    consoleApiKeyInput: queryId('voiceui-console-apikey'),
    consoleModelIdInput: queryId('voiceui-console-modelid'),
    consoleSystemPromptTextarea: queryId('voiceui-console-systemprompt'),
    consoleSaveBtn: queryId('voiceui-console-save'),
    consoleCancelBtn: queryId('voiceui-console-cancel'),
    fetchConsoleModelsBtn: queryId('voiceui-fetch-console-models-btn'),
    consoleModelsDatalist: queryId('voiceui-console-models-list'),

    toastContainer: queryId('toast-container'),

    // Recorder elements
    recordBtn: queryId('record-btn'),
    transcribeNowBtn: queryId('transcribe-now-btn'),
    cancelRecordBtn: queryId('cancel-record-btn'),
    recorderTimer: query('.voiceui-recorder-timer'),
    recorderCanvas: queryId('recorder-canvas'),
    get recorderCanvasCtx() { return this.recorderCanvas.getContext('2d'); },

    // Preview elements
    playerFilename: queryId('player-filename'),
    playerTimedisplay: queryId('player-timedisplay'),
    playPauseBtn: queryId('play-pause-btn'),
    playIcon: queryId('play-icon'),
    pauseIcon: queryId('pause-icon'),
    volumeBtn: queryId('volume-btn'),
    volumeOnIcon: queryId('volume-on-icon'),
    volumeOffIcon: queryId('volume-off-icon'),
    speedBtn: queryId('speed-btn'),
    rewindBtn: queryId('rewind-btn'),
    forwardBtn: queryId('forward-btn'),
    loopBtn: queryId('loop-btn'),
    downloadBtn: queryId('download-btn'),
    previewCanvas: queryId('preview-canvas'),
    get previewCanvasCtx() { return this.previewCanvas.getContext('2d'); },
    playhead: queryId('playhead'),
    waveformContainer: queryId('preview-waveform-container'),
    previewCancelBtn: queryId('preview-cancel-btn'),
    previewTranscribeBtn: queryId('preview-transcribe-btn'),
    previewStartNewRecordingBtn: queryId('preview-start-new-recording-btn'),
  });
}

export function setUIState(state) {
  if (uiElements.mainPanel) {
    uiElements.mainPanel.dataset.state = state;
    if (state === 'idle') {
        uiElements.fileInput.value = '';
        uiElements.resultText.readOnly = true;
        uiElements.resultText.value = '';
    } else if (state === 'result' || state === 'history-result') {
      uiElements.resultText.readOnly = false;
      uiElements.resultText.focus();
    }
  }
}

export function toast(msg) {
  if (!uiElements.toastContainer) return;
  const n = document.createElement('div');
  n.className = 'toast-message';
  n.innerHTML = String(msg).replace(/\n/g, '<br>');
  uiElements.toastContainer.appendChild(n);
  setTimeout(() => n.remove(), 5000);
}

export function initModal(onSave, loadConfig) {
  const { ctxModal, ctxExpandBtn, ctxTextarea, ctxInput, ctxSaveBtn, ctxCancelBtn,
          openaiModal, openaiConfigBtn, openaiSaveBtn, openaiCancelBtn,
          fetchModelsBtn, modelsDatalist, openaiBaseUrlInput, openaiApiKeyInput,
          consoleModal, consoleConfigBtn, consoleSaveBtn, consoleCancelBtn,
          fetchConsoleModelsBtn, consoleModelsDatalist, consoleBaseUrlInput, consoleApiKeyInput } = uiElements;

  // CTX Modal
  ctxExpandBtn.addEventListener('click', () => {
    ctxTextarea.value = ctxInput.value;
    ctxModal.style.display = 'flex';
    ctxTextarea.focus();
  });

  const closeCtxModal = () => ctxModal.style.display = 'none';

  ctxCancelBtn.addEventListener('click', closeCtxModal);
  ctxModal.addEventListener('click', e => { if (e.target === ctxModal) closeCtxModal(); });

  ctxSaveBtn.addEventListener('click', () => {
    ctxInput.value = ctxTextarea.value;
    onSave();
    closeCtxModal();
  });

  // OpenAI Modal
  openaiConfigBtn.addEventListener('click', () => {
      loadConfig(); // Ensure modal shows saved values
      openaiModal.style.display = 'flex';
  });

  const closeOpenAIModal = () => openaiModal.style.display = 'none';

  openaiCancelBtn.addEventListener('click', () => {
      closeOpenAIModal();
      loadConfig(); // Revert any unsaved changes in the modal
  });
  
  openaiModal.addEventListener('click', e => { 
      if (e.target === openaiModal) {
          closeOpenAIModal();
          loadConfig();
      }
  });

  openaiSaveBtn.addEventListener('click', () => {
      onSave();
      closeOpenAIModal();
  });

  // Console Modal
  consoleConfigBtn.addEventListener('click', () => {
      loadConfig(); // Ensure modal shows saved values
      consoleModal.style.display = 'flex';
  });

  const closeConsoleModal = () => consoleModal.style.display = 'none';

  consoleCancelBtn.addEventListener('click', () => {
      closeConsoleModal();
      loadConfig(); // Revert any unsaved changes in the modal
  });
  
  consoleModal.addEventListener('click', e => { 
      if (e.target === consoleModal) {
          closeConsoleModal();
          loadConfig();
      }
  });

  consoleSaveBtn.addEventListener('click', () => {
      onSave();
      closeConsoleModal();
  });


  // Fetch Models Logic (shared function)
  const setupFetchModels = (button, baseUrlInput, apiKeyInput, datalist) => {
    if (!button) return;
    button.addEventListener('click', async () => {
      const baseUrl = baseUrlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();
      
      if (!baseUrl || !apiKey) {
        toast('Please enter Base URL and API Key first.');
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
          datalist.innerHTML = ''; // Clear previous options
          if (models.length > 0) {
            models.forEach(model => {
              const option = document.createElement('option');
              option.value = model.id;
              datalist.appendChild(option);
            });
            toast('Model list updated.');
          } else {
            toast('No models found at this endpoint.');
          }
        } else {
          throw new Error(response.error || 'Failed to fetch models.');
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        toast(`Error: ${error.message}`);
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


export function initUIEventListeners({ onRetry, onTranscribeAnother, onStartNewRecording }) {
  const { copyBtn, resultText, retryBtn, transcribeAnotherBtn, previewStartNewRecordingBtn } = uiElements;

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resultText.value).then(() => {
      const iconCopy = copyBtn.querySelector('.icon-copy');
      const iconCheck = copyBtn.querySelector('.icon-check');
      const textSpan = copyBtn.querySelector('.copy-text');
      
      iconCopy.style.display = 'none';
      iconCheck.style.display = 'inline-block';
      textSpan.textContent = '已复制!';
      copyBtn.classList.add('copied');

      setTimeout(() => {
        iconCopy.style.display = 'inline-block';
        iconCheck.style.display = 'none';
        textSpan.textContent = '复制文本';
        copyBtn.classList.remove('copied');
      }, 2000);
    }).catch(() => toast('复制失败'));
  });

  retryBtn.addEventListener('click', onRetry);
  transcribeAnotherBtn.addEventListener('click', onTranscribeAnother);
  if (previewStartNewRecordingBtn) {
    previewStartNewRecordingBtn.addEventListener('click', onStartNewRecording);
  }
}

export const formatTime = (timeInSeconds) => {
  const total = Math.round(timeInSeconds) || 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};