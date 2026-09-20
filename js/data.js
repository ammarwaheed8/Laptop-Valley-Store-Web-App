// Global memory cache of laptops retrieved from server
var CACHED_LAPTOPS = [];

// ---- API CLIENT (Database on hosting drive) ----
var DB = {
  fetchLaptops: function() {
    return fetch('api.php?action=get_laptops', { credentials: 'same-origin' })
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
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(laptopData)
    }).then(function(res) { return res.json(); });
  },

  deleteLaptop: function(id) {
    return fetch('api.php?action=delete_laptop', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    }).then(function(res) { return res.json(); });
  },

  createOrder: function(orderData) {
    return fetch('api.php?action=create_order', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    }).then(function(res) { return res.json(); });
  },

  fetchOrders: function() {
    return fetch('api.php?action=get_orders', { credentials: 'same-origin' })
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.success ? data.orders : []; });
  },

  updateOrderStatus: function(orderId, status) {
    return fetch('api.php?action=update_order_status', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: status })
    }).then(function(res) { return res.json(); });
  },

  deleteOrder: function(orderId) {
    return fetch('api.php?action=delete_order', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId })
    }).then(function(res) { return res.json(); });
  },

  // ---- AUTH METHODS ----
  login: function(username, password) {
    return fetch('api.php?action=login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function(res) { return res.json(); });
  },

  logout: function() {
    return fetch('api.php?action=logout', {
      method: 'POST',
      credentials: 'same-origin'
    }).then(function(res) { return res.json(); });
  },

  checkSession: function() {
    return fetch('api.php?action=check_session', { credentials: 'same-origin' })
      .then(function(res) { return res.json(); });
  },

  heartbeat: function() {
    return fetch('api.php?action=heartbeat', {
      method: 'POST',
      credentials: 'same-origin'
    }).then(function(res) { return res.json(); });
  },

  changePassword: function(currentPassword, newPassword) {
    return fetch('api.php?action=change_password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    }).then(function(res) { return res.json(); });
  }
};
