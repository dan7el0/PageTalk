import { uiElements, setUIState, toast, formatTime } from './transcribe-ui.js';
import { currentConfig } from './transcribe-config.js';
import { listMicrophones } from './transcribe-config.js';

let isRecording = false;
let mediaRecorder, audioChunks, audioContext, source, analyser, dataArray, animationFrameId, timerInterval, recordingTimeoutId;
let idleAnimationTime = 0;
let idleAnimationFrameId;

const MAX_RECORDING_DURATION_SECONDS = 180; // 3 minutes

function getFormattedTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

const stopIdleAnimation = () => {
  if (idleAnimationFrameId) {
    cancelAnimationFrame(idleAnimationFrameId);
    idleAnimationFrameId = null;
  }
};

const drawIdleLine = () => {
  const { recorderCanvas, recorderCanvasCtx } = uiElements;
  if (!recorderCanvas || !recorderCanvasCtx || isRecording) {
    stopIdleAnimation();
    return;
  }
  
  idleAnimationTime += 0.02;
  const parent = recorderCanvas.parentElement;
  if (recorderCanvas.width !== parent.clientWidth || recorderCanvas.height !== parent.clientHeight) {
    recorderCanvas.width = parent.clientWidth;
    recorderCanvas.height = parent.clientHeight;
  }
  
  const w = recorderCanvas.width, h = recorderCanvas.height, h2 = h / 2;
  recorderCanvasCtx.clearRect(0, 0, w, h);
  recorderCanvasCtx.lineWidth = 2.5;
  recorderCanvasCtx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
  recorderCanvasCtx.beginPath();
  for (let x = 0; x < w; x++) {
    const y = h2 + Math.sin(x * 0.03 + idleAnimationTime) * 2 * Math.sin(idleAnimationTime * 0.5);
    x === 0 ? recorderCanvasCtx.moveTo(x, y) : recorderCanvasCtx.lineTo(x, y);
  }
  recorderCanvasCtx.stroke();
  idleAnimationFrameId = requestAnimationFrame(drawIdleLine);
};

const cleanupAudio = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (timerInterval) clearInterval(timerInterval);
    source?.disconnect();
    analyser = null;
    source = null;
    audioContext?.close().catch(console.error);
    audioContext = null;
    mediaRecorder?.stream?.getTracks().forEach(track => track.stop());
    mediaRecorder = null;
    uiElements.recordBtn.classList.remove('recording');
    uiElements.recorderTimer.textContent = '00:00';
    stopIdleAnimation();
    drawIdleLine();
};

const drawWaveform = () => {
  if (!isRecording || !analyser) return;
  animationFrameId = requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);
  
  const { recorderCanvas, recorderCanvasCtx } = uiElements;
  const parent = recorderCanvas.parentElement;
  if (parent && (recorderCanvas.width !== parent.clientWidth || recorderCanvas.height !== parent.clientHeight)) {
      recorderCanvas.width = parent.clientWidth;
      recorderCanvas.height = parent.clientHeight;
  }

  recorderCanvasCtx.clearRect(0, 0, recorderCanvas.width, recorderCanvas.height);
  recorderCanvasCtx.lineWidth = 2.5;
  recorderCanvasCtx.strokeStyle = 'var(--primary-color)';
  recorderCanvasCtx.beginPath();
  
  const sliceWidth = (recorderCanvas.width * 1.0) / analyser.fftSize;
  let x = 0;
  for (let i = 0; i < analyser.fftSize; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * recorderCanvas.height) / 2;
      i === 0 ? recorderCanvasCtx.moveTo(x, y) : recorderCanvasCtx.lineTo(x, y);
      x += sliceWidth;
  }
  recorderCanvasCtx.lineTo(recorderCanvas.width, recorderCanvas.height / 2);
  recorderCanvasCtx.stroke();
};

async function startRecording(onRecordingComplete) {
  if (isRecording) return;
  stopIdleAnimation();
  try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              ...(currentConfig.audioDeviceId !== 'default' && { deviceId: { exact: currentConfig.audioDeviceId } })
          }
      });
      isRecording = true;
      uiElements.recordBtn.classList.add('recording');
      
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      drawWaveform();

      let startTime = Date.now();
      uiElements.recorderTimer.textContent = '00:00';
      timerInterval = setInterval(() => {
          uiElements.recorderTimer.textContent = formatTime((Date.now() - startTime) / 1000);
      }, 1000);

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
          cleanupAudio();
          if (audioChunks.length === 0) {
            toast('录音时间太短');
            setUIState('idle');
            return;
          }
          
          const audioBlob = new Blob(audioChunks, { type: audioChunks[0].type });
          const audioFile = new File([audioBlob], `recording-${getFormattedTimestamp()}.webm`, { type: audioBlob.type });
          onRecordingComplete(audioFile);
      };

      recordingTimeoutId = setTimeout(() => {
          if (isRecording) {
              toast('已达到3分钟录音上限，自动停止。');
              stopRecording();
          }
      }, MAX_RECORDING_DURATION_SECONDS * 1000);
      
      mediaRecorder.start();
      toast('录音开始，最长3分钟。');
  } catch (err) {
      console.error("Error starting recording:", err);
      toast(err.name === 'NotFoundError' ? '选择的麦克风未找到，请检查设备或重新选择。' : `无法开始录音: ${err.message}`);
      if (err.name === 'NotFoundError') listMicrophones();
      setUIState('idle');
  }
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  if (recordingTimeoutId) {
      clearTimeout(recordingTimeoutId);
      recordingTimeoutId = null;
  }
  if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
  }
}

function cancelRecording() {
  if (!isRecording) return;
  isRecording = false;
  if (recordingTimeoutId) clearTimeout(recordingTimeoutId);
  recordingTimeoutId = null;
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  cleanupAudio();
  toast('录音已取消');
  setUIState('idle');
}

export function initRecorder(onRecordingComplete) {
  uiElements.recordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(onRecordingComplete);
    }
  });
  
  uiElements.cancelRecordBtn.addEventListener('click', cancelRecording);
  
  drawIdleLine();
  new ResizeObserver(drawIdleLine).observe(uiElements.recorderCanvas);
}