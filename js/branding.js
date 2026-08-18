/* Apply site branding (name + logo + favicon) and registration guide set from admin Settings.
   Reads /api/settings and updates branding and login modal instruction guide on load. */
function applySiteFavicon(url) {
  var href = (url || '').trim();
  var head = document.head || document.getElementsByTagName('head')[0];
  var existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');

  if (!href) {
    existing.forEach(function (el) { el.remove(); });
    return;
  }

  // Remove existing to force browser tab update
  existing.forEach(function (el) { el.remove(); });

  var mimeType = href.indexOf('image/svg') !== -1 ? 'image/svg+xml'
    : (href.indexOf('image/png') !== -1 ? 'image/png'
      : (href.indexOf('image/x-icon') !== -1 || href.indexOf('image/vnd.microsoft.icon') !== -1 || href.indexOf('.ico') !== -1 ? 'image/x-icon' : 'image/png'));

  ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(function (relType) {
    var link = document.createElement('link');
    link.rel = relType;
    link.type = mimeType;
    link.href = href;
    head.appendChild(link);
  });
}
window.applySiteFavicon = applySiteFavicon;

(function applySiteBranding() {
  if (typeof fetch === 'undefined') return;
  fetch('/api/settings', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s) return;
      window._siteSettings = s;
      var name = s.brandName || '';
      var nameEl = document.getElementById('brandName');
      if (nameEl) nameEl.textContent = name;

      var iconEl = document.getElementById('logoIcon');
      if (iconEl) {
        if (s.brandLogo) {
          iconEl.innerHTML = '';
          var img = document.createElement('img');
          img.className = 'logo-img';
          img.src = s.brandLogo;
          img.alt = name;
          iconEl.appendChild(img);
        } else {
          iconEl.innerHTML = '';
        }
      }

      applySiteFavicon(s.favicon || '');

      var desc = (s.siteDescription || s.metaDescription || '').trim();
      if (desc) {
        var descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', desc);
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', desc);
        var twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.setAttribute('content', desc);
      }

      var effectiveTitle = s.siteTitle || (name ? name : '');
      if (effectiveTitle && (window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname === '/index.html')) {
        document.title = effectiveTitle;
        var stEl = document.getElementById('siteTitleTag');
        if (stEl) stEl.textContent = effectiveTitle;
        var mtEl = document.querySelector('meta[name="title"]');
        if (mtEl) mtEl.setAttribute('content', effectiveTitle);
        var ogtEl = document.querySelector('meta[property="og:title"]');
        if (ogtEl) ogtEl.setAttribute('content', effectiveTitle);
        var twtEl = document.querySelector('meta[name="twitter:title"]');
        if (twtEl) twtEl.setAttribute('content', effectiveTitle);
      } else if (name && document.title && !window.location.pathname.includes('/product')) {
        if (document.title.indexOf(' | ') !== -1) {
          document.title = name + ' | ' + document.title.split(' | ').slice(1).join(' | ');
        } else if (document.title.indexOf(' — ') !== -1) {
          var parts = document.title.split(' — ');
          document.title = parts[0] + ' — ' + name;
        } else {
          document.title = name + ' — ' + document.title;
        }
      }

      if (s.footerTagline) {
        var footerElements = document.querySelectorAll('#footerTagline, .footer-bottom span, .site-footer .footer-bottom');
        footerElements.forEach(function(el) {
          if (el.tagName === 'SPAN' || el.id === 'footerTagline') {
            el.textContent = s.footerTagline;
          }
        });
      }

      renderRegistrationGuide(s);
    })
    .catch(function () { /* non-critical */ });
})();

function renderRegistrationGuide(s) {
  if (!s) return;
  var enabled = s.regGuideEnabled !== 'false' && s.regGuideEnabled !== false;
  var guideElements = document.querySelectorAll('.auth-reg-guide, #authRegGuideLogin, #authRegGuideRegister, #modalRegGuide');
  if (!guideElements.length) return;

  if (!enabled) {
    guideElements.forEach(function(el) { el.style.display = 'none'; });
    return;
  }

  var title = s.regGuideTitle || 'How to Register / Create Account';
  var subtitle = s.regGuideSubtitle || 'New to our shop? Follow these simple steps to create your customer account:';
  var rawSteps = s.regGuideSteps || '1. Click the "Create Account" tab.\n2. Enter your Full Name, Email Address, and Mobile Number.\n3. Click "Send code" to receive your 6-digit email verification code.\n4. Enter the code and choose a password (min. 8 characters).\n5. Click "Create My Account" to start shopping!';

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var stepLines = rawSteps.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var stepsHTML = stepLines.map(function(line, idx) {
    var cleanLine = line.replace(/^\d+[\.\)\-]\s*/, '');
    var num = idx + 1;
    return '<li class="auth-reg-guide-step-item">' +
      '<span class="auth-reg-guide-step-num">' + num + '</span>' +
      '<span class="auth-reg-guide-step-text">' + esc(cleanLine) + '</span>' +
      '</li>';
  }).join('');

  guideElements.forEach(function(container) {
    container.style.display = 'block';
    var isLoginContext = container.id === 'authRegGuideLogin' || container.id === 'modalRegGuide' || (container.closest && container.closest('#authSectionLogin'));

    container.innerHTML =
      '<button type="button" class="auth-reg-guide-header" aria-expanded="false">' +
        '<span class="auth-reg-guide-header-left">' +
          '<span class="auth-reg-guide-icon">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' +
          '</span>' +
          '<span class="auth-reg-guide-title">' + esc(title) + '</span>' +
        '</span>' +
        '<span class="auth-reg-guide-arrow">▼</span>' +
      '</button>' +
      '<div class="auth-reg-guide-body">' +
        (subtitle ? '<div class="auth-reg-guide-subtitle">' + esc(subtitle) + '</div>' : '') +
        '<ul class="auth-reg-guide-steps">' + stepsHTML + '</ul>' +
        (isLoginContext ? '<div class="auth-reg-guide-cta"><button type="button" class="auth-reg-guide-cta-btn" data-action="switch-reg">Ready to register? Create Account →</button></div>' : '') +
      '</div>';

    var header = container.querySelector('.auth-reg-guide-header');
    if (header) {
      header.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = container.classList.toggle('is-open');
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      };
    }

    var ctaBtn = container.querySelector('[data-action="switch-reg"]');
    if (ctaBtn) {
      ctaBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openAuthModal === 'function') {
          openAuthModal('register');
        } else {
          var regTab = document.getElementById('modalRegisterTab') || document.getElementById('tabRegister');
          if (regTab) regTab.click();
        }
      };
    }
  });
}

window.renderRegistrationGuide = renderRegistrationGuide;