import { uiElements, setUIState, formatTime } from './transcribe-ui.js';
import { processAudioForTranscription } from './transcribe-audio-processor.js';
import { currentConfig } from './transcribe-config.js';

let previewAudioBlob = null;
let originalAudioBlob = null;
const hiddenAudioPlayer = new Audio();
const playbackSpeeds = [1, 1.5, 2, 0.75];
let currentSpeedIndex = 0;

export function getOriginalBlob() {
  return originalAudioBlob;
}

async function drawPreviewWaveform(audioBlob) {
    const { previewCanvas, previewCanvasCtx } = uiElements;
    const parent = previewCanvas.parentElement;
    if (previewCanvas.width !== parent.clientWidth || previewCanvas.height !== parent.clientHeight) {
      previewCanvas.width = parent.clientWidth;
      previewCanvas.height = parent.clientHeight;
    }

    previewCanvasCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCanvasCtx.fillStyle = '#64748b';
    previewCanvasCtx.font = '14px sans-serif';
    previewCanvasCtx.textAlign = 'center';
    previewCanvasCtx.fillText('正在生成波形...', previewCanvas.width / 2, previewCanvas.height / 2);

  try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / previewCanvas.width);
      const amp = previewCanvas.height / 2;

      previewCanvasCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCanvasCtx.strokeStyle = '#64748b';
      previewCanvasCtx.lineWidth = 1;
      previewCanvasCtx.beginPath();
      
      for (let i = 0; i < previewCanvas.width; i++) {
          let min = 1.0;
          let max = -1.0;

          for (let j = 0; j < step; j++) {
              const datum = data[(i * step) + j];
              if (datum < min) min = datum;
              if (datum > max) max = datum;
          }
          
          const x = i + 0.5;
          const y_max = (1 - max) * amp;
          const y_min = (1 - min) * amp;

          previewCanvasCtx.moveTo(x, y_max);
          previewCanvasCtx.lineTo(x, y_min);
      }
      previewCanvasCtx.stroke();
  } catch (e) {
      console.error('Error drawing waveform:', e);
      previewCanvasCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCanvasCtx.fillText('无法绘制波形', previewCanvas.width / 2, previewCanvas.height / 2);
  }
}

async function updatePreviewAudio() {
  if (!originalAudioBlob) return;

  if (hiddenAudioPlayer.src) {
      URL.revokeObjectURL(hiddenAudioPlayer.src);
  }
  hiddenAudioPlayer.pause();
  uiElements.playIcon.style.display = 'block';
  uiElements.pauseIcon.style.display = 'none';

  const playbackRate = Number(currentConfig.transcribeSpeed) || 1;
  let blobToPreview;
  let fileName = originalAudioBlob.name;

  if (playbackRate !== 1) {
    try {
        blobToPreview = await processAudioForTranscription(originalAudioBlob, playbackRate);
        fileName = `[${playbackRate}x] ${originalAudioBlob.name}`;
    } catch (err) {
        uiElements.errorMessageEl.textContent = '音频处理失败: ' + (err.message || err);
        setUIState('error');
        return;
    }
  } else {
      blobToPreview = originalAudioBlob;
  }
  
  previewAudioBlob = blobToPreview; 

  const url = URL.createObjectURL(blobToPreview);
  hiddenAudioPlayer.src = url;
  uiElements.playerFilename.textContent = fileName;
  drawPreviewWaveform(blobToPreview);
}

export function updatePreviewAudioForSpeedChange() {
    updatePreviewAudio();
}

export function setupPreview(file) {
  originalAudioBlob = file;
  previewAudioBlob = file;
  setUIState('preview');
  updatePreviewAudio();
}

export function initPlayer(onTranscribe, onCancel) {
  const {
      playPauseBtn, rewindBtn, forwardBtn, volumeBtn, loopBtn, speedBtn, downloadBtn,
      playIcon, pauseIcon, volumeOnIcon, volumeOffIcon, playerTimedisplay,
      playhead, waveformContainer, previewTranscribeBtn, previewCancelBtn, playerFilename
  } = uiElements;

  playPauseBtn.addEventListener('click', () => hiddenAudioPlayer.paused ? hiddenAudioPlayer.play() : hiddenAudioPlayer.pause());
  rewindBtn.addEventListener('click', () => hiddenAudioPlayer.currentTime = Math.max(0, hiddenAudioPlayer.currentTime - 5));
  forwardBtn.addEventListener('click', () => hiddenAudioPlayer.currentTime = Math.min(hiddenAudioPlayer.duration, hiddenAudioPlayer.currentTime + 5));
  volumeBtn.addEventListener('click', () => hiddenAudioPlayer.muted = !hiddenAudioPlayer.muted);
  loopBtn.addEventListener('click', () => {
    hiddenAudioPlayer.loop = !hiddenAudioPlayer.loop;
    loopBtn.classList.toggle('active', hiddenAudioPlayer.loop);
  });
  speedBtn.addEventListener('click', () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % playbackSpeeds.length;
    hiddenAudioPlayer.playbackRate = playbackSpeeds[currentSpeedIndex];
    speedBtn.textContent = `${playbackSpeeds[currentSpeedIndex]}x`;
  });
  downloadBtn.addEventListener('click', () => {
    if (previewAudioBlob) {
        const a = document.createElement('a');
        a.href = hiddenAudioPlayer.src;
        a.download = playerFilename.textContent || 'audio.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  });

  hiddenAudioPlayer.addEventListener('play', () => {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  });
  hiddenAudioPlayer.addEventListener('pause', () => {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  });
  hiddenAudioPlayer.addEventListener('ended', () => {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playhead.style.left = hiddenAudioPlayer.loop ? '0%' : '100%';
  });
  hiddenAudioPlayer.addEventListener('volumechange', () => {
    const isMuted = hiddenAudioPlayer.muted || hiddenAudioPlayer.volume === 0;
    volumeOnIcon.style.display = isMuted ? 'none' : 'block';
    volumeOffIcon.style.display = isMuted ? 'block' : 'none';
  });
   hiddenAudioPlayer.addEventListener('loadedmetadata', () => {
    playerTimedisplay.textContent = `${formatTime(0)} / ${formatTime(hiddenAudioPlayer.duration)}`;
  });
  hiddenAudioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = hiddenAudioPlayer;
    if (!isNaN(duration)) {
        playerTimedisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        playhead.style.left = `${(currentTime / duration) * 100}%`;
    }
  });

  waveformContainer.addEventListener('click', (e) => {
    if (!hiddenAudioPlayer.duration) return;
    const rect = waveformContainer.getBoundingClientRect();
    hiddenAudioPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * hiddenAudioPlayer.duration;
  });

  previewTranscribeBtn.addEventListener('click', onTranscribe);
  previewCancelBtn.addEventListener('click', onCancel);
}