// Global memory cache of laptops retrieved from server
var CACHED_LAPTOPS = [];

// ---- API CLIENT (Database on hosting drive) ----
var DB = {
  fetchLaptops: function() {
    return fetch('api.php?action=get_laptops')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success) {
          CACHED_LAPTOPS = data.laptops;
          return data.laptops;
        }
        return [];
      });
  },

  saveLaptop: function(laptopData) {
    return fetch('api.php?action=save_laptop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(laptopData)
    }).then(function(res) { return res.json(); });
  },

  deleteLaptop: function(id) {
    return fetch('api.php?action=delete_laptop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    }).then(function(res) { return res.json(); });
  },

  createOrder: function(orderData) {
    return fetch('api.php?action=create_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    }).then(function(res) { return res.json(); });
  },

  fetchOrders: function() {
    return fetch('api.php?action=get_orders')
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.success ? data.orders : []; });
  },

  updateOrderStatus: function(orderId, status) {
    return fetch('api.php?action=update_order_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: status })
    }).then(function(res) { return res.json(); });
  },

  deleteOrder: function(orderId) {
    return fetch('api.php?action=delete_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId })
    }).then(function(res) { return res.json(); });
  }
};

function getLaptops() {
  return CACHED_LAPTOPS;
}

function getLaptopById(id) {
  for (var i = 0; i < CACHED_LAPTOPS.length; i++) {
    if (CACHED_LAPTOPS[i].id === id) return CACHED_LAPTOPS[i];
  }
  return null;
}

// ---- SHOPPING CART (Client device storage) ----
function getCart() {
  var cart = localStorage.getItem('lv_cart');
  if (!cart) return [];
  try {
    var parsed = JSON.parse(cart);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('lv_cart', JSON.stringify(cart));
}

function addToCart(laptopId, qty) {
  qty = qty || 1;
  var cart = getCart();
  var found = false;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === laptopId) {
      cart[i].qty += qty;
      found = true;
    }
  }
  if (!found) cart.push({ id: laptopId, qty: qty });
  saveCart(cart);
  validateCart();
}

function updateCartQty(laptopId, qty) {
  var cart = getCart();
  var newCart = [];
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === laptopId) {
      if (qty > 0) newCart.push({ id: laptopId, qty: qty });
    } else {
      newCart.push(cart[i]);
    }
  }
  saveCart(newCart);
}

function removeFromCart(laptopId) {
  var cart = getCart();
  var newCart = [];
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id !== laptopId) newCart.push(cart[i]);
  }
  saveCart(newCart);
}

function clearCart() {
  localStorage.removeItem('lv_cart');
}

function validateCart() {
  var cart = getCart();
  var laptops = CACHED_LAPTOPS;
  if (!laptops || laptops.length === 0) return cart;

  var mergedMap = {};
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    if (!item || !item.id || item.qty <= 0) continue;

    var lp = getLaptopById(item.id);
    if (!lp) continue;

    var qty = (mergedMap[item.id] || 0) + item.qty;
    if (qty > lp.stock) qty = lp.stock;
    if (qty > 0) mergedMap[item.id] = qty;
  }

  var cleanCart = [];
  for (var key in mergedMap) {
    if (mergedMap.hasOwnProperty(key)) {
      cleanCart.push({ id: key, qty: mergedMap[key] });
    }
  }
  saveCart(cleanCart);
  return cleanCart;
}

function getAvailableStock(laptopId) {
  var lp = getLaptopById(laptopId);
  if (!lp) return 0;
  var cart = getCart();
  var inCartQty = 0;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === laptopId) inCartQty = cart[i].qty;
  }
  var available = lp.stock - inCartQty;
  return available > 0 ? available : 0;
}

function getCartTotal() {
  var cart = getCart();
  var total = 0;
  for (var i = 0; i < cart.length; i++) {
    var lp = getLaptopById(cart[i].id);
    if (lp) total += lp.price * cart[i].qty;
  }
  return total;
}

function getCartCount() {
  var cart = getCart();
  var count = 0;
  for (var i = 0; i < cart.length; i++) count += cart[i].qty;
  return count;
}

function formatPrice(num) {
  var n = Number(num);
  if (isNaN(n)) n = 0;
  var parts = Math.round(n).toString();
  var formatted = '';
  var count = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    formatted = parts[i] + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) formatted = ',' + formatted;
  }
  return 'Rs. ' + formatted;
}
