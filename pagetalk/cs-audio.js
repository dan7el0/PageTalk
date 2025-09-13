'use strict';

let audioContext, mediaStream, sourceNode, workletNode;
let pcmData = [];
let currentSampleRate = 44100;
let isRecording = false;

const MAX_RECORDING_SECONDS = 180; // 3 minutes
let recordingTimerInterval = null;

async function startRecording() {
  if (isRecording) return;

  try {
    if (!chrome.runtime?.id) {
      toast('扩展程序环境已失效，请刷新页面重试。');
      return;
    }
  } catch (e) {
    console.warn("PageTalk: Extension context invalidated.", e);
    toast('扩展程序环境已失效，请刷新页面重试。');
    return;
  }

  if (state.apiProvider === 'dashscope' && !state.apiKey) {
    toast('请点击浏览器右上角的扩展图标，设置您的阿里云百炼 API Key。');
    return;
  }

  try {
    lastFocusedEl = getActiveEditable();

    const audioConstraints = {
      sampleRate: 16000,
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: false,
      channelCount: 1
    };

    if (state.audioDeviceId && state.audioDeviceId !== 'default') {
      audioConstraints.deviceId = { exact: state.audioDeviceId };
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints
    });

    mediaStream.getTracks().forEach(track => {
      track.onended = () => {
        if (isRecording) {
          console.log('PageTalk: Audio track ended unexpectedly.');
          toast('麦克风连接已断开，请重试。');
          cleanupAudio();
        }
      };
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    currentSampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    
    const workletURL = chrome.runtime.getURL('audio-processor.js');

    try {
      await audioContext.audioWorklet.addModule(workletURL);
    } catch (e) {
      console.error("Error adding audio worklet module", e);
      toast('无法加载录音模块。');
      cleanupAudio();
      return;
    }
    
    workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
    pcmData = [];
    workletNode.port.onmessage = (e) => {
      const pcmChunk = e.data;
      pcmData.push(pcmChunk);
      const rms = Math.sqrt(pcmChunk.reduce((s, v) => s + v*v, 0) / pcmChunk.length);
      setButtonLevel(rms);
    };

    sourceNode.connect(workletNode);
    workletNode.connect(audioContext.destination);

    isRecording = true;
    ui.wrap.classList.add('recording');
    ui.btn.classList.add('recording');

    // Timer logic
    let startTime = Date.now();
    const maxMinutes = Math.floor(MAX_RECORDING_SECONDS / 60);
    
    const updateTimer = () => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
            toast(`已达到最长录音时间 (${maxMinutes}分钟)`);
            stopRecording(); // This will clear the interval
            return;
        }
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        if (ui.badge) {
          ui.badge.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    };
    
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
    }
    updateTimer(); // Set to 00:00 immediately
    recordingTimerInterval = setInterval(updateTimer, 1000);

    ui.badge.style.background = '#ef4444';
    if (ui.tip) {
      ui.tip.textContent = `录音中... (最长 ${maxMinutes} 分钟)`;
    }
    toast('开始录音…');
  } catch (err) {
    console.error(err);
    let message;
    if (err && err.message && err.message.includes('Extension context invalidated')) {
      message = '扩展程序环境已失效，请刷新页面重试。';
    } else if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          message = '您已阻止麦克风权限，请在浏览器设置中允许访问。';
          break;
        case 'NotFoundError':
          message = '未找到可用的麦克风设备。';
          break;
        case 'NotReadableError':
          message = '麦克风硬件错误，无法读取。';
          break;
        default:
          message = `无法访问麦克风：${err.name}`;
      }
    } else if (err && err.message) {
      message = '无法访问麦克风：' + err.message;
    } else {
      message = '无法访问麦克风，发生未知错误。';
    }
    toast(message);
    cleanupAudio();
  }
}

function getLanguageAbbreviation(lang) {
  if (!lang) return '';
  const langMap = {
    // DashScope values (lowercase)
    'chinese': 'zh',
    'english': 'en',
    'japanese': 'ja',
    'korean': 'ko',
    'german': 'de',
    'russian': 'ru',
    'french': 'fr',
    'portuguese': 'pt',
    'arabic': 'ar',
    'italian': 'it',
    'spanish': 'es',
    // Free API values (as is)
    '中文': 'zh',
    '英语': 'en',
    '日语': 'ja',
    '韩语': 'ko',
    '德语': 'de',
    '俄语': 'ru',
    '法语': 'fr',
    '葡萄牙语': 'pt',
    '阿拉伯语': 'ar',
    '意大利语': 'it',
    '西班牙语': 'es'
  };
  return langMap[lang.toLowerCase()] || lang;
}

async function resample(audioBuffer, targetSampleRate, playbackRate = 1) {
  const duration = audioBuffer.duration / playbackRate;
  const offlineContext = new OfflineAudioContext(
    1, // mono
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.playbackRate.value = playbackRate;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);
  return await offlineContext.startRendering();
}

async function stopRecording() {
  if (!isRecording) return;

  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
  if (ui.tip) {
    ui.tip.textContent = '单击录音，长按打开转录页面';
  }

  isRecording = false;
  ui.wrap.classList.remove('recording');
  ui.btn.classList.remove('recording');
  ui.badge.textContent = '…';
  ui.badge.style.background = '#22c55e';
  
  // Combine PCM data chunks
  const totalLength = pcmData.reduce((len, arr) => len + arr.length, 0);
  
  if (totalLength === 0) {
    cleanupAudio();
    toast('录音时间太短');
    return;
  }

  const combinedPcm = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of pcmData) {
    combinedPcm.set(chunk, offset);
    offset += chunk.length;
  }
  
  const TARGET_SAMPLE_RATE = 16000;
  let wavBlob;

  try {
    if (currentSampleRate === TARGET_SAMPLE_RATE && state.transcribeSpeed === 1) {
      wavBlob = encodeWAV([combinedPcm], currentSampleRate);
    } else {
      // Create buffer with original sample rate. audioContext is still open here.
      const originalBuffer = audioContext.createBuffer(1, combinedPcm.length, currentSampleRate);
      originalBuffer.copyToChannel(combinedPcm, 0);

      const resampledBuffer = await resample(originalBuffer, TARGET_SAMPLE_RATE, state.transcribeSpeed);
      const resampledPcm = resampledBuffer.getChannelData(0);
      wavBlob = encodeWAV([resampledPcm], TARGET_SAMPLE_RATE);
    }
  } catch (err) {
    console.error('Error processing audio:', err);
    toast('音频处理失败: ' + (err.message || err));
    cleanupAudio();
    return;
  }

  // Now we can cleanup audio resources
  cleanupAudioResources();
  pcmData = [];
  setButtonLevel(0);
  
  try {
    ui.badge.textContent = '…';
    ui.badge.style.background = '#f97316';
    toast('正在识别…');
    let text, lang;
    if (state.apiProvider === 'free') {
        [text, lang] = await callFreeASRAPI(wavBlob, state);
    } else {
        [text, lang] = await callDashScopeASRAPI(wavBlob, state);
    }

    if (state.removeTrailingPeriod && text && text.endsWith('。')) {
      text = text.slice(0, -1);
    }
    
    const langAbbr = getLanguageAbbreviation(lang);
    ui.badge.textContent = langAbbr || 'OK';
    ui.badge.style.background = '#22c55e';

    let toastMessage = '识别完成' + (langAbbr ? `（${langAbbr}）` : '');
    if (state.autoCopy && text) {
      try {
        await navigator.clipboard.writeText(text);
        toastMessage = '识别完成并已复制';
      } catch (err) {
        console.error("Auto-copy failed", err);
        toastMessage = '识别完成（复制失败）';
      }
    }

    insertTextAtCursor(text);
    toast(toastMessage);

  } catch (err) {
    console.error('ASR error:', err);
    ui.badge.textContent = '!';
    ui.badge.style.background = '#ef4444';
    toast('识别失败：' + (err && err.message ? err.message : err));
  }
}

function cancelRecording() {
  if (!isRecording) return;
  cleanupAudio();
  toast('录音已取消');
}

function cleanupAudioResources() {
    try { workletNode?.port.close(); } catch (_) {}
    try { workletNode?.disconnect(); } catch (_) {}
    try { sourceNode?.disconnect(); } catch (_) {}
    if (audioContext && audioContext.state !== 'closed') {
      try { audioContext.close(); } catch (_) {}
    }
    try { mediaStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
    workletNode = null;
    sourceNode = null;
    audioContext = null;
    mediaStream = null;
}

function cleanupAudio() {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
  isRecording = false;
  pcmData = [];
  cleanupAudioResources();
  setButtonLevel(0);
  ui.wrap.classList.remove('recording');
  ui.btn.classList.remove('recording');
  ui.badge.textContent = '…';
  ui.badge.style.background = '#22c55e';
  if (ui.tip) {
    ui.tip.textContent = '单击录音，长按打开转录页面';
  }
}

function encodeWAV(chunks, sampleRate) {
  const totalLength = chunks.reduce((len, arr) => len + arr.length, 0);
  const mono = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    mono.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = new ArrayBuffer(44 + mono.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + mono.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, mono.length * 2, true);
  let idx = 44;
  for (let i = 0; i < mono.length; i++, idx += 2) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}