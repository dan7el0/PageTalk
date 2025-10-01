import { loadHTMLPartials } from './transcribe-loader.js';
import { currentConfig, loadConfig, saveConfig, listMicrophones, toggleProviderSpecificRows } from './transcribe-config.js';
import { callFreeASRAPI, callDashScopeASRAPI, callDashScopeASRAPIStream, callOpenAIAPI, callConsoleAPI } from './transcribe-api.js';
import { processAudioForTranscription } from './transcribe-audio-processor.js';
import { uiElements, setUIState, toast, initModal, initUIEventListeners, initUIElements } from './transcribe-ui.js';
import { initRecorder } from './transcribe-recorder.js';
import { initPlayer, setupPreview, getOriginalBlob, updatePreviewAudioForSpeedChange } from './transcribe-player.js';
import { initFileHandler } from './transcribe-file-handler.js';

let transcriptionTimerInterval = null;
let transcriptionStartTime = 0;
let currentTranscriptionResult = null;
let saveDebounceTimer = null;

function getLanguageAbbreviation(lang) {
  if (!lang) return '';
  const langMap = {
    // DashScope values (lowercase)
    'chinese': 'zh', 'english': 'en', 'japanese': 'ja', 'korean': 'ko',
    'german': 'de', 'russian': 'ru', 'french': 'fr', 'portuguese': 'pt',
    'arabic': 'ar', 'italian': 'it', 'spanish': 'es',
    // Free API values (as is)
    '中文': 'zh', '英文': 'en', '英语': 'en', '日语': 'ja', '韩语': 'ko', '德语': 'de',
    '俄语': 'ru', '法语': 'fr', '葡萄牙语': 'pt',
    '阿拉伯语': 'ar', '意大利语': 'it', '西班牙语': 'es'
  };
  return langMap[lang.toLowerCase()] || lang;
}

function formatHistoryDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString();
    }
}

function renderHistory(items = []) {
    const { historyList, historyEmpty } = uiElements;
    historyList.innerHTML = '';

    if (items.length === 0) {
        historyEmpty.style.display = 'flex';
        historyList.style.display = 'none';
        return;
    }

    historyEmpty.style.display = 'none';
    historyList.style.display = 'flex';

    const fragment = document.createDocumentFragment();
    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.dataset.id = item.timestamp;
        div.title = `Click to load. Transcribed on ${new Date(item.timestamp).toLocaleString()}`;
        
        const langPart = item.lang ? `<span>${item.lang.toUpperCase()}</span>` : '';
        const durationPart = item.duration ? `<span>${item.duration.toFixed(1)}s</span>` : '';

        div.innerHTML = `
            <div class="history-item-content">
                <p class="history-item-text">${item.text}</p>
                <div class="history-item-meta">
                    <span>${formatHistoryDate(item.timestamp)}</span>
                    ${langPart ? '<span>&middot;</span>' + langPart : ''}
                    ${durationPart ? '<span>&middot;</span>' + durationPart : ''}
                </div>
            </div>
            <button class="history-item-delete" title="Delete entry">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        fragment.appendChild(div);
    }
    historyList.appendChild(fragment);
}

async function loadHistory() {
    try {
        const { pagetalk_history = [] } = await chrome.storage.local.get('pagetalk_history');
        renderHistory(pagetalk_history);
    } catch (e) {
        console.error("Error loading history:", e);
        toast('Failed to load history.');
    }
}

async function saveOrUpdateHistory(isNew = false) {
    if (!currentTranscriptionResult) return;

    const textToSave = uiElements.resultText.value;
    if (!textToSave.trim()) {
        if (isNew) toast('Empty transcription not saved.');
        return;
    }

    currentTranscriptionResult.text = textToSave;

    if (!currentTranscriptionResult.timestamp) {
        currentTranscriptionResult.timestamp = Date.now();
    }

    try {
        const { pagetalk_history = [] } = await chrome.storage.local.get('pagetalk_history');
        const existingIndex = pagetalk_history.findIndex(h => h.timestamp === currentTranscriptionResult.timestamp);

        let newHistory;
        if (existingIndex > -1) {
            pagetalk_history[existingIndex] = currentTranscriptionResult;
            newHistory = pagetalk_history;
        } else {
            newHistory = [currentTranscriptionResult, ...pagetalk_history];
        }

        if (newHistory.length > 100) {
            newHistory.length = 100;
        }

        await chrome.storage.local.set({ pagetalk_history: newHistory });
        if (!isNew) {
            toast('Changes saved to history.');
        }
        renderHistory(newHistory);
    } catch (e) {
        console.error("Error saving history:", e);
        toast('Failed to save history.');
    }
}

async function clearHistory() {
    if (confirm('Are you sure you want to delete all transcription history? This cannot be undone.')) {
        try {
            await chrome.storage.local.remove('pagetalk_history');
            renderHistory([]);
            toast('History cleared.');
        } catch (e) {
            console.error("Error clearing history:", e);
            toast('Failed to clear history.');
        }
    }
}

async function fetchAndDisplayGitHubStars() {
    const starCountEl = document.getElementById('github-stars-transcribe');
    if (!starCountEl) return;

    try {
        const response = await fetch('https://api.github.com/repos/yeahhe365/PageTalk');
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }
        const data = await response.json();
        const stars = data.stargazers_count;

        if (stars !== undefined) {
            const formattedStars = stars > 999 ? `${(stars / 1000).toFixed(1)}k` : stars;
            starCountEl.textContent = formattedStars;
            starCountEl.classList.add('loaded');
        }
    } catch (error) {
        console.error('PageTalk: Could not fetch GitHub stars:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadHTMLPartials();
    initUIElements();

    if (uiElements.settingsDetails && window.innerWidth <= 800) {
        uiElements.settingsDetails.open = false;
    }

    const onFileReady = (file) => {
        setupPreview(file);
    };

    function startLoadingTimer() {
        if (transcriptionTimerInterval) clearInterval(transcriptionTimerInterval);
        transcriptionStartTime = Date.now();
        if (uiElements.loadingTimer) {
            uiElements.loadingTimer.textContent = '0.0s';
        }
        transcriptionTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - transcriptionStartTime) / 1000;
            if (uiElements.loadingTimer) {
                uiElements.loadingTimer.textContent = `${elapsed.toFixed(1)}s`;
            }
        }, 100);
    }

    function stopLoadingTimer() {
        if (transcriptionTimerInterval) {
            clearInterval(transcriptionTimerInterval);
            transcriptionTimerInterval = null;
        }
        const elapsedSeconds = (Date.now() - transcriptionStartTime) / 1000;
        return elapsedSeconds;
    }

    const startTranscription = async (audioBlobToTranscribe) => {
        if (!audioBlobToTranscribe) {
            toast('没有可供转录的音频。');
            setUIState('idle');
            return;
        }

        if (currentConfig.apiProvider === 'dashscope' && !currentConfig.apiKey) {
            toast('请在下面设置您的阿里云百炼 API Key。');
            return;
        }
        
        if (currentConfig.apiProvider !== 'dashscope' && currentConfig.enableStreaming) {
            toast('流式输出仅支持阿里云百炼服务。');
            return;
        }
        
        if (uiElements.loadingFilename) {
            uiElements.loadingFilename.textContent = audioBlobToTranscribe.name || 'Recording';
        }
        setUIState('loading');
        
        try {
            toast('正在处理音频...');
            const processedBlob = await processAudioForTranscription(audioBlobToTranscribe, currentConfig.transcribeSpeed);
            toast('正在识别...');

            const handleFinalText = async (finalText, lang, duration) => {
                 let processedText = finalText;

                if (currentConfig.enableOpenaiProcessing && processedText) {
                    try {
                        toast('正在后处理文本…');
                        processedText = await callOpenAIAPI(processedText, currentConfig);
                    } catch (err) {
                        console.error('OpenAI API error:', err);
                        toast('文本后处理失败: ' + (err?.message || err));
                    }
                }

                if (currentConfig.removeTrailingPeriod && processedText && processedText.endsWith('。')) {
                    processedText = processedText.slice(0, -1);
                }

                currentTranscriptionResult = {
                    text: processedText,
                    lang: getLanguageAbbreviation(lang),
                    duration: duration,
                    filename: audioBlobToTranscribe.name || `Recording`,
                    timestamp: Date.now(),
                };

                uiElements.resultText.value = processedText;
                setupPreview(audioBlobToTranscribe, false);
                setUIState('result');
                saveOrUpdateHistory(true);
                
                let copyStatus = '';
                if (currentConfig.autoCopy && processedText) {
                    try {
                        await navigator.clipboard.writeText(processedText);
                        copyStatus = '、已复制';
                    } catch (err) {
                        console.error("Auto-copy failed", err);
                        copyStatus = ' (复制失败)';
                    }
                }

                const durationInfo = duration ? ` (耗时 ${duration.toFixed(2)}s)` : '';
                const toastMessage = `识别完成并已保存${copyStatus}${durationInfo}\n\n${processedText}`;
                
                toast(toastMessage);
            };

            if (currentConfig.apiProvider === 'dashscope' && currentConfig.enableStreaming) {
                setUIState('result'); // Switch to result view to show textarea
                uiElements.resultText.value = ''; // Clear it
                uiElements.resultText.placeholder = '正在接收流式结果...';
                
                await callDashScopeASRAPIStream(processedBlob, currentConfig, {
                    onChunk: (currentText) => {
                        uiElements.resultText.value = currentText;
                    },
                    onFinish: (finalText, lang) => {
                        uiElements.resultText.placeholder = '识别结果将显示在此处...';
                        handleFinalText(finalText, lang);
                    },
                    onError: (err) => {
                        uiElements.errorMessageEl.textContent = '流式识别失败: ' + (err?.message || err);
                        setUIState('error');
                    }
                });

            } else {
                startLoadingTimer();
                let text, lang;
                if (currentConfig.apiProvider === 'free') {
                    [text, lang] = await callFreeASRAPI(processedBlob, currentConfig);
                } else {
                    [text, lang] = await callDashScopeASRAPI(processedBlob, currentConfig);
                }
                const duration = stopLoadingTimer();
                handleFinalText(text, lang, duration);
            }

        } catch (err) {
            stopLoadingTimer();
            uiElements.errorMessageEl.textContent = '识别失败: ' + (err?.message || err);
            setUIState('error');
        }
    };

    const onTranscribeNow = (file) => {
      startTranscription(file);
    };

    initUIEventListeners({
      onRetry: () => setUIState('preview'),
      onTranscribeAnother: () => {
        setUIState('idle');
        currentTranscriptionResult = null;
        setupPreview(null);
      },
      onStartNewRecording: () => {
        setUIState('idle');
        currentTranscriptionResult = null;
        setupPreview(null);
        setTimeout(() => uiElements.recordBtn.click(), 50);
      }
    });
    
    initFileHandler(onFileReady);
    initRecorder(onFileReady, onTranscribeNow);
    initPlayer(() => startTranscription(getOriginalBlob()), () => {
        setUIState('idle');
        currentTranscriptionResult = null;
        setupPreview(null);
    });
    
    loadConfig().then(() => {
        listMicrophones();
    });
    
    const configInputs = [
        uiElements.providerSelect, uiElements.apiKeyInput, uiElements.dashscopeModelSelect, uiElements.langSelect, 
        uiElements.micSelect, uiElements.itnCheckbox, uiElements.autoCopyCheckbox, 
        uiElements.removePeriodCheckbox, uiElements.ctxInput, uiElements.streamingCheckbox,
        uiElements.openaiProcessingCheckbox, uiElements.consoleControlCheckbox,
    ];
    configInputs.forEach(el => el.addEventListener('change', saveConfig));
    
    uiElements.openaiProcessingCheckbox.addEventListener('change', () => {
        if (uiElements.openaiProcessingCheckbox.checked) {
            uiElements.consoleControlCheckbox.checked = false;
        }
    });

    uiElements.consoleControlCheckbox.addEventListener('change', () => {
        if (uiElements.consoleControlCheckbox.checked) {
            uiElements.openaiProcessingCheckbox.checked = false;
        }
    });

    uiElements.speedSlider.addEventListener('change', () => {
        const oldSpeed = currentConfig.transcribeSpeed;
        saveConfig();
        if (uiElements.mainPanel.dataset.state === 'preview' && oldSpeed !== currentConfig.transcribeSpeed) {
            updatePreviewAudioForSpeedChange();
        }
    });

    uiElements.speedSlider.addEventListener('input', () => {
        if (uiElements.speedValue) {
            uiElements.speedValue.textContent = `${Number(uiElements.speedSlider.value).toFixed(2)}x`;
        }
    });

    uiElements.providerSelect.addEventListener('change', toggleProviderSpecificRows);
    navigator.mediaDevices?.addEventListener?.('devicechange', listMicrophones);

    initModal(saveConfig, loadConfig);
    loadHistory();
    fetchAndDisplayGitHubStars();

    uiElements.resultText.addEventListener('input', () => {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            if (currentTranscriptionResult) {
                saveOrUpdateHistory(false);
            }
        }, 1500);
    });

    uiElements.clearHistoryBtn.addEventListener('click', clearHistory);

    uiElements.historyList.addEventListener('click', async (e) => {
        const itemEl = e.target.closest('.history-item');
        if (!itemEl) return;
        const id = Number(itemEl.dataset.id);
        if (e.target.closest('.history-item-delete')) {
            e.stopPropagation();
            const { pagetalk_history = [] } = await chrome.storage.local.get('pagetalk_history');
            const updatedHistory = pagetalk_history.filter(item => item.timestamp !== id);
            await chrome.storage.local.set({ pagetalk_history: updatedHistory });
            renderHistory(updatedHistory);
            toast('Entry deleted.');
        } else {
            const { pagetalk_history = [] } = await chrome.storage.local.get('pagetalk_history');
            const itemToLoad = pagetalk_history.find(item => item.timestamp === id);
            if (itemToLoad) {
                currentTranscriptionResult = itemToLoad;
                uiElements.resultText.value = itemToLoad.text;
                setupPreview(null);
                setUIState('history-result');
                toast('Loaded from history.');
            }
        }
    });

    let isSpacebarDown = false;
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && uiElements.ctxModal && uiElements.ctxModal.style.display !== 'none') {
            uiElements.ctxModal.style.display = 'none';
            return;
        }
         if (e.key === 'Escape' && uiElements.openaiModal && uiElements.openaiModal.style.display !== 'none') {
            uiElements.openaiModal.style.display = 'none';
            loadConfig(); // Revert changes
            return;
        }
        
        if (e.code === 'Space' && !isSpacebarDown) {
            const activeEl = document.activeElement;
            if (activeEl && /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(activeEl.tagName)) {
                return;
            }
            if (uiElements.mainPanel.dataset.state === 'preview') {
                e.preventDefault();
                uiElements.playPauseBtn.click();
                return;
            }
            if (uiElements.mainPanel.dataset.state !== 'idle') {
                return;
            }

            e.preventDefault();
            isSpacebarDown = true;
            uiElements.recordBtn.click();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isSpacebarDown) {
            if (uiElements.recordBtn.classList.contains('recording')) {
                uiElements.recordBtn.click();
            }
            isSpacebarDown = false;
        }
    });
});