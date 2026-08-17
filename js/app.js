/* ENMAR application layer */
let currentUser = null;
let adminRefreshTimer = null;
const taka = value => `৳${Number(value || 0).toFixed(2)}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
// Render multi-line content safely: escape HTML then format paragraphs, links, bold, lists
function safeMultiline(text) {
  if (!text || !String(text).trim()) return '';
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  function inline(str) {
    let s = esc(str);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)\"\'<>]+)\)/gi, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--forest);text-decoration:underline;font-weight:600">$1</a>');
    s = s.replace(/(^|[\s(])((https?:\/\/[^\s\)\"\'<>]+))/gi, '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--forest);text-decoration:underline;font-weight:600">$2</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--paper-alt);border:1px solid var(--line);padding:2px 5px;border-radius:3px;font-size:.85em">$1</code>');
    return s;
  }
  const raw = String(text).replace(/\r\n|\r/g, '\n');
  const blocks = raw.split(/\n{2,}/);
  const out = [];
  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;
    const lines = block.split('\n');

    let currentList = null;
    let listItems = [];
    let textLines = [];

    function flushList() {
      if (currentList && listItems.length) {
        const tag = currentList;
        out.push(`<${tag} style="margin:0 0 12px 22px;padding:0">${listItems.map(i => `<li style="margin-bottom:6px">${inline(i)}</li>`).join('')}</${tag}>`);
        currentList = null;
        listItems = [];
      }
    }

    function flushText() {
      if (textLines.length) {
        out.push(`<p style="margin:0 0 10px 0;line-height:1.75">${textLines.map(l => inline(l)).join('<br>')}</p>`);
        textLines = [];
      }
    }

    for (let l of lines) {
      const trimmed = l.trim();
      if (!trimmed) continue;

      if (/^#{1,4}\s+/.test(trimmed)) {
        flushList();
        flushText();
        out.push(`<h4 style="font-size:1.05rem;font-weight:700;color:var(--forest);margin:16px 0 8px 0">${inline(trimmed.replace(/^#{1,4}\s+/, ''))}</h4>`);
      } else if (/^[-*•]\s+/.test(trimmed)) {
        flushText();
        if (currentList !== 'ul') {
          flushList();
          currentList = 'ul';
        }
        listItems.push(trimmed.replace(/^[-*•]\s+/, ''));
      } else if (/^\d+[\.\)]\s+/.test(trimmed)) {
        flushText();
        if (currentList !== 'ol') {
          flushList();
          currentList = 'ol';
        }
        listItems.push(trimmed.replace(/^\d+[\.\)]\s+/, ''));
      } else {
        flushList();
        textLines.push(l);
      }
    }
    flushList();
    flushText();
  }
  return out.join('');
}

/* ── client-side delivery countdown (user panel) ── */
function getUserDeliveryWindowMs() {
  const hours = (window._siteSettings && Number(window._siteSettings.deliveryCountdownHours)) || 4;
  return hours * 60 * 60 * 1000;
}
let _userCountdownTimer = null;

function _fmtCountdown(ms) {
  if (ms <= 0) return 'Arriving soon';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${pad(h % 24)}h ${pad(m)}m`; }
  return `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
}

function userCountdownHTML(order) {
  if (['Delivered', 'Cancelled', 'Pending'].includes(order.status)) return '';
  let target;
  if (order.estimatedDelivery) {
    target = new Date(order.estimatedDelivery).getTime();
  } else if (order.confirmedAt) {
    target = new Date(order.confirmedAt).getTime() + getUserDeliveryWindowMs();
  } else {
    return '';
  }
  const remaining = target - Date.now();
  const due = remaining <= 0;
  const dateStr = new Date(target).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });
  return `<div class="user-countdown${due ? ' user-countdown--due' : ''}" data-target="${target}">
    <span class="ucd-label">Est. delivery in</span>
    <span class="ucd-time">${due ? 'Arriving soon' : _fmtCountdown(remaining)}</span>
    <span class="ucd-date">${dateStr}</span>
  </div>`;
}

function startUserCountdowns() {
  if (_userCountdownTimer) clearInterval(_userCountdownTimer);
  _userCountdownTimer = setInterval(() => {
    document.querySelectorAll('.user-countdown').forEach(chip => {
      const target = Number(chip.dataset.target);
      const remaining = target - Date.now();
      const timeEl = chip.querySelector('.ucd-time');
      if (!timeEl) return;
      if (remaining <= 0) {
        timeEl.textContent = 'Arriving soon';
        chip.classList.add('user-countdown--due');
      } else {
        timeEl.textContent = _fmtCountdown(remaining);
      }
    });
  }, 1000);
}

function stopAdminAutoRefresh() {
  if (adminRefreshTimer) {
    clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
  }
}

function renderAdminOrders(target, orders) {
  if (!target) return;
  target.innerHTML = orders.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer / delivery</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHTML(order.number)}<br><small>${new Date(order.createdAt).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })}</small></td><td>${escapeHTML(order.customer.name)}<br><small>${escapeHTML(order.customer.phone)} · ${escapeHTML(order.customer.city)}</small></td><td>${taka(order.total)}</td><td>${escapeHTML(order.paymentMethod)}</td><td><select data-order="${order.id}" class="statusSelect">${['Pending','Confirmed','Shipped','Delivered','Cancelled'].map(status => `<option ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : '<p class="cart-empty">No orders yet.</p>';
  document.querySelectorAll('.statusSelect').forEach(select => select.onchange = async () => { try { await request(`/api/admin/orders/${select.dataset.order}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); } catch (error) { message(document.getElementById('adminMessage'), error.message); } });
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch {
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function showApp(content) {
  if (!shopView || !checkoutView || !checkoutRoot) return;
  shopView.classList.remove('active');
  checkoutView.classList.add('active');
  checkoutRoot.innerHTML = content;
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function showShopView() {
  if (shopView && checkoutView) {
    checkoutView.classList.remove('active');
    shopView.classList.add('active');
  }
}
function refreshAccountButton() {
  const button = document.getElementById('accountBtn');
  if (button) {
    const isStaff = currentUser && ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
    button.textContent = currentUser ? (isStaff ? 'Admin Panel' : 'My Account') : 'Sign In';
    button.onclick = () => {
      if (currentUser) {
        if (['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role)) {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/my-orders';
        }
      } else {
        openAuthModal('login');
      }
    };
  }
  if (typeof loadCommunityComments === 'function') {
    loadCommunityComments();
  }
}
function message(target, text, success = false) {
  if (!target) return false;
  target.innerHTML = `<div class="auth-notice ${success ? 'notice-success' : 'notice-error'}">${escapeHTML(text)}</div>`;
  return true;
}

let _otpCountdownInterval = null;
let _currentAuthMode = 'register';

function evaluatePasswordStrength(password) {
  const p = String(password || '');
  if (!p) return { score: 0, label: 'Enter password', color: 'var(--ink-soft,#888)', class: '', hasLen: false };
  const hasLen = p.length >= 8;
  const hasNumOrSym = /[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p);
  const hasMixed = /[a-z]/.test(p) && /[A-Z]/.test(p);
  const isLong = p.length >= 12;

  if (!hasLen) {
    return { score: 1, label: `${p.length}/8 characters`, color: '#e63946', class: 'active-weak', hasLen: false };
  }

  // All passwords >= 8 chars are valid (numbers, characters, symbols, or combinations)
  let bonus = 0;
  if (hasNumOrSym) bonus++;
  if (hasMixed) bonus++;
  if (isLong) bonus++;

  if (bonus === 0) return { score: 2, label: 'Valid (8+ chars)', color: '#2a9d8f', class: 'active-good', hasLen: true };
  if (bonus === 1) return { score: 3, label: 'Good Password', color: '#2a9d8f', class: 'active-good', hasLen: true };
  return { score: 4, label: 'Strong & Secure', color: '#2a9d8f', class: 'active-strong', hasLen: true };
}

function updatePasswordStrengthUI(password) {
  const strength = evaluatePasswordStrength(password);
  const labelEl = document.getElementById('pwdStrengthLabel') || document.getElementById('pwdStrengthLabelText');
  if (labelEl) {
    labelEl.textContent = strength.label;
    labelEl.style.color = strength.color;
  }
  const labelTextEl = document.getElementById('pwdStrengthLabelText');
  if (labelTextEl && labelTextEl !== labelEl) {
    labelTextEl.textContent = strength.label;
    labelTextEl.style.color = strength.color;
  }
  const bars = [document.getElementById('pwdBar1'), document.getElementById('pwdBar2'), document.getElementById('pwdBar3'), document.getElementById('pwdBar4')];
  bars.forEach((bar, idx) => {
    if (!bar) return;
    bar.className = 'pwd-bar-segment';
    if (idx < strength.score && strength.score > 0) {
      bar.classList.add(strength.class);
    }
  });
  const chkLen = document.getElementById('chkLen');
  if (chkLen) {
    chkLen.textContent = (strength.hasLen ? '✓' : '○') + ' Min. 8 characters (numbers, letters, symbols accepted)';
    chkLen.classList.toggle('met', strength.hasLen);
  }
}

function updatePasswordMatchUI(isForgot = false) {
  const p1Id = isForgot ? 'forgotPassword' : 'regPassword';
  const p2Id = isForgot ? 'forgotPasswordConfirm' : 'regPasswordConfirm';
  const statusId = isForgot ? 'forgotPwdMatchStatus' : 'pwdMatchStatus';
  const chkLenId = isForgot ? 'forgotChkLen' : 'chkLen';

  const p1 = (document.getElementById(p1Id) || {}).value || '';
  const p2 = (document.getElementById(p2Id) || {}).value || '';
  const statusEl = document.getElementById(statusId);
  const chkLenEl = document.getElementById(chkLenId);

  if (chkLenEl) {
    const met = p1.length >= 8;
    chkLenEl.textContent = (met ? '✓' : '○') + ' Min. 8 characters (numbers, letters, symbols accepted)';
    chkLenEl.classList.toggle('met', met);
  }

  if (statusEl) {
    if (!p2) {
      statusEl.textContent = '';
    } else if (p1 === p2) {
      statusEl.innerHTML = '<span style="color:#2a9d8f; font-weight:700">✓ Passwords match</span>';
    } else {
      statusEl.innerHTML = '<span style="color:#e63946; font-weight:700">✗ Mismatch</span>';
    }
  }
}

function startOtpCountdown(buttonEl, totalSec = 60) {
  if (!buttonEl) return;
  if (_otpCountdownInterval) clearInterval(_otpCountdownInterval);
  let sec = totalSec;
  buttonEl.disabled = true;
  buttonEl.textContent = `Resend (${sec}s)`;

  _otpCountdownInterval = setInterval(() => {
    sec--;
    if (sec <= 0) {
      clearInterval(_otpCountdownInterval);
      _otpCountdownInterval = null;
      buttonEl.disabled = false;
      buttonEl.textContent = 'Resend Code';
    } else {
      buttonEl.textContent = `Resend (${sec}s)`;
    }
  }, 1000);
}

function openAuthModal(mode = 'register', note = '') {
  _currentAuthMode = mode;
  const overlay = document.getElementById('authModalOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('authModalTitle');
  const subEl = document.getElementById('authModalSubtitle');
  const noticeEl = document.getElementById('authModalNotice');
  const secReg = document.getElementById('authSectionRegister');
  const secLogin = document.getElementById('authSectionLogin');
  const secForgot = document.getElementById('authSectionForgot');
  const tabReg = document.getElementById('tabRegister');
  const tabLogin = document.getElementById('tabLogin');
  const tabForgot = document.getElementById('tabForgot');
  const tabsWrap = document.getElementById('authTabsWrap');

  if (noticeEl) {
    noticeEl.innerHTML = note ? `<div class="auth-notice notice-info">${escapeHTML(note)}</div>` : '';
  }

  if (mode === 'register') {
    if (titleEl) titleEl.textContent = 'Create an Account';
    if (subEl) subEl.textContent = 'Join ENMAR for organic field-fresh grocery delivery.';
    if (secReg) secReg.style.display = '';
    if (secLogin) secLogin.style.display = 'none';
    if (secForgot) secForgot.style.display = 'none';
    if (tabReg) tabReg.className = 'auth-tab-btn active';
    if (tabLogin) tabLogin.className = 'auth-tab-btn';
    if (tabForgot) tabForgot.style.display = 'none';
    if (tabsWrap) tabsWrap.style.display = 'flex';
  } else if (mode === 'login') {
    if (titleEl) titleEl.textContent = 'Welcome Back';
    if (subEl) subEl.textContent = 'Sign in to access your orders and account.';
    if (secReg) secReg.style.display = 'none';
    if (secLogin) secLogin.style.display = '';
    if (secForgot) secForgot.style.display = 'none';
    if (tabReg) tabReg.className = 'auth-tab-btn';
    if (tabLogin) tabLogin.className = 'auth-tab-btn active';
    if (tabForgot) tabForgot.style.display = 'none';
    if (tabsWrap) tabsWrap.style.display = 'flex';
  } else if (mode === 'forgot') {
    if (titleEl) titleEl.textContent = 'Reset Password';
    if (subEl) subEl.textContent = 'We will email you a 6-digit code to reset your password.';
    if (secReg) secReg.style.display = 'none';
    if (secLogin) secLogin.style.display = 'none';
    if (secForgot) secForgot.style.display = '';
    if (tabsWrap) tabsWrap.style.display = 'none';

    // Auto-prefill email from login or register input if empty
    const forgotEmailInput = document.getElementById('forgotEmail');
    if (forgotEmailInput && !forgotEmailInput.value) {
      const candidate = (document.getElementById('loginEmail') || {}).value || (document.getElementById('regEmail') || {}).value || '';
      if (candidate.trim()) forgotEmailInput.value = candidate.trim();
    }
    updatePasswordMatchUI(true);
  }

  overlay.classList.add('is-active');
  document.body.style.overflow = 'hidden';

  // Auto-focus first input
  setTimeout(() => {
    if (mode === 'register') {
      const el = document.getElementById('regName');
      if (el) el.focus();
    } else if (mode === 'login') {
      const el = document.getElementById('loginEmail');
      if (el) el.focus();
    } else if (mode === 'forgot') {
      const el = document.getElementById('forgotEmail');
      if (el) el.focus();
    }
  }, 100);
}

function closeAuthModal() {
  const overlay = document.getElementById('authModalOverlay');
  if (overlay) overlay.classList.remove('is-active');
  document.body.style.overflow = '';
  if (_otpCountdownInterval) {
    clearInterval(_otpCountdownInterval);
    _otpCountdownInterval = null;
  }
}

function showAuth(mode = 'login', note = '') {
  openAuthModal(mode, note);
}

function initAuthModalSystem() {
  const overlay = document.getElementById('authModalOverlay');
  if (!overlay) return;

  // Close button & overlay click
  const closeBtn = document.getElementById('authModalCloseBtn');
  if (closeBtn) closeBtn.onclick = closeAuthModal;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAuthModal();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-active')) closeAuthModal();
  });

  // Tab buttons
  const tabReg = document.getElementById('tabRegister');
  const tabLogin = document.getElementById('tabLogin');
  if (tabReg) tabReg.onclick = () => openAuthModal('register');
  if (tabLogin) tabLogin.onclick = () => openAuthModal('login');

  // Quick switch links
  const linkGoToLogin = document.getElementById('linkGoToLogin');
  const linkGoToRegister = document.getElementById('linkGoToRegister');
  const linkGoToForgot = document.getElementById('linkGoToForgot');
  const linkBackToLoginFromForgot = document.getElementById('linkBackToLoginFromForgot');

  if (linkGoToLogin) linkGoToLogin.onclick = () => openAuthModal('login');
  if (linkGoToRegister) linkGoToRegister.onclick = () => openAuthModal('register');
  if (linkGoToForgot) linkGoToForgot.onclick = () => openAuthModal('forgot');
  if (linkBackToLoginFromForgot) linkBackToLoginFromForgot.onclick = () => openAuthModal('login');

  // Show/Hide password toggle buttons
  document.querySelectorAll('.auth-toggle-pwd').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;
      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Hide' : 'Show';
    };
  });

  // Live password strength listener
  const regPwdInput = document.getElementById('regPassword');
  if (regPwdInput) {
    regPwdInput.addEventListener('input', () => {
      updatePasswordStrengthUI(regPwdInput.value);
      updatePasswordMatchUI();
    });
  }

  // Live confirm password listener
  const regPwdConfirmInput = document.getElementById('regPasswordConfirm');
  if (regPwdConfirmInput) {
    regPwdConfirmInput.addEventListener('input', () => {
      updatePasswordMatchUI(false);
    });
  }

  // Live forgot password listeners
  const forgotPwdInput = document.getElementById('forgotPassword');
  if (forgotPwdInput) {
    forgotPwdInput.addEventListener('input', () => {
      updatePasswordMatchUI(true);
    });
  }
  const forgotPwdConfirmInput = document.getElementById('forgotPasswordConfirm');
  if (forgotPwdConfirmInput) {
    forgotPwdConfirmInput.addEventListener('input', () => {
      updatePasswordMatchUI(true);
    });
  }

  // Pre-check email on blur
  const regEmailInput = document.getElementById('regEmail');
  if (regEmailInput) {
    regEmailInput.addEventListener('blur', async () => {
      const email = regEmailInput.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return;
      try {
        const res = await request('/api/auth/check-user', { method: 'POST', body: JSON.stringify({ email }) });
        const noticeEl = document.getElementById('authModalNotice');
        if (res.emailTaken) {
          message(noticeEl, 'An account already exists with this email. Click "Sign In" instead.');
        }
      } catch {}
    });
  }

  // Send Registration OTP Button
  const btnSendRegOtp = document.getElementById('btnSendRegOtp');
  if (btnSendRegOtp) {
    btnSendRegOtp.onclick = async () => {
      const noticeEl = document.getElementById('authModalNotice');
      const email = (document.getElementById('regEmail') || {}).value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        message(noticeEl, 'Please enter a valid email address first.');
        return;
      }
      btnSendRegOtp.disabled = true;
      btnSendRegOtp.textContent = 'Sending…';
      try {
        const data = await request('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) });
        message(noticeEl, data.message || 'Verification code sent to your email. Check your inbox and spam folder.', true);
        const otpField = document.getElementById('regOtpField');
        if (otpField) otpField.style.display = '';
        const otpInput = document.getElementById('regOtp');
        if (otpInput) { otpInput.focus(); }
        startOtpCountdown(btnSendRegOtp, data.cooldown || 60);
      } catch (err) {
        message(noticeEl, err.message);
        btnSendRegOtp.disabled = false;
        btnSendRegOtp.textContent = 'Send Code';
      }
    };
  }

  // Send Forgot Password OTP Button
  const btnSendForgotOtp = document.getElementById('btnSendForgotOtp');
  if (btnSendForgotOtp) {
    btnSendForgotOtp.onclick = async () => {
      const noticeEl = document.getElementById('authModalNotice');
      const email = (document.getElementById('forgotEmail') || {}).value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        message(noticeEl, 'Please enter a valid email address first.');
        return;
      }
      btnSendForgotOtp.disabled = true;
      btnSendForgotOtp.textContent = 'Sending…';
      try {
        const data = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        message(noticeEl, data.message || 'Password reset code sent to your email. Check your inbox and spam folder.', true);
        const otpField = document.getElementById('forgotOtpField');
        if (otpField) otpField.style.display = '';
        const otpInput = document.getElementById('forgotOtp');
        if (otpInput) { otpInput.focus(); }
        startOtpCountdown(btnSendForgotOtp, data.cooldown || 60);
      } catch (err) {
        message(noticeEl, err.message);
        btnSendForgotOtp.disabled = false;
        btnSendForgotOtp.textContent = 'Send Code';
      }
    };
  }

  // Form Submit Handler
  const authForm = document.getElementById('authModalForm');
  if (authForm) {
    authForm.onsubmit = async event => {
      event.preventDefault();
      const noticeEl = document.getElementById('authModalNotice');

      if (_currentAuthMode === 'register') {
        const name = (document.getElementById('regName') || {}).value.trim();
        const email = (document.getElementById('regEmail') || {}).value.trim().toLowerCase();
        const otp = (document.getElementById('regOtp') || {}).value.trim();
        const phone = (document.getElementById('regPhone') || {}).value.trim();
        const password = (document.getElementById('regPassword') || {}).value;
        const confirmPass = (document.getElementById('regPasswordConfirm') || {}).value;
        const city = (document.getElementById('regCity') || {}).value.trim();
        const address = (document.getElementById('regAddress') || {}).value.trim();
        const terms = (document.getElementById('regTerms') || {}).checked;

        if (name.length < 2) {
          message(noticeEl, 'Please enter your full name (at least 2 characters).');
          return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          message(noticeEl, 'Please enter a valid email address.');
          return;
        }
        if (!otp) {
          message(noticeEl, 'Please request and enter the 6-digit email verification code.');
          return;
        }
        if (!/^(?:\+88|88)?01[0-9]{9}$/.test(phone.replace(/\s+/g, ''))) {
          message(noticeEl, 'Please enter a valid Bangladesh mobile number (e.g. 017XXXXXXXX).');
          return;
        }
        if (password.length < 8) {
          message(noticeEl, 'Password must be at least 8 characters long.');
          return;
        }
        if (password !== confirmPass) {
          message(noticeEl, 'Passwords do not match. Please re-enter your password.');
          return;
        }
        if (!terms) {
          message(noticeEl, 'Please agree to the Terms & Conditions and Privacy Policy.');
          return;
        }

        const submitBtn = document.getElementById('btnSubmitRegister');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating Account…'; }

        try {
          const res = await request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, password, otp, city, address })
          });
          currentUser = res.user;
          refreshAccountButton();
          closeAuthModal();

          // Show celebration toast
          if (typeof showNewArrivalToast === 'function') {
            showNewArrivalToast({
              name: `Welcome to ENMAR, ${currentUser.name}!`,
              farm: 'Your account is ready. Farm fresh organic foods await you.',
              price: '',
              unit: '',
              tag: 'Account Active'
            });
          }
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has('checkout')) {
            window.location.href = '/checkout';
          }
        } catch (err) {
          message(noticeEl, err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create My Account →'; }
        }
      } else if (_currentAuthMode === 'login') {
        const email = (document.getElementById('loginEmail') || {}).value.trim().toLowerCase();
        const password = (document.getElementById('loginPassword') || {}).value;

        if (!/^\S+@\S+\.\S+$/.test(email)) {
          message(noticeEl, 'Please enter your email address.');
          return;
        }
        if (!password) {
          message(noticeEl, 'Please enter your password.');
          return;
        }

        const submitBtn = document.getElementById('btnSubmitLogin');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in…'; }

        try {
          const res = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });
          currentUser = res.user;
          refreshAccountButton();
          closeAuthModal();

          const isStaff = currentUser && ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
          if (isStaff) {
            window.location.href = '/admin/dashboard';
          } else {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('checkout')) {
              window.location.href = '/checkout';
            }
          }
        } catch (err) {
          message(noticeEl, err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In to Account →'; }
        }
      } else if (_currentAuthMode === 'forgot') {
        const email = (document.getElementById('forgotEmail') || {}).value.trim().toLowerCase();
        const otp = (document.getElementById('forgotOtp') || {}).value.trim();
        const password = (document.getElementById('forgotPassword') || {}).value;
        const confirmPass = (document.getElementById('forgotPasswordConfirm') || {}).value;

        if (!/^\S+@\S+\.\S+$/.test(email)) {
          message(noticeEl, 'Please enter your registered email address.');
          return;
        }
        if (!otp) {
          message(noticeEl, 'Please request and enter the 6-digit reset code sent to your email.');
          return;
        }
        if (password.length < 8) {
          message(noticeEl, 'New password must be at least 8 characters long (numbers, letters, or symbols).');
          return;
        }
        if (password !== confirmPass) {
          message(noticeEl, 'New passwords do not match. Please re-enter.');
          return;
        }

        const submitBtn = document.getElementById('btnSubmitForgot');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Resetting Password…'; }

        try {
          const res = await request('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, otp, password })
          });
          currentUser = res.user;
          refreshAccountButton();
          closeAuthModal();

          const isStaff = currentUser && ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
          if (isStaff) {
            window.location.href = '/admin/dashboard';
          } else if (typeof showNewArrivalToast === 'function') {
            showNewArrivalToast({
              name: 'Password Reset Successful!',
              farm: `Welcome back, ${currentUser.name}. You are now signed in.`,
              price: '',
              unit: '',
              tag: 'Password Updated'
            });
          }
        } catch (err) {
          message(noticeEl, err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Reset Password & Sign In →'; }
        }
      }
    };
  }
}

// Initialize immediately so modal and button listeners are bound without delay
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAuthModalSystem();
    refreshAccountButton();
  });
} else {
  initAuthModalSystem();
  refreshAccountButton();
}

async function showAccount() {
  if (!currentUser) return showAuth();
  const isStaff = ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
  if (isStaff) return showAdmin();

  showApp(`<div class="app-panel">
    <h1>My Account</h1>
    <p>Assalamu alaikum, ${escapeHTML(currentUser.name)}. Here are your account details, deliveries &amp; reviews.</p>
    <div id="accountMessage"></div>

    <!-- PROFILE & DEFAULT ADDRESS -->
    <div class="panel-card" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h2 style="font-family:var(--font-display);margin:0">Profile &amp; Default Delivery Address</h2>
        <button type="button" class="btn-soft" id="btnToggleEditProfile" style="font-size:.7rem;padding:5px 12px">Edit Profile</button>
      </div>

      <div id="profileView" class="profile-view-box">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;font-size:.88rem">
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Full Name</span><strong>${escapeHTML(currentUser.name)}</strong></div>
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Email</span><span>${escapeHTML(currentUser.email)}</span></div>
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Mobile Number</span><strong>${escapeHTML(currentUser.phone || 'Not set')}</strong></div>
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Default Address</span><span>${escapeHTML(currentUser.address || 'No address set yet')}</span></div>
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">District / City</span><span>${escapeHTML(currentUser.city || '—')}</span></div>
          <div><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Postal Code</span><span>${escapeHTML(currentUser.zip || '—')}</span></div>
          <div style="grid-column:1/-1"><span style="font-family:var(--font-mono);font-size:.65rem;text-transform:uppercase;color:var(--ink-soft);display:block">Delivery Notes / Landmark</span><span>${escapeHTML(currentUser.notes || '—')}</span></div>
        </div>
      </div>

      <form id="profileEditForm" class="profile-edit-form" style="display:none;margin-top:16px" novalidate>
        <div id="profileEditMsg"></div>
        <div class="delivery-edit-grid">
          <div class="field"><label>Full Name</label><input type="text" id="profName" value="${escapeHTML(currentUser.name)}" required></div>
          <div class="field"><label>Mobile Number (01XXXXXXXXX)</label><input type="tel" id="profPhone" value="${escapeHTML(currentUser.phone || '')}" placeholder="01XXXXXXXXX" pattern="01[0-9]{9}" required></div>
          <div class="field span2"><label>Default House / Road / Area Address</label><input type="text" id="profAddress" value="${escapeHTML(currentUser.address || '')}" placeholder="e.g. House 12, Road 4, Sector 7, Uttara"></div>
          <div class="field"><label>District / City</label><input type="text" id="profCity" value="${escapeHTML(currentUser.city || '')}" placeholder="e.g. Dhaka"></div>
          <div class="field"><label>Postal Code</label><input type="text" id="profZip" value="${escapeHTML(currentUser.zip || '')}" placeholder="e.g. 1230"></div>
          <div class="field span2"><label>Delivery Notes / Landmark</label><input type="text" id="profNotes" value="${escapeHTML(currentUser.notes || '')}" placeholder="e.g. Near Mascot Plaza, 4th floor"></div>
          <div class="field actions-cell" style="grid-column:1/-1;margin-top:8px">
            <button type="submit" class="btn-primary" id="btnSaveProfile" style="padding:9px 18px;font-size:.72rem">Save Profile &amp; Address</button>
            <button type="button" class="btn-soft" id="btnCancelEditProfile" style="padding:9px 14px;font-size:.72rem">Cancel</button>
          </div>
        </div>
      </form>
    </div>

    <!-- MY ORDERS -->
    <div class="panel-card">
      <h2 style="font-family:var(--font-display);margin-top:0">My orders</h2>
      <div id="ordersContent">Loading orders…</div>
    </div>

    <!-- MY REVIEWS -->
    <div class="panel-card" style="margin-top:24px">
      <h2 style="font-family:var(--font-display);margin-top:0">My Product Reviews</h2>
      <div id="reviewsContent">Loading reviews…</div>
    </div>
    <button class="account-btn" id="logoutBtn" style="margin-top:24px">Sign out</button>
  </div>`);

  document.getElementById('logoutBtn').onclick = logout;

  // Profile edit toggle & submit
  const toggleBtn = document.getElementById('btnToggleEditProfile');
  const viewBox = document.getElementById('profileView');
  const editForm = document.getElementById('profileEditForm');
  const cancelBtn = document.getElementById('btnCancelEditProfile');

  if (toggleBtn && viewBox && editForm) {
    toggleBtn.onclick = () => {
      const isEditing = editForm.style.display !== 'none';
      editForm.style.display = isEditing ? 'none' : 'block';
      viewBox.style.display = isEditing ? 'block' : 'none';
      toggleBtn.textContent = isEditing ? 'Edit Profile' : 'Close Form';
    };
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        editForm.style.display = 'none';
        viewBox.style.display = 'block';
        toggleBtn.textContent = 'Edit Profile';
      };
    }

    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('profileEditMsg');
      msgEl.innerHTML = '';
      const name = document.getElementById('profName').value.trim();
      const phone = document.getElementById('profPhone').value.trim();
      const address = document.getElementById('profAddress').value.trim();
      const city = document.getElementById('profCity').value.trim();
      const zip = document.getElementById('profZip').value.trim();
      const notes = document.getElementById('profNotes').value.trim();

      if (name.length < 2) {
        message(msgEl, 'Name must be at least 2 characters.');
        return;
      }
      if (phone && !/^01[0-9]{9}$/.test(phone)) {
        message(msgEl, 'Please enter a valid Bangladesh phone number (01XXXXXXXXX).');
        return;
      }

      try {
        const res = await request('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({ name, phone, address, city, zip, notes })
        });
        currentUser = res.user;
        refreshAccountButton();
        showAccount();
      } catch (err) {
        message(msgEl, err.message);
      }
    };
  }

  // Load orders
  try {
    const orders = await request('/api/orders');
    const ordersContent = document.getElementById('ordersContent');
    if (ordersContent) {
      if (!orders.length) {
        ordersContent.innerHTML = '<p class="cart-empty">No orders yet. Your first crate is waiting in the shop.</p>';
      } else {
        function renderOrderRows(orders) {
          ordersContent.innerHTML = `<div class="table-wrap"><table class="data-table">
            <thead><tr>
              <th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th>Delivery</th><th></th>
            </tr></thead>
            <tbody>
            ${orders.map(o => {
              const editable = o.status === 'Pending';
              const canDeleteHistory = ['Delivered', 'Cancelled'].includes(o.status);
              return `<tr id="row-${o.id}">
                <td><strong>${escapeHTML(o.number)}</strong><br><small style="color:var(--forest);font-size:.65rem;font-weight:600">💌 ${escapeHTML(o.customerMessage || o.note || 'Thank you')}</small></td>
                <td>${new Date(o.createdAt).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>${taka(o.total)}</td>
                <td>${escapeHTML(o.paymentMethod)}</td>
                <td>${(() => {
                  if (o.status === 'Cancelled') {
                    const custName = o.cancelledByName || (o.customer && o.customer.name) || (currentUser && currentUser.name) || 'Customer';
                    const by = o.cancelledBy === 'customer' ? `Cancelled by ${custName}` : 'Cancelled by ENMAR';
                    return `<span class="mono-tag" style="font-size:.65rem;background:#fee2e2;color:#991b1b;font-weight:700">${escapeHTML(by)}</span>`;
                  }
                  return `<span class="mono-tag" style="font-size:.65rem;${o.status === 'Pending' ? 'background:#fef3c7;color:#92400e' : ''}">${escapeHTML(o.status)}</span>`;
                })()}</td>
                <td>${userCountdownHTML(o)}</td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                    <a href="/receipt?id=${o.id}" target="_blank" class="btn-soft" style="font-size:.62rem;padding:4px 8px;text-decoration:none;color:var(--forest);font-weight:700" title="Open &amp; Print Money Receipt">🧾 Receipt</a>
                    ${editable ? `
                    <button class="btn-soft btn-edit-delivery" data-oid="${o.id}"
                      data-name="${escapeHTML(o.customer.name)}"
                      data-phone="${escapeHTML(o.customer.phone)}"
                      data-address="${escapeHTML(o.customer.address)}"
                      data-city="${escapeHTML(o.customer.city)}"
                      style="font-size:.62rem;padding:4px 8px">Edit</button>
                    <button class="btn-soft btn-cancel-order" data-oid="${o.id}" data-onum="${escapeHTML(o.number)}"
                      style="font-size:.62rem;padding:4px 8px;color:#c53030;border-color:#fca5a5;background:#fef2f2">Cancel</button>
                    ` : ''}
                    ${canDeleteHistory ? `
                    <button class="btn-soft btn-del-history" data-oid="${o.id}" data-onum="${escapeHTML(o.number)}"
                      style="font-size:.62rem;padding:4px 6px;color:#991b1b;border-color:#fca5a5;background:#fff5f5" title="Remove from your history">🗑️</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
              <tr id="edit-row-${o.id}" style="display:none">
                <td colspan="7">
                  <div class="delivery-edit-form" id="delivery-form-${o.id}">
                    <div id="delivery-msg-${o.id}"></div>
                    <div class="delivery-edit-grid">
                      <div class="field"><label>Full Name</label><input type="text" id="dn-${o.id}" value="${escapeHTML(o.customer.name)}"></div>
                      <div class="field"><label>Phone</label><input type="tel" id="dp-${o.id}" value="${escapeHTML(o.customer.phone)}"></div>
                      <div class="field span2"><label>Delivery Address</label><input type="text" id="da-${o.id}" value="${escapeHTML(o.customer.address)}"></div>
                      <div class="field"><label>City / Area</label><input type="text" id="dc-${o.id}" value="${escapeHTML(o.customer.city)}"></div>
                      <div class="field actions-cell">
                        <button type="button" class="btn-primary btn-save-delivery" data-oid="${o.id}">Save</button>
                        <button type="button" class="btn-soft btn-cancel-delivery" data-oid="${o.id}">Cancel</button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
            </tbody></table></div>`;

          document.querySelectorAll('.btn-edit-delivery').forEach(btn => {
            btn.onclick = () => {
              const editRow = document.getElementById(`edit-row-${btn.dataset.oid}`);
              editRow.style.display = editRow.style.display === 'none' ? '' : 'none';
            };
          });

          document.querySelectorAll('.btn-del-history').forEach(btn => {
            btn.onclick = async () => {
              const oid = btn.dataset.oid;
              const onum = btn.dataset.onum || `#${oid}`;
              const ok = typeof smartConfirm === 'function' ? await smartConfirm({
                title: 'Delete Order History',
                message: `Delete order ${onum} from your order history?\n\nThis will remove the order from your personal view.`,
                confirmText: 'Delete from History',
                cancelText: 'Keep in History',
                danger: true,
                variant: 'delete'
              }) : confirm(`Delete order ${onum} from your order history?\n\nThis will remove the order from your personal view.`);
              if (!ok) return;

              try {
                btn.disabled = true;
                btn.textContent = '…';
                await request(`/api/orders/${oid}/history`, { method: 'DELETE' });
                const updated = await request('/api/orders');
                renderOrderRows(updated);
              } catch (err) {
                alert(err.message || 'Failed to remove order from history.');
                btn.disabled = false;
                btn.textContent = 'Delete';
              }
            };
          });

          document.querySelectorAll('.btn-cancel-order').forEach(btn => {
            btn.onclick = async () => {
              const oid = btn.dataset.oid;
              const onum = btn.dataset.onum || `#${oid}`;
              const ok = typeof smartConfirm === 'function' ? await smartConfirm({
                title: 'Cancel Order',
                message: `Are you sure you want to cancel order ${onum}?\n\nThis order has not been confirmed yet and will be immediately cancelled.`,
                confirmText: 'Yes, Cancel Order',
                cancelText: 'Keep Order',
                danger: true,
                variant: 'warning'
              }) : confirm(`Are you sure you want to cancel order ${onum}?\n\nThis order has not been confirmed yet and will be immediately cancelled.`);
              if (!ok) return;

              try {
                btn.disabled = true;
                btn.textContent = 'Cancelling…';
                await request(`/api/orders/${oid}/cancel`, { method: 'POST' });
                const updated = await request('/api/orders');
                renderOrderRows(updated);
              } catch (err) {
                alert(err.message || 'Failed to cancel order.');
                btn.disabled = false;
                btn.textContent = 'Cancel';
              }
            };
          });

          document.querySelectorAll('.btn-cancel-delivery').forEach(btn => {
            btn.onclick = () => {
              document.getElementById(`edit-row-${btn.dataset.oid}`).style.display = 'none';
            };
          });

          document.querySelectorAll('.btn-save-delivery').forEach(btn => {
            btn.onclick = async () => {
              const oid = btn.dataset.oid;
              const msgEl = document.getElementById(`delivery-msg-${oid}`);
              msgEl.innerHTML = '';
              try {
                await request(`/api/orders/${oid}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    name:    document.getElementById(`dn-${oid}`).value.trim(),
                    phone:   document.getElementById(`dp-${oid}`).value.trim(),
                    address: document.getElementById(`da-${oid}`).value.trim(),
                    city:    document.getElementById(`dc-${oid}`).value.trim()
                  })
                });
                const updated = await request('/api/orders');
                renderOrderRows(updated);
              } catch (err) {
                msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--tomato)">${escapeHTML(err.message)}</div>`;
              }
            };
          });

          startUserCountdowns();
        }
        renderOrderRows(orders);
      }
    }
  } catch (error) {
    message(document.getElementById('accountMessage'), error.message);
  }

  // Load reviews
  try {
    const reviews = await request('/api/my-reviews');
    const revContent = document.getElementById('reviewsContent');
    if (revContent) {
      if (!reviews.length) {
        revContent.innerHTML = '<p class="cart-empty">You have not written any product reviews yet.</p>';
      } else {
        function renderUserReviews(list) {
          if (!list.length) {
            revContent.innerHTML = '<p class="cart-empty">You have not written any product reviews yet.</p>';
            return;
          }
          revContent.innerHTML = `<div class="reviews-list">
            ${list.map(r => `
              <div class="review-card review-card--mine" id="userRev-${r.id}">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                  <div>
                    <strong><a href="/product?id=${r.productId}" style="color:inherit;text-decoration:underline">${escapeHTML(r.productName)}</a></strong>
                    <div style="color:var(--gold);font-size:.9rem;margin-top:2px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} <small style="color:var(--ink-soft)">${new Date(r.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' })}</small></div>
                  </div>
                  <div style="display:flex;gap:6px">
                    <a href="/product?id=${r.productId}#reviewsSection" class="btn-soft" style="font-size:.65rem;text-decoration:none;padding:4px 8px">Edit on Product Page</a>
                    <button type="button" class="btn-danger btn-del-my-rev" data-id="${r.id}" style="font-size:.65rem;padding:4px 8px">Delete</button>
                  </div>
                </div>
                <p style="margin:0;color:var(--ink);font-size:.9rem">${escapeHTML(r.comment)}</p>
                ${(r.images && r.images.length) ? `
                  <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                    ${r.images.map(img => `<img src="${escapeHTML(img)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid var(--line)" alt="Review photo">`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>`;

          revContent.querySelectorAll('.btn-del-my-rev').forEach(btn => {
            btn.onclick = async () => {
              const ok = typeof smartConfirm === 'function' ? await smartConfirm({
                title: 'Delete Review',
                message: 'Are you sure you want to delete your review for this product?',
                confirmText: 'Delete Review',
                cancelText: 'Keep Review',
                danger: true,
                variant: 'delete'
              }) : confirm('Are you sure you want to delete this review?');
              if (!ok) return;

              btn.disabled = true;
              try {
                await request(`/api/reviews/${btn.dataset.id}`, { method: 'DELETE' });
                const updated = await request('/api/my-reviews');
                renderUserReviews(updated);
              } catch (err) {
                alert('Could not delete review: ' + err.message);
                btn.disabled = false;
              }
            };
          });
        }
        renderUserReviews(reviews);
      }
    }
  } catch (error) {
    console.warn('Could not load reviews:', error);
  }
}
async function logout() { stopAdminAutoRefresh(); await request('/api/auth/logout', { method: 'POST' }); currentUser = null; refreshAccountButton(); showShopView(); }

function renderConfirmation(orderNumber, email, status) {
  const isCOD = status === 'Confirmed';
  showApp(`<div class="confirmation">
    <span id="confirmIcon"></span>
    <h1>${isCOD ? 'Order Confirmed!' : 'Order Placed!'}</h1>
    <p>Thank you, ${escapeHTML(currentUser ? currentUser.name : '')}${isCOD ? '. Your Cash on Delivery order is confirmed and being prepared.' : '. Your crate is on its way.'}</p>
    <div class="order-number">${escapeHTML(orderNumber)}</div>
    ${isCOD
      ? `<p>Our team will contact you before delivery. No advance payment needed.</p>`
      : `<p>We'll confirm your order by phone shortly${email ? ` — a copy will also be sent to <strong>${escapeHTML(email)}</strong>` : ''}.</p>`
    }
    <button class="btn-primary" id="backToShopBtn" style="margin-top:24px">Back to the Shop</button>
  </div>`);
  const icon = document.getElementById('confirmIcon');
  if (icon) icon.innerHTML = UI_ICONS.check;
  const btn = document.getElementById('backToShopBtn');
  if (btn) btn.onclick = showShopView;
}

function renderBangladeshCheckout() {
  window.location.href = '/checkout';
}

async function showAdmin() {
  if (!currentUser || !['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role)) return showAuth('login');
  stopAdminAutoRefresh();
  showApp(`<div class="app-panel"><h1>Admin Panel</h1><p>Manage ENMAR products, customers, and orders.</p><div id="adminMessage"></div><div class="panel-grid" id="stats">Loading overview…</div><div class="panel-card"><h2 style="font-family:var(--font-display);margin-top:0">Add a product</h2><form class="inline-form" id="productForm"><input id="pName" placeholder="Product name" required><input id="pFarm" placeholder="Farm / source" required><div class="form-row"><input id="pPrice" type="number" min="1" placeholder="Price (BDT)" required><input id="pUnit" placeholder="Unit, e.g. kg" required></div><div class="form-row"><select id="pCategory">${CATEGORIES.filter(c => c !== 'All').map(c => `<option>${escapeHTML(c)}</option>`).join('')}</select><select id="pIcon"><option value="leaf">Leaf</option><option value="tomato">Tomato</option><option value="carrot">Carrot</option><option value="apple">Fruit</option><option value="egg">Egg</option><option value="honey">Honey</option></select></div><button class="btn-primary" type="submit">Add Product</button></form></div><div class="panel-card"><h2 style="font-family:var(--font-display);margin-top:0">Products</h2><div id="adminProducts"></div></div><div class="panel-card"><h2 style="font-family:var(--font-display);margin-top:0">Orders</h2><p class="mono" style="font-size:.7rem;color:var(--ink-soft);margin-top:-4px">Customer orders appear here automatically and refresh every 10 seconds.</p><div id="adminOrders">Loading…</div></div><div class="panel-card"><h2 style="font-family:var(--font-display);margin-top:0">Customers</h2><div id="adminUsers">Loading…</div></div><button class="account-btn" id="logoutBtn">Sign out</button></div>`);
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = logout;
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.onsubmit = async event => { event.preventDefault(); try { await request('/api/admin/products', { method: 'POST', body: JSON.stringify({ name: document.getElementById('pName').value, farm: document.getElementById('pFarm').value, price: document.getElementById('pPrice').value, unit: document.getElementById('pUnit').value, cat: document.getElementById('pCategory').value, icon: document.getElementById('pIcon').value }) }); await loadProducts(); showAdmin(); } catch (error) { message(document.getElementById('adminMessage'), error.message); } };
  }
  try {
    const [stats, orders, users] = await Promise.all([request('/api/admin/stats'), request('/api/admin/orders'), request('/api/admin/users')]);
    const statsEl = document.getElementById('stats');
    if (statsEl) statsEl.innerHTML = [['Customers', stats.users], ['Orders', stats.orders], ['Revenue', taka(stats.revenue)], ['Pending', stats.pending]].map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');
    const adminProducts = document.getElementById('adminProducts');
    if (adminProducts) adminProducts.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Farm</th><th>Price</th><th></th></tr></thead><tbody>${PRODUCTS.map(product => `<tr><td>${escapeHTML(product.name)}</td><td>${escapeHTML(product.farm)}</td><td>${taka(product.price)} / ${escapeHTML(product.unit)}</td><td><button class="account-btn productDelete" data-product="${product.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('.productDelete').forEach(button => button.onclick = async () => { if (!confirm('Remove this product from the store?')) return; try { await request(`/api/admin/products/${button.dataset.product}`, { method: 'DELETE' }); await loadProducts(); showAdmin(); } catch (error) { message(document.getElementById('adminMessage'), error.message); } });
    const adminOrders = document.getElementById('adminOrders');
    renderAdminOrders(adminOrders, orders);
    const adminUsers = document.getElementById('adminUsers');
    if (adminUsers) adminUsers.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th></tr></thead><tbody>${users.map(user => `<tr><td>${escapeHTML(user.name)}</td><td>${escapeHTML(user.email)}</td><td>${currentUser.role === 'superadmin' && user.role !== 'superadmin' ? `<select class="roleSelect" data-user="${user.id}">${['customer', 'moderator', 'manager', 'admin', 'superadmin'].filter(role => role !== 'superadmin' || user.role === 'superadmin').map(role => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>`).join('')}</select>` : escapeHTML(user.role)}</td><td>${user.role === 'customer' ? `<button class="account-btn userToggle" data-user="${user.id}" data-active="${user.active}">${user.active ? 'Disable' : 'Enable'}</button>` : user.role === 'superadmin' ? 'Protected' : 'Manage'}</td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('.userToggle').forEach(button => button.onclick = async () => { try { await request(`/api/admin/users/${button.dataset.user}`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active !== 'true' }) }); showAdmin(); } catch (error) { message(document.getElementById('adminMessage'), error.message); } });
    document.querySelectorAll('.roleSelect').forEach(select => select.onchange = async () => { try { await request(`/api/admin/users/${select.dataset.user}`, { method: 'PATCH', body: JSON.stringify({ role: select.value }) }); showAdmin(); } catch (error) { message(document.getElementById('adminMessage'), error.message); } });
    adminRefreshTimer = setInterval(async () => {
      try {
        const refreshedOrders = await request('/api/admin/orders');
        renderAdminOrders(document.getElementById('adminOrders'), refreshedOrders);
      } catch (error) {
        message(document.getElementById('adminMessage'), error.message);
      }
    }, 10000);
  } catch (error) { message(document.getElementById('adminMessage'), error.message); }
}
async function loadSettings() {
  try {
    const s = await request('/api/settings');
    window._siteSettings = s;
    const set = (id, text) => { const el = document.getElementById(id); if (el && text !== undefined) el.textContent = text; };
    set('newsletterHeading', s.newsletterHeading);
    set('newsletterBody',    s.newsletterBody);
    set('footerTagline',     s.footerTagline);
    set('brandName', s.brandName || 'ENMAR');

    // Dynamic Section & Catalog Texts
    if (s.categorySectionTitle)  set('catSectionTitle', s.categorySectionTitle);
    if (s.productsSectionTitle)  set('productsSectionTitle', s.productsSectionTitle);
    if (s.communitySectionPill)  set('communitySectionPill', s.communitySectionPill);
    if (s.communitySectionTitle) set('communitySectionTitle', s.communitySectionTitle);
    if (s.communitySectionSubtitle) set('communitySectionSubtitle', s.communitySectionSubtitle);

    // Recently Added Products dynamic texts & links
    if (s.recentSectionBadge)    set('recentSectionBadge', s.recentSectionBadge);
    if (s.recentSectionTitle)    set('recentSectionTitle', s.recentSectionTitle);
    if (s.recentSectionSubtitle) set('recentSectionSubtitle', s.recentSectionSubtitle);
    const recentExp = document.getElementById('recentSectionExplore');
    if (recentExp) {
      if (s.recentSectionExploreText) recentExp.textContent = s.recentSectionExploreText;
      if (s.recentSectionExploreLink) recentExp.href = s.recentSectionExploreLink;
    }
    if (typeof renderRecentProducts === 'function') {
      renderRecentProducts();
    }

    const searchInp = document.getElementById('search') || document.getElementById('searchInput') || document.getElementById('productSearchInput');
    if (searchInp && s.searchPlaceholder) {
      searchInp.placeholder = s.searchPlaceholder;
    }

    const brandIcon = document.getElementById('logoIcon');
    if (brandIcon && s.brandLogo) {
      brandIcon.innerHTML = '';
      const bimg = document.createElement('img');
      bimg.className = 'logo-img';
      bimg.src = s.brandLogo;
      bimg.alt = s.brandName || 'Logo';
      brandIcon.appendChild(bimg);
    }
    const favUrl = String(s.favicon || '').trim();
    const head = document.head || document.getElementsByTagName('head')[0];
    const existingFavs = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    if (!favUrl) {
      existingFavs.forEach(el => el.remove());
    } else {
      existingFavs.forEach(el => el.remove());
      const mime = favUrl.includes('image/svg') ? 'image/svg+xml'
        : (favUrl.includes('image/png') ? 'image/png'
          : (favUrl.includes('image/x-icon') || favUrl.includes('image/vnd.microsoft.icon') || favUrl.includes('.ico') ? 'image/x-icon' : 'image/png'));
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(rel => {
        const link = document.createElement('link');
        link.rel = rel;
        link.type = mime;
        link.href = favUrl;
        head.appendChild(link);
      });
    }
    if (typeof s.shippingFlat === 'number')          SHIPPING_FLAT           = s.shippingFlat;
    if (typeof s.shippingFreeThreshold === 'number') SHIPPING_FREE_THRESHOLD = s.shippingFreeThreshold;

    if (typeof renderRegistrationGuide === 'function') {
      renderRegistrationGuide(s);
    }

    // Messenger chat bubble
    const bubble = document.getElementById('messengerBubble');
    if (bubble) {
      const url = (s.messengerUrl || '').trim();
      if (url) { bubble.href = url; bubble.style.display = 'flex'; }
      else       { bubble.style.display = 'none'; }
    }

    // Store all page content fields so footer modal can display them
    window._pageContent = {
      pageAboutUs:       s.pageAboutUs       || '',
      pageContactUs:     s.pageContactUs     || '',
      pageCompanyInfo:   s.pageCompanyInfo   || '',
      pageTerms:         s.pageTerms         || '',
      pagePrivacyPolicy: s.pagePrivacyPolicy || '',
      pageSupportCenter: s.pageSupportCenter || '',
      pageHowToOrder:    s.pageHowToOrder    || '',
      pageOrderTracking: s.pageOrderTracking || '',
      pagePaymentInfo:   s.pagePaymentInfo   || '',
      pageFaq:           s.pageFaq           || '',
      pageHappyReturn:   s.pageHappyReturn   || '',
      pageRefundPolicy:  s.pageRefundPolicy  || '',
      pageCancellation:  s.pageCancellation  || '',
      pagePreOrder:      s.pagePreOrder      || '',
      footerShippingInfo: s.footerShippingInfo || '',
    };

    // Wire footer page-content buttons
    document.querySelectorAll('.footer-page-btn').forEach(btn => {
      btn.onclick = () => {
        const key   = btn.dataset.page;
        const title = btn.dataset.title;
        const body  = document.getElementById('pageModalBody');
        const titleEl = document.getElementById('pageModalTitle');
        const overlay = document.getElementById('pageModalOverlay');
        if (!body || !titleEl || !overlay) return;
        const raw = (window._pageContent && window._pageContent[key]) || '';
        titleEl.textContent = title;
        body.innerHTML = raw
          ? safeMultiline(raw)
          : `<p style="color:var(--ink-soft);font-style:italic">No content added yet. Ask your admin to update this page.</p>`;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
      };
    });

    // Close modal
    const closeBtn = document.getElementById('pageModalClose');
    const overlay  = document.getElementById('pageModalOverlay');
    if (closeBtn && overlay) {
      closeBtn.onclick = closePaageModal;
      overlay.addEventListener('click', e => { if (e.target === overlay) closePaageModal(); });
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePaageModal(); });
  } catch (err) {
    console.warn('Could not load storefront settings:', err);
  }
}

function closePaageModal() {
  const overlay = document.getElementById('pageModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

async function loadProducts() {
  try {
    const [products, categories] = await Promise.all([request('/api/products'), request('/api/categories')]);
    PRODUCTS.splice(0, PRODUCTS.length, ...products);
    CATEGORIES.splice(0, CATEGORIES.length, 'All', ...categories);
    buildCategoryButtons(nav);
    buildCategoryButtons(filters);
    if (typeof buildCategoryCircles === 'function') buildCategoryCircles();
    if (typeof buildFooterShopLinks === 'function') buildFooterShopLinks();
    renderProducts();
    renderCart();
  } catch (error) { console.warn('Unable to load products from server', error); }
}

/* ── Ad Banner ── */
function adHeadlineHtml(t) {
  return String(t || '').split('\n').map(escapeHTML).join('<br>');
}

function buildCustomAdSlide(a) {
  const isFullBanner = a.image && (!a.headline && !a.tag && !a.body);
  const clickCat = (a.buttonCat && a.buttonCat !== 'None') ? a.buttonCat : '';
  const clickAttr = clickCat ? `data-ad-cat="${escapeHTML(clickCat)}" style="cursor:pointer"` : '';

  if (isFullBanner) {
    return `<div class="ad-slide"><div class="dummy-ad dummy-ad--full-banner" ${clickAttr} style="background:${escapeHTML(a.bg || 'transparent')}">
      <img src="${escapeHTML(a.image)}" alt="${escapeHTML(a.name || 'Banner Ad')}" loading="lazy">
    </div></div>`;
  }

  const size = Number(a.imageSize) || 130;
  const image = a.image
    ? `<div class="dummy-ad-img" style="width:${size}px;height:${size}px"><img src="${escapeHTML(a.image)}" alt="" loading="lazy"></div>`
    : `<div class="dummy-ad-img" style="width:${size}px;height:${size}px"></div>`;
  const btn = (a.buttonText && a.buttonCat && a.buttonCat !== 'None')
    ? `<button type="button" class="dummy-ad-btn" data-ad-cat="${escapeHTML(a.buttonCat)}">${escapeHTML(a.buttonText)}</button>`
    : '';
  return `<div class="ad-slide"><div class="dummy-ad" style="--ad-text:${escapeHTML(a.textColor || '#ffffff')};background:${escapeHTML(a.bg) || '#f5a623'}">
    <div class="dummy-ad-text">
      ${a.tag ? `<div class="dummy-ad-tag">${escapeHTML(a.tag)}</div>` : ''}
      ${a.headline ? `<h2>${adHeadlineHtml(a.headline)}</h2>` : ''}
      ${a.body ? `<p>${escapeHTML(a.body)}</p>` : ''}
      ${btn}
    </div>
    ${image}
  </div></div>`;
}

/* ── Swipe / Drag Gesture Controller for Banners ── */
function attachSwipeHandler(container, onPrev, onNext) {
  if (!container || container.dataset.swipeInit) return;
  container.dataset.swipeInit = '1';

  let startX = 0;
  let startY = 0;
  let dist = 0;
  let isDown = false;
  let hasMoved = false;

  // Touch Swipe (Mobile)
  container.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dist = 0;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!startX) return;
    const t = e.touches[0];
    const diffX = t.clientX - startX;
    const diffY = t.clientY - startY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      dist = diffX;
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    const threshold = 40;
    if (dist > threshold) {
      onPrev();
    } else if (dist < -threshold) {
      onNext();
    }
    startX = 0;
    startY = 0;
    dist = 0;
  }, { passive: true });

  // Mouse Drag (Desktop)
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDown = true;
    hasMoved = false;
    startX = e.clientX;
    dist = 0;
    container.classList.add('is-dragging');
  });

  const stopMouse = () => {
    if (!isDown) return;
    isDown = false;
    container.classList.remove('is-dragging');
    const threshold = 45;
    if (dist > threshold) {
      onPrev();
    } else if (dist < -threshold) {
      onNext();
    }
    dist = 0;
    startX = 0;
  };

  container.addEventListener('mouseleave', stopMouse);
  container.addEventListener('mouseup', stopMouse);

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    dist = e.clientX - startX;
    if (Math.abs(dist) > 5) hasMoved = true;
  });

  // Prevent accidental clicks when dragging
  container.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      hasMoved = false;
    }
  }, true);
}

function buildCustomAdSlideshow(ads, trackId, dotsId, prevId, nextId, containerId) {
  const track     = document.getElementById(trackId);
  const dotsEl    = document.getElementById(dotsId);
  const prevBtn   = document.getElementById(prevId);
  const nextBtn   = document.getElementById(nextId);
  const container = document.getElementById(containerId);
  if (!track || !container || !ads.length) return;

  // Show ONE ad at a time and rotate automatically after a few seconds.
  container.classList.add('ad-banner--one');
  track.innerHTML = ads.map(buildCustomAdSlide).join('');

  const total = ads.length;
  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: total }, (_, i) =>
      `<button class="ad-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i+1}"></button>`
    ).join('');
  }
  container.style.display = '';

  let current = 0;
  let direction = 1;
  let timer;
  const INTERVAL = 5000; // 5 s between ads
  if (total <= 1) {
    if (prevBtn) prevBtn.hidden = true;
    if (nextBtn) nextBtn.hidden = true;
  }

  function goTo(idx) {
    if (total <= 1) {
      track.style.transform = 'translateX(0)';
      return;
    }
    current = Math.max(0, Math.min(idx, total - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    if (dotsEl) dotsEl.querySelectorAll('.ad-dot').forEach((d, i) => d.classList.toggle('active', i === current));
    resetTimer();
  }

  function nextStep() {
    if (total <= 1) return;
    if (current >= total - 1) {
      direction = -1; // reached the last ad -> reverse!
    } else if (current <= 0) {
      direction = 1;  // reached the first ad -> go forward!
    }
    goTo(current + direction);
  }

  function resetTimer() {
    clearInterval(timer); clearTimeout(timer);
    if (total > 1) {
      timer = setInterval(nextStep, INTERVAL);
    }
  }

  if (prevBtn) prevBtn.onclick = () => { direction = -1; goTo(current - 1); };
  if (nextBtn) nextBtn.onclick = () => { direction = 1; goTo(current + 1); };
  if (dotsEl) dotsEl.onclick = e => {
    const b = e.target.closest('.ad-dot');
    if (b) {
      const target = Number(b.dataset.i);
      if (target > current) direction = 1;
      if (target < current) direction = -1;
      goTo(target);
    }
  };

  container.addEventListener('mouseenter', () => clearInterval(timer));
  container.addEventListener('mouseleave', () => resetTimer());
  container.addEventListener('touchstart', () => clearInterval(timer), { passive: true });
  container.addEventListener('touchend', () => resetTimer(), { passive: true });

  attachSwipeHandler(
    container,
    () => { direction = -1; goTo(current - 1); },
    () => { direction = 1; goTo(current + 1); }
  );

  goTo(0);
}

function buildAdSlideshow(media, trackId, dotsId, prevId, nextId, containerId) {
  const track     = document.getElementById(trackId);
  const dotsEl    = document.getElementById(dotsId);
  const prevBtn   = document.getElementById(prevId);
  const nextBtn   = document.getElementById(nextId);
  const container = document.getElementById(containerId);
  if (!track || !container || !media.length) return;

  const slideClass = 'ad-slide';
  const dotClass   = 'ad-dot';

  // On desktop we show 2 slides side-by-side; each slide is 50% wide.
  // We need an even number of slides — pad with a duplicate if odd.
  const items = media.length % 2 === 0 ? media : [...media, media[0]];

  track.innerHTML = items.map(m => {
    if (m.type === 'video') {
      return `<div class="${slideClass}"><video src="${m.url}" autoplay muted loop playsinline preload="auto"></video></div>`;
    }
    return `<div class="${slideClass}"><img src="${m.url}" alt="Advertisement" loading="lazy"></div>`;
  }).join('');

  // One dot per pair of slides
  const pairCount = Math.ceil(items.length / 2);
  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: pairCount }, (_, i) =>
      `<button class="${dotClass}${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i+1}"></button>`
    ).join('');
  }

  container.style.display = '';

  let current = 0; // current pair index
  let direction = 1;
  let timer;
  const INTERVAL = 4000;

  if (pairCount <= 1) {
    if (prevBtn) prevBtn.hidden = true;
    if (nextBtn) nextBtn.hidden = true;
  }

  function goTo(pairIdx) {
    if (pairCount <= 1) {
      track.style.transform = 'translateX(0)';
      return;
    }
    current = Math.max(0, Math.min(pairIdx, pairCount - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    if (dotsEl) dotsEl.querySelectorAll('.' + dotClass).forEach((d, i) => d.classList.toggle('active', i === current));
    resetTimer();
  }

  function nextStep() {
    if (pairCount <= 1) return;
    if (current >= pairCount - 1) {
      direction = -1; // reached the last slide -> reverse!
    } else if (current <= 0) {
      direction = 1;  // reached the first slide -> go forward!
    }
    goTo(current + direction);
  }

  function resetTimer() {
    clearInterval(timer); clearTimeout(timer);
    if (pairCount > 1) {
      timer = setInterval(nextStep, INTERVAL);
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { direction = -1; goTo(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', () => { direction = 1; goTo(current + 1); });
  if (dotsEl) dotsEl.addEventListener('click', e => {
    const btn = e.target.closest('.' + dotClass);
    if (btn) {
      const target = Number(btn.dataset.i);
      if (target > current) direction = 1;
      if (target < current) direction = -1;
      goTo(target);
    }
  });

  container.addEventListener('mouseenter', () => clearInterval(timer));
  container.addEventListener('mouseleave', () => resetTimer());
  container.addEventListener('touchstart', () => clearInterval(timer), { passive: true });
  container.addEventListener('touchend', () => resetTimer(), { passive: true });

  attachSwipeHandler(
    container,
    () => { direction = -1; goTo(current - 1); },
    () => { direction = 1; goTo(current + 1); }
  );

  goTo(0);
}

async function loadAdBanner() {
  const container = document.getElementById('adBanner');
  // 1) Custom ads created in the Admin "Ads Maker" take priority
  try {
    const custom = await request('/api/ads');
    if (custom && custom.length) {
      buildCustomAdSlideshow(custom, 'adTrack', 'adDots', 'adPrev', 'adNext', 'adBanner');
      return;
    }
  } catch (e) { /* fall through to uploaded media */ }

  try {
    const media = await request('/api/ad-media');
    if (media && media.length) {
      // Use uploaded admin media
      buildAdSlideshow(media, 'adTrack', 'adDots', 'adPrev', 'adNext', 'adBanner');
      return;
    }
  } catch (e) { /* non-critical */ }

  // If no custom ads or media are configured, hide the ad banner section completely
  if (container) container.style.display = 'none';
}

document.getElementById('accountBtn').onclick = () => currentUser ? (['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role) ? (window.location.href = '/admin/dashboard') : (window.location.href = '/my-orders')) : showAuth();

/* ── Ad banner CTA buttons — filter shop by category ── */
document.getElementById('adBanner').addEventListener('click', e => {
  const btn = e.target.closest('.dummy-ad-btn[data-ad-cat]');
  if (!btn) return;
  const cat = btn.dataset.adCat;
  if (typeof setActiveCategory === 'function') {
    setActiveCategory(cat);
  }
  const shopEl = document.getElementById('shop') || document.getElementById('productGrid');
  if (shopEl) shopEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
/* ── COMMUNITY COMMENTS & MEMBER VOICES (3 at a time + See more) ── */
let _allCommunityComments = [];
let _visibleCommentsCount = 3;
const COMMENTS_INITIAL = 3;
const COMMENTS_STEP = 3;

function renderCommunityCommentsGrid() {
  const grid = document.getElementById('communityCommentsGrid');
  const countTag = document.getElementById('communityCountTag');
  const moreWrap = document.getElementById('communityMoreWrap');
  const moreBtn = document.getElementById('btnSeeMoreComments');
  if (!grid) return;

  if (countTag) {
    countTag.textContent = `${_allCommunityComments.length} ${_allCommunityComments.length === 1 ? 'Comment' : 'Comments'}`;
  }

  if (!_allCommunityComments.length) {
    grid.innerHTML = `
      <div class="community-empty">
        <p style="font-size:1.05rem;font-weight:600;margin-bottom:6px">🌱 ${escapeHTML(window._siteSettings?.communityEmptyMessage || 'Be the first to share your thoughts!')}</p>
      </div>
    `;
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }

  const visibleList = _allCommunityComments.slice(0, _visibleCommentsCount);

  grid.innerHTML = visibleList.map(c => {
    const initial = (c.authorName || 'M').charAt(0).toUpperCase();
    const isStaff = ['superadmin', 'admin', 'manager', 'moderator'].includes(c.authorRole);
    const isOwner = currentUser && (currentUser.id === c.userId || currentUser.email === c.authorEmail);
    const canDelete = isOwner || (currentUser && ['superadmin', 'admin', 'moderator'].includes(currentUser.role));
    const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

    return `
      <div class="comment-card" id="comment-${c.id}">
        <div class="comment-card-content">
          <div class="comment-card-head">
            <div class="comment-user-info">
              <div class="comment-user-avatar ${isStaff ? 'avatar--staff' : 'avatar--member'}">
                ${c.authorAvatar ? `<img src="${escapeHTML(c.authorAvatar)}" alt="${escapeHTML(c.authorName || 'Member')}">` : escapeHTML(initial)}
              </div>
              <div>
                <div class="comment-user-name">
                  ${escapeHTML(c.authorName || 'Member')}
                  <span class="comment-badge-verified">${isStaff ? '👑 Staff' : '🌱 Member'}</span>
                </div>
                <div class="comment-time">${escapeHTML(dateStr)}</div>
              </div>
            </div>
          </div>
          <div class="comment-body">${escapeHTML(c.text)}</div>
          ${c.reply ? `
            <div class="comment-reply-box">
              <div class="comment-reply-head">
                <span class="comment-reply-badge">🌾 ${escapeHTML(c.reply.replierName || 'ENMAR Response')}</span>
                <span class="comment-reply-time">${c.reply.repliedAt ? escapeHTML(new Date(c.reply.repliedAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })) : ''}</span>
              </div>
              <div class="comment-reply-text">${escapeHTML(c.reply.text)}</div>
            </div>
          ` : ''}
        </div>
        ${canDelete ? `
          <div class="comment-actions">
            <button type="button" class="btn-comment-del" data-cid="${c.id}">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-comment-del').forEach(btn => {
    btn.onclick = async () => {
      const cid = Number(btn.dataset.cid);
      const ok = typeof smartConfirm === 'function' ? await smartConfirm({
        title: 'Delete Comment',
        message: 'Are you sure you want to delete this comment from the community board?',
        confirmText: 'Delete Comment',
        cancelText: 'Keep Comment',
        danger: true,
        variant: 'delete'
      }) : confirm('Are you sure you want to delete this comment?');
      if (!ok) return;

      try {
        await request(`/api/comments/${cid}`, { method: 'DELETE' });
        await loadCommunityComments();
      } catch (err) {
        alert(err.message || 'Failed to delete comment.');
      }
    };
  });

  // Wire see more / see less button
  if (moreWrap && moreBtn) {
    const total = _allCommunityComments.length;
    if (total <= COMMENTS_INITIAL) {
      moreWrap.style.display = 'none';
    } else {
      moreWrap.style.display = 'flex';
      const remaining = total - _visibleCommentsCount;
      if (remaining > 0) {
        moreBtn.innerHTML = `See more comments (${remaining} more) <span style="font-size:1.05em;margin-left:4px">↓</span>`;
        moreBtn.dataset.state = 'more';
      } else {
        moreBtn.innerHTML = `See less comments <span style="font-size:1.05em;margin-left:4px">↑</span>`;
        moreBtn.dataset.state = 'less';
      }

      if (!moreBtn.dataset.bound) {
        moreBtn.dataset.bound = '1';
        moreBtn.addEventListener('click', () => {
          if (moreBtn.dataset.state === 'less') {
            _visibleCommentsCount = COMMENTS_INITIAL;
            renderCommunityCommentsGrid();
            const sec = document.getElementById('communitySection');
            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            _visibleCommentsCount += COMMENTS_STEP;
            renderCommunityCommentsGrid();
          }
        });
      }
    }
  }
}

async function loadCommunityComments() {
  const grid = document.getElementById('communityCommentsGrid');
  const composeCard = document.getElementById('communityComposeCard');

  if (composeCard) {
    if (currentUser) {
      const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
      const isStaff = ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
      const roleLabel = isStaff ? '👑 Team ENMAR' : '🌱 Verified Member';
      composeCard.innerHTML = `
        <div class="community-member-compose">
          <div class="compose-user-bar">
            <div class="compose-avatar">
              ${currentUser.avatar ? `<img src="${escapeHTML(currentUser.avatar)}" alt="${escapeHTML(currentUser.name)}">` : escapeHTML(initial)}
            </div>
            <div>
              <span class="compose-author-name">${escapeHTML(currentUser.name)}</span>
              <span class="compose-member-badge">${escapeHTML(roleLabel)}</span>
            </div>
          </div>
          <form id="communityCommentForm">
            <textarea id="communityCommentText" class="compose-textarea" placeholder="${escapeHTML(window._siteSettings?.communityPlaceholder || 'Share your thoughts, review our seasonal harvest, or ask a question…')}" required maxlength="1000"></textarea>
            <div class="compose-actions" style="margin-top:8px">
              <span class="compose-hint">Posting publicly as <strong>${escapeHTML(currentUser.name)}</strong></span>
              <button type="submit" class="btn-post-comment" id="btnSubmitComment">Post Comment</button>
            </div>
          </form>
          <div id="communityCommentMsg" style="font-size:.82rem;margin-top:6px;font-weight:600"></div>
        </div>
      `;

      const form = document.getElementById('communityCommentForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const textarea = document.getElementById('communityCommentText');
          const btn = document.getElementById('btnSubmitComment');
          const msgEl = document.getElementById('communityCommentMsg');
          const text = (textarea.value || '').trim();
          if (!text) return;
          btn.disabled = true;
          btn.textContent = 'Posting…';
          if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
          try {
            await request('/api/comments', {
              method: 'POST',
              body: JSON.stringify({ text })
            });
            textarea.value = '';
            if (msgEl) {
              msgEl.textContent = '✓ Your comment has been posted to the community!';
              msgEl.style.color = 'var(--forest, #15803d)';
            }
            await loadCommunityComments();
          } catch (err) {
            if (msgEl) {
              msgEl.textContent = err.message || 'Failed to post comment.';
              msgEl.style.color = 'var(--tomato, #dc2626)';
            }
          } finally {
            btn.disabled = false;
            btn.textContent = 'Post Comment';
          }
        };
      }
    } else {
      composeCard.innerHTML = `
        <div class="community-guest-prompt">
          <div class="community-guest-info">
            <div class="community-guest-icon">💬</div>
            <div>
              <div class="community-guest-title">Join our community conversation</div>
              <div class="community-guest-desc">${escapeHTML(window._siteSettings?.communityPromptGuest || 'Only registered members can post comments and reviews. Sign in or create a free account to share your thoughts!')}</div>
            </div>
          </div>
          <div class="community-guest-actions">
            <button type="button" class="btn-soft" id="btnGuestSignIn" style="padding:8px 18px;font-size:.82rem;font-weight:600">Sign In</button>
            <button type="button" class="btn-primary" id="btnGuestRegister" style="padding:8px 18px;font-size:.82rem;font-weight:600">Register Free</button>
          </div>
        </div>
      `;

      const btnSignIn = document.getElementById('btnGuestSignIn');
      const btnReg = document.getElementById('btnGuestRegister');
      if (btnSignIn) btnSignIn.onclick = () => showAuth('login');
      if (btnReg) btnReg.onclick = () => showAuth('register');
    }
  }

  if (!grid) return;
  try {
    _allCommunityComments = await request('/api/comments');
    renderCommunityCommentsGrid();
  } catch (err) {
    grid.innerHTML = `<div class="community-empty"><p style="color:var(--tomato)">Unable to load comments at this time.</p></div>`;
  }
}

/* ── Live Product Arrival Real-Time Notification ── */
function showProductArrivalToast(p) {
  if (!p || !p.name) return;
  let container = document.getElementById('arrivalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'arrivalToastContainer';
    container.className = 'arrival-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'arrival-toast';

  const imgHtml = p.image
    ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="arrival-toast-img">`
    : `<div class="arrival-toast-img">🌾</div>`;

  const farmHtml = p.farm ? `from <strong>${escapeHTML(p.farm)}</strong>` : '';
  const priceHtml = taka(p.price) + (p.unit ? ` / ${escapeHTML(p.unit)}` : '');

  toast.innerHTML = `
    ${imgHtml}
    <div class="arrival-toast-body">
      <div class="arrival-toast-tag">
        <span>🌿</span> Fresh Arrival
      </div>
      <div class="arrival-toast-title">${escapeHTML(p.name)}</div>
      <div class="arrival-toast-meta">
        ${farmHtml ? `${farmHtml} · ` : ''}<span class="arrival-toast-price">${priceHtml}</span>
      </div>
      <a href="/product?id=${p.id}" class="arrival-toast-btn">View Product →</a>
    </div>
    <button type="button" class="arrival-toast-close" title="Dismiss">✕</button>
  `;

  const closeBtn = toast.querySelector('.arrival-toast-close');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  };
  closeBtn.onclick = dismiss;

  // Auto dismiss after 9 seconds
  setTimeout(dismiss, 9000);

  container.appendChild(toast);
}

(async () => {
  try {
    initAuthModalSystem();
    [currentUser] = await Promise.all([
      request('/api/auth/me').then(d => d.user),
      loadSettings(),
      loadProducts(),
      loadAdBanner()
    ]);
    refreshAccountButton();
    await loadCommunityComments();

    const urlParams = new URLSearchParams(window.location.search);
    if (!currentUser && (urlParams.has('login') || urlParams.has('auth') || urlParams.has('checkout'))) {
      const mode = urlParams.get('mode') === 'register' ? 'register' : 'login';
      const note = urlParams.has('checkout') ? 'অর্ডার সম্পন্ন করার জন্য অনুগ্রহ করে সাইন ইন করুন।' : '';
      openAuthModal(mode, note);
    }
  } catch (error) {
    console.warn(error);
  }
})();

