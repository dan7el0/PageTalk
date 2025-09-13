

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
  
  // From cs-config.js
  cfg = await loadConfigFromStorage();
  
  // From cs-ui.js
  initializeStyles(cfg.uiScale);
  const ui = createUI();
  createResultOverlay();

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
    }
  });

  ui.btn.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only for left-click
      if (!state.clickToToggle) return;

      isLongPress = false; // Reset on new press
      longPressTimer = setTimeout(() => {
          isLongPress = true;
          chrome.runtime.sendMessage({ type: 'openTranscriptionPage' });
      }, LONG_PRESS_DURATION);
  });

  ui.btn.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return; // Only for left-click
      clearTimeout(longPressTimer);

      if (!isLongPress) {
          if (ui.wrap.dataset.dragged === 'true' || !state.clickToToggle) return;
          toggleRecording();
      }
  });

  // Cancel long press if mouse leaves the button before timeout
  ui.btn.addEventListener('mouseleave', () => {
      clearTimeout(longPressTimer);
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
