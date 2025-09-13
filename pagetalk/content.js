

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
  createTranscriptionPanel();

  // Wire up events
  ui.btn.addEventListener('click', () => {
    if (ui.wrap.dataset.dragged === 'true') return;
    if (!state.clickToToggle) return;
    toggleRecording();
  });
  ui.btn.addEventListener('dblclick', () => {
    if (ui.wrap.dataset.dragged === 'true') return;
    showTranscriptionPanel();
  });
  ui.cancelBtn.addEventListener('click', cancelRecording);

  // Apply initial config
  handleConfigChange(cfg);

  // Keyboard shortcut listener
  window.addEventListener('keydown', (e) => {
    if (matchesHotkey(e, cfg.hotkey)) {
      e.preventDefault();
      e.stopPropagation();
      toggleRecording();
    } else if (isRecording && matchesHotkey(e, cfg.cancelHotkey)) {
      e.preventDefault();
      e.stopPropagation();
      cancelRecording();
    }
  }, true);

})();