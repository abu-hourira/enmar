/* Apply the site colour theme (primary + accent) chosen in the admin panel.
   Synchronously loads cached theme from localStorage to eliminate any FOUC (flash of unstyled theme),
   then fetches /api/settings to sync live updates seamlessly. */
(function applySiteTheme() {
  function toHex(v) {
    var str = String(v || '').trim();
    if (str.charAt(0) !== '#') return '';
    if (/^#[0-9a-fA-F]{3}$/.test(str)) {
      str = '#' + str.slice(1).split('').map(function (c) { return c + c; }).join('');
    }
    return /^#[0-9a-fA-F]{6}$/.test(str) ? str : '';
  }

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }

  function applyStyles(primary, accent) {
    var pr = toHex(primary) || '#631e2a';
    var ac = toHex(accent) || '#C0912E';
    var root = document.documentElement.style;
    root.setProperty('--forest', pr);
    root.setProperty('--forest-deep', shade(pr, 0.72));
    root.setProperty('--line-dark', pr);
    root.setProperty('--gold', ac);
  }

  // 1. INSTANT SYNCHRONOUS APPLY from localStorage (Zero delay on page reload)
  try {
    var cached = localStorage.getItem('enmar_site_theme');
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.primary) {
        applyStyles(parsed.primary, parsed.accent);
      }
    }
  } catch (e) {}

  // 2. LIVE SYNC with server settings in background
  if (typeof fetch === 'undefined') return;
  fetch('/api/settings', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s) return;
      var pr = toHex(s.themePrimary) || '#631e2a';
      var ac = toHex(s.themeAccent) || '#C0912E';
      applyStyles(pr, ac);
      try {
        localStorage.setItem('enmar_site_theme', JSON.stringify({ primary: pr, accent: ac }));
      } catch (e) {}
    })
    .catch(function () {});
})();