/* ============================================================
   DATA — populated by app.js from server
   ============================================================ */
let PRODUCTS = [];
let CATEGORIES = ['All'];
let SHIPPING_FLAT = 60;
let SHIPPING_FREE_THRESHOLD = 5000;

/* ============================================================
   ICONS
   ============================================================ */
const PRODUCE_PATHS = {
  tomato:  `<circle cx="24" cy="27" r="14"/><path d="M24 13c-2 2-3 3-6 3M24 13c2 2 3 3 6 3M24 13v4"/>`,
  carrot:  `<path d="M24 14l6 24-6 6-6-6 6-24z"/><path d="M24 14v-4M20 12l2 3M28 12l-2 3"/>`,
  leaf:    `<path d="M12 34C10 18 24 10 36 10c1 14-6 26-24 24z"/><path d="M14 32L34 12"/>`,
  potato:  `<ellipse cx="24" cy="26" rx="15" ry="10"/><circle cx="18" cy="24" r="0.8" fill="currentColor"/><circle cx="27" cy="29" r="0.8" fill="currentColor"/><circle cx="30" cy="21" r="0.8" fill="currentColor"/>`,
  apple:   `<path d="M24 18c-6-6-16-2-15 7 1 9 9 14 15 17 6-3 14-8 15-17 1-9-9-13-15-7z"/><path d="M24 18v-5M24 13c2-2 4-2 6-1"/>`,
  berry:   `<circle cx="18" cy="22" r="6"/><circle cx="30" cy="22" r="6"/><circle cx="24" cy="31" r="6"/><path d="M24 12v4"/>`,
  lemon:   `<ellipse cx="24" cy="24" rx="15" ry="11" transform="rotate(-20 24 24)"/><path d="M11 21c-2-1-3-1-4 0M41 27c2 1 3 1 4 0"/>`,
  egg:     `<path d="M24 10c8 8 12 17 12 23a12 12 0 01-24 0c0-6 4-15 12-23z"/>`,
  butter:  `<rect x="10" y="18" width="28" height="16" rx="2"/><path d="M10 24h28"/>`,
  wheat:   `<path d="M24 10v28"/><path d="M24 14l-6 4M24 14l6 4M24 20l-6 4M24 20l6 4M24 26l-6 4M24 26l6 4"/>`,
  honey:   `<path d="M17 12h14l3 5v18l-3 5H17l-3-5V17z"/><path d="M14 22h20M14 28h20"/>`,
  bean:    `<path d="M14 18c-2 6 0 12 6 14s12-2 14-8"/><path d="M34 30c2-6 0-12-6-14s-12 2-14 8"/>`,
  frozen:  `<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07"/>`,
  spice:   `<path d="M12 2a5 5 0 015 5c0 3-2 5-5 8-3-3-5-5-5-8a5 5 0 015-5z"/><path d="M12 22v-7"/>`,
  grain:   `<ellipse cx="12" cy="16" rx="7" ry="5"/><path d="M5 16c0-3 3-7 7-14 4 7 7 11 7 14"/>`,
  dairy:   `<path d="M8 2h8l2 6H6L8 2z"/><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M9 14h6"/>`,
  oil:     `<path d="M10 2h4v4l2 3v11a2 2 0 01-2 2H10a2 2 0 01-2-2V9l2-3V2z"/><path d="M8 11h8"/>`,
  nuts:    `<ellipse cx="12" cy="13" rx="7" ry="9"/><path d="M8 7c0-3 8-3 8 0"/><path d="M9 17c1 2 5 2 6 0"/>`,
  meat:    `<path d="M6 20c1-4 2-8 6-10 2-1 5 0 6 2s0 5-2 6c-4 2-8 1-10 2z"/><path d="M15 10l3-5"/>`,
};

function produceIconSVG(type, size = 44) {
  const d = PRODUCE_PATHS[type] || PRODUCE_PATHS.leaf;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

function productImageHTML(p, size = 44) {
  if (p.images && p.images.length > 0) {
    if (size === 'full') {
      const dots = p.images.length > 1
        ? `<div class="card-img-dots">${p.images.map((_, i) =>
            `<span class="card-img-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
        : '';
      return `<img src="${p.images[0]}" alt="${p.name}" class="card-img-fill"
               data-images='${JSON.stringify(p.images)}' data-idx="0">${dots}`;
    }
    return `<img src="${p.images[0]}" alt="${p.name}" class="cart-img-fill">`;
  }
  return produceIconSVG(p.icon, size);
}

const UI_ICONS = {
  leaf:    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17C5 9 12 5 18 5c.5 7-3 13-12 12z"/><path d="M7 16L17 6"/></svg>`,
  basket:  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16l-1.5 9a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7L4 10z"/><path d="M8 10V8a4 4 0 018 0v2"/></svg>`,
  close:   `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  plus:    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  minus:   `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  truck:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3zM14 11h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>`,
  shield:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  mail:    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
  check:   `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>`,
  menu:    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`,
  cart:    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
};

/* ── Icon injection ── */
const _si = (id, svg) => { const el = document.getElementById(id); if (el) el.innerHTML = svg; };
_si('logoIcon',   UI_ICONS.leaf);
_si('basketIcon', UI_ICONS.basket);
_si('navToggle',  UI_ICONS.menu);
_si('closeCart',  UI_ICONS.close);
_si('mailIcon',   UI_ICONS.mail);

/* ============================================================
   VIEW SWITCHING
   ============================================================ */
const shopView     = document.getElementById('shopView');
const checkoutView = document.getElementById('checkoutView');

function showShopView() {
  shopView.classList.add('active');
  checkoutView.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function showCheckoutView() {
  renderBangladeshCheckout();
  shopView.classList.remove('active');
  checkoutView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
document.getElementById('logoBtn').addEventListener('click', showShopView);

/* ============================================================
   NAV + FILTER BUTTONS (pill style)
   ============================================================ */
let activeCategory = 'All';
const nav     = document.getElementById('nav');
const filters = document.getElementById('filters');

function buildCategoryButtons(container) {
  if (!container) return;
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.className = 'filter-btn' + (cat === activeCategory ? ' active' : '');
    btn.addEventListener('click', () => setActiveCategory(cat));
    container.appendChild(btn);
  });
}

/* ── Category circle row ── */
async function buildCategoryCircles() {
  const container = document.getElementById('catCircles');
  if (!container) return;

  // custom icons/logos uploaded in the admin panel (keyed by category name)
  let customIcons = {};
  try { customIcons = await fetch('/api/category-icons').then(r => r.json()); } catch (e) { customIcons = {}; }

  // icon map: try to match category name to a produce icon
  const iconMap = {
    'all': 'leaf', 'vegetables': 'carrot', 'fruits': 'apple',
    'dairy': 'dairy', 'dairy & eggs': 'dairy', 'eggs': 'egg',
    'pantry': 'wheat', 'pantry & grains': 'grain', 'grains': 'grain',
    'honey': 'honey', 'spices': 'spice', 'frozen': 'frozen',
    'frozen food': 'frozen', 'oil': 'oil', 'meat': 'meat',
    'nuts': 'nuts', 'beans': 'bean', 'lemon': 'lemon', 'berries': 'berry',
  };

  const items = CATEGORIES.filter(c => c !== 'All');
  if (!items.length) {
    document.querySelector('.cat-section').style.display = 'none';
    return;
  }
  document.querySelector('.cat-section').style.display = '';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  container.innerHTML = items.map(cat => {
    const key = cat.toLowerCase();
    const cicon = customIcons[cat] || {};
    const imgUrl = (typeof cicon === 'string' && (cicon.startsWith('/') || cicon.startsWith('http') || cicon.startsWith('data:')))
      ? cicon
      : (cicon.image || '');

    const iconHTML = imgUrl
      ? `<img src="${esc(imgUrl)}" alt="${esc(cat)}" class="cat-circle-img" style="width:36px;height:36px;object-fit:cover;border-radius:50%">`
      : (cicon.icon || (typeof cicon === 'string' && cicon)
        ? (produceIconSVG(cicon.icon || cicon, 32) || `<span style="font-size:1.6rem">${esc(cicon.icon || cicon)}</span>`)
        : produceIconSVG(iconMap[key] || 'leaf', 32));

    return `<button class="cat-circle${cat === activeCategory ? ' active' : ''}" data-cat="${cat}">
      <div class="cat-circle-icon">${iconHTML}</div>
      <span class="cat-circle-label">${cat}</span>
    </button>`;
  }).join('');

  container.querySelectorAll('.cat-circle').forEach(btn => {
    btn.addEventListener('click', () => setActiveCategory(btn.dataset.cat));
  });

  // Touch & Drag-to-scroll setup for desktop and mobile
  const scrollEl = document.getElementById('catCirclesScroll');
  if (scrollEl && !scrollEl.dataset.dragInit) {
    scrollEl.dataset.dragInit = '1';
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    scrollEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      hasMoved = false;
      scrollEl.classList.add('is-dragging');
      startX = e.pageX - scrollEl.offsetLeft;
      scrollLeft = scrollEl.scrollLeft;
    });

    const stopDrag = () => {
      if (!isDown) return;
      isDown = false;
      scrollEl.classList.remove('is-dragging');
    };

    scrollEl.addEventListener('mouseleave', stopDrag);
    scrollEl.addEventListener('mouseup', stopDrag);

    scrollEl.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollEl.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 4) hasMoved = true;
      scrollEl.scrollLeft = scrollLeft - walk;
    });

    // Prevent activating category button click if user was dragging
    scrollEl.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);
  }
}

function setActiveCategory(cat) {
  activeCategory = cat;
  showShopView();
  [nav, filters].forEach(c => {
    if (!c) return;
    c.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  });
  // sync circles
  document.querySelectorAll('.cat-circle').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderProducts();
  if (nav) nav.classList.remove('mobile-open');
}

buildCategoryButtons(nav);
buildCategoryButtons(filters);

document.getElementById('navToggle').addEventListener('click', () => {
  const isOpen = nav.classList.toggle('mobile-open');
  document.getElementById('navToggle').setAttribute('aria-expanded', String(isOpen));
});

/* ============================================================
   CART (localStorage)
   ============================================================ */
const STORAGE_KEY = 'enmarCart';
function getCart()   { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveCart(c) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); renderCart(); }

function addToCart(id, qty = 1) {
  const cart = getCart();
  const ex = cart.find(c => c.id === id);
  if (ex) ex.qty += qty; else cart.push({ id, qty });
  saveCart(cart);
}
function updateQty(id, qty) {
  let cart = getCart();
  cart = qty <= 0 ? cart.filter(c => c.id !== id) : cart.map(c => c.id === id ? { ...c, qty } : c);
  saveCart(cart);
}
function clearCart()        { saveCart([]); }
function getCartLines()     { return getCart().map(c => ({ ...c, product: PRODUCTS.find(p => p.id === c.id) })).filter(l => l.product); }
function getCartCount()     { return getCart().reduce((s, c) => s + c.qty, 0); }
function getCartSubtotal()  { return getCartLines().reduce((s, l) => s + effectivePrice(l.product) * l.qty, 0); }

function effectivePrice(p) {
  if (!p.discount || p.discount <= 0) return p.price;
  return Math.round(p.price * (1 - p.discount / 100) * 100) / 100;
}

function priceHTML(p) {
  const ep  = effectivePrice(p);
  const unit = `<span class="price-unit">/ ${p.unit}</span>`;
  if (!p.discount || p.discount <= 0) {
    return `<span class="price-final">৳${ep.toFixed(2)}</span> ${unit}`;
  }
  const saved = p.price - ep;
  return `
    <span class="price-final">৳${ep.toFixed(2)}</span>
    <span class="price-original">৳${p.price.toFixed(2)}</span>
    ${unit}
    <span class="price-save-badge">Save ৳${saved.toFixed(0)}</span>`;
}

/* ============================================================
   PRODUCT GRID & RECENTLY ADDED PRODUCTS CAROUSEL
   ============================================================ */
const productGrid = document.getElementById('productGrid');
let _recentCurrent = 0;
let _recentTimer = null;
let _recentTotalPages = 1;

function renderRecentProducts() {
  const track = document.getElementById('recentCarouselTrack');
  const section = document.getElementById('recentProductsSection');
  const container = document.getElementById('recentCarouselContainer');
  const dotsEl = document.getElementById('recentDots');
  if (!track) return;

  const settings = window._siteSettings || {};

  // Check if admin disabled the recent products section
  if (settings.recentSectionEnabled === 'false' || settings.recentSectionEnabled === false) {
    if (section) section.style.display = 'none';
    return;
  }

  if (!PRODUCTS.length) {
    if (section) section.style.display = 'none';
    return;
  }

  // Expiry date window filter (in days) configured in admin settings
  const daysLimit = Number(settings.recentSectionDaysLimit) || 0;
  const now = Date.now();
  let filtered = [...PRODUCTS];

  if (daysLimit > 0) {
    const maxAgeMs = daysLimit * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(p => {
      if (!p.createdAt) return true;
      const createdTime = new Date(p.createdAt).getTime();
      return !isNaN(createdTime) ? (now - createdTime) <= maxAgeMs : true;
    });
  }

  if (!filtered.length) {
    if (section) section.style.display = 'none';
    return;
  }

  // Max products limit in carousel rotation configured in admin settings
  const maxLimit = Math.max(1, Math.min(50, Number(settings.recentSectionMaxProducts) || 8));

  // Sort by id descending (newest first) and take up to maxLimit products
  const recentList = filtered
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, maxLimit);

  if (!recentList.length) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';

  const defaultBadge = settings.recentSectionCardBadge || '🌱 Fresh Arrival';
  const defaultStarText = settings.recentSectionRatingText || 'New harvest';

  // Render side-by-side slides
  track.innerHTML = recentList.map(p => {
    const hasDiscount = p.discount && p.discount > 0;
    const tag = p.tag || (hasDiscount ? `${p.discount}% OFF` : defaultBadge);
    const href = `/product?id=${p.id}`;
    const rCount = Number(p.reviewCount) || 0;
    const rAvg = Number(p.rating) || 0;
    const ratingHTML = rCount > 0
      ? `<div class="card-rating-row"><span class="stars">${'★'.repeat(Math.round(rAvg))}${'☆'.repeat(5 - Math.round(rAvg))}</span> <span>${rAvg.toFixed(1)} (${rCount})</span></div>`
      : `<div class="card-rating-row"><span class="stars" style="color:var(--line-dark)">★★★★★</span> <span>${escapeHTML(defaultStarText)}</span></div>`;

    return `<div class="recent-slide-item">
      <div class="recent-product-card">
        <a class="recent-card-img" href="${href}" aria-label="View details for ${escapeHTML(p.name)}">
          ${productImageHTML(p, 'full')}
          <div class="recent-card-badge">${tag}</div>
        </a>
        <div class="recent-card-body">
          <div>
            <h3 class="recent-card-title"><a href="${href}">${escapeHTML(p.name)}</a></h3>
            <div class="recent-card-farm">📍 ${escapeHTML(p.farm || 'Local Organic Farm')}</div>
            ${ratingHTML}
          </div>
          <div>
            <div class="recent-card-price-row">${priceHTML(p)}</div>
            <div class="recent-card-actions">
              <button type="button" class="btn-add" data-id="${p.id}">
                ${UI_ICONS.cart} Add
              </button>
              <button type="button" class="btn-buy" data-buy="${p.id}">
                Buy now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Setup auto-scroll controller with dynamic speed
  const speedSec = Math.max(1, Math.min(30, Number(settings.recentSectionScrollSpeed) || 3.8));
  initRecentCarouselController(track, container, dotsEl, recentList.length, speedSec * 1000);
}

function initRecentCarouselController(track, container, dotsEl, totalItems, intervalMs = 3800) {
  if (!track) return;
  const isMobile = window.innerWidth <= 768;
  const perPage = isMobile ? 1 : 2;
  _recentTotalPages = Math.max(1, Math.ceil(totalItems / perPage));
  _recentCurrent = 0;
  let _recentDirection = 1; // 1 = forward, -1 = reverse

  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: _recentTotalPages }, (_, i) =>
      `<button type="button" class="recent-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Go to page ${i + 1}"></button>`
    ).join('');
  }

  function goTo(idx) {
    if (_recentTotalPages <= 1) {
      track.style.transform = 'translateX(0)';
      return;
    }
    _recentCurrent = Math.max(0, Math.min(idx, _recentTotalPages - 1));
    const isMob = window.innerWidth <= 768;
    if (isMob) {
      track.style.transform = `translateX(-${_recentCurrent * 100}%)`;
    } else {
      track.style.transform = `translateX(calc(-${_recentCurrent * 100}% - ${_recentCurrent * 16}px))`;
    }
    if (dotsEl) {
      dotsEl.querySelectorAll('.recent-dot').forEach((d, i) => d.classList.toggle('active', i === _recentCurrent));
    }
    resetTimer();
  }

  function nextStep() {
    if (_recentTotalPages <= 1) return;
    if (_recentCurrent >= _recentTotalPages - 1) {
      _recentDirection = -1; // reached the last product slide -> reverse back smoothly!
    } else if (_recentCurrent <= 0) {
      _recentDirection = 1;  // reached the first product slide -> go forward!
    }
    goTo(_recentCurrent + _recentDirection);
  }

  function resetTimer() {
    clearInterval(_recentTimer);
    if (_recentTotalPages > 1) {
      _recentTimer = setInterval(nextStep, intervalMs);
    }
  }

  if (dotsEl) {
    dotsEl.onclick = (e) => {
      const dot = e.target.closest('.recent-dot');
      if (dot) {
        const target = Number(dot.dataset.i);
        if (target > _recentCurrent) _recentDirection = 1;
        if (target < _recentCurrent) _recentDirection = -1;
        goTo(target);
      }
    };
  }

  if (container) {
    // Pause auto-scroll on hover / touch
    container.onmouseenter = () => clearInterval(_recentTimer);
    container.onmouseleave = () => resetTimer();
    container.ontouchstart = () => clearInterval(_recentTimer);
    container.ontouchend = () => resetTimer();

    // Attach swipe gesture controller if present
    if (typeof attachSwipeHandler === 'function') {
      attachSwipeHandler(
        container,
        () => { _recentDirection = -1; goTo(_recentCurrent - 1); },
        () => { _recentDirection = 1; goTo(_recentCurrent + 1); }
      );
    }
  }

  goTo(0);
}

let productSearchQuery = '';

function renderProducts() {
  renderRecentProducts();

  const query = productSearchQuery.trim().toLowerCase();

  let list = activeCategory === 'All'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.cat === activeCategory);

  if (query) {
    list = list.filter(p => {
      const name = String(p.name || '').toLowerCase();
      const farm = String(p.farm || '').toLowerCase();
      const cat  = String(p.cat  || '').toLowerCase();
      const tag  = String(p.tag  || '').toLowerCase();
      const desc = String(p.desc || '').toLowerCase();
      return name.includes(query) || farm.includes(query) || cat.includes(query) || tag.includes(query) || desc.includes(query);
    });
  }

  if (!list.length) {
    if (productGrid) {
      if (query) {
        const escQ = query.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--ink-soft)">
          <div style="font-size:1.6rem;margin-bottom:8px">🔍</div>
          No products found matching "<strong>${escQ}</strong>".<br>
          <button type="button" onclick="clearProductSearch()" style="margin-top:12px;padding:6px 14px;border:1px solid var(--line-dark);border-radius:20px;background:var(--paper-alt);color:var(--forest);font-size:0.75rem;cursor:pointer">Clear Search</button>
        </div>`;
      } else {
        productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--ink-soft)">
          No products in this category yet.</div>`;
      }
    }
    return;
  }

  if (productGrid) {
    productGrid.innerHTML = list.map(p => {
      const hasDiscount = p.discount && p.discount > 0;
      const tag = p.tag || (hasDiscount ? 'Sale' : '');
      const href = `/product?id=${p.id}`;
      const rCount = Number(p.reviewCount) || 0;
      const rAvg = Number(p.rating) || 0;
      const ratingHTML = rCount > 0
        ? `<div class="card-rating-row"><span class="stars">${'★'.repeat(Math.round(rAvg))}${'☆'.repeat(5 - Math.round(rAvg))}</span> <span>${rAvg.toFixed(1)} (${rCount})</span></div>`
        : `<div class="card-rating-row"><span class="stars" style="color:var(--line-dark)">★★★★★</span> <span>New harvest</span></div>`;
      return `<div class="product-card">
        <a class="card-image" href="${href}" aria-label="View details for ${p.name}">
          ${productImageHTML(p, 'full')}
          ${tag ? `<div class="stamp${tag === 'Limited' ? ' tomato' : tag === 'New' ? ' gold' : ''}">${tag}</div>` : ''}
        </a>
        <div class="card-body">
          <h3><a class="card-title-link" href="${href}">${p.name}</a></h3>
          ${ratingHTML}
          <div class="card-price-row">${priceHTML(p)}</div>
          <div class="card-actions">
            <button type="button" class="btn-add" data-id="${p.id}">
              ${UI_ICONS.cart} Add to Cart
            </button>
            <button type="button" class="btn-buy" data-buy="${p.id}">
              ${UI_ICONS.cart} Buy now
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

/* Helper to attach cart actions to a grid/track */
function attachGridCartListeners(gridEl) {
  if (!gridEl) return;
  gridEl.addEventListener('click', e => {
    const addBtn = e.target.closest('.btn-add');
    if (addBtn) {
      addToCart(Number(addBtn.dataset.id), 1);
      const orig = addBtn.innerHTML;
      addBtn.innerHTML = '✓ Added';
      addBtn.classList.add('added');
      setTimeout(() => { addBtn.innerHTML = orig; addBtn.classList.remove('added'); }, 900);
      openCart();
      return;
    }

    const buyBtn = e.target.closest('.btn-buy');
    if (buyBtn) {
      addToCart(Number(buyBtn.dataset.buy), 1);
      window.location.href = '/checkout';
      return;
    }

    const seeBtn = e.target.closest('.btn-see-more');
    if (seeBtn) {
      const desc = document.getElementById('desc-' + seeBtn.dataset.see);
      if (desc) {
        const expanded = desc.classList.toggle('expanded');
        seeBtn.textContent = expanded ? 'See less' : 'See more';
      }
    }
  });
}

attachGridCartListeners(productGrid);
attachGridCartListeners(document.getElementById('recentCarouselTrack'));

/* ============================================================
   CART DRAWER
   ============================================================ */
const cartOverlay  = document.getElementById('cartOverlay');
const cartDrawer   = document.getElementById('cartDrawer');
const cartItemsEl  = document.getElementById('cartItems');
const cartSubEl    = document.getElementById('cartSubtotal');
const cartCountEl  = document.getElementById('cartCount');
const checkoutBtn  = document.getElementById('checkoutBtn');

function openCart() {
  cartOverlay.classList.add('open');
  cartDrawer.classList.add('open');
  cartDrawer.removeAttribute('inert');
}
function closeCart() {
  cartOverlay.classList.remove('open');
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('inert', '');
}

document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
checkoutBtn.addEventListener('click', () => {
  if (!getCartLines().length) return;
  closeCart();
  window.location.href = '/checkout';
});

function renderCart() {
  const lines    = getCartLines();
  const count    = getCartCount();
  const subtotal = getCartSubtotal();

  cartCountEl.textContent = String(count);
  cartCountEl.hidden      = count === 0;
  cartSubEl.textContent   = `৳${subtotal.toFixed(2)}`;
  checkoutBtn.setAttribute('aria-disabled', lines.length === 0 ? 'true' : 'false');

  cartItemsEl.innerHTML = lines.length === 0
    ? `<p class="cart-empty">Your cart is empty.</p>`
    : lines.map(l => `
      <div class="cart-line">
        <div class="cart-line-icon">${productImageHTML(l.product)}</div>
        <div class="cart-line-info">
          <p>${l.product.name}</p>
          <span>৳${effectivePrice(l.product).toFixed(2)} / ${l.product.unit}${l.product.discount ? ` <s style="opacity:.5">৳${l.product.price.toFixed(2)}</s>` : ''}</span>
        </div>
        <div class="qty-controls">
          <button data-action="dec" data-id="${l.id}" aria-label="Decrease">${UI_ICONS.minus}</button>
          <span>${l.qty}</span>
          <button data-action="inc" data-id="${l.id}" aria-label="Increase">${UI_ICONS.plus}</button>
        </div>
      </div>`).join('');
}

cartItemsEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id      = Number(btn.dataset.id);
  const current = getCartLines().find(l => l.id === id);
  if (!current) return;
  updateQty(id, current.qty + (btn.dataset.action === 'inc' ? 1 : -1));
});

/* ============================================================
   NEWSLETTER
   ============================================================ */
document.getElementById('newsletterForm').addEventListener('submit', async e => {
  e.preventDefault();
  const note  = document.getElementById('newsletterNote');
  const input = document.getElementById('newsletterEmail');
  try {
    const res  = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.value.trim() })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      note.textContent = data.error || 'Could not subscribe. Try again.';
      note.style.color = 'rgba(255,200,200,1)';
    } else {
      note.textContent = 'Thanks — you\'re subscribed!';
      note.style.color = '';
      e.target.reset();
    }
    note.classList.add('show');
    setTimeout(() => note.classList.remove('show'), 5000);
  } catch {
    note.textContent = 'Could not reach the server.';
    note.style.color = 'rgba(255,200,200,1)';
    note.classList.add('show');
    setTimeout(() => note.classList.remove('show'), 4000);
  }
});

/* ============================================================
   FOOTER — populate Shop By with live categories
   ============================================================ */
function buildFooterShopLinks() {
  const ul = document.getElementById('footerShopLinks');
  if (!ul) return;
  const cats = CATEGORIES.filter(c => c !== 'All');
  ul.innerHTML = cats.map(c =>
    `<li><a href="#shop" onclick="setActiveCategory('${c.replace(/'/g, "\\'")}')">${c}</a></li>`
  ).join('');
}

/* ============================================================
   PRODUCT SEARCH INPUT (USER PANEL)
   ============================================================ */
const _prodSearchInp = document.getElementById('productSearchInput');
const _prodSearchClr = document.getElementById('productSearchClear');

function clearProductSearch() {
  productSearchQuery = '';
  if (_prodSearchInp) _prodSearchInp.value = '';
  if (_prodSearchClr) _prodSearchClr.style.display = 'none';
  renderProducts();
}

if (_prodSearchInp) {
  _prodSearchInp.addEventListener('input', (e) => {
    productSearchQuery = e.target.value || '';
    if (_prodSearchClr) {
      _prodSearchClr.style.display = productSearchQuery.trim() ? 'block' : 'none';
    }
    renderProducts();
  });
}

if (_prodSearchClr) {
  _prodSearchClr.addEventListener('click', () => {
    clearProductSearch();
  });
}

/* ============================================================
   INIT & RESIZE
   ============================================================ */
renderProducts();
renderCart();

let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (typeof renderRecentProducts === 'function') renderRecentProducts();
  }, 200);
});

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
      if (lower.includes('delete') || lower.includes('remove')) {
        config.title = 'Confirm Deletion';
        config.confirmText = 'Delete';
      } else if (lower.includes('cancel')) {
        config.title = 'Confirm Cancellation';
        config.confirmText = 'Cancel Order';
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

