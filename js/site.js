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
  });

  window.addEventListener('hashchange', navigateFromHash);
  window.addEventListener('popstate', navigateFromHash);
  window.addEventListener('storage', updateSiteCartBadge);
  window.addEventListener('cartUpdated', updateSiteCartBadge);
})();
