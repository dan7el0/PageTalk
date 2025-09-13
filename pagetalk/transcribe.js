document.addEventListener('DOMContentLoaded', () => {

  const defaultConfig = {
    apiProvider: 'free',
    apiKey: '',
    language: 'auto',
    enable_itn: false,
    context: '',
  };
  
  let currentConfig = { ...defaultConfig };

  const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  const FREE_API_ENDPOINT = 'https://c0rpr74ughd0-deploy.space.z.ai/api/asr-inference';
  const SUPPORTED_FORMATS = ['aac', 'amr', 'avi', 'aiff', 'flac', 'flv', 'm4a', 'mkv', 'mp3', 'mp4', 'mpeg', 'ogg', 'opus', 'wav', 'webm', 'wma', 'wmv'];
  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // UI elements
  const transcribeArea = document.getElementById('transcribe-area');
  const dropzone = document.querySelector('.voiceui-panel-dropzone');
  const errorMessageEl = document.querySelector('.voiceui-panel-error-message');
  const resultText = document.getElementById('result-text');
  const copyBtn = document.getElementById('copy-btn');
  const retryBtn = document.getElementById('retry-btn');
  const transcribeAnotherBtn = document.getElementById('transcribe-another-btn');
  const fileInput = document.getElementById('file-input');
  
  // Settings elements
  const providerSelect = document.getElementById('voiceui-provider');
  const apiKeyInput = document.getElementById('voiceui-apikey');
  const apiKeyRow = document.getElementById('api-key-row');
  const langSelect = document.getElementById('voiceui-lang');
  const itnCheckbox = document.getElementById('voiceui-itn');
  const ctxInput = document.getElementById('voiceui-ctx');

  const toastContainer = document.getElementById('toast-container');
  
  // Tab elements
  const tabButtons = document.querySelectorAll('.voiceui-tab-btn');
  const tabPanels = document.querySelectorAll('.voiceui-tab-panel');

  // Recorder elements
  const recordBtn = document.getElementById('record-btn');
  const recorderTimer = document.querySelector('.voiceui-recorder-timer');
  const canvas = document.getElementById('recorder-canvas');
  const canvasCtx = canvas.getContext('2d');

  // Recorder state
  let isRecording = false;
  let mediaRecorder, audioChunks, audioContext, source, analyser, dataArray, animationFrameId, timerInterval;
  let isSpacebarDown = false; // For hotkey
  let idleAnimationTime = 0; // For idle canvas animation
  let idleAnimationFrameId;


  function toast(msg) {
    if (!toastContainer) return;
    const n = document.createElement('div');
    n.className = 'toast-message';
    n.textContent = String(msg);
    toastContainer.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  function toggleApiKeyVisibility() {
    apiKeyRow.style.display = providerSelect.value === 'free' ? 'none' : 'flex';
  }

  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get('voiceui_config');
      const storedConfig = result.voiceui_config || {};
      currentConfig = { ...defaultConfig, ...storedConfig };

      providerSelect.value = currentConfig.apiProvider;
      apiKeyInput.value = currentConfig.apiKey;
      langSelect.value = currentConfig.language;
      itnCheckbox.checked = currentConfig.enable_itn;
      ctxInput.value = currentConfig.context;
      
      toggleApiKeyVisibility();
    } catch (e) {
      console.error("Error loading config:", e);
      toast('加载配置失败！');
    }
  }

  function saveConfig() {
    // We need to load the full config first to not overwrite settings not on this page.
    chrome.storage.sync.get('voiceui_config', (result) => {
        const fullConfig = result.voiceui_config || {};

        const configToSave = {
          ...fullConfig,
          apiProvider: providerSelect.value,
          apiKey: apiKeyInput.value.trim(),
          language: langSelect.value,
          enable_itn: itnCheckbox.checked,
          context: ctxInput.value,
        };
        
        currentConfig = configToSave;

        chrome.storage.sync.set({ voiceui_config: configToSave }, () => {
          if (chrome.runtime.lastError) {
            toast('保存设置失败！');
            console.error("Error saving config:", chrome.runtime.lastError);
          } else {
            toast('设置已保存！');
          }
        });
    });
  }
  
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  async function callFreeASRAPI(audioBlob, options) {
    const base64 = await blobToBase64(audioBlob);
    const payload = {
      audio_file: { data: base64, name: 'recording.dat', type: audioBlob.type, size: audioBlob.size },
      context: options.context || '',
      language: options.language || 'auto',
      enable_itn: !!options.enable_itn
    };
    const response = await chrome.runtime.sendMessage({
      type: 'callASRAPI',
      payload: {
        url: FREE_API_ENDPOINT,
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      }
    });
    if (response.success && response.data.success) {
      const result = response.data.data;
      if (Array.isArray(result) && result.length >= 1) {
          return result[0];
      }
      throw new Error('API 未能返回有效文本');
    } else {
      throw new Error(response.data?.error || response.data?.details || response.error || '请求失败');
    }
  }

  async function callDashScopeASRAPI(audioBlob, options) {
    if (!options.apiKey) {
      toast('请设置您的阿里云百炼 API Key。');
      throw new Error('未提供阿里云百炼 API Key');
    }
    const base64 = await blobToBase64(audioBlob);
    const audioDataURI = `data:${audioBlob.type};base64,${base64}`;
    const system_parts = [];
    if (options.language && options.language !== 'auto') system_parts.push(`asr language:${options.language}`);
    if (options.context) system_parts.push(options.context);
    const messages = [];
    if (system_parts.length > 0) messages.push({ role: "system", content: [{ text: system_parts.join('\\n') }] });
    messages.push({ role: "user", content: [{ audio: audioDataURI }] });
    const payload = {
      model: "qwen3-asr-flash",
      input: { messages },
      parameters: { asr_options: { enable_lid: options.language === 'auto', enable_itn: !!options.enable_itn } }
    };
    const response = await chrome.runtime.sendMessage({
      type: 'callASRAPI',
      payload: {
        url: API_ENDPOINT,
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${options.apiKey}` },
          body: JSON.stringify(payload)
        }
      }
    });
    if (response.success) {
      const choice = response.data.output?.choices?.[0];
      if (choice?.finish_reason === 'stop' && choice.message?.content?.[0]?.text) {
        return choice.message.content[0].text;
      } else {
        throw new Error(response.data?.message || 'API 未能返回有效文本');
      }
    } else {
      throw new Error(response.error || '请求失败');
    }
  }

  const setUIState = (state) => {
    transcribeArea.dataset.state = state;
    if (state === 'idle') {
      fileInput.value = ''; // Reset file input
      isRecording = false; // Ensure recording state is reset
      cleanupAudio();
      resultText.readOnly = true;
      resultText.value = '';
    } else if (state === 'result') {
      resultText.readOnly = false;
      resultText.focus();
    }
  };

  const processFile = async (file) => {
    if (!file) return;

    if (!isRecording) { // Don't validate our own recording blob
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!SUPPORTED_FORMATS.includes(extension)) {
        errorMessageEl.textContent = `不支持的文件格式。`;
        setUIState('error');
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errorMessageEl.textContent = `文件过大。最大允许 ${MAX_FILE_SIZE_MB}MB。`;
        setUIState('error');
        return;
      }
    }

    if (currentConfig.apiProvider === 'dashscope' && !currentConfig.apiKey) {
      toast('请在下面设置您的阿里云百炼 API Key。');
      setUIState('idle');
      return;
    }

    setUIState('loading');

    try {
      let text;
      if (currentConfig.apiProvider === 'free') {
        text = await callFreeASRAPI(file, currentConfig);
      } else {
        text = await callDashScopeASRAPI(file, currentConfig);
      }
      resultText.value = text;
      setUIState('result');
    } catch (err) {
      errorMessageEl.textContent = '识别失败: ' + (err?.message || err);
      setUIState('error');
    }
  };

  // --- Recording Logic ---
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const stopIdleAnimation = () => {
    if (idleAnimationFrameId) {
      cancelAnimationFrame(idleAnimationFrameId);
      idleAnimationFrameId = null;
    }
  };

  const drawIdleLine = () => {
    if (!canvas || !canvasCtx || isRecording) {
      stopIdleAnimation();
      return;
    }
    
    idleAnimationTime += 0.02;

    const parent = canvas.parentElement;
    if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    
    const w = canvas.width;
    const h = canvas.height;
    const h2 = h / 2;

    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    canvasCtx.beginPath();

    for (let x = 0; x < w; x++) {
      const y = h2 + Math.sin(x * 0.03 + idleAnimationTime) * 2 * Math.sin(idleAnimationTime * 0.5);
      if (x === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();

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
      recordBtn.classList.remove('recording');
      recorderTimer.textContent = '00:00';
      stopIdleAnimation();
      drawIdleLine();
  };

  const drawWaveform = () => {
    if (!isRecording || !analyser) return;
    animationFrameId = requestAnimationFrame(drawWaveform);
    analyser.getByteTimeDomainData(dataArray);
    
    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = 'var(--primary-color)';
    canvasCtx.beginPath();
    
    const sliceWidth = (canvas.width * 1.0) / analyser.fftSize;
    let x = 0;
    for (let i = 0; i < analyser.fftSize; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  };
  
  const startRecording = async () => {
    stopIdleAnimation();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            }
        });
        isRecording = true;
        recordBtn.classList.add('recording');
        
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
        recorderTimer.textContent = '00:00';
        timerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            recorderTimer.textContent = formatTime(elapsedSeconds);
        }, 1000);

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioFile = new File([audioBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
            processFile(audioFile);
            cleanupAudio();
        };
        mediaRecorder.start();
    } catch (err) {
        console.error("Error starting recording:", err);
        toast(`无法开始录音: ${err.message}`);
        setUIState('idle');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    isRecording = false;
  };

  recordBtn.addEventListener('click', () => {
      if (isRecording) {
          stopRecording();
      } else {
          startRecording();
      }
  });

  
  // --- Event Listeners ---
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (isRecording) return;
      const targetTab = button.dataset.tab;

      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');

      tabPanels.forEach(panel => {
        if (panel.id === `${targetTab}-panel`) {
          panel.classList.add('active');
          panel.removeAttribute('hidden');
        } else {
          panel.classList.remove('active');
          panel.setAttribute('hidden', '');
        }
      });
    });
  });


  dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    processFile(e.dataTransfer.files?.[0]);
  });
  dropzone.addEventListener('click', () => {
    if (transcribeArea.dataset.state === 'error' || transcribeArea.dataset.state === 'loading') return;
    fileInput.click()
  });
  fileInput.addEventListener('change', () => {
    processFile(fileInput.files?.[0]);
  });
  
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
    }).catch(err => toast('复制失败'));
  });

  retryBtn.addEventListener('click', () => setUIState('idle'));
  transcribeAnotherBtn.addEventListener('click', () => setUIState('idle'));

  // Settings listeners
  [providerSelect, apiKeyInput, langSelect, itnCheckbox, ctxInput].forEach(el => {
    el.addEventListener('change', saveConfig);
  });
  providerSelect.addEventListener('change', toggleApiKeyVisibility);
  
  // Spacebar hotkey for recording
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpacebarDown) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'BUTTON' || activeEl.tagName === 'SELECT')) {
        return;
      }
      if (!document.querySelector('#record-panel').classList.contains('active')) {
        return;
      }

      e.preventDefault();
      isSpacebarDown = true;
      if (!isRecording) {
        startRecording();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        if (isSpacebarDown && isRecording) {
          stopRecording();
        }
        isSpacebarDown = false;
    }
  });

  // Initial load
  loadConfig();
  resultText.readOnly = true;
  drawIdleLine();
  // Redraw idle line on resize to ensure it's centered and sized correctly.
  new ResizeObserver(drawIdleLine).observe(canvas);
});
