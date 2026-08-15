/**
 * admin-core.js — shared utilities, auth guard, sidebar wiring
 * Loaded on every admin page.
 */

// Early check to avoid flash of sidebar when admin prefers collapsed desktop mode
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('enmar_admin_sidebar_collapsed') === '1') {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      document.documentElement.classList.add('sidebar-collapsed');
    }
  }
} catch (_) {}

const $ = id => (typeof id === 'string' ? document.getElementById(id.replace(/^#/, '')) : id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const taka = v => `৳${Number(v || 0).toFixed(2)}`;

function notice(el, text, ok = false) {
  if (!el) return;
  el.innerHTML = text ? `<div class="notice${ok ? ' ok' : ''}">${esc(text)}</div>` : '';
}

function openModal(id) {
  const el = $(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('open');
}

async function api(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
  } catch {
    throw new Error('Cannot reach the server. Make sure "node server.js" is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

/* ── AUTH GUARD ── */
let currentUser = null;

async function initAdminPage(requiredRoles) {
  requiredRoles = requiredRoles || ['superadmin', 'admin', 'manager', 'moderator'];
  try {
    const d = await api('/api/auth/me');
    if (d.user && requiredRoles.includes(d.user.role)) {
      currentUser = d.user;
      setupShell();
      return currentUser;
    }
  } catch { /* fall through */ }
  window.location.href = '/';
  return null;
}

function updateSidebarUserDisplay() {
  if (!currentUser) return;
  const av = $('sidebarAvatar');
  if (av) {
    if (currentUser.avatar) {
      av.innerHTML = `<img src="${esc(currentUser.avatar)}" alt="${esc(currentUser.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      const ini = (currentUser.name || 'A').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      av.textContent = ini;
    }
  }
  const sn = $('sidebarName'); if (sn) sn.textContent = currentUser.name || 'Admin';
  const sr = $('sidebarRole'); if (sr) sr.textContent = currentUser.designation ? `${currentUser.designation}` : currentUser.role;
  const tr = $('topbarRole');  if (tr) tr.textContent = currentUser.role;
}

let _adminAvatarData = null; // store new avatar dataUrl or ''

function ensureAdminProfileModal() {
  if ($('adminProfileModal')) return;
  const div = document.createElement('div');
  div.id = 'adminProfileModal';
  div.className = 'modal-overlay';
  div.innerHTML = `
    <div class="modal-box wide">
      <div class="modal-head">
        <div>
          <h2>Admin Profile Settings</h2>
          <span class="mono-tag" id="admProfRoleBadge" style="margin-top:2px;display:inline-block">Profile Details</span>
        </div>
        <button type="button" class="btn-muted" onclick="closeModal('adminProfileModal')">✕</button>
      </div>

      <div id="admProfMsg" class="global-message" style="padding:0 0 12px"></div>

      <form id="adminProfileForm" onsubmit="return false;">
        <!-- AVATAR UPLOAD SECTION -->
        <div class="profile-avatar-row">
          <div class="profile-avatar-preview" id="admProfAvatarPreview">
            <span id="admProfAvatarInitials">?</span>
          </div>
          <div class="profile-avatar-controls">
            <label class="btn-soft" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-size:.72rem">
              <span>📷 Upload Profile Photo</span>
              <input type="file" id="admProfFileInput" accept="image/*" style="display:none">
            </label>
            <button type="button" class="btn-danger" id="admProfRemoveAvatarBtn" style="font-size:.65rem;padding:5px 10px;align-self:flex-start">✕ Remove Photo</button>
            <small class="mono-tag mono-tag--plain" style="color:var(--ink-soft);font-size:.64rem">JPG, PNG, WebP (max 5MB)</small>
          </div>
        </div>

        <!-- FORM FIELDS -->
        <div class="profile-field-grid">
          <div class="field span2">
            <label for="admProfName">Full Name *</label>
            <input type="text" id="admProfName" required placeholder="Enter full name" autocomplete="name">
          </div>

          <div class="field">
            <label for="admProfDesignation">Designation / Title</label>
            <input type="text" id="admProfDesignation" placeholder="e.g. Founder &amp; CEO, Store Director" autocomplete="organization-title">
          </div>

          <div class="field">
            <label for="admProfPhone">Phone Number</label>
            <input type="tel" id="admProfPhone" placeholder="01XXXXXXXXX" autocomplete="tel">
          </div>

          <div class="field">
            <label for="admProfCity">City / Region</label>
            <input type="text" id="admProfCity" placeholder="e.g. Dhaka" autocomplete="address-level2">
          </div>

          <div class="field">
            <label for="admProfAddress">Address</label>
            <input type="text" id="admProfAddress" placeholder="e.g. Road 12, Block B" autocomplete="street-address">
          </div>

          <div class="field span2">
            <label for="admProfBio">About / Bio</label>
            <textarea id="admProfBio" rows="2" placeholder="Brief personal or management note..."></textarea>
          </div>

          <!-- READ-ONLY PROTECTED FIELDS -->
          <div class="field">
            <label for="admProfEmail">Email Address (Locked)</label>
            <input type="email" id="admProfEmail" disabled readonly style="background:rgba(0,0,0,.04);color:var(--ink-soft);cursor:not-allowed">
            <span class="field-locked-note">🔒 Email cannot be changed here</span>
          </div>

          <div class="field">
            <label for="admProfRole">Account Role (Locked)</label>
            <input type="text" id="admProfRole" disabled readonly style="background:rgba(0,0,0,.04);color:var(--ink-soft);cursor:not-allowed">
            <span class="field-locked-note">🔒 Managed by system permissions</span>
          </div>

          <!-- OPTIONAL PASSWORD CHANGE -->
          <div class="field span2" style="margin-top:10px;padding-top:14px;border-top:1px dashed var(--line)">
            <strong style="font-size:0.8rem;color:var(--forest);display:block;margin-bottom:6px">Change Password (Leave blank to keep unchanged)</strong>
          </div>
          <div class="field">
            <label for="admProfCurrPass">Current Password</label>
            <div style="position:relative;display:flex;align-items:center">
              <input type="password" id="admProfCurrPass" placeholder="Current password" autocomplete="current-password" style="padding-right:60px">
              <button type="button" class="adm-toggle-pwd" data-target="admProfCurrPass" style="position:absolute;right:8px;background:none;border:none;color:var(--forest);font-size:0.75rem;font-weight:700;cursor:pointer;padding:4px">Show</button>
            </div>
          </div>
          <div class="field">
            <label for="admProfNewPass">New Password (min 8 chars)</label>
            <div style="position:relative;display:flex;align-items:center">
              <input type="password" id="admProfNewPass" placeholder="Min. 8 characters" autocomplete="new-password" style="padding-right:60px">
              <button type="button" class="adm-toggle-pwd" data-target="admProfNewPass" style="position:absolute;right:8px;background:none;border:none;color:var(--forest);font-size:0.75rem;font-weight:700;cursor:pointer;padding:4px">Show</button>
            </div>
          </div>
        </div>

        <div class="modal-actions" style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line)">
          <button type="button" class="btn-muted" onclick="closeModal('adminProfileModal')">Cancel</button>
          <button type="submit" class="btn-primary" id="admProfSaveBtn">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(div);

  document.querySelectorAll('#adminProfileModal .adm-toggle-pwd').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isPass = target.type === 'password';
      target.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Hide' : 'Show';
    };
  });

  // File input listener with auto canvas scaling
  $('admProfFileInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notice($('admProfMsg'), 'Please choose an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notice($('admProfMsg'), 'Image too large. Please select an image under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        _adminAvatarData = canvas.toDataURL('image/jpeg', 0.88);
        renderProfileModalAvatarPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('admProfRemoveAvatarBtn').addEventListener('click', () => {
    _adminAvatarData = ''; // marked to clear
    $('admProfFileInput').value = '';
    renderProfileModalAvatarPreview();
  });

  $('adminProfileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = $('admProfSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    notice($('admProfMsg'), '');

    const newPass = ($('admProfNewPass') || {}).value || '';
    const currPass = ($('admProfCurrPass') || {}).value || '';

    if (newPass) {
      if (newPass.length < 8) {
        notice($('admProfMsg'), 'New password must be at least 8 characters long.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        return;
      }
      if (!currPass) {
        notice($('admProfMsg'), 'Please enter your current password to change password.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        return;
      }
    }

    const payload = {
      name: $('admProfName').value.trim(),
      designation: $('admProfDesignation').value.trim(),
      phone: $('admProfPhone').value.trim(),
      city: $('admProfCity').value.trim(),
      address: $('admProfAddress').value.trim(),
      bio: $('admProfBio').value.trim()
    };
    if (_adminAvatarData !== null) {
      payload.avatar = _adminAvatarData;
    }

    try {
      if (newPass) {
        await api('/api/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: currPass, newPassword: newPass })
        });
      }
      const res = await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (res.user) {
        currentUser = res.user;
        updateSidebarUserDisplay();
        notice($('admProfMsg'), newPass ? 'Profile and password updated successfully!' : 'Profile updated successfully!', true);
        if ($('admProfNewPass')) $('admProfNewPass').value = '';
        if ($('admProfCurrPass')) $('admProfCurrPass').value = '';
        setTimeout(() => {
          closeModal('adminProfileModal');
        }, 900);
      }
    } catch (err) {
      notice($('admProfMsg'), err.message || 'Could not update profile.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

function renderProfileModalAvatarPreview() {
  const preview = $('admProfAvatarPreview');
  if (!preview) return;
  const currentSrc = _adminAvatarData !== null ? _adminAvatarData : (currentUser && currentUser.avatar);
  if (currentSrc) {
    preview.innerHTML = `<img src="${esc(currentSrc)}" alt="Avatar Preview" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    const name = ($('admProfName') && $('admProfName').value) || (currentUser && currentUser.name) || 'A';
    const ini = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    preview.innerHTML = `<span>${esc(ini)}</span>`;
  }
}

function openAdminProfileModal() {
  ensureAdminProfileModal();
  if (!currentUser) return;
  _adminAvatarData = null; // reset pending state
  notice($('admProfMsg'), '');

  $('admProfName').value = currentUser.name || '';
  $('admProfDesignation').value = currentUser.designation || '';
  $('admProfPhone').value = currentUser.phone || '';
  $('admProfCity').value = currentUser.city || '';
  $('admProfAddress').value = currentUser.address || '';
  $('admProfBio').value = currentUser.bio || '';
  $('admProfEmail').value = currentUser.email || '';
  $('admProfRole').value = currentUser.role ? currentUser.role.toUpperCase() : '';
  if ($('admProfRoleBadge')) $('admProfRoleBadge').textContent = `${currentUser.role.toUpperCase()} PROFILE`;

  renderProfileModalAvatarPreview();
  openModal('adminProfileModal');
}

function applyAdminBranding(settings) {
  if (!settings) return;
  const brandName = settings.brandName || 'ENMAR';
  const adminName = settings.adminBrandName || `${brandName} Admin`;
  const logo = settings.adminLogo || settings.brandLogo || '';

  // Update sidebar branding title text & logo
  const logoBrand = document.querySelector('.sidebar-logo-brand');
  if (logoBrand) {
    const textSpan = logoBrand.querySelector('span');
    if (textSpan) textSpan.textContent = adminName;

    // Update or inject logo image/icon
    if (logo) {
      let img = logoBrand.querySelector('img.sidebar-brand-img');
      const svg = logoBrand.querySelector('svg');
      if (svg) svg.style.display = 'none';

      if (!img) {
        img = document.createElement('img');
        img.className = 'sidebar-brand-img';
        img.style.cssText = 'width:24px;height:24px;object-fit:contain;border-radius:4px;flex-shrink:0;';
        if (textSpan) logoBrand.insertBefore(img, textSpan);
        else logoBrand.appendChild(img);
      }
      img.src = logo;
      img.alt = adminName;
      img.style.display = 'block';
    } else {
      const img = logoBrand.querySelector('img.sidebar-brand-img');
      if (img) img.style.display = 'none';
      const svg = logoBrand.querySelector('svg');
      if (svg) svg.style.display = '';
    }
  }

  // Update document title if applicable
  const currentTitle = document.title;
  if (currentTitle && currentTitle.includes('—')) {
    const parts = currentTitle.split('—');
    document.title = `${parts[0].trim()} — ${adminName}`;
  }

  applyAdminFavicon(settings.favicon || '');
}

function applyAdminFavicon(url) {
  const href = String(url || '').trim();
  const existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  if (!href) {
    existing.forEach(el => el.remove());
    return;
  }
  let link = existing[0];
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  existing.forEach((el, i) => { if (i > 0) el.remove(); });
  link.type = href.includes('image/svg') ? 'image/svg+xml'
    : (href.includes('image/png') ? 'image/png'
      : (href.includes('image/x-icon') || href.includes('image/vnd.microsoft.icon') ? 'image/x-icon' : 'image/png'));
  link.href = href;
}

function setupShell() {
  if (!currentUser) return;
  updateSidebarUserDisplay();

  // Load and apply live branding (Name & Logo)
  api('/api/settings').then(s => {
    applyAdminBranding(s);
  }).catch(() => {});

  // Hide staff nav item for non-superadmin
  const staffLink = $('staffNavLink');
  if (staffLink) staffLink.style.display = currentUser.role === 'superadmin' ? '' : 'none';

  // Ensure Recycle Bin nav link is present in sidebar under System section
  const sysNav = document.querySelector('nav[aria-label="System"], nav[aria-label="System navigation"]');
  if (sysNav && !sysNav.querySelector('a[data-page="bin"]')) {
    const binLink = document.createElement('a');
    binLink.href = '/admin/bin.html';
    binLink.className = 'nav-item' + (window.location.pathname.includes('bin.html') ? ' active' : '');
    binLink.dataset.page = 'bin';
    binLink.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>Recycle Bin <span class="sidebar-badge" id="binNavBadge" style="margin-left:auto;display:none;background:#fee2e2;color:#991b1b;font-weight:700;font-size:.65rem;padding:1px 6px;border-radius:10px">0</span>
    `;
    sysNav.appendChild(binLink);
  }

  // Update live Recycle Bin count in sidebar
  api('/api/admin/bin').then(data => {
    const badge = $('binNavBadge') || document.querySelector('#binNavBadge');
    if (badge && data && data.counts) {
      if (data.counts.all > 0) {
        badge.textContent = data.counts.all;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }).catch(() => {});

  // Wire User Chip click to customize profile
  const userChips = document.querySelectorAll('.user-chip');
  userChips.forEach(chip => {
    chip.style.cursor = 'pointer';
    chip.title = 'Click to customize your profile';
    chip.onclick = () => openAdminProfileModal();
  });

  // Sidebar toggle (Desktop collapse & Mobile drawer)
  const toggle = $('menuToggle');
  const sidebar = $('sidebar');
  const overlay = $('sbOverlay');
  const collapseBtn = $('sidebarCollapseBtn');

  const updateToggleTitle = () => {
    if (!toggle) return;
    const isCollapsed = document.documentElement.classList.contains('sidebar-collapsed') || document.body.classList.contains('sidebar-collapsed');
    toggle.title = isCollapsed ? 'Show Sidebar' : 'Hide Sidebar';
    toggle.setAttribute('aria-label', toggle.title);
  };

  if (document.documentElement.classList.contains('sidebar-collapsed') && window.innerWidth > 768) {
    document.body.classList.add('sidebar-collapsed');
  }
  updateToggleTitle();

  if (toggle && sidebar) {
    toggle.onclick = () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('visible');
      } else {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('enmar_admin_sidebar_collapsed', isCollapsed ? '1' : '0');
        updateToggleTitle();
      }
    };
  }

  if (collapseBtn && sidebar) {
    collapseBtn.onclick = () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
      } else {
        document.body.classList.add('sidebar-collapsed');
        document.documentElement.classList.add('sidebar-collapsed');
        localStorage.setItem('enmar_admin_sidebar_collapsed', '1');
        updateToggleTitle();
      }
    };
  }

  if (overlay && sidebar) {
    overlay.onclick = () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    };
  }

  // Logout
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/';
    };
  }

  // 3-dot dropdown
  const dotBtn = $('dotMenuBtn');
  const dotDrop = $('dotDropdown');
  if (dotBtn && dotDrop) {
    if (!dotDrop.querySelector('.btn-profile-link')) {
      const profLink = document.createElement('a');
      profLink.href = 'javascript:void(0)';
      profLink.className = 'btn-profile-link';
      profLink.innerHTML = '👤 My Profile';
      profLink.onclick = (e) => { e.preventDefault(); dotDrop.classList.remove('open'); openAdminProfileModal(); };
      dotDrop.insertBefore(profLink, dotDrop.firstChild);
    }
    dotBtn.onclick = e => { e.stopPropagation(); dotDrop.classList.toggle('open'); };
    document.addEventListener('click', () => dotDrop.classList.remove('open'));
  }

  // Mark active nav item based on current page filename
  const page = location.pathname.split('/').pop().replace('.html', '');
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

/* ── SHARED TABLE BUILDERS ── */
function buildOrderTable(orders, showPayment, canDel = false) {
  return `<table class="data-table"><thead><tr>
    <th>Order #</th><th>Date</th><th>Customer</th><th>City</th>
    ${showPayment ? '<th>Payment</th>' : ''}
    <th>Total</th><th>Status</th><th>Delivery</th><th></th>
  </tr></thead><tbody>
  ${orders.map(o => {
    const isCustomerCancelled = o.status === 'Cancelled' && o.cancelledBy === 'customer';
    const isCustomerHidden = Boolean(o.customerHidden);
    return `<tr>
    <td>
      <strong>${esc(o.number)}</strong>
      ${isCustomerHidden ? `<br><span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;font-size:0.6rem;font-weight:700;margin-top:2px" title="Customer cleared this order from their personal history view">🗑️ Cleared from Customer View</span>` : ''}
      <br><small style="color:var(--forest);font-size:.65rem">💌 ${esc(o.customerMessage || o.note || 'Thank you')}</small>
    </td>
    <td><small>${new Date(o.createdAt).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })}</small></td>
    <td>${esc(o.customer?.name || '—')}<br><small>${esc(o.customer?.phone || '')}</small></td>
    <td>${esc(o.customer?.city || '—')}</td>
    ${showPayment ? `<td><small>${esc(o.paymentMethod)}</small></td>` : ''}
    <td>${taka(o.total)}</td>
    <td>
      <select class="inline-select statusSelect" data-order="${o.id}" ${isCustomerCancelled ? 'disabled title="Locked: Cancelled by customer" style="opacity:0.75;cursor:not-allowed;border-color:#fca5a5;background:#fef2f2;color:#991b1b;font-weight:700"' : ''}>
        ${['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      ${o.status === 'Cancelled' ? `<div style="font-size:.62rem;color:#b91c1c;font-weight:700;margin-top:3px">${esc(o.cancelledBy === 'customer' ? `🔒 Cancelled by ${o.cancelledByName || o.customer?.name || o.user?.name || 'Customer'}` : 'Cancelled by ENMAR')}</div>` : ''}
    </td>
    <td>${countdownHTML(o)}</td>
    <td style="white-space:nowrap">
      <button type="button" class="btn-soft btn-order-detail" data-oid="${o.id}" style="margin-right:3px">Detail</button>
      <a href="/receipt.html?id=${o.id}" target="_blank" class="btn-soft" style="margin-right:3px;text-decoration:none;color:var(--forest,#16a34a);font-weight:600" title="Open &amp; Print Official Money Receipt">🧾 Receipt</a>
      ${canDel ? `<button type="button" class="btn-danger btn-order-delete" data-oid="${o.id}">Del</button>` : ''}
    </td>
  </tr>`;
  }).join('')}
  </tbody></table>`;
}

function renderAdminHistory(o) {
  const listEl = $('adminHistoryList');
  if (!listEl) return;
  const hist = Array.isArray(o.history) && o.history.length ? o.history : [
    {
      action: 'Order Placed',
      detail: `Order created with ${o.paymentMethod || 'Cash on Delivery'} (Total: ${taka(o.total)})`,
      actor: 'customer',
      actorName: o.customer?.name || 'Customer',
      timestamp: o.createdAt
    }
  ];

  listEl.innerHTML = hist.map(h => {
    const isCustomer = h.actor === 'customer';
    const isDelete = h.action && (h.action.includes('Deleted') || h.action.includes('History'));
    const isCancel = h.action && h.action.includes('Cancelled');
    const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    
    let icon = isDelete ? '🗑️' : (isCancel ? '✕' : (isCustomer ? '👤' : '🛡️'));
    let badgeColor = isDelete ? '#dc2626' : (isCancel ? '#b91c1c' : (isCustomer ? '#2563eb' : '#16a34a'));
    let bg = isDelete ? '#fef2f2' : (isCancel ? '#fff1f2' : (isCustomer ? '#eff6ff' : '#f0fdf4'));
    let border = isDelete ? '#fca5a5' : (isCancel ? '#fecdd3' : (isCustomer ? '#bfdbfe' : '#bbf7d0'));

    return `
      <div style="padding:7px 10px;border-radius:6px;background:${bg};border:1px solid ${border};font-size:.78rem">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:2px">
          <strong style="color:${badgeColor}">${icon} ${esc(h.action)}</strong>
          <span style="font-family:var(--font-mono);font-size:.65rem;color:var(--ink-soft)">${esc(timeStr)}</span>
        </div>
        ${h.detail ? `<div style="color:var(--ink);font-size:.75rem;margin:2px 0">${esc(h.detail)}</div>` : ''}
        <div style="font-size:.64rem;color:var(--ink-soft)">
          Actor: <span style="font-weight:600">${esc(h.actorName || (isCustomer ? 'Customer' : 'Staff'))}</span> ${h.actorRole ? `(${esc(h.actorRole)})` : ''}
        </div>
      </div>
    `;
  }).join('');
  listEl.scrollTop = listEl.scrollHeight;
}

/* ── ORDER NOTIFICATIONS (SSE) ── */
let _sseSource = null;

function startOrderNotifications() {
  if (_sseSource) return; // already connected
  if (!window.EventSource) return; // browser doesn't support SSE

  _sseSource = new EventSource('/api/events');

  _sseSource.addEventListener('new-order', (e) => {
    try {
      const order = JSON.parse(e.data);
      showOrderToast(order);
      // play a subtle beep using the Web Audio API if available
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } catch { /* audio not available */ }
    } catch { /* ignore malformed data */ }
  });

  _sseSource.onerror = () => {
    // reconnect automatically after 5 s if the connection drops
    _sseSource.close();
    _sseSource = null;
    setTimeout(startOrderNotifications, 5000);
  };
}

function showOrderToast(order) {
  // ensure container exists
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'order-toast';
  toast.innerHTML = `
    <div class="order-toast__icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7h11v9H3z"/><path d="M14 11h4l3 3v2h-7z"/>
        <circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>
      </svg>
    </div>
    <div class="order-toast__body">
      <strong>New Order</strong>
      <span>${esc(order.number)} · ${esc(order.customer)}</span>
      <span>${esc(order.city)} · ${taka(order.total)}</span>
    </div>
    <a href="/admin/orders.html" class="order-toast__link">View</a>
    <button type="button" class="order-toast__close" aria-label="Dismiss">✕</button>`;

  toast.querySelector('.order-toast__close').onclick = () => dismissToast(toast);
  container.appendChild(toast);

  // animate in
  requestAnimationFrame(() => toast.classList.add('order-toast--in'));

  // auto-dismiss after 8 s
  setTimeout(() => dismissToast(toast), 8000);
}

function dismissToast(toast) {
  toast.classList.remove('order-toast--in');
  toast.classList.add('order-toast--out');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// Hook into initAdminPage — start SSE after successful auth
const _origInitAdminPage = initAdminPage;
// eslint-disable-next-line no-global-assign
initAdminPage = async function(requiredRoles) {
  const user = await _origInitAdminPage(requiredRoles);
  if (user) startOrderNotifications();
  return user;
};

/* ── DELIVERY COUNTDOWN ── */
const DELIVERY_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

function countdownHTML(order) {
  // Only show for Confirmed or Shipped (not yet Delivered/Cancelled)
  if (['Delivered', 'Cancelled', 'Pending'].includes(order.status)) return '';
  // prefer admin-set estimatedDelivery, fall back to confirmedAt + 48h
  let target;
  if (order.estimatedDelivery) {
    target = new Date(order.estimatedDelivery).getTime();
  } else if (order.confirmedAt) {
    target = new Date(order.confirmedAt).getTime() + DELIVERY_WINDOW_MS;
  } else {
    return '';
  }
  const remaining = target - Date.now();
  const due = remaining <= 0;
  const timeText = due ? 'Arriving soon' : formatCountdown(remaining);
  // Rendered as a <button> so it is keyboard-accessible and clearly clickable
  return `<button type="button" class="countdown-chip${due ? ' countdown-chip--due' : ''} btn-countdown-edit"
    data-target="${target}" data-oid="${order.id}"
    title="Click to edit delivery time">
    <span class="cd-label">Est. delivery in</span>
    <span class="cd-time">${timeText}</span>
    <span class="cd-edit-hint">&#9998; edit</span>
  </button>`;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Arriving soon';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${pad(rh)}h ${pad(m)}m`;
  }
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

let _countdownTimer = null;

function startCountdowns() {
  if (_countdownTimer) clearInterval(_countdownTimer);
  _countdownTimer = setInterval(() => {
    document.querySelectorAll('.countdown-chip').forEach(chip => {
      const target = Number(chip.dataset.target);
      const remaining = target - Date.now();
      const timeEl = chip.querySelector('.cd-time');
      if (!timeEl) return;
      if (remaining <= 0) {
        timeEl.textContent = 'Arriving soon';
        chip.classList.add('countdown-chip--due');
      } else {
        timeEl.textContent = formatCountdown(remaining);
        chip.classList.remove('countdown-chip--due');
      }
    });
  }, 1000);
}

/* ============================================================
   SMART CONFIRMATION BAR & NOTIFICATION API
   ============================================================ */
window.smartConfirm = function smartConfirm(options) {
  return new Promise(function(resolve) {
    var config = {
      title: 'Confirm Action',
      message: 'Are you sure you want to proceed?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      danger: true,
      variant: 'delete'
    };

    if (typeof options === 'string') {
      config.message = options;
      var lower = options.toLowerCase();
      if (lower.includes('delete') || lower.includes('remove') || lower.includes('destroy') || lower.includes('empty')) {
        config.title = 'Confirm Deletion';
        config.confirmText = 'Delete';
      } else if (lower.includes('cancel')) {
        config.title = 'Confirm Cancellation';
        config.confirmText = 'Cancel Order';
      } else if (lower.includes('restore')) {
        config.title = 'Confirm Restore';
        config.confirmText = 'Restore';
        config.danger = false;
        config.variant = 'info';
      }
    } else if (options && typeof options === 'object') {
      if (options.title) config.title = options.title;
      if (options.message) config.message = options.message;
      if (options.confirmText) config.confirmText = options.confirmText;
      if (options.cancelText) config.cancelText = options.cancelText;
      if (options.danger !== undefined) config.danger = Boolean(options.danger);
      if (options.variant) config.variant = options.variant;
    }

    var overlay = document.getElementById('smartConfirmOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'smartConfirmOverlay';
      overlay.className = 'smart-confirm-overlay';
      document.body.appendChild(overlay);
    }

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    var iconWrapClass = 'smart-confirm-icon-wrap';

    if (config.variant === 'warning') {
      iconWrapClass += ' icon-warning';
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (!config.danger) {
      iconWrapClass += ' icon-forest';
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
    }

    var okBtnClass = config.danger ? 'btn-confirm-ok' : 'btn-confirm-ok btn-forest';

    overlay.innerHTML =
      '<div class="smart-confirm-bar" role="alertdialog" aria-modal="true" aria-labelledby="smartConfirmTitle" aria-describedby="smartConfirmDesc">' +
        '<div class="smart-confirm-header">' +
          '<div class="' + iconWrapClass + '">' + iconSvg + '</div>' +
          '<div class="smart-confirm-body">' +
            '<h3 class="smart-confirm-title" id="smartConfirmTitle">' + esc(config.title) + '</h3>' +
            '<p class="smart-confirm-message" id="smartConfirmDesc">' + esc(config.message) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="smart-confirm-actions">' +
          '<button type="button" class="btn-confirm-cancel" id="smartConfirmCancelBtn">' + esc(config.cancelText) + '</button>' +
          '<button type="button" class="' + okBtnClass + '" id="smartConfirmOkBtn">' + esc(config.confirmText) + '</button>' +
        '</div>' +
      '</div>';

    requestAnimationFrame(function() {
      overlay.classList.add('is-active');
      var cancelBtn = document.getElementById('smartConfirmCancelBtn');
      if (cancelBtn) cancelBtn.focus();
    });

    var resolved = false;
    function cleanup(result) {
      if (resolved) return;
      resolved = true;
      overlay.classList.remove('is-active');
      window.removeEventListener('keydown', onKeyDown);
      setTimeout(function() {
        if (overlay.parentNode && !overlay.classList.contains('is-active')) {
          overlay.innerHTML = '';
        }
        resolve(result);
      }, 240);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);

    var cancelBtn = document.getElementById('smartConfirmCancelBtn');
    if (cancelBtn) cancelBtn.onclick = function(e) { e.preventDefault(); cleanup(false); };

    var okBtn = document.getElementById('smartConfirmOkBtn');
    if (okBtn) okBtn.onclick = function(e) { e.preventDefault(); cleanup(true); };

    overlay.onclick = function(e) {
      if (e.target === overlay) {
        cleanup(false);
      }
    };
  });
};
