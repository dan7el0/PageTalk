'use strict';

let lastFocusedEl = null;

function getActiveEditable() {
  const el = document.activeElement;
  if (!el) return null;
  if (el.isContentEditable) return el;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'textarea') return el;
  if (tag === 'input' && /^(text|search|url|email|tel|number|password)$/i.test(el.type || 'text')) return el;
  return null;
}

function insertTextAtCursor(text) {
  const target = lastFocusedEl || getActiveEditable();
  if (!target) {
    // This function must be defined in cs-ui.js
    showResultOverlay(text);
    return;
  }

  if (target.tagName?.toLowerCase() === 'textarea' || target.tagName?.toLowerCase() === 'input') {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    let value = target.value || '';

    value = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;

    target.value = value;
    target.focus();
    target.setSelectionRange(caret, caret);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (target.isContentEditable) {
    target.focus();
    const sel = window.getSelection();
    const range = sel?.rangeCount > 0 ? sel.getRangeAt(0) : document.createRange();

    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Track currently focused input area
['focusin', 'mousedown'].forEach(evt => {
  document.addEventListener(evt, () => {
    lastFocusedEl = getActiveEditable();
  }, true);
});
