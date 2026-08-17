/* Apply the site colour theme (primary + accent) chosen in the admin panel.
   Purges any stale localStorage caches and fetches active settings from /api/settings. */
(function applySiteTheme() {
  // Purge any stale client-side localStorage theme cache
  try {
    localStorage.removeItem('enmar_site_theme');
    sessionStorage.removeItem('enmar_site_theme');
  } catch (e) {}

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
    if (isNaN(n)) return hex;
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }

  function applyStyles(primary, accent) {
    if (!primary && !accent) return;
    var pr = toHex(primary);
    var ac = toHex(accent);
    if (!pr && !ac) return;
    
    var root = document.documentElement.style;
    if (pr) {
      root.setProperty('--forest', pr);
      root.setProperty('--forest-deep', shade(pr, 0.72));
      root.setProperty('--line-dark', pr);
    }
    if (ac) {
      root.setProperty('--gold', ac);
    }

    var st = document.getElementById('serverTheme');
    if (!st) {
      st = document.createElement('style');
      st.id = 'serverTheme';
      document.head.appendChild(st);
    }
    var css = ':root{';
    if (pr) css += '--forest:' + pr + ' !important;--forest-deep:' + shade(pr, 0.72) + ' !important;--line-dark:' + pr + ' !important;';
    if (ac) css += '--gold:' + ac + ' !important;';
    css += '}';
    st.textContent = css;
  }

  // Fetch live settings from server
  if (typeof fetch === 'undefined') return;
  fetch('/api/settings', { credentials: 'include', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s) return;
      if (s.themePrimary || s.themeAccent) {
        applyStyles(s.themePrimary, s.themeAccent);
      }
    })
    .catch(function () {});
})();