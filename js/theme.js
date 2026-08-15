/* Apply the site colour theme (primary + accent) chosen in the admin panel.
   Reads /api/settings and overrides the CSS custom properties on <html>. */
(function applySiteTheme() {
  if (typeof fetch === 'undefined') return;
  fetch('/api/settings', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s) return;
      var primary = s.themePrimary;
      var accent = s.themeAccent;

      function toHex(v) {
        var str = String(v || '').trim();
        if (str.charAt(0) !== '#') return '';
        if (/^#[0-9a-fA-F]{3}$/.test(str)) {
          str = '#' + str.slice(1).split('').map(function (c) { return c + c; }).join('');
        }
        return /^#[0-9a-fA-F]{6}$/.test(str) ? str : '';
      }
      var pr = toHex(primary) || '#631e2a';
      var ac = toHex(accent) || '#C0912E';
      var DEF_P = '#631e2a', DEF_A = '#C0912E';
      if (pr === DEF_P && ac === DEF_A) return; // default theme — keep the CSS defaults untouched

      function shade(hex, f) {
        var n = parseInt(hex.slice(1), 16);
        var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
        var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
        var b = Math.min(255, Math.round((n & 255) * f));
        return '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      }

      var root = document.documentElement.style;
      root.setProperty('--forest', pr);
      root.setProperty('--forest-deep', shade(pr, 0.72));
      root.setProperty('--line-dark', pr);
      root.setProperty('--gold', ac);
    })
    .catch(function () { /* non-critical */ });
})();