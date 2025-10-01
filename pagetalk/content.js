

(async () => {
  'use strict';

  /******************** Core Logic ********************/

  function toggleRecording() {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }

  function matchesHotkey(e, def) {
    if (!def) return false;
    const defParts = def.split('+');
    const defKey = defParts.pop() || '';

    let eventKey = e.key;
    if (eventKey === ' ') eventKey = 'Space';
    if (eventKey.length === 1 && /[a-zA-Z]/.test(eventKey)) eventKey = eventKey.toUpperCase();

    if (eventKey.toLowerCase() !== defKey.toLowerCase()) return false;
    
    const ctrlMatch = defParts.includes('Ctrl') === e.ctrlKey;
    const altMatch = defParts.includes('Alt') === e.altKey;
    const shiftMatch = defParts.includes('Shift') === e.shiftKey;
    
    return ctrlMatch && altMatch && shiftMatch;
  }

  /******************** Main Execution ********************/

  // From cs-connector.js
  connectToServiceWorker();

  // Handle page restoration from back-forward cache to prevent connection errors
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      console.log('PageTalk: Page restored from bfcache. Reconnecting to service worker.');
      connectToServiceWorker();
    }
  });
  
  // From cs-config.js
  cfg = await loadConfigFromStorage();
  
  // From cs-ui.js
  initializeStyles(cfg.uiScale);
  const ui = createUI();
  createResultOverlay();
  
  await loadLastPosition();

  // New position update logic
  const throttledUpdate = throttle(updateUIPosition, 100);
  document.addEventListener('focusin', updateUIPosition, true);
  // Use a timeout on focusout to allow the next element to receive focus before deciding to hide.
  document.addEventListener('focusout', () => setTimeout(updateUIPosition, 0), true);
  window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true });
  window.addEventListener('resize', throttledUpdate, { capture: true, passive: true });
  
  // Initial check in case a field is already focused on page load
  setTimeout(updateUIPosition, 100);

  // Wire up events
  let longPressTimer;
  let isLongPress = false;
  const LONG_PRESS_DURATION = 500; // ms

  // Listen for the custom event from cs-ui.js to cancel long press on drag
  ui.wrap.addEventListener('voiceuidragstart', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  const handlePress = (e) => {
    // For mousedown, only handle left-click. For touchstart, this check is not needed.
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (!state.clickToToggle) return;

    isLongPress = false; // Reset on new press
    longPressTimer = setTimeout(() => {
        isLongPress = true;
        chrome.runtime.sendMessage({ type: 'openTranscriptionPage' });
    }, LONG_PRESS_DURATION);
  };

  const handleRelease = (e) => {
      // For mouseup, only handle left-click.
      if (e.type === 'mouseup' && e.button !== 0) return;
      
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (!isLongPress) {
          // ui.wrap.dataset.dragged is set to 'true' by the draggable logic on move
          if (ui.wrap.dataset.dragged === 'true' || !state.clickToToggle) return;
          toggleRecording();
      }
  };

  const handleCancel = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
  };
  
  // Mouse events
  ui.btn.addEventListener('mousedown', handlePress);
  ui.btn.addEventListener('mouseup', handleRelease);
  ui.btn.addEventListener('mouseleave', handleCancel);

  // Touch events for mobile support
  ui.btn.addEventListener('touchstart', handlePress, { passive: true });
  ui.btn.addEventListener('touchend', handleRelease);
  ui.btn.addEventListener('touchcancel', handleCancel);
  
  // Prevent focus stealing from inputs
  ui.openaiBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  ui.openaiBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isRecording) return;

    const newState = !state.enableOpenaiProcessing;

    try {
      const currentFullConfig = await loadConfigFromStorage();
      
      currentFullConfig.enableOpenaiProcessing = newState;
      if (newState) {
        currentFullConfig.enableConsoleControl = false;
      }

      await chrome.storage.sync.set({ pagetalk_config: currentFullConfig });
      toast(`文本后处理已${newState ? '开启' : '关闭'}`);
    } catch (err) {
      console.error("PageTalk: Failed to save OpenAI processing state", err);
      toast('设置保存失败');
    }
  });

  ui.consoleBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  ui.consoleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isRecording) return;

    const newState = !state.enableConsoleControl;

    try {
      const currentFullConfig = await loadConfigFromStorage();
      
      currentFullConfig.enableConsoleControl = newState;
      if (newState) {
        currentFullConfig.enableOpenaiProcessing = false;
      }

      await chrome.storage.sync.set({ pagetalk_config: currentFullConfig });
      toast(`控制台命令已${newState ? '开启' : '关闭'}`);
    } catch (err) {
      console.error("PageTalk: Failed to save console control state", err);
      toast('设置保存失败');
    }
  });

  // Command Input Button events
  ui.inputBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  ui.inputBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRecording) return;
    ui.inputOverlay.classList.add('visible');
    ui.inputField.focus();
  });

  const closeInputOverlay = () => {
    ui.inputOverlay.classList.remove('visible');
    ui.inputField.value = '';
  };

  const submitInputText = async () => {
    const text = ui.inputField.value.trim();
    if (text) {
      closeInputOverlay();
      await processConsoleCommand(text);
    }
  };

  ui.inputOverlay.addEventListener('click', (e) => {
    if (e.target === ui.inputOverlay) {
      closeInputOverlay();
    }
  });
  
  ui.inputSubmitBtn.addEventListener('click', submitInputText);

  ui.inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      submitInputText();
    } else if (e.key === 'Escape') {
      closeInputOverlay();
    }
  });

  // Prevent focus stealing from inputs
  ui.cancelBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  ui.cancelBtn.addEventListener('click', cancelRecording);

  // Apply initial config
  handleConfigChange(cfg);

  // Keyboard shortcut listener
  window.addEventListener('keydown', (e) => {
    if (matchesHotkey(e, cfg.hotkey)) {
      e.preventDefault();
      e.stopPropagation();
      // Hotkey is global, so we always toggle recording.
      // If no input is focused, the result will be shown in an overlay.
      toggleRecording();
    } else if (isRecording && matchesHotkey(e, cfg.cancelHotkey)) {
      e.preventDefault();
      e.stopPropagation();
      cancelRecording();
    }
  }, true);

})();