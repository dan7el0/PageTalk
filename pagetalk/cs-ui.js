'use strict';

let ui = {};
let resultOverlay, resultTextEl;
let transcriptionPanelElements = {};

function addStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function cssEscape(v) { return String(v).replace(/[^0-9.\-]/g, ''); }

function initializeStyles(scale) {
    addStyle(`
    :root { --voiceui-scale: ${cssEscape(scale)}; }
    .voiceui-wrap { position: fixed; right: calc(16px * var(--voiceui-scale)); bottom: calc(16px * var(--voiceui-scale)); z-index: 2147483647; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; }
    .voiceui-draggable { touch-action: none; }
    .voiceui-btn { width: calc(56px * var(--voiceui-scale)); height: calc(56px * var(--voiceui-scale)); border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.24); background: #111; color: #fff; position: relative; user-select: none; z-index: 2; }
    .voiceui-btn:hover { filter: brightness(1.08); }
    .voiceui-btn:active { transform: translateY(1px); }
    .voiceui-pulse { position: absolute; inset: -6px; border-radius: 999px; box-shadow: 0 0 0 2px rgba(0, 200, 120, .35); opacity: 0; transition: opacity .2s ease; }
    .voiceui-btn.recording .voiceui-pulse { opacity: 1; animation: voiceui-pulse 1.1s ease-out infinite; }
    @keyframes voiceui-pulse { 0% { box-shadow: 0 0 0 0 rgba(0, 200, 120, .65);} 100% { box-shadow: 0 0 0 12px rgba(0, 200, 120, 0);} }
    .voiceui-icon { width: 50%; height: 50%; display: block; }
    .voiceui-badge { position: absolute; top: -6px; right: -6px; background: #22c55e; color: #fff; border-radius: 999px; height: calc(18px * var(--voiceui-scale)); min-width: calc(18px * var(--voiceui-scale)); padding: 0 4px; font-size: calc(11px * var(--voiceui-scale)); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,.24); z-index: 3; }
    .voiceui-tooltip { position: absolute; bottom: calc(64px * var(--voiceui-scale)); left: 0; background: #111; color: #ddd; font-size: calc(12px * var(--voiceui-scale)); padding: 6px 8px; border-radius: 10px; white-space: nowrap; transform: translateX(-50%); box-shadow: 0 8px 24px rgba(0,0,0,.25); display: none; }
    .voiceui-btn:hover + .voiceui-tooltip { display: block; }

    .voiceui-cancel-btn {
      position: absolute;
      bottom: calc(10px * var(--voiceui-scale));
      right: calc(64px * var(--voiceui-scale));
      width: calc(36px * var(--voiceui-scale));
      height: calc(36px * var(--voiceui-scale));
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
      transform: translateX(calc(10px * var(--voiceui-scale))) scale(0.8);
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
    
    /* Transcription Panel Styles */
    .voiceui-panel-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s ease-in-out; pointer-events: none; }
    .voiceui-panel-overlay.visible { opacity: 1; pointer-events: auto; }
    .voiceui-panel-main { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; background: #2a2a2e; color: #eee; border-radius: 16px; padding: 24px; width: 90%; max-width: 550px; box-shadow: 0 10px 40px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 16px; transform: scale(0.95); transition: transform .2s ease-out; position: relative; border: 1px solid rgba(255,255,255,0.1); }
    .voiceui-panel-overlay.visible .voiceui-panel-main { transform: scale(1); }
    .voiceui-panel-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #999; font-size: 24px; cursor: pointer; line-height: 1; padding: 4px; }
    .voiceui-panel-close:hover { color: #fff; }
    .voiceui-panel-main h2 { margin: 0; font-size: 20px; color: #fff; font-weight: 600; }
    .voiceui-panel-main p { margin: 0; color: #aaa; font-size: 14px; }
    .voiceui-panel-dropzone { border: 2px dashed #555; border-radius: 12px; padding: 32px; text-align: center; cursor: pointer; transition: all .2s; position: relative; min-height: 150px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
    .voiceui-panel-dropzone.dragover { border-color: #3385ff; background: rgba(51, 133, 255, 0.1); }
    .voiceui-panel-dropzone-content { display: none; }
    .voiceui-panel-dropzone-content.active { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
    .voiceui-panel-dropzone .icon { width: 48px; height: 48px; color: #888; }
    .voiceui-panel-dropzone span { font-size: 16px; font-weight: 500; color: #ccc; }
    .voiceui-panel-dropzone small { font-size: 12px; color: #888; max-width: 90%; }
    .voiceui-panel-result-view { display: none; flex-direction: column; gap: 12px; }
    .voiceui-panel-result-view.visible { display: flex; }
    .voiceui-panel-result-text { background: #1f1f1f; border: 1px solid #444; border-radius: 8px; padding: 12px; font-size: 14px; line-height: 1.6; min-height: 150px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; color: #eee; font-family: inherit; resize: vertical; }
    .voiceui-panel-result-actions { display: flex; justify-content: flex-end; }
    .voiceui-panel-copy-btn { background: #3385ff; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .voiceui-panel-copy-btn:hover { background: #4090ff; }
    .voiceui-spinner { width: 48px; height: 48px; border: 4px solid #555; border-top-color: #fff; border-radius: 50%; animation: voiceui-spin 1s linear infinite; }
    @keyframes voiceui-spin { to { transform: rotate(360deg); } }
  `);
}

function createUI() {
  const wrap = document.createElement('div');
  wrap.className = 'voiceui-wrap voiceui-draggable';

  const cancelBtn = document.createElement('div');
  cancelBtn.className = 'voiceui-cancel-btn';
  cancelBtn.title = '取消录音';
  cancelBtn.innerHTML = `<svg class="voiceui-icon" style="width: 60%; height: 60%;" viewBox="0 0 24 24" fill="currentColor"><path d="m12 13.4 5.6 5.6q.275.275.7.275.425 0 .7-.7.275-.275.275-.7 0-.425-.7-.7L13.4 12l5.6-5.6q.275-.275.275-.7 0-.425-.7-.7-.275-.275-.7-.275-.425 0-.7.7L12 10.6 6.4 5q-.275-.275-.7-.275-.425 0-.7.7-.275.275-.275.7 0 .425.7.7L10.6 12l-5.6 5.6q-.275.275-.275.7 0 .425.7.7.275.275.7.275.425 0 .7-.7Z"/></svg>`;

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

const SUPPORTED_FORMATS = ['aac', 'amr', 'avi', 'aiff', 'flac', 'flv', 'm4a', 'mkv', 'mp3', 'mp4', 'mpeg', 'ogg', 'opus', 'wav', 'webm', 'wma', 'wmv'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function createTranscriptionPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'voiceui-panel-overlay';

  const panel = document.createElement('div');
  panel.className = 'voiceui-panel-main';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'voiceui-panel-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = '关闭';

  const title = document.createElement('h2');
  title.textContent = '文件转录';

  const desc = document.createElement('p');
  desc.textContent = '将支持的音频文件拖放到下面的区域中（双击按钮可打开/关闭此面板）';

  const dropzone = document.createElement('div');
  dropzone.className = 'voiceui-panel-dropzone';

  const idleContent = document.createElement('div');
  idleContent.className = 'voiceui-panel-dropzone-content';
  idleContent.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg><span>拖放文件至此</span><small>支持格式: ${SUPPORTED_FORMATS.slice(0, 4).join(', ')} 等，大小不超过 ${MAX_FILE_SIZE_MB}MB</small>`;
  
  const loadingContent = document.createElement('div');
  loadingContent.className = 'voiceui-panel-dropzone-content';
  loadingContent.innerHTML = `<div class="voiceui-spinner"></div><span>正在识别...</span>`;

  const errorContent = document.createElement('div');
  errorContent.className = 'voiceui-panel-dropzone-content';
  errorContent.innerHTML = `<svg class="icon" style="color: #ef4444;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span class="voiceui-panel-error-message"></span>`;
  const errorMessageEl = errorContent.querySelector('.voiceui-panel-error-message');

  const resultView = document.createElement('div');
  resultView.className = 'voiceui-panel-result-view';

  const resultText = document.createElement('textarea');
  resultText.className = 'voiceui-panel-result-text';
  resultText.readOnly = true;

  const resultActions = document.createElement('div');
  resultActions.className = 'voiceui-panel-result-actions';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'voiceui-panel-copy-btn';
  copyBtn.textContent = '复制';

  dropzone.appendChild(idleContent);
  dropzone.appendChild(loadingContent);
  dropzone.appendChild(errorContent);
  resultActions.appendChild(copyBtn);
  resultView.appendChild(resultText);
  resultView.appendChild(resultActions);
  panel.appendChild(closeBtn);
  panel.appendChild(title);
  panel.appendChild(desc);
  panel.appendChild(dropzone);
  panel.appendChild(resultView);
  overlay.appendChild(panel);
  document.documentElement.appendChild(overlay);

  transcriptionPanelElements = { overlay, dropzone, idleContent, loadingContent, errorContent, errorMessageEl, resultView, resultText, copyBtn };
  
  const setDropzoneState = (state) => { // state: 'idle', 'loading', 'error'
    idleContent.classList.toggle('active', state === 'idle');
    loadingContent.classList.toggle('active', state === 'loading');
    errorContent.classList.toggle('active', state === 'error');
  };

  const resetPanel = () => {
    setDropzoneState('idle');
    resultView.classList.remove('visible');
    dropzone.style.display = 'flex';
  }
  
  closeBtn.addEventListener('click', hideTranscriptionPanel);
  overlay.addEventListener('click', e => e.target === overlay && hideTranscriptionPanel());
  
  dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
  
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    if (state.apiProvider === 'dashscope' && !state.apiKey) {
      toast('请点击浏览器右上角的扩展图标，设置您的阿里云百炼 API Key。');
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_FORMATS.includes(extension)) {
      errorMessageEl.textContent = `不支持的文件格式。请使用 ${SUPPORTED_FORMATS.join(', ')}。`;
      setDropzoneState('error');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errorMessageEl.textContent = `文件过大。最大允许 ${MAX_FILE_SIZE_MB}MB。`;
      setDropzoneState('error');
      return;
    }

    setDropzoneState('loading');
    resultView.classList.remove('visible');

    try {
      let text, lang;
      if (state.apiProvider === 'free') {
        [text, lang] = await callFreeASRAPI(file, state);
      } else {
        [text, lang] = await callDashScopeASRAPI(file, state);
      }
      resultText.value = text;
      dropzone.style.display = 'none';
      resultView.classList.add('visible');
    } catch (err) {
      errorMessageEl.textContent = '识别失败: ' + (err?.message || err);
      setDropzoneState('error');
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resultText.value).then(() => {
      toast('已复制到剪贴板');
      copyBtn.textContent = '已复制!';
      setTimeout(() => copyBtn.textContent = '复制', 2000);
    }).catch(err => toast('复制失败'));
  });

  resetPanel();
}

function showTranscriptionPanel() {
  if (transcriptionPanelElements.overlay) {
    transcriptionPanelElements.overlay.classList.add('visible');
  }
}

function hideTranscriptionPanel() {
  if (transcriptionPanelElements.overlay) {
    transcriptionPanelElements.overlay.classList.remove('visible');
    // Reset state after transition ends
    setTimeout(() => {
        transcriptionPanelElements.dropzone.style.display = 'flex';
        transcriptionPanelElements.resultView.classList.remove('visible');
        transcriptionPanelElements.idleContent.classList.add('active');
        transcriptionPanelElements.loadingContent.classList.remove('active');
        transcriptionPanelElements.errorContent.classList.remove('active');
    }, 200);
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
  let dragging = false, sx=0, sy=0, x=0, y=0;
  const DRAG_THRESHOLD = 5;

  const onDown = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    dragging = true;
    container.dataset.dragged = 'false';
    sx = e.touches ? e.touches[0].clientX : e.clientX;
    sy = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = container.getBoundingClientRect();
    x = rect.left; y = rect.top;
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

    if (container.dataset.dragged === 'true') {
      container.style.left = (x + dx) + 'px';
      container.style.top = (y + dy) + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    }
  };

  const onUp = () => { dragging = false; };

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
            ui.tip.textContent = `快捷键：${newConfig.hotkey}（单击开始/停止）`;
        } else {
            ui.wrap.style.display = 'none';
            ui.tip.textContent = `快捷键：${newConfig.hotkey}`;
        }
    }
    
    if (state.uiScale !== newConfig.uiScale) {
        state.uiScale = newConfig.uiScale;
        document.documentElement.style.setProperty('--voiceui-scale', String(state.uiScale));
    }
}