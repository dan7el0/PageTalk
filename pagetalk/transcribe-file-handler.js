import { uiElements, setUIState } from './transcribe-ui.js';

const SUPPORTED_FORMATS = ['aac', 'amr', 'avi', 'aiff', 'flac', 'flv', 'm4a', 'mkv', 'mp3', 'mp4', 'mpeg', 'ogg', 'opus', 'wav', 'webm', 'wma', 'wmv'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function handleFile(file, onFileReady) {
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_FORMATS.includes(extension)) {
    uiElements.errorMessageEl.textContent = `不支持的文件格式。`;
    setUIState('error');
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    uiElements.errorMessageEl.textContent = `文件过大。最大允许 ${MAX_FILE_SIZE_MB}MB。`;
    setUIState('error');
    return;
  }
  
  onFileReady(file);
}

export function initFileHandler(onFileReady) {
  const { transcribeArea, idleView, uploadLinkBtn, fileInput, mainPanel } = uiElements;
  
  transcribeArea.addEventListener('dragenter', e => {
    e.preventDefault();
    if (mainPanel.dataset.state === 'idle') {
      idleView.classList.add('dragover');
    }
  });
  transcribeArea.addEventListener('dragover', e => e.preventDefault());
  transcribeArea.addEventListener('dragleave', e => {
    e.preventDefault();
    idleView.classList.remove('dragover');
  });
  transcribeArea.addEventListener('drop', e => {
    e.preventDefault();
    idleView.classList.remove('dragover');
    if (mainPanel.dataset.state === 'idle' || mainPanel.dataset.state === 'error') {
      handleFile(e.dataTransfer.files?.[0], onFileReady);
    }
  });

  uploadLinkBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files?.[0], onFileReady);
  });
}