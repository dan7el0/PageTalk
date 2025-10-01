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
  const { idleView, uploadLinkBtn, fileInput, mainPanel } = uiElements;
  let dragCounter = 0;
  
  // Prevent default behavior for dragover to allow drop
  window.addEventListener('dragover', e => {
    e.preventDefault();
  });

  window.addEventListener('dragenter', e => {
    e.preventDefault();
    if (mainPanel.dataset.state === 'idle' || mainPanel.dataset.state === 'error') {
      dragCounter++;
      idleView.classList.add('dragover');
    }
  });

  window.addEventListener('dragleave', e => {
    e.preventDefault();
    if (mainPanel.dataset.state === 'idle' || mainPanel.dataset.state === 'error') {
      dragCounter--;
      if (dragCounter === 0) {
        idleView.classList.remove('dragover');
      }
    }
  });

  window.addEventListener('drop', e => {
    e.preventDefault();
    // Unconditionally reset UI feedback
    dragCounter = 0;
    idleView.classList.remove('dragover');
    
    // Only handle file if in correct state
    if (mainPanel.dataset.state === 'idle' || mainPanel.dataset.state === 'error') {
      handleFile(e.dataTransfer.files?.[0], onFileReady);
    }
  });

  uploadLinkBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files?.[0], onFileReady);
    // Reset file input value to allow uploading the same file again
    if(e.target) {
        e.target.value = '';
    }
  });
}
