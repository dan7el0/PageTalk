import { loadHTMLPartials } from './transcribe-loader.js';
import { currentConfig, loadConfig, saveConfig, listMicrophones, toggleApiKeyVisibility } from './transcribe-config.js';
import { callFreeASRAPI, callDashScopeASRAPI } from './transcribe-api.js';
import { processAudioForTranscription } from './transcribe-audio-processor.js';
import { uiElements, setUIState, toast, initModal, initUIEventListeners, initUIElements } from './transcribe-ui.js';
import { initRecorder } from './transcribe-recorder.js';
import { initPlayer, setupPreview, getOriginalBlob, updatePreviewAudioForSpeedChange } from './transcribe-player.js';
import { initFileHandler } from './transcribe-file-handler.js';

let transcriptionTimerInterval = null;
let transcriptionStartTime = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Load HTML content first
    await loadHTMLPartials();

    // Now that HTML is loaded, initialize the UI element references
    initUIElements();

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

    const startTranscription = async () => {
        const originalAudioBlob = getOriginalBlob();
        if (!originalAudioBlob) {
            toast('没有可供转录的音频。');
            setUIState('idle');
            return;
        }

        if (currentConfig.apiProvider === 'dashscope' && !currentConfig.apiKey) {
            toast('请在下面设置您的阿里云百炼 API Key。');
            return;
        }
        
        setUIState('loading');
        startLoadingTimer();
        
        try {
            toast('正在处理音频...');
            const processedBlob = await processAudioForTranscription(originalAudioBlob, currentConfig.transcribeSpeed);
            toast('正在识别...');

            let text;
            if (currentConfig.apiProvider === 'free') {
                text = await callFreeASRAPI(processedBlob, currentConfig);
            } else {
                text = await callDashScopeASRAPI(processedBlob, currentConfig);
            }
            
            const duration = stopLoadingTimer();

            if (currentConfig.removeTrailingPeriod && text && text.endsWith('。')) {
                text = text.slice(0, -1);
            }

            uiElements.resultText.value = text;
            setUIState('result');
            
            let toastMessage = `识别完成 (耗时 ${duration.toFixed(2)}s)`;
            if (currentConfig.autoCopy && text) {
                try {
                    await navigator.clipboard.writeText(text);
                    toastMessage = `识别完成并已复制 (耗时 ${duration.toFixed(2)}s)`;
                } catch (err) {
                    console.error("Auto-copy failed", err);
                    toastMessage = `识别完成（复制失败, 耗时 ${duration.toFixed(2)}s）`;
                }
            }
            toast(toastMessage);

        } catch (err) {
            stopLoadingTimer();
            uiElements.errorMessageEl.textContent = '识别失败: ' + (err?.message || err);
            setUIState('error');
        }
    };

    // --- INITIALIZATION ---

    initUIEventListeners({
      onRetry: () => setUIState('preview'),
      onTranscribeAnother: () => setUIState('idle'),
    });

    initFileHandler(onFileReady);
    initRecorder(onFileReady);
    initPlayer(startTranscription, () => setUIState('idle'));
    
    // Initialize config and its UI interactions
    loadConfig().then(() => {
        listMicrophones();
    });
    
    // Setup config change listeners
    const configInputs = [
        uiElements.providerSelect, uiElements.apiKeyInput, uiElements.langSelect, 
        uiElements.micSelect, uiElements.itnCheckbox, uiElements.autoCopyCheckbox, 
        uiElements.removePeriodCheckbox, uiElements.ctxInput
    ];
    configInputs.forEach(el => el.addEventListener('change', saveConfig));
    
    uiElements.speedSelect.addEventListener('change', () => {
        const oldSpeed = currentConfig.transcribeSpeed;
        saveConfig();
        if (uiElements.mainPanel.dataset.state === 'preview' && oldSpeed !== currentConfig.transcribeSpeed) {
            updatePreviewAudioForSpeedChange();
        }
    });

    uiElements.providerSelect.addEventListener('change', toggleApiKeyVisibility);
    navigator.mediaDevices?.addEventListener?.('devicechange', listMicrophones);

    initModal(saveConfig);

    // --- HOTKEYS ---
    let isSpacebarDown = false;
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && uiElements.ctxModal && uiElements.ctxModal.style.display !== 'none') {
            uiElements.ctxModal.style.display = 'none';
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
            // The recorder module handles its own state, so we just trigger the button
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