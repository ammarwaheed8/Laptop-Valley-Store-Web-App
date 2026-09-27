(function() {
  function updateSiteCartBadge() {
    var badge = document.getElementById('cartCount');
    if (!badge || typeof getCartCount !== 'function') return;
    badge.textContent = getCartCount();
  }

  function parseHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return { page: 'home', category: '' };
    var parts = raw.split('?');
    var page = parts[0] || 'home';
    var query = new URLSearchParams(parts[1] || '');
    var allowedPages = ['home', 'store', 'contact'];
    if (allowedPages.indexOf(page) === -1) page = 'home';
    return { page: page, category: query.get('category') || '' };
  }

  function syncStoreCategory(category) {
    var categoryEl = document.getElementById('filterCategory');
    if (!categoryEl) return;
    var allowed = ['', 'Laptop', 'Accessories', 'Desktop PC'];
    categoryEl.value = allowed.indexOf(category) !== -1 ? category : '';
    if (typeof applyFilters === 'function') applyFilters();
  }

  function setActivePage(page, category, pushHash) {
    var views = document.querySelectorAll('.app-view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle('active', views[i].getAttribute('data-view') === page);
    }

    var links = document.querySelectorAll('[data-page-link]');
    for (var j = 0; j < links.length; j++) {
      links[j].classList.toggle('active', links[j].getAttribute('data-page-link') === page);
    }

    if (page === 'store') syncStoreCategory(category || '');
    if (page === 'home') { loadTestimonials(false); initTestimonialForm(); }

    if (pushHash) {
      var hash = '#' + page + (category ? '?category=' + encodeURIComponent(category) : '');
      if (window.location.hash !== hash) history.pushState({ page: page, category: category || '' }, '', hash);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    var nav = document.getElementById('navLinks');
    if (nav) nav.classList.remove('active');
    updateSiteCartBadge();
  }

  function navigateFromHash() {
    var state = parseHash();
    setActivePage(state.page, state.category, false);
    document.title = state.page === 'store'
      ? 'Store | Laptop Valley'
      : (state.page === 'contact' ? 'Contact | Laptop Valley' : 'Laptop Valley | Laptops, Desktop PCs & Accessories Pakistan');
  }

  var testimonialsLoaded = false;
  var testimonialsLoading = false;

  function escapeTestimonialHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function testimonialStars(rating) {
    var value = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
    var html = '';
    for (var i = 1; i <= 5; i++) html += i <= value ? '★' : '☆';
    return html;
  }

  function renderTestimonials(list) {
    var container = document.getElementById('testimonialsList');
    if (!container) return;
    if (!Array.isArray(list) || !list.length) {
      container.innerHTML = '<div class="testimonials-empty card"><h3>Be the first to share your experience</h3><p>We would love to hear what you think about Laptop Valley.</p></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      html += '<article class="testimonial-card">';
      html += '<p class="testimonial-message">' + escapeTestimonialHtml(item.message) + '</p>';
      html += '<div class="testimonial-name">' + escapeTestimonialHtml(item.name) + '</div>';
      html += '<div class="testimonial-stars" aria-label="' + escapeTestimonialHtml(item.rating) + ' out of 5 stars">' + testimonialStars(item.rating) + '</div>';
      html += '</article>';
    }
    container.innerHTML = html;
  }

  function loadTestimonials(force) {
    var container = document.getElementById('testimonialsList');
    if (!container || !window.DB || typeof DB.fetchTestimonials !== 'function') return;
    if ((testimonialsLoaded || testimonialsLoading) && !force) return;
    testimonialsLoading = true;
    DB.fetchTestimonials().then(function(list) { testimonialsLoaded = true; testimonialsLoading = false; renderTestimonials(list); })
      .catch(function(err) { testimonialsLoading = false; console.error('Failed to load testimonials:', err); container.innerHTML = '<p class="testimonials-empty">Customer testimonials are temporarily unavailable.</p>'; });
  }

  function initTestimonialForm() {
    var form = document.getElementById('testimonialForm');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');

    function paintRating(value) {
      var labels = form.querySelectorAll('.star-rating-input label');
      var rating = parseInt(value, 10) || 0;
      for (var i = 0; i < labels.length; i++) {
        var input = labels[i].querySelector('input');
        labels[i].classList.toggle('selected', !!input && parseInt(input.value, 10) <= rating);
      }
    }

    var ratingInputs = form.querySelectorAll('input[name="testimonialRating"]');
    for (var r = 0; r < ratingInputs.length; r++) {
      ratingInputs[r].addEventListener('change', function() { paintRating(this.value); });
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = document.getElementById('testimonialSubmitBtn');
      var msg = document.getElementById('testimonialFormMessage');
      var name = document.getElementById('testimonialName').value.trim();
      var message = document.getElementById('testimonialMessage').value.trim();
      var ratingEl = document.querySelector('input[name="testimonialRating"]:checked');
      if (!name || !message || !ratingEl) return;
      btn.disabled = true; btn.textContent = 'Submitting...';
      DB.submitTestimonial({name:name, message:message, rating:Number(ratingEl.value)}).then(function(res) {
        btn.disabled = false; btn.textContent = 'Submit Testimonial';
        if (msg) { msg.textContent = res.message || (res.error || ''); msg.style.display = 'block'; msg.className = 'testimonial-form-message' + (res.success ? ' success' : ' error'); }
        if (res.success) { form.reset(); paintRating(0); }
      }).catch(function(err) {
        btn.disabled = false; btn.textContent = 'Submit Testimonial';
        if (msg) { msg.textContent = err.message || 'Could not submit testimonial. Please try again.'; msg.style.display = 'block'; msg.className = 'testimonial-form-message error'; }
      });
    });
  }

  window.toggleMobileMenu = function() {
    var nav = document.getElementById('navLinks');
    if (nav) nav.classList.toggle('active');
  };

  document.addEventListener('DOMContentLoaded', function() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) {
      history.replaceState({ page: 'home' }, '', '#home');
    }

    var pageLinks = document.querySelectorAll('[data-page-link]');
    for (var i = 0; i < pageLinks.length; i++) {
      pageLinks[i].addEventListener('click', function(e) {
        var href = this.getAttribute('href') || '';
        if (href.indexOf('#') !== 0) return;
        e.preventDefault();
        var target = href.substring(1);
        if (window.location.hash.substring(1) === target) {
          navigateFromHash();
        } else {
          window.location.hash = target;
        }
      });
    }

    navigateFromHash();
    updateSiteCartBadge();
    initTestimonialForm();
    loadTestimonials(false);
  });

  window.addEventListener('hashchange', navigateFromHash);
  window.addEventListener('popstate', navigateFromHash);
  window.addEventListener('storage', updateSiteCartBadge);
  window.addEventListener('cartUpdated', updateSiteCartBadge);
})();
