// Live product data returned by the PHP/SQLite API.
var CACHED_LAPTOPS = [];

// Cart is intentionally kept in the browser only. Product inventory and
// pricing are always re-read from the server when the store loads and when
// an order is submitted.
var CART_STORAGE_KEY = 'laptopValleyCart';

// CSRF token for this session. Populated from the X-CSRF-Token response
// header the server sends on every api.php reply, and sent back on every
// state-changing request.
var CSRF_TOKEN = '';

function formatPrice(value) {
  var amount = Number(value);
  if (!isFinite(amount)) amount = 0;
  return 'Rs. ' + Math.round(amount).toLocaleString('en-PK');
}

function getLaptops() {
  return CACHED_LAPTOPS;
}

function getLaptopImages(laptop) {
  if (!laptop) return [];
  var images = [];
  if (Array.isArray(laptop.images)) images = laptop.images.slice(0, 3);
  if (!images.length && laptop.image) images = [laptop.image];
  var cleaned = [];
  for (var i = 0; i < images.length; i++) {
    if (typeof images[i] === 'string' && images[i].trim()) cleaned.push(images[i].trim());
  }
  return cleaned;
}

function getLaptopPrimaryImage(laptop) {
  var images = getLaptopImages(laptop);
  return images.length ? images[0] : 'assets/laptop-placeholder.svg';
}

function getLaptopById(id) {
  for (var i = 0; i < CACHED_LAPTOPS.length; i++) {
    if (String(CACHED_LAPTOPS[i].id) === String(id)) return CACHED_LAPTOPS[i];
  }
  return null;
}

function getProducts() { return getLaptops(); }
function getProductById(id) { return getLaptopById(id); }
function getProductCategory(product) { return product && product.category ? product.category : 'Laptop'; }

function readStoredCart() {
  try {
    var raw = localStorage.getItem(CART_STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Could not read cart from localStorage:', e);
    return [];
  }
}

function writeStoredCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn('Could not save cart to localStorage:', e);
  }
}

function getCart() {
  return readStoredCart();
}

function saveCart(cart) {
  writeStoredCart(cart);
  return cart;
}

function getAvailableStock(id) {
  var laptop = getLaptopById(id);
  if (!laptop) return 0;

  var cart = getCart();
  var reserved = 0;
  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) === String(id)) {
      reserved = Math.max(0, parseInt(cart[i].qty, 10) || 0);
      break;
    }
  }

  return Math.max(0, (parseInt(laptop.stock, 10) || 0) - reserved);
}

function validateCart() {
  // Do not destroy a cart before live inventory has been fetched.
  if (CACHED_LAPTOPS.length === 0) return;

  var cart = getCart();
  var cleaned = [];

  for (var i = 0; i < cart.length; i++) {
    var item = cart[i] || {};
    var laptop = getLaptopById(item.id);
    var qty = parseInt(item.qty, 10) || 0;

    if (!laptop || qty <= 0) continue;

    var stock = Math.max(0, parseInt(laptop.stock, 10) || 0);
    if (stock === 0) continue;
    if (qty > stock) qty = stock;

    cleaned.push({ id: laptop.id, qty: qty });
  }

  saveCart(cleaned);
  return cleaned;
}

function addToCart(id, qty) {
  var laptop = getLaptopById(id);
  if (!laptop) return false;

  qty = parseInt(qty, 10) || 0;
  if (qty <= 0) return false;

  var cart = validateCart() || getCart();
  var found = false;
  var stock = Math.max(0, parseInt(laptop.stock, 10) || 0);

  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) === String(id)) {
      var nextQty = (parseInt(cart[i].qty, 10) || 0) + qty;
      if (nextQty > stock) nextQty = stock;
      if (nextQty <= 0) return false;
      cart[i].qty = nextQty;
      found = true;
      break;
    }
  }

  if (!found) {
    if (stock <= 0) return false;
    cart.push({ id: laptop.id, qty: Math.min(qty, stock) });
  }

  saveCart(cart);
  return true;
}

function updateCartQty(id, qty) {
  qty = parseInt(qty, 10) || 0;
  var cart = getCart();
  var laptop = getLaptopById(id);

  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) === String(id)) {
      if (!laptop || qty <= 0) {
        cart.splice(i, 1);
      } else {
        var stock = Math.max(0, parseInt(laptop.stock, 10) || 0);
        cart[i].qty = Math.min(qty, stock);
        if (cart[i].qty <= 0) cart.splice(i, 1);
      }
      break;
    }
  }

  saveCart(cart);
}

function removeFromCart(id) {
  var cart = getCart();
  var next = [];
  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) !== String(id)) next.push(cart[i]);
  }
  saveCart(next);
}

function clearCart() {
  saveCart([]);
}

function getCartCount() {
  var cart = getCart();
  var count = 0;
  for (var i = 0; i < cart.length; i++) {
    count += Math.max(0, parseInt(cart[i].qty, 10) || 0);
  }
  return count;
}

function getCartTotal() {
  var cart = getCart();
  var total = 0;
  for (var i = 0; i < cart.length; i++) {
    var laptop = getLaptopById(cart[i].id);
    if (!laptop) continue;
    total += (Number(laptop.price) || 0) * (parseInt(cart[i].qty, 10) || 0);
  }
  return total;
}

// Wraps fetch() so every request automatically carries the current CSRF
// token and every response automatically refreshes it.
function apiFetch(url, options) {
  options = options || {};
  options.credentials = 'same-origin';
  options.cache = 'no-store';
  options.headers = options.headers || {};
  if (CSRF_TOKEN) {
    options.headers['X-CSRF-Token'] = CSRF_TOKEN;
  }

  return fetch(url, options).then(function(res) {
    var headerToken = res.headers.get('X-CSRF-Token');
    if (headerToken) CSRF_TOKEN = headerToken;

    return res.text().then(function(text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('API returned a non-JSON response (HTTP ' + res.status + ').');
      }

      if (!res.ok) {
        var error = new Error(data.error || ('API request failed with HTTP ' + res.status + '.'));
        error.response = data;
        error.status = res.status;
        throw error;
      }
      return data;
    });
  });
}

// ---- API CLIENT (database on hosting drive) ----
var DB = {
  primeCsrfToken: function() {
    return apiFetch('api.php?action=csrf_token');
  },

  fetchLaptops: function() {
    return apiFetch('api.php?action=get_laptops').then(function(data) {
      if (!data || data.success !== true || !Array.isArray(data.laptops)) {
        throw new Error((data && data.error) || 'Could not load laptops from the server.');
      }

      CACHED_LAPTOPS = data.laptops;
      validateCart();
      return CACHED_LAPTOPS;
    });
  },

  saveLaptop: function(laptopData, imageFiles, removeImages) {
    var form = new FormData();
    for (var key in laptopData) {
      if (Object.prototype.hasOwnProperty.call(laptopData, key)) {
        form.append(key, laptopData[key] === null || laptopData[key] === undefined ? '' : laptopData[key]);
      }
    }
    imageFiles = imageFiles || {};
    removeImages = removeImages || {};
    for (var slot = 1; slot <= 3; slot++) {
      var file = imageFiles['image' + slot];
      if (file) form.append('image' + slot, file);
      if (removeImages['remove' + slot]) form.append('remove' + slot, '1');
    }
    return apiFetch('api.php?action=save_laptop', {
      method: 'POST',
      body: form
    });
  },

  deleteLaptop: function(id) {
    return apiFetch('api.php?action=delete_laptop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
  },

  createOrder: function(orderData) {
    return apiFetch('api.php?action=create_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
  },

  fetchOrders: function() {
    return apiFetch('api.php?action=get_orders')
      .then(function(data) {
        return data.success ? data.orders : [];
      });
  },

  updateOrderStatus: function(orderId, status) {
    return apiFetch('api.php?action=update_order_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: status })
    });
  },

  deleteOrder: function(orderId) {
    return apiFetch('api.php?action=delete_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId })
    });
  },

  // ---- AUTH METHODS ----
  login: function(username, password) {
    return apiFetch('api.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
  },

  logout: function() {
    return apiFetch('api.php?action=logout', { method: 'POST' });
  },

  checkSession: function() {
    return apiFetch('api.php?action=check_session');
  },

  heartbeat: function() {
    return apiFetch('api.php?action=heartbeat', { method: 'POST' });
  },

  changePassword: function(currentPassword, newPassword) {
    return apiFetch('api.php?action=change_password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    });
  }
};

// Prime the CSRF token as soon as this script loads on any page. Do not let a
// token bootstrap failure become an opaque blank storefront; log it and let
// the normal fetch calls report the real server error.
DB.primeCsrfToken().catch(function(err) {
  console.error('CSRF bootstrap failed:', err);
});
