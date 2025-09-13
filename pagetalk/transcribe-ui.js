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
    errorMessageEl: query('.voiceui-panel-error-message'),
    
    // Result elements
    resultText: queryId('result-text'),
    copyBtn: queryId('copy-btn'),
    retryBtn: queryId('retry-btn'),
    transcribeAnotherBtn: queryId('transcribe-another-btn'),
    
    // File input
    fileInput: queryId('file-input'),
    uploadLinkBtn: queryId('upload-link-btn'),
    
    // Settings elements
    providerSelect: queryId('voiceui-provider'),
    apiKeyInput: queryId('voiceui-apikey'),
    apiKeyRow: queryId('api-key-row'),
    langSelect: queryId('voiceui-lang'),
    micSelect: queryId('voiceui-mic'),
    itnCheckbox: queryId('voiceui-itn'),
    autoCopyCheckbox: queryId('voiceui-autocopy'),
    removePeriodCheckbox: queryId('voiceui-remove-period'),
    ctxInput: queryId('voiceui-ctx'),
    speedSelect: queryId('voiceui-speed'),

    // Modal elements
    ctxExpandBtn: queryId('voiceui-ctx-expand'),
    ctxModal: queryId('voiceui-ctx-modal'),
    ctxTextarea: queryId('voiceui-ctx-textarea'),
    ctxSaveBtn: queryId('voiceui-ctx-save'),
    ctxCancelBtn: queryId('voiceui-ctx-cancel'),
    toastContainer: queryId('toast-container'),

    // Recorder elements
    recordBtn: queryId('record-btn'),
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
  });
}

export function setUIState(state) {
  if (uiElements.mainPanel) {
    uiElements.mainPanel.dataset.state = state;
    if (state === 'idle') {
        uiElements.fileInput.value = '';
        uiElements.resultText.readOnly = true;
        uiElements.resultText.value = '';
    } else if (state === 'result') {
      uiElements.resultText.readOnly = false;
      uiElements.resultText.focus();
    }
  }
}

export function toast(msg) {
  if (!uiElements.toastContainer) return;
  const n = document.createElement('div');
  n.className = 'toast-message';
  n.textContent = String(msg);
  uiElements.toastContainer.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

export function initModal(onSave) {
  const { ctxModal, ctxExpandBtn, ctxTextarea, ctxInput, ctxSaveBtn, ctxCancelBtn } = uiElements;

  ctxExpandBtn.addEventListener('click', () => {
    ctxTextarea.value = ctxInput.value;
    ctxModal.style.display = 'flex';
    ctxTextarea.focus();
  });

  const closeModal = () => ctxModal.style.display = 'none';

  ctxCancelBtn.addEventListener('click', closeModal);
  ctxModal.addEventListener('click', e => { if (e.target === ctxModal) closeModal(); });

  ctxSaveBtn.addEventListener('click', () => {
    ctxInput.value = ctxTextarea.value;
    onSave();
    closeModal();
  });
}

export function initUIEventListeners({ onRetry, onTranscribeAnother }) {
  const { copyBtn, resultText, retryBtn, transcribeAnotherBtn } = uiElements;

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
}

export const formatTime = (timeInSeconds) => {
  const total = Math.round(timeInSeconds) || 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};