
'use strict';

let ui = {};
let resultOverlay, resultTextEl;
let lastPositionedElement = null; // Track the last element we auto-positioned to

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
    .voiceui-wrap.voiceui-visible {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
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

    .voiceui-cancel-btn {
      position: absolute;
      bottom: calc(8px * var(--voiceui-scale));
      right: calc(50px * var(--voiceui-scale));
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
  `);
}

function moveToDefaultPosition() {
  if (!ui.wrap) return;
  Object.assign(ui.wrap.style, {
    top: 'auto',
    left: 'auto',
    right: '20px',
    bottom: '20px',
  });
  ui.wrap.dataset.dragged = 'false';
}

function updateUIPosition() {
  if (!cfg.clickToToggle || !ui.wrap) return;

  const activeEl = getActiveEditable();
  
  if (ui.wrap.dataset.isDragging === 'true') return;

  if (activeEl !== lastPositionedElement) {
    ui.wrap.dataset.dragged = 'false';
  }
  lastPositionedElement = activeEl;

  ui.wrap.classList.add('voiceui-visible');

  if (activeEl && ui.wrap.dataset.dragged !== 'true') {
    const elRect = activeEl.getBoundingClientRect();
    if (elRect.width === 0 || elRect.height === 0 || elRect.top < -50 || elRect.bottom > window.innerHeight + 50) {
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
  } else if (!activeEl) {
    moveToDefaultPosition();
  }
}

function createUI() {
  const wrap = document.createElement('div');
  wrap.className = 'voiceui-wrap voiceui-draggable';

  const cancelBtn = document.createElement('div');
  cancelBtn.className = 'voiceui-cancel-btn';
  cancelBtn.title = '取消录音';
  cancelBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="currentColor"><path d="m12 13.4 5.6 5.6q.275.275.7.275.425 0 .7-.7.275-.275.275-.7 0-.425-.7-.7L13.4 12l5.6-5.6q.275-.275.275-.7 0-.425-.7-.7-.275-.275-.7-.275-.425 0-.7.7L12 10.6 6.4 5q-.275-.275-.7-.275-.425 0-.7.7-.275.275.275-.7 0 .425.7.7L10.6 12l-5.6 5.6q-.275.275-.275.7 0 .425.7.7.275.275.7.275.425 0 .7-.7Z"/></svg>`;

  const btn = document.createElement('div');
  btn.className = 'voiceui-btn';
  btn.title = '语音输入';
  btn.innerHTML = `<div class="voiceui-pulse"></div><svg class="voiceui-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 1.85 1.325 3.175T12 15.5q1.85 0 3.175-1.325T16.5 11h2q0 2.5-1.7 4.5T13 18v3Z"/></svg>`;

  const tip = document.createElement('div');
  tip.className = 'voiceui-tooltip';

  const badge = document.createElement('div');
  badge.className = 'voiceui-badge';
  badge.textContent = '…';

  wrap.appendChild(cancelBtn);
  wrap.appendChild(btn);
  wrap.appendChild(tip);
  wrap.appendChild(badge);
  document.documentElement.appendChild(wrap);

  makeDraggable(wrap, btn);
  
  // Assign to the global `ui` object
  ui = { wrap, btn, badge, tip, cancelBtn };

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
  n.textContent = String(msg);
  Object.assign(n.style, { position: 'fixed', left: '50%', bottom: '20%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.85)', color: '#fff', padding: '8px 12px', borderRadius: '10px', zIndex: 2147483647, fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,.35)' });
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2000);
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
    dragging = true;
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
      container.dataset.dragged = 'true';
    }
    
    container.style.left = (initialLeft + dx) + 'px';
    container.style.top = (initialTop + dy) + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  };

  const onUp = () => { 
    dragging = false; 
    container.dataset.isDragging = 'false';
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
    
    if (state.uiScale !== newConfig.uiScale) {
        state.uiScale = newConfig.uiScale;
        document.documentElement.style.setProperty('--voiceui-scale', String(state.uiScale));
        updateUIPosition(); // Re-calculate position on scale change
    }
}
