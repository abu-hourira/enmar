/**
 * devtools-guard.js
 * Blocks common DevTools / inspect-mode entry points.
 *   1. Right-click context menu disabled
 *   2. Keyboard shortcuts blocked (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
 *   3. Text selection & drag disabled
 */
(function () {
  'use strict';

  /* ── 1. Disable right-click context menu ── */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  /* ── 2. Block inspect keyboard shortcuts ── */
  document.addEventListener('keydown', function (e) {
    var k = e.key || '';

    // F12
    if (e.keyCode === 123) {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && /^[ijcIJC]$/.test(k)) {
      e.preventDefault();
      return;
    }
    // Ctrl+U  (view-source)
    if (e.ctrlKey && /^[uU]$/.test(k)) {
      e.preventDefault();
      return;
    }
    // Ctrl+S  (save page)
    if (e.ctrlKey && /^[sS]$/.test(k)) {
      e.preventDefault();
      return;
    }
  });

  /* ── 3. Disable text selection & drag ── */
  document.addEventListener('selectstart', function (e) {
    e.preventDefault();
  });
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
  });

})();
