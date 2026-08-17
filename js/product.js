/* ENMAR — Product detail page with customer reviews & photo uploads */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const STORAGE_KEY = 'enmarCart';
  const taka = (v) => `৳${Number(v || 0).toFixed(2)}`;
  const escapeHTML = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const safeMultiline = (v) => escapeHTML(v).replace(/\r\n|\r|\n/g, '<br>');

  function slugify(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getProductUrl(p) {
    if (!p) return '/';
    const id = Number(p.id || p.productId);
    if (!id) return '/';
    const name = p.name || p.productName || '';
    const slug = slugify(name);
    return slug ? `/product/${id}-${slug}` : `/product/${id}`;
  }

  function getProductIdOrSlug() {
    if (window.__INITIAL_PRODUCT__ && (window.__INITIAL_PRODUCT__.id || window.__INITIAL_PRODUCT__.name)) {
      return String(window.__INITIAL_PRODUCT__.id);
    }
    const match = window.location.pathname.match(/\/product\/([^\/?#]+)/i);
    if (match && match[1]) {
      const segment = decodeURIComponent(match[1]).trim();
      if (/^\d+$/.test(segment)) return segment;
      const idPrefix = segment.match(/^(\d+)-/);
      if (idPrefix) return idPrefix[1];
      const idSuffix = segment.match(/-(\d+)$/);
      if (idSuffix) return idSuffix[1];
      return segment;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('slug') || null;
  }

  /* ── Rich Description Formatter (paragraphs, newlines, links, lists, bold) ── */
  function formatInline(str) {
    let s = escapeHTML(str);
    // [title](https://url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)\"\'<>]+)\)/gi, '<a href="$2" target="_blank" rel="noopener noreferrer" class="desc-link">$1</a>');
    // raw URLs (https:// or http://)
    s = s.replace(/(^|[\s(])((https?:\/\/[^\s\)\"\'<>]+))/gi, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="desc-link">$2</a>');
    // bold **text** or __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // italic *text* or _text_
    s = s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
    // code / badge `text`
    s = s.replace(/`([^`]+)`/g, '<code class="desc-code">$1</code>');
    return s;
  }

  function formatDescription(text) {
    if (!text || !String(text).trim()) {
      return '<p class="desc-p">Fresh from our partner farms, packed to order.</p>';
    }
    const raw = String(text).replace(/\r\n|\r/g, '\n');
    const blocks = raw.split(/\n{2,}/);
    const out = [];

    for (let block of blocks) {
      block = block.trim();
      if (!block) continue;
      const lines = block.split('\n');

      let currentList = null; // 'ul' | 'ol' | null
      let listItems = [];
      let textLines = [];

      function flushList() {
        if (currentList && listItems.length) {
          const tag = currentList;
          out.push(`<${tag} class="desc-list">${listItems.map(i => `<li>${formatInline(i)}</li>`).join('')}</${tag}>`);
          currentList = null;
          listItems = [];
        }
      }

      function flushText() {
        if (textLines.length) {
          out.push(`<p class="desc-p">${textLines.map(l => formatInline(l)).join('<br>')}</p>`);
          textLines = [];
        }
      }

      for (let l of lines) {
        const trimmed = l.trim();
        if (!trimmed) continue;

        if (/^#{1,4}\s+/.test(trimmed)) {
          flushList();
          flushText();
          out.push(`<h4 class="desc-subhead">${formatInline(trimmed.replace(/^#{1,4}\s+/, ''))}</h4>`);
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

  let currentProduct = null;
  let currentReviews = [];
  let currentUser = null;
  let authMode = 'login'; // 'login' | 'register'

  /* ── Produce icons (fallback when a product has no photo) ── */
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
  function produceIconSVG(type, size = 220) {
    const d = PRODUCE_PATHS[type] || PRODUCE_PATHS.leaf;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }

  /* ── Icons in the header ── */
  const leafIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17C5 9 12 5 18 5c.5 7-3 13-12 12z"/><path d="M7 16L17 6"/></svg>`;
  const basketIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16l-1.5 9a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7L4 10z"/><path d="M8 10V8a4 4 0 018 0v2"/></svg>`;
  const starSVG = (fill = false) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/></svg>`;
  const $el = (id, svg) => { const e = document.getElementById(id); if (e) e.innerHTML = svg; };
  $el('logoIcon', leafIcon);
  $el('basketIcon', basketIcon);

  /* ── Cart (shared localStorage with storefront) ── */
  function getCart() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
  function getCartCount() { return getCart().reduce((s, c) => s + (Number(c.qty) || 0), 0); }
  function addToCart(id, qty = 1) {
    const cart = getCart();
    const ex = cart.find(c => Number(c.id) === Number(id));
    if (ex) ex.qty = (Number(ex.qty) || 0) + qty;
    else cart.push({ id: Number(id), qty });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    refreshCartBadge();
  }
  function refreshCartBadge() {
    const count = getCartCount();
    const el = document.getElementById('cartCount');
    if (!el) return;
    el.textContent = String(count);
    el.hidden = count === 0;
  }

  function effectivePrice(p) {
    if (!p.discount || p.discount <= 0) return p.price;
    return Math.round(p.price * (1 - p.discount / 100) * 100) / 100;
  }

  /* ── Helper: Read file as Data URL ── */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── Small API helper ── */
  async function api(url, options = {}) {
    let res;
    try {
      res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    } catch {
      throw new Error('Cannot reach the server. Please check your connection.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  function showStatus(msg) {
    const root = document.getElementById('productRoot');
    if (root) root.innerHTML = `<p class="page-status">${msg}</p>`;
  }

  /* ── Read-only star row ── */
  function starsHTML(rating) {
    const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
    let html = '<span class="stars stars--ro" aria-label="' + r + ' out of 5 stars">';
    for (let i = 1; i <= 5; i++) html += `<span class="star${i <= r ? ' is-on' : ''}">${starSVG(i <= r)}</span>`;
    html += '</span>';
    return html;
  }

  const RATING_LABELS = {
    1: '★☆☆☆☆ Poor',
    2: '★★☆☆☆ Fair',
    3: '★★★☆☆ Good',
    4: '★★★★☆ Very Good',
    5: '★★★★★ Excellent'
  };

  /* ── Review list ── */
  function reviewsListHTML(reviews, currentUserId) {
    if (!reviews || !reviews.length) {
      return `<p class="reviews-empty">No reviews yet. Be the first to share your experience with this organic harvest!</p>`;
    }
    return reviews.map((r) => {
      const mine = Boolean(currentUserId && r.userId && Number(r.userId) === Number(currentUserId));
      const date = new Date(r.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' });
      const initial = (r.authorName || 'C').trim().charAt(0).toUpperCase();
      const hasImgs = Array.isArray(r.images) && r.images.length > 0;
      const imagesDataJSON = hasImgs ? escapeHTML(JSON.stringify(r.images)) : '[]';

      return `<article class="review-card${mine ? ' review-card--mine' : ''}" id="reviewCard_${r.id}">
        <div class="review-card-top">
          <span class="review-avatar" aria-hidden="true">${r.authorAvatar ? `<img src="${escapeHTML(r.authorAvatar)}" alt="${escapeHTML(r.authorName || 'Customer')}">` : escapeHTML(initial)}</span>
          <div style="flex:1">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <p class="review-author">
                ${escapeHTML(r.authorName || 'Customer')}
                ${mine ? '<span class="review-mine-badge">You</span>' : (r.userId ? '<span class="review-verified-badge">Verified Buyer</span>' : '')}
              </p>
              ${mine ? `
                <div class="review-card-actions">
                  <button type="button" class="btn-review-action btn-review-edit" data-id="${r.id}" data-rating="${r.rating}" data-comment="${escapeHTML(r.comment)}" data-images="${imagesDataJSON}" title="Edit your review">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button type="button" class="btn-review-action btn-review-del" data-id="${r.id}" title="Delete your review">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    Delete
                  </button>
                </div>
              ` : ''}
            </div>
            <div class="review-meta">${starsHTML(r.rating)} <time>${escapeHTML(date)}</time></div>
          </div>
        </div>
        <p class="review-comment">${escapeHTML(r.comment)}</p>
        ${hasImgs ? `
          <div class="review-images-grid">
            ${r.images.map(img => `
              <button type="button" class="review-img-thumb" data-src="${escapeHTML(img)}" title="Click to enlarge photo">
                <img src="${escapeHTML(img)}" alt="Customer product photo" loading="lazy">
              </button>
            `).join('')}
          </div>
        ` : ''}
      </article>`;
    }).join('');
  }

  /* ── Review form ── */
  function reviewFormHTML(productId, user, myReview) {
    const rating = myReview ? myReview.rating : 5;
    const comment = myReview ? myReview.comment : '';
    const isEdit = Boolean(myReview);

    return `
      <form class="review-form" id="reviewForm" novalidate>
        <h3 class="review-form-title">${isEdit ? 'Update your review' : 'Write a customer review'}</h3>
        
        <div class="review-user-status">
          ${user ? `
            <p class="review-user-tag">Reviewing as <strong>${escapeHTML(user.name)}</strong> (${escapeHTML(user.email)})</p>
          ` : `
            <div class="review-guest-prompt">
              <span>Have an account? <button type="button" class="btn-link-action" id="openAuthModalBtn">Sign In</button> for a verified badge, or review as guest:</span>
            </div>
            <div class="review-guest-inputs">
              <input type="text" id="reviewGuestName" placeholder="Your name (required)" maxlength="60" required>
              <input type="email" id="reviewGuestEmail" placeholder="Email address (optional)" maxlength="100">
            </div>
          `}
        </div>

        <div class="field" style="margin-top:12px">
          <label class="review-label">Your rating</label>
          <div class="review-stars-wrap">
            <div class="review-form-stars" id="reviewFormStars" role="radiogroup" aria-label="Choose a rating">
              ${[1, 2, 3, 4, 5].map(i => `
                <button type="button" class="star-pick${i <= rating ? ' is-on' : ''}" data-value="${i}" aria-label="${i} star${i > 1 ? 's' : ''}">
                  ${starSVG(i <= rating)}
                </button>
              `).join('')}
            </div>
            <span class="rating-text-hint" id="ratingTextHint">${RATING_LABELS[rating] || '★★★★★ Excellent'}</span>
          </div>
          <input type="hidden" id="reviewRating" value="${rating}">
        </div>

        <div class="field" style="margin-top:12px">
          <label class="review-label" for="reviewComment">Your comment</label>
          <textarea id="reviewComment" rows="4" maxlength="1000" placeholder="How was this organic product? Freshness, aroma, taste, packaging…" required>${escapeHTML(comment)}</textarea>
        </div>

        <!-- PRODUCT PHOTO UPLOAD SECTION -->
        <div class="field" style="margin-top:12px">
          <label class="review-label">Product Photos (Optional)</label>
          <div class="review-photos-upload-wrap">
            <div class="review-photos-previews" id="reviewPhotosPreviews"></div>
            <label class="btn-review-upload-label" id="reviewUploadBtn" for="reviewPhotoInput">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Add Photos (Max 3)</span>
            </label>
            <input type="file" id="reviewPhotoInput" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none">
          </div>
          <p class="review-photo-hint">Upload photos of the actual produce received for customer reference (up to 3 images, 5MB each).</p>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px">
          <button type="submit" class="btn-review-submit" id="btnSubmitReview">${isEdit ? 'Update Review' : 'Submit Review'}</button>
          <button type="button" class="btn-review-cancel" id="btnCancelEdit" style="display:none">Cancel</button>
        </div>
        <div class="review-form-note" id="reviewNote" role="alert"></div>
      </form>
    `;
  }

  /* ── Render the reviews section ── */
  function renderReviewsSection(container, productId, reviews, user, successNotice = '') {
    if (!container) return;
    const count = reviews.length;
    const avg = count ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count) : 0;
    const myReview = user ? reviews.find(r => r.userId && Number(r.userId) === Number(user.id)) : null;

    container.innerHTML = `
      <section class="reviews-section" id="reviewsSection">
        <h2 class="reviews-title">Customer Reviews &amp; Ratings</h2>
        <div class="reviews-summary">
          <div class="reviews-score">${avg ? avg.toFixed(1) : '—'}</div>
          <div class="reviews-summary-info">
            ${starsHTML(Math.round(avg))}
            <p>${count} ${count === 1 ? 'verified review' : 'customer reviews'}</p>
          </div>
        </div>

        ${successNotice ? `<div class="notice-success">${escapeHTML(successNotice)}</div>` : ''}

        ${reviewFormHTML(productId, user, myReview)}

        <div class="reviews-list" id="reviewsList">
          ${reviewsListHTML(reviews, user && user.id)}
        </div>
      </section>`;

    // Photos state in the active form
    let formReviewImages = (myReview && Array.isArray(myReview.images)) ? [...myReview.images] : [];
    const previewsBox = container.querySelector('#reviewPhotosPreviews');
    const uploadBtn = container.querySelector('#reviewUploadBtn');
    const photoInput = container.querySelector('#reviewPhotoInput');

    function renderFormPhotos() {
      if (!previewsBox || !uploadBtn) return;
      previewsBox.innerHTML = formReviewImages.map((src, i) => `
        <div class="review-preview-item">
          <img src="${escapeHTML(src)}" alt="Selected review photo">
          <button type="button" class="btn-remove-review-photo" data-idx="${i}" aria-label="Remove photo">&times;</button>
        </div>
      `).join('');

      uploadBtn.style.display = formReviewImages.length >= 3 ? 'none' : 'inline-flex';
    }
    renderFormPhotos();

    if (photoInput) {
      photoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
          if (formReviewImages.length >= 3) break;
          if (!file.type.startsWith('image/')) continue;
          if (file.size > 5 * 1024 * 1024) {
            alert(`File "${file.name}" is larger than 5MB.`);
            continue;
          }
          try {
            const dataUrl = await fileToDataURL(file);
            formReviewImages.push(dataUrl);
          } catch (err) {
            console.error('Failed reading image:', err);
          }
        }
        photoInput.value = '';
        renderFormPhotos();
      });
    }

    if (previewsBox) {
      previewsBox.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-review-photo');
        if (removeBtn) {
          const idx = Number(removeBtn.dataset.idx);
          formReviewImages.splice(idx, 1);
          renderFormPhotos();
        }
      });
    }

    // Star picker interactive events
    const starsBox = container.querySelector('#reviewFormStars');
    const hintEl = container.querySelector('#ratingTextHint');
    const hidden = container.querySelector('#reviewRating');

    function updateStars(val) {
      if (!starsBox) return;
      starsBox.querySelectorAll('.star-pick').forEach(b => {
        const on = Number(b.dataset.value) <= val;
        b.classList.toggle('is-on', on);
        b.innerHTML = starSVG(on);
      });
      if (hintEl) hintEl.textContent = RATING_LABELS[val] || '';
    }

    if (starsBox && hidden) {
      starsBox.querySelectorAll('.star-pick').forEach(b => {
        b.addEventListener('mouseenter', () => {
          updateStars(Number(b.dataset.value));
        });
        b.addEventListener('click', (e) => {
          e.preventDefault();
          const val = Number(b.dataset.value);
          hidden.value = val;
          updateStars(val);
        });
      });

      starsBox.addEventListener('mouseleave', () => {
        updateStars(Number(hidden.value) || 5);
      });
    }

    // "Sign in" link inside guest form
    const openAuthBtn = container.querySelector('#openAuthModalBtn');
    if (openAuthBtn) {
      openAuthBtn.onclick = () => openAuthModal('login');
    }

    // Customer edit button click on review card
    container.querySelectorAll('.btn-review-edit').forEach(btn => {
      btn.onclick = () => {
        const rVal = Number(btn.dataset.rating) || 5;
        const cVal = btn.dataset.comment || '';
        let imgs = [];
        try { imgs = JSON.parse(btn.dataset.images || '[]'); } catch {}

        const formEl = container.querySelector('#reviewForm');
        if (!formEl) return;

        if (hidden) hidden.value = rVal;
        updateStars(rVal);

        const commentInput = container.querySelector('#reviewComment');
        if (commentInput) {
          commentInput.value = cVal;
          commentInput.focus();
        }

        formReviewImages = Array.isArray(imgs) ? [...imgs] : [];
        renderFormPhotos();

        const titleEl = container.querySelector('.review-form-title');
        if (titleEl) titleEl.textContent = 'Edit your review';

        const submitBtn = container.querySelector('#btnSubmitReview');
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        const cancelBtn = container.querySelector('#btnCancelEdit');
        if (cancelBtn) {
          cancelBtn.style.display = 'inline-block';
          cancelBtn.onclick = () => {
            renderReviewsSection(container, productId, reviews, user);
          };
        }

        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    });

    // Customer delete button click on review card
    container.querySelectorAll('.btn-review-del').forEach(btn => {
      btn.onclick = async () => {
        const ok = typeof smartConfirm === 'function' ? await smartConfirm({
          title: 'Delete Review',
          message: 'Are you sure you want to delete your review for this product?',
          confirmText: 'Delete Review',
          cancelText: 'Keep Review',
          danger: true,
          variant: 'delete'
        }) : confirm('Are you sure you want to delete your review for this product?');
        if (!ok) return;

        btn.disabled = true;
        try {
          await api(`/api/products/${productId}/reviews`, { method: 'DELETE' });
          const refreshedReviews = await api(`/api/products/${productId}/reviews`);
          currentReviews = refreshedReviews;
          renderReviewsSection(container, productId, refreshedReviews, currentUser, '✓ Your review has been deleted.');
          
          // update header rating
          const newCount = refreshedReviews.length;
          const newAvg = newCount ? (refreshedReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / newCount) : 0;
          const headerRating = document.getElementById('productHeaderRating');
          if (headerRating) {
            headerRating.innerHTML = `${starsHTML(Math.round(newAvg))} <a href="#reviewsSection" class="rating-link">${newCount > 0 ? `${newAvg.toFixed(1)} (${newCount} ${newCount === 1 ? 'review' : 'reviews'})` : 'No reviews yet · Leave a review'}</a>`;
          }
        } catch (err) {
          alert('Could not delete review: ' + err.message);
          btn.disabled = false;
        }
      };
    });

    // Review form submission
    const form = container.querySelector('#reviewForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const note = container.querySelector('#reviewNote');
        note.textContent = '';
        note.className = 'review-form-note';

        const rating = Number((container.querySelector('#reviewRating') || {}).value) || 5;
        const comment = (container.querySelector('#reviewComment') || {}).value.trim();

        if (!rating || rating < 1 || rating > 5) {
          note.textContent = 'Please choose a star rating from 1 to 5.';
          note.className = 'review-form-note error';
          return;
        }
        if (comment.length < 2) {
          note.textContent = 'Please write a short review comment (at least 2 characters).';
          note.className = 'review-form-note error';
          return;
        }

        const payload = { rating, comment, images: formReviewImages };

        if (!currentUser) {
          const nameInput = container.querySelector('#reviewGuestName');
          const emailInput = container.querySelector('#reviewGuestEmail');
          const name = nameInput ? nameInput.value.trim() : '';
          const email = emailInput ? emailInput.value.trim() : '';
          if (!name || name.length < 2) {
            note.textContent = 'Please enter your name.';
            note.className = 'review-form-note error';
            if (nameInput) nameInput.focus();
            return;
          }
          payload.name = name;
          payload.email = email;
        }

        const btn = container.querySelector('#btnSubmitReview');
        btn.disabled = true;
        btn.textContent = 'Submitting…';

        try {
          await api(`/api/products/${productId}/reviews`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          
          // Refresh reviews and re-render
          const refreshedReviews = await api(`/api/products/${productId}/reviews`);
          currentReviews = refreshedReviews;
          renderReviewsSection(container, productId, refreshedReviews, currentUser, '✓ Thank you! Your review has been successfully saved.');
          
          // Update product header rating
          const newCount = refreshedReviews.length;
          const newAvg = newCount ? (refreshedReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / newCount) : 0;
          const headerRating = document.getElementById('productHeaderRating');
          if (headerRating) {
            headerRating.innerHTML = `${starsHTML(Math.round(newAvg))} <a href="#reviewsSection" class="rating-link">${newCount > 0 ? `${newAvg.toFixed(1)} (${newCount} ${newCount === 1 ? 'review' : 'reviews'})` : 'No reviews yet · Leave a review'}</a>`;
          }

          // Scroll smoothly to reviews section
          const sec = document.getElementById('reviewsSection');
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
          note.textContent = err.message;
          note.className = 'review-form-note error';
          btn.disabled = false;
          btn.textContent = myReview ? 'Update Review' : 'Submit Review';
        }
      });
    }
  }

  /* ── Render full product page ── */
  function renderProduct(product, reviews, user) {
    const root = document.getElementById('productRoot');
    if (!root) return;

    const images = (product.images && product.images.length) ? product.images : [];
    const galleryContent = images.length
      ? `<div class="gallery-main">
          <img id="galleryImg" src="${escapeHTML(images[0])}" alt="${escapeHTML(product.name)}" class="gallery-img">
          <button type="button" class="btn-gallery-fullscreen" id="btnGalleryFullscreen" aria-label="View full screen photo" title="ফুল স্ক্রিন ছবি দেখুন">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            <span>Full Screen</span>
          </button>
        </div>
         ${images.length > 1 ? `<div class="gallery-nav">
           <button type="button" class="gallery-arrow" id="galleryPrev" aria-label="Previous image">&#8249;</button>
           <div class="gallery-dots" id="galleryDots"></div>
           <button type="button" class="gallery-arrow" id="galleryNext" aria-label="Next image">&#8250;</button>
         </div>` : ''}`
      : `<div class="gallery-main gallery-icon">${produceIconSVG(product.icon)}</div>`;

    const ep = effectivePrice(product);
    const priceHTML = product.discount && product.discount > 0
      ? `<span class="card-price-final">${taka(ep)}</span> <span class="card-price-original">${taka(product.price)}</span> <span class="card-price-save">Save ${taka(product.price - ep)}</span>`
      : `<span class="card-price-final">${taka(ep)}</span>`;

    const count = reviews.length;
    const avg = count ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count) : 0;

    root.innerHTML = `
      <article class="product-detail">
        <div class="product-detail-media">${galleryContent}</div>

        <div class="product-detail-info">
          <p class="product-detail-cat">${escapeHTML(product.cat || '')}${product.tag ? ` · ${escapeHTML(product.tag)}` : ''}</p>
          <h1 class="product-detail-name">${escapeHTML(product.name)}</h1>
          
          <!-- Rating badge in header -->
          <div class="product-header-rating" id="productHeaderRating">
            ${starsHTML(Math.round(avg))}
            <a href="#reviewsSection" class="rating-link">${count > 0 ? `${avg.toFixed(1)} (${count} ${count === 1 ? 'review' : 'reviews'})` : 'No reviews yet · Leave a review'}</a>
          </div>

          <div class="product-detail-price-row">${priceHTML} <span class="price-unit">/ ${escapeHTML(product.unit || '')}</span></div>
          <p class="product-detail-farm">Grown by <strong>${escapeHTML(product.farm || 'our partner farms')}</strong>${product.lot ? ` · Lot ${escapeHTML(product.lot)}` : ''}</p>

          <div class="qty-row">
            <button type="button" class="qty-btn" id="qtyMinus" aria-label="Decrease quantity">&minus;</button>
            <input type="number" id="qtyInput" value="1" min="1" max="99" aria-label="Quantity">
            <button type="button" class="qty-btn" id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>

          <div class="product-detail-actions">
            <button type="button" class="btn-add-detail" id="addToCartBtn">Add to Cart</button>
            <button type="button" class="btn-buy-detail" id="buyNowBtn">Buy Now</button>
          </div>
          <p class="product-feedback" id="productFeedback" role="status"></p>
        </div>
      </article>

      <div class="product-desc-section">
        <h2 class="product-desc-heading">Description</h2>
        <div class="product-desc-body" id="pdDesc">${formatDescription(product.description)}</div>
        <button type="button" class="btn-see-more" id="btnSeeMore" aria-expanded="false">See more</button>
      </div>

      <div id="reviewsContainer"></div>`;

    // ── Dynamic SEO & Schema.org Rich Snippet for Google ──
    try {
      document.title = `${product.name} | ১০০% খাঁটি অর্গানিক - ENMAR Shop`;
      let descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) {
        descMeta.setAttribute('content', `কিনুন ${product.name} সেরা দামে। ১০০% খাঁটি ও নির্ভেজাল পণ্য সরাসরি কৃষকের খামার থেকে হোম ডেলিভারি।`);
      }
      
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      const cleanProdUrl = `https://enmar.shop${getProductUrl(product)}`;
      canonicalLink.href = cleanProdUrl;

      const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "image": images.length ? images : ["https://enmar.shop/favicon.ico"],
        "description": product.description || `১০০% খাঁটি ও ফ্রেশ ${product.name}`,
        "brand": {
          "@type": "Brand",
          "name": "ENMAR"
        },
        "offers": {
          "@type": "Offer",
          "url": cleanProdUrl,
          "priceCurrency": "BDT",
          "price": ep,
          "priceValidUntil": "2030-12-31",
          "itemCondition": "https://schema.org/NewCondition",
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": "ENMAR"
          }
        }
      };

      if (count > 0) {
        schemaData.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": avg.toFixed(1),
          "reviewCount": count,
          "bestRating": "5",
          "worstRating": "1"
        };
      }

      let scriptTag = document.getElementById('productSchemaTag');
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'productSchemaTag';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(schemaData);
    } catch (err) {}

    // gallery interactivity
    if (images.length > 1) {
      let idx = 0;
      const imgEl = document.getElementById('galleryImg');
      const dotsEl = document.getElementById('galleryDots');
      dotsEl.innerHTML = images.map((_, i) => `<button type="button" class="gallery-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Image ${i + 1}"></button>`).join('');
      const set = (i) => {
        idx = (i + images.length) % images.length;
        imgEl.src = images[idx];
        dotsEl.querySelectorAll('.gallery-dot').forEach((d, k) => d.classList.toggle('active', k === idx));
      };
      document.getElementById('galleryPrev').addEventListener('click', () => set(idx - 1));
      document.getElementById('galleryNext').addEventListener('click', () => set(idx + 1));
      dotsEl.addEventListener('click', (e) => { const d = e.target.closest('.gallery-dot'); if (d) set(Number(d.dataset.i)); });
    }

    // quantity
    const qtyInput = document.getElementById('qtyInput');
    const clampQty = (v) => Math.max(1, Math.min(99, Number(v) || 1));
    document.getElementById('qtyMinus').addEventListener('click', () => { qtyInput.value = clampQty(Number(qtyInput.value) - 1); });
    document.getElementById('qtyPlus').addEventListener('click', () => { qtyInput.value = clampQty(Number(qtyInput.value) + 1); });
    qtyInput.addEventListener('change', () => { qtyInput.value = clampQty(qtyInput.value); });

    // add to cart / buy
    const feedback = document.getElementById('productFeedback');
    const flash = (msg, ok) => { feedback.textContent = msg; feedback.style.color = ok ? 'var(--forest)' : 'var(--tomato)'; };
    function currentQty() { return clampQty(qtyInput.value); }
    document.getElementById('addToCartBtn').addEventListener('click', () => {
      addToCart(product.id, currentQty());
      flash('Added to cart! ✓', true);
    });
    document.getElementById('buyNowBtn').addEventListener('click', () => {
      addToCart(product.id, currentQty());
      window.location.href = '/checkout';
    });

    // reviews
    renderReviewsSection(document.getElementById('reviewsContainer'), product.id, reviews, user);

    // "See more / See less" for description
    const descEl  = document.getElementById('pdDesc');
    const seeBtn  = document.getElementById('btnSeeMore');
    if (descEl && seeBtn) {
      const text = (product.description || '').trim();
      // If content naturally fits within compact height or has very few characters, expand immediately
      if (text.length <= 220 || descEl.scrollHeight <= 165) {
        descEl.classList.add('expanded');
        seeBtn.style.display = 'none';
      } else {
        seeBtn.addEventListener('click', () => {
          const expanded = descEl.classList.toggle('expanded');
          seeBtn.textContent = expanded ? 'See less' : 'See more';
          seeBtn.setAttribute('aria-expanded', String(expanded));
        });
      }
    }
  }

  /* ── Lightbox viewer for review photos ── */
  function setupLightbox() {
    const modal = document.getElementById('reviewLightboxModal');
    const img = document.getElementById('lightboxImg');
    const closeBtn = document.getElementById('lightboxClose');
    if (!modal || !img) return;

    function close() {
      modal.style.display = 'none';
      img.src = '';
    }
    if (closeBtn) closeBtn.onclick = close;
    modal.onclick = (e) => {
      if (e.target === modal || e.target.classList.contains('lightbox-box')) close();
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') close();
    });

    document.addEventListener('click', (e) => {
      const fsBtn = e.target.closest('#btnGalleryFullscreen, .btn-gallery-fullscreen');
      if (fsBtn) {
        const currentGal = document.getElementById('galleryImg');
        if (currentGal && currentGal.src) {
          img.src = currentGal.src;
          modal.style.display = 'flex';
          return;
        }
      }
      const thumb = e.target.closest('.review-img-thumb');
      if (thumb && thumb.dataset.src) {
        img.src = thumb.dataset.src;
        modal.style.display = 'flex';
        return;
      }
      const galleryImg = e.target.closest('#galleryImg, .gallery-img');
      if (galleryImg && galleryImg.src) {
        img.src = galleryImg.src;
        modal.style.display = 'flex';
      }
    });
  }

  /* ── In-Page Auth Modal ── */
  function openAuthModal(mode = 'login') {
    authMode = mode;
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('modalAuthMessage').innerHTML = '';
    const isReg = mode === 'register';
    const isForgot = mode === 'forgot';

    document.getElementById('authModalTitle').textContent = isForgot ? 'Reset Password' : (isReg ? 'Create an Account' : 'Sign In');
    const tabs = document.getElementById('modalAuthTabs');
    if (tabs) tabs.style.display = isForgot ? 'none' : 'flex';
    document.getElementById('modalLoginTab').classList.toggle('active', !isReg && !isForgot);
    document.getElementById('modalRegisterTab').classList.toggle('active', isReg);

    document.getElementById('modalRegisterFields').style.display = isReg ? 'block' : 'none';
    document.getElementById('modalForgotFields').style.display = isForgot ? 'block' : 'none';
    document.getElementById('modalLoginFields').style.display = (!isReg && !isForgot) ? 'block' : 'none';
    document.getElementById('modalAuthSubmitBtn').textContent = isForgot ? 'Reset Password & Sign In' : (isReg ? 'Create Account' : 'Sign In');

    if (isForgot) {
      const emailForgot = document.getElementById('modalAuthEmailForgot');
      if (emailForgot && !emailForgot.value) {
        const candidate = (document.getElementById('modalAuthEmail') || {}).value || (document.getElementById('modalAuthEmailReg') || {}).value || '';
        if (candidate.trim()) emailForgot.value = candidate.trim();
      }
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
  }

  function setupAuthModal() {
    const closeBtn = document.getElementById('authModalClose');
    if (closeBtn) closeBtn.onclick = closeAuthModal;

    // Show/hide password toggles
    document.querySelectorAll('#authModal .auth-toggle-pwd').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.dataset.target;
        const targetInput = document.getElementById(targetId);
        if (!targetInput) return;
        const isPassword = targetInput.type === 'password';
        targetInput.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
      };
    });

    function updateModalForgotMatch() {
      const p1 = (document.getElementById('modalAuthPasswordForgot') || {}).value || '';
      const p2 = (document.getElementById('modalAuthPasswordForgotConfirm') || {}).value || '';
      const chkLen = document.getElementById('modalForgotChkLen');
      const matchEl = document.getElementById('modalForgotPwdMatchStatus');
      if (chkLen) {
        const met = p1.length >= 8;
        chkLen.textContent = (met ? '✓' : '○') + ' Min. 8 characters (numbers, letters, symbols accepted)';
        chkLen.style.color = met ? '#2a9d8f' : 'var(--ink-soft,#666)';
        chkLen.style.fontWeight = met ? '700' : 'normal';
      }
      if (matchEl) {
        if (!p2) matchEl.textContent = '';
        else if (p1 === p2) matchEl.innerHTML = '<span style="color:#2a9d8f; font-weight:700">✓ Passwords match</span>';
        else matchEl.innerHTML = '<span style="color:#e63946; font-weight:700">✗ Mismatch</span>';
      }
    }

    const forgotP1 = document.getElementById('modalAuthPasswordForgot');
    if (forgotP1) forgotP1.addEventListener('input', updateModalForgotMatch);
    const forgotP2 = document.getElementById('modalAuthPasswordForgotConfirm');
    if (forgotP2) forgotP2.addEventListener('input', updateModalForgotMatch);

    const loginTab = document.getElementById('modalLoginTab');
    const regTab = document.getElementById('modalRegisterTab');
    if (loginTab) loginTab.onclick = () => openAuthModal('login');
    if (regTab) regTab.onclick = () => openAuthModal('register');

    const forgotBtn = document.getElementById('modalForgotBtn');
    if (forgotBtn) forgotBtn.onclick = () => openAuthModal('forgot');
    const backToLoginBtn = document.getElementById('modalBackToLoginBtn');
    if (backToLoginBtn) backToLoginBtn.onclick = () => openAuthModal('login');

    const sendOtpBtn = document.getElementById('modalSendOtpBtn');
    if (sendOtpBtn) {
      sendOtpBtn.onclick = async () => {
        const msgEl = document.getElementById('modalAuthMessage');
        const emailInput = document.getElementById('modalAuthEmailReg');
        const email = (emailInput ? emailInput.value : '').trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">Please enter a valid email address.</div>';
          return;
        }
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Sending…';
        try {
          const res = await api('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) });
          msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--forest)">${escapeHTML(res.message || 'Verification code sent to your email.')}</div>`;
          const otpField = document.getElementById('modalOtpFieldReg');
          if (otpField) otpField.style.display = '';
          const otpInput = document.getElementById('modalAuthOtp');
          if (otpInput) { otpInput.focus(); }
          sendOtpBtn.textContent = 'Resend code';
        } catch (err) {
          msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--tomato)">${escapeHTML(err.message)}</div>`;
        } finally {
          sendOtpBtn.disabled = false;
        }
      };
    }

    const sendForgotOtpBtn = document.getElementById('modalSendForgotOtpBtn');
    if (sendForgotOtpBtn) {
      sendForgotOtpBtn.onclick = async () => {
        const msgEl = document.getElementById('modalAuthMessage');
        const emailInput = document.getElementById('modalAuthEmailForgot');
        const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">Please enter a valid email address.</div>';
          return;
        }
        sendForgotOtpBtn.disabled = true;
        sendForgotOtpBtn.textContent = 'Sending…';
        try {
          const res = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
          msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--forest)">${escapeHTML(res.message || 'Password reset code sent to your email.')}</div>`;
          const otpField = document.getElementById('modalOtpFieldForgot');
          if (otpField) otpField.style.display = '';
          const otpInput = document.getElementById('modalAuthOtpForgot');
          if (otpInput) { otpInput.focus(); }
          sendForgotOtpBtn.textContent = 'Resend code';
        } catch (err) {
          msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--tomato)">${escapeHTML(err.message)}</div>`;
        } finally {
          sendForgotOtpBtn.disabled = false;
        }
      };
    }

    const form = document.getElementById('modalAuthForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('modalAuthMessage');

        if (authMode === 'forgot') {
          const email = (document.getElementById('modalAuthEmailForgot') || {}).value.trim().toLowerCase();
          const otp = (document.getElementById('modalAuthOtpForgot') || {}).value.trim();
          const password = (document.getElementById('modalAuthPasswordForgot') || {}).value;
          const confirmPass = (document.getElementById('modalAuthPasswordForgotConfirm') || {}).value;

          if (!/^\S+@\S+\.\S+$/.test(email)) {
            msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">Please enter your registered email address.</div>';
            return;
          }
          if (!otp) {
            msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">Please request and enter the 6-digit reset code sent to your email.</div>';
            return;
          }
          if (password.length < 8) {
            msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">Password must be at least 8 characters long (numbers, letters, or symbols).</div>';
            return;
          }
          if (password !== confirmPass) {
            msgEl.innerHTML = '<div class="notice" style="border-left-color:var(--tomato)">New passwords do not match. Please retype.</div>';
            return;
          }
          try {
            const res = await api('/api/auth/reset-password', {
              method: 'POST',
              body: JSON.stringify({ email, otp, password })
            });
            currentUser = res.user;
            closeAuthModal();
            updateAccountButton();
            if (currentProduct) {
              renderReviewsSection(document.getElementById('reviewsContainer'), currentProduct.id, currentReviews, currentUser);
            }
          } catch (err) {
            msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--tomato)">${escapeHTML(err.message)}</div>`;
          }
          return;
        }

        const isReg = authMode === 'register';
        const pass = isReg
          ? (document.getElementById('modalAuthPasswordReg') || {}).value
          : (document.getElementById('modalAuthPassword') || {}).value;

        let body = { password: pass };
        if (isReg) {
          body.name = (document.getElementById('modalAuthName') || {}).value.trim();
          body.email = (document.getElementById('modalAuthEmailReg') || {}).value.trim();
          body.phone = (document.getElementById('modalAuthPhone') || {}).value.trim();
          body.otp = (document.getElementById('modalAuthOtp') || {}).value.trim();
        } else {
          body.email = (document.getElementById('modalAuthEmail') || {}).value.trim();
        }

        try {
          const res = await api(`/api/auth/${isReg ? 'register' : 'login'}`, {
            method: 'POST',
            body: JSON.stringify(body)
          });
          currentUser = res.user;
          closeAuthModal();
          updateAccountButton();
          
          // Refresh reviews section so user sees logged-in form and [Edit]/[Delete] buttons on their review
          if (currentProduct) {
            renderReviewsSection(document.getElementById('reviewsContainer'), currentProduct.id, currentReviews, currentUser);
          }
        } catch (err) {
          msgEl.innerHTML = `<div class="notice" style="border-left-color:var(--tomato)">${escapeHTML(err.message)}</div>`;
        }
      };
    }
  }

  function updateAccountButton() {
    const btn = document.getElementById('accountBtn');
    if (!btn) return;
    if (currentUser) {
      const isStaff = ['superadmin', 'admin', 'manager', 'moderator'].includes(currentUser.role);
      btn.textContent = isStaff ? 'Admin Panel' : `My Account (${currentUser.name.split(' ')[0]})`;
      btn.onclick = () => {
        window.location.href = isStaff ? '/admin/dashboard' : '/my-orders';
      };
    } else {
      btn.textContent = 'Sign In';
      btn.onclick = () => openAuthModal('login');
    }
  }

  /* ── Load product & reviews ── */
  async function loadAll() {
    const ident = getProductIdOrSlug();
    if (!ident) {
      showStatus('Invalid product. <a href="/">Return to shop.</a>');
      return;
    }
    try {
      const initialProduct = window.__INITIAL_PRODUCT__;
      const [product, reviews, meData] = await Promise.all([
        initialProduct ? Promise.resolve(initialProduct) : api(`/api/products/${encodeURIComponent(ident)}`),
        api(`/api/products/${encodeURIComponent(ident)}/reviews`).catch(() => []),
        api('/api/auth/me').catch(() => ({ user: null })),
      ]);
      currentProduct = product;
      currentReviews = reviews || [];
      currentUser = meData ? meData.user : null;

      document.title = `${product.name} — ENMAR`;
      updateAccountButton();
      renderProduct(product, currentReviews, currentUser);
      refreshCartBadge();
    } catch (err) {
      showStatus(escapeHTML(err.message) + ' <a href="/">Return to shop.</a>');
    }
  }

  setupAuthModal();
  setupLightbox();
  refreshCartBadge();
  loadAll();
})();
