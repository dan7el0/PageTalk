

'use strict';

let ui = {};
let resultOverlay, resultTextEl;
let lastPositionedElement = null; // Track the last element we auto-positioned to
let lastUIPosition = { x: window.innerWidth, y: window.innerHeight - 80 }; // For docking

async function saveLastPosition() {
  try {
    await chrome.storage.local.set({ pagetalk_last_position: lastUIPosition });
  } catch (e) {
    console.error("PageTalk: Error saving last UI position", e);
  }
}

async function loadLastPosition() {
  try {
    const result = await chrome.storage.local.get('pagetalk_last_position');
    if (result.pagetalk_last_position) {
      // Basic validation
      if (typeof result.pagetalk_last_position.x === 'number' && typeof result.pagetalk_last_position.y === 'number') {
        lastUIPosition = result.pagetalk_last_position;
      }
    }
  } catch (e) {
    console.error("PageTalk: Error loading last UI position", e);
  }
}

function addStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function cssEscape(v) { return String(v).replace(/[^0-9.\-]/g, ''); }

const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

function initializeStyles(scale) {
    addStyle(`
    :root { --voiceui-scale: ${cssEscape(scale)}; }
    .voiceui-wrap {
      position: fixed;
      z-index: 2147483647;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
      transition: top 0.2s ease-out, left 0.2s ease-out, right 0.2s ease-out, bottom 0.2s ease-out, opacity 0.2s ease-out, transform 0.2s ease-out;
      opacity: 0;
      transform: scale(0.9);
      pointer-events: none;
    }
    /* Create an invisible hover area around the button to bridge the gap to the side buttons */
    .voiceui-wrap:not(.recording):hover::before {
      content: '';
      position: absolute;
      z-index: 0;
      left: calc(-100px * var(--voiceui-scale));
      right: calc(-100px * var(--voiceui-scale));
      top: 0;
      bottom: 0;
    }
    .voiceui-wrap.voiceui-visible {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }
    .voiceui-wrap.voiceui-dragging {
      transition: none;
    }
    .voiceui-draggable { touch-action: none; }
    .voiceui-btn { width: calc(42px * var(--voiceui-scale)); height: calc(42px * var(--voiceui-scale)); border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.24); background: #111; color: #fff; position: relative; user-select: none; z-index: 2; }
    .voiceui-btn:hover { filter: brightness(1.08); }
    .voiceui-btn:active { transform: translateY(1px); }
    .voiceui-pulse { position: absolute; inset: -6px; border-radius: 999px; box-shadow: 0 0 0 2px rgba(0, 200, 120, .35); opacity: 0; transition: opacity .2s ease; }
    .voiceui-btn.recording .voiceui-pulse { opacity: 1; animation: voiceui-pulse 1.1s ease-out infinite; }
    @keyframes voiceui-pulse { 0% { box-shadow: 0 0 0 0 rgba(0, 200, 120, .65);} 100% { box-shadow: 0 0 0 12px rgba(0, 200, 120, 0);} }
    .voiceui-icon { width: 50%; height: 50%; display: block; }
    .voiceui-badge { position: absolute; top: -6px; right: -6px; background: #22c55e; color: #fff; border-radius: 999px; height: calc(18px * var(--voiceui-scale)); min-width: calc(18px * var(--voiceui-scale)); padding: 0 4px; font-size: calc(11px * var(--voiceui-scale)); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,.24); z-index: 3; }
    .voiceui-tooltip { position: absolute; bottom: calc(50px * var(--voiceui-scale)); left: 0; background: #111; color: #ddd; font-size: calc(12px * var(--voiceui-scale)); padding: 6px 8px; border-radius: 10px; white-space: nowrap; transform: translateX(-50%); box-shadow: 0 8px 24px rgba(0,0,0,.25); display: none; }
    .voiceui-btn:hover + .voiceui-tooltip { display: block; }

    .voiceui-streaming-text {
      position: absolute;
      top: calc(50px * var(--voiceui-scale));
      left: 50%;
      transform: translateX(-50%);
      background: #111;
      color: #ddd;
      font-size: calc(13px * var(--voiceui-scale));
      padding: 8px 12px;
      border-radius: 10px;
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
      display: none;
      max-width: 300px;
      text-overflow: ellipsis;
      overflow: hidden;
      z-index: 4;
      pointer-events: none;
    }
    
    .voiceui-side-btn {
      position: absolute;
      bottom: calc(8px * var(--voiceui-scale));
      width: calc(27px * var(--voiceui-scale));
      height: calc(27px * var(--voiceui-scale));
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      background: #374151;
      color: #fff;
      user-select: none;
      transition: all .2s ease-out;
      opacity: 0;
      transform: translateX(calc(8px * var(--voiceui-scale))) scale(0.8);
      pointer-events: none;
      z-index: 1;
    }
    .voiceui-wrap:not(.recording) .voiceui-side-btn:active { transform: translateX(0) translateY(1px) scale(0.95); }
    .voiceui-side-btn:hover { background: #4b5563; }
    .voiceui-side-btn.active { background: #3b82f6; }
    .voiceui-side-btn.active:hover { background: #60a5fa; }
    .voiceui-wrap:not(.recording):hover .voiceui-openai-btn,
    .voiceui-wrap:not(.recording):hover .voiceui-console-btn {
      opacity: 1;
      transform: translateX(0) scale(1);
      pointer-events: auto;
    }

    .voiceui-console-btn {
      right: calc(50px * var(--voiceui-scale));
    }

    .voiceui-openai-btn {
      right: calc(82px * var(--voiceui-scale));
    }

    .voiceui-input-btn {
      left: calc(50px * var(--voiceui-scale));
      opacity: 0;
      transform: translateX(calc(-8px * var(--voiceui-scale))) scale(0.8);
      pointer-events: none;
    }
    .voiceui-wrap.console-enabled:not(.recording):hover .voiceui-input-btn {
      opacity: 1;
      transform: translateX(0) scale(1);
      pointer-events: auto;
    }

    .voiceui-cancel-btn {
      position: absolute;
      bottom: calc(8px * var(--voiceui-scale));
      left: calc(50px * var(--voiceui-scale));
      width: calc(27px * var(--voiceui-scale));
      height: calc(27px * var(--voiceui-scale));
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      background: #374151;
      color: #fff;
      user-select: none;
      transition: all .2s ease-out;
      opacity: 0;
      transform: translateX(calc(-8px * var(--voiceui-scale))) scale(0.8);
      pointer-events: none;
      z-index: 1;
    }
    .voiceui-wrap.recording .voiceui-cancel-btn {
      opacity: 1;
      transform: translateX(0) scale(1);
      pointer-events: auto;
    }
    .voiceui-cancel-btn:hover { background: #ef4444; }
    .voiceui-wrap.recording .voiceui-cancel-btn:active { transform: translateX(0) translateY(1px) scale(0.95); }

    /* Result Overlay Styles */
    .voiceui-result-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2147483646; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s ease-in-out; pointer-events: none; }
    .voiceui-result-overlay.visible { opacity: 1; pointer-events: auto; }
    .voiceui-result-panel { background: #2d2d2d; color: #eee; border-radius: 12px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,.3); display: flex; flex-direction: column; gap: 16px; transform: scale(0.95); transition: transform .2s ease-out; }
    .voiceui-result-overlay.visible .voiceui-result-panel { transform: scale(1); }
    .voiceui-result-text { background: #1f1f1f; border: 1px solid #444; border-radius: 8px; padding: 12px; font-size: 14px; line-height: 1.6; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
    .voiceui-result-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .voiceui-result-btn { background: #444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background .2s; }
    .voiceui-result-btn:hover { background: #555; }
    .voiceui-result-btn.primary { background: #3385ff; }
    .voiceui-result-btn.primary:hover { background: #4090ff; }

    /* Input Overlay Styles */
    .voiceui-input-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s ease-in-out; pointer-events: none; }
    .voiceui-input-overlay.visible { opacity: 1; pointer-events: auto; }
    .voiceui-input-box { background: #2d2d2d; border-radius: 12px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,.3); display: flex; gap: 12px; transform: scale(0.95); transition: transform .2s ease-out; }
    .voiceui-input-overlay.visible .voiceui-input-box { transform: scale(1); }
    .voiceui-input-field { flex: 1; background: #1f1f1f; border: 1px solid #444; border-radius: 8px; padding: 12px; font-size: 14px; color: #eee; outline: none; }
    .voiceui-input-field:focus { border-color: #3385ff; }
    .voiceui-input-submit { background: #3385ff; color: #fff; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background .2s; }
    .voiceui-input-submit:hover { background: #4090ff; }

    /* Docking Styles */
    .voiceui-wrap.voiceui-docked-right,
    .voiceui-wrap.voiceui-docked-left {
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .voiceui-wrap.voiceui-docked-right::after,
    .voiceui-wrap.voiceui-docked-left::after {
      content: '';
      position: absolute;
      top: -20px;
      bottom: -20px;
      z-index: 1;
    }

    .voiceui-wrap.voiceui-docked-right {
      transform: translateX(calc( (42px * var(--voiceui-scale)) - 18px) );
    }
    .voiceui-wrap.voiceui-docked-right::after {
      left: -40px; /* Hover area extends 40px inwards */
      right: 0;
    }

    .voiceui-wrap.voiceui-docked-left {
      transform: translateX(calc(-1 * ( (42px * var(--voiceui-scale)) - 18px) ));
    }
    .voiceui-wrap.voiceui-docked-left::after {
      right: -40px; /* Hover area extends 40px inwards */
      left: 0;
    }

    .voiceui-wrap.voiceui-docked-right:hover,
    .voiceui-wrap.voiceui-docked-left:hover {
      transform: translateX(0);
    }
  `);
}

function undockUI() {
  if (!ui.wrap) return;
  ui.wrap.classList.remove('voiceui-docked-left', 'voiceui-docked-right');
}

function dockUI() {
  if (!ui.wrap) return;

  // Don't dock if being dragged, recording, or if it should be hidden
  if (ui.wrap.dataset.isDragging === 'true' || isRecording || state.hideOnNoFocus) return;

  undockUI();

  // If the user has dragged it, respect that position to decide which side to dock to.
  // Otherwise, default to right.
  const dockToRight = (lastUIPosition.x + (ui.wrap.offsetWidth / 2)) > (window.innerWidth / 2);

  const clampedTop = Math.max(10, Math.min(lastUIPosition.y, window.innerHeight - ui.wrap.offsetHeight - 10));

  if (dockToRight) {
    ui.wrap.classList.add('voiceui-docked-right');
    Object.assign(ui.wrap.style, {
      left: 'auto',
      right: '0px',
      bottom: 'auto',
      top: `${clampedTop}px`,
    });
  } else {
    ui.wrap.classList.add('voiceui-docked-left');
    Object.assign(ui.wrap.style, {
      left: '0px',
      right: 'auto',
      bottom: 'auto',
      top: `${clampedTop}px`,
    });
  }
}

function moveToDefaultPosition() {
  if (!ui.wrap) return;
  ui.wrap.dataset.dragged = 'false';
  dockUI(); // Replaced original logic with docking
}

function updateUIPosition() {
  if (!cfg.clickToToggle || !ui.wrap || isRecording) return;

  const activeEl = getActiveEditable();
  
  if (ui.wrap.dataset.isDragging === 'true') return;

  if (activeEl) {
    undockUI(); // Undock when attaching to an element
    ui.wrap.classList.add('voiceui-visible');
    lastPositionedElement = activeEl;

    if (ui.wrap.dataset.dragged !== 'true') {
      const elRect = activeEl.getBoundingClientRect();
      if (elRect.width === 0 || elRect.height === 0 || elRect.top < -50 || elRect.bottom > window.innerHeight + 50) {
        // If the element is off-screen, go to idle/docked mode instead of following it
        moveToDefaultPosition();
        return;
      }
      const wrapWidth = 42 * state.uiScale;
      const wrapHeight = 42 * state.uiScale;
      
      let top = elRect.top + (elRect.height / 2) - (wrapHeight / 2);
      let left = elRect.right + 8;

      if (left + wrapWidth > window.innerWidth - 10) {
          left = elRect.left - wrapWidth - 8;
      }
      if (left < 10) left = 10;
      if (top < 10) top = 10;
      if (top + wrapHeight > window.innerHeight - 10) {
          top = window.innerHeight - wrapHeight - 10;
      }
      
      Object.assign(ui.wrap.style, {
        top: `${top}px`,
        left: `${left}px`,
        right: 'auto',
        bottom: 'auto'
      });
      // After positioning, save this as the last known good spot
      const rect = ui.wrap.getBoundingClientRect();
      lastUIPosition = { x: rect.left, y: rect.top };
    }
  } else {
    // No active element
    lastPositionedElement = null;
    if (state.hideOnNoFocus) {
      ui.wrap.classList.remove('voiceui-visible');
    } else {
      ui.wrap.classList.add('voiceui-visible');
      moveToDefaultPosition(); // This will now dock the UI
    }
  }
}

function createUI() {
  const wrap = document.createElement('div');
  wrap.className = 'voiceui-wrap voiceui-draggable';

  const openaiBtn = document.createElement('div');
  openaiBtn.className = 'voiceui-openai-btn voiceui-side-btn';
  openaiBtn.title = '切换文本后处理';
  openaiBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L9.25 8.75L3.5 9.5L8.38 13.88L7 19.5L12 16.25L17 19.5L15.62 13.88L20.5 9.5L14.75 8.75L12 3Z"/><path d="M3.5 15.5L4.5 14.5"/><path d="M19.5 15.5L18.5 14.5"/><path d="M12 21V20"/><path d="M12 4V3"/></svg>`;

  const consoleBtn = document.createElement('div');
  consoleBtn.className = 'voiceui-console-btn voiceui-side-btn';
  consoleBtn.title = '切换控制台命令模式';
  consoleBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6-6-6m8 12h8"/></svg>`;

  const cancelBtn = document.createElement('div');
  cancelBtn.className = 'voiceui-cancel-btn';
  cancelBtn.title = '取消录音';
  cancelBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;

  const inputBtn = document.createElement('div');
  inputBtn.className = 'voiceui-input-btn voiceui-side-btn';
  inputBtn.title = '键盘输入命令';
  inputBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 7Z M8 10H8.01 M12 10H12.01 M16 10H16.01 M16 14H8"/></svg>`;

  const btn = document.createElement('div');
  btn.className = 'voiceui-btn';
  btn.title = '语音输入';
  btn.innerHTML = `<div class="voiceui-pulse"></div><svg class="voiceui-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 1.85 1.325 3.175T12 15.5q1.85 0 3.175-1.325T16.5 11h2q0 2.5-1.7 4.5T13 18v3Z"/></svg>`;

  const tip = document.createElement('div');
  tip.className = 'voiceui-tooltip';
  
  const streamingText = document.createElement('div');
  streamingText.className = 'voiceui-streaming-text';

  const badge = document.createElement('div');
  badge.className = 'voiceui-badge';
  badge.textContent = '…';

  wrap.appendChild(openaiBtn);
  wrap.appendChild(consoleBtn);
  wrap.appendChild(cancelBtn);
  wrap.appendChild(inputBtn);
  wrap.appendChild(btn);
  wrap.appendChild(tip);
  wrap.appendChild(streamingText);
  wrap.appendChild(badge);
  document.documentElement.appendChild(wrap);

  // Create Command Input Overlay
  const inputOverlay = document.createElement('div');
  inputOverlay.className = 'voiceui-input-overlay';
  const inputBox = document.createElement('div');
  inputBox.className = 'voiceui-input-box';
  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.className = 'voiceui-input-field';
  inputField.placeholder = '输入命令，例如 "刷新页面"';
  const inputSubmitBtn = document.createElement('button');
  inputSubmitBtn.className = 'voiceui-input-submit';
  inputSubmitBtn.textContent = '执行';
  inputBox.appendChild(inputField);
  inputBox.appendChild(inputSubmitBtn);
  inputOverlay.appendChild(inputBox);
  document.documentElement.appendChild(inputOverlay);

  makeDraggable(wrap, btn);
  
  // Assign to the global `ui` object
  ui = { wrap, btn, badge, tip, cancelBtn, streamingText, consoleBtn, openaiBtn, inputBtn, inputOverlay, inputField, inputSubmitBtn };

  return ui;
}

function createResultOverlay() {
  resultOverlay = document.createElement('div');
  resultOverlay.className = 'voiceui-result-overlay';
  
  const panel = document.createElement('div');
  panel.className = 'voiceui-result-panel';
  
  resultTextEl = document.createElement('div');
  resultTextEl.className = 'voiceui-result-text';

  const actions = document.createElement('div');
  actions.className = 'voiceui-result-actions';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'voiceui-result-btn';
  closeBtn.textContent = '关闭';
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'voiceui-result-btn primary';
  copyBtn.textContent = '复制';
  
  actions.appendChild(closeBtn);
  actions.appendChild(copyBtn);
  panel.appendChild(resultTextEl);
  panel.appendChild(actions);
  resultOverlay.appendChild(panel);
  
  document.documentElement.appendChild(resultOverlay);
  
  closeBtn.addEventListener('click', hideResultOverlay);
  resultOverlay.addEventListener('click', (e) => {
    if (e.target === resultOverlay) {
      hideResultOverlay();
    }
  });

  copyBtn.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(resultTextEl.textContent).then(() => {
        toast('已复制到剪贴板');
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
          copyBtn.textContent = '复制';
        }, 2000);
      }).catch(err => {
        toast('复制失败');
        console.error('Copy failed:', err);
      });
    }
  });
}

function showResultOverlay(text) {
  if (!resultOverlay) return;
  resultTextEl.textContent = text;
  resultOverlay.classList.add('visible');
}

function hideResultOverlay() {
  if (resultOverlay) {
    resultOverlay.classList.remove('visible');
  }
}

function toast(msg) {
  const n = document.createElement('div');
  n.innerHTML = String(msg).replace(/\n/g, '<br>');
  Object.assign(n.style, { position: 'fixed', left: '50%', bottom: '20%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.85)', color: '#fff', padding: '10px 16px', borderRadius: '10px', zIndex: 2147483647, fontSize: '13px', boxShadow: '0 8px 24px rgba(0,0,0,.35)', maxWidth: '90%', textAlign: 'center', boxSizing: 'border-box' });
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 5000);
}

function setButtonLevel(rms) {
  if (!ui.btn) return;
  const level = Math.min(1, rms * 8);
  const shadow = 24 + Math.round(level * 24);
  const green = Math.round(120 + level * 80);
  ui.btn.style.boxShadow = `0 8px ${shadow}px rgba(0,0,0,.24), 0 0 ${8 + level*12}px rgba(0, ${green}, 120, ${0.2 + level * 0.4})`;
}

function makeDraggable(container, handle) {
  let dragging = false, sx=0, sy=0, initialTop=0, initialLeft=0;
  const DRAG_THRESHOLD = 5;

  const onDown = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    undockUI(); // Undock when starting a drag
    dragging = true;
    container.classList.add('voiceui-dragging');
    container.dataset.isDragging = 'true';
    container.dataset.dragged = 'false';

    sx = e.touches ? e.touches[0].clientX : e.clientX;
    sy = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = container.getBoundingClientRect();
    initialTop = rect.top;
    initialLeft = rect.left;
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - sx;
    const dy = cy - sy;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      if (container.dataset.dragged !== 'true') {
        container.dataset.dragged = 'true';
        // Dispatch a custom event to notify other parts of the app
        container.dispatchEvent(new CustomEvent('voiceuidragstart'));
      }
    }
    
    container.style.left = (initialLeft + dx) + 'px';
    container.style.top = (initialTop + dy) + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  };

  const onUp = () => { 
    if (!dragging) return;
    dragging = false; 
    container.classList.remove('voiceui-dragging');
    container.dataset.isDragging = 'false';

    // Save the final position
    const rect = container.getBoundingClientRect();
    lastUIPosition = { x: rect.left, y: rect.top };
    
    saveLastPosition();

    // After a drag, re-evaluate if we should dock
    setTimeout(updateUIPosition, 100);
  };

  handle.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  handle.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
}

function updateUIAfterConfigChange(newConfig) {
    if (ui.wrap) {
        if (newConfig.clickToToggle) {
            ui.wrap.style.display = '';
            ui.tip.textContent = '单击录音，长按打开转录页面';
            updateUIPosition();
        } else {
            ui.wrap.style.display = 'none';
            ui.tip.textContent = '';
            ui.wrap.classList.remove('voiceui-visible');
        }
    }

    if (ui.consoleBtn) {
        ui.consoleBtn.classList.toggle('active', newConfig.enableConsoleControl);
    }

    if (ui.wrap) {
        ui.wrap.classList.toggle('console-enabled', newConfig.enableConsoleControl);
    }

    if (ui.openaiBtn) {
        ui.openaiBtn.classList.toggle('active', newConfig.enableOpenaiProcessing);
    }
    
    if (state.uiScale !== newConfig.uiScale) {
        state.uiScale = newConfig.uiScale;
        document.documentElement.style.setProperty('--voiceui-scale', String(state.uiScale));
        updateUIPosition(); // Re-calculate position on scale change
    }
}