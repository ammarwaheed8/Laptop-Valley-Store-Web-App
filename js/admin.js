var idleCheckTimer = null;
var heartbeatTimer = null;

function showToast(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 3000);
}

function clearLoginFields() {
  var userEl = document.getElementById('adminUser');
  var passEl = document.getElementById('adminPass');
  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';

  var eyeOpen = document.getElementById('eyeOpen');
  var eyeClosed = document.getElementById('eyeClosed');
  if (passEl) passEl.type = 'password';
  if (eyeOpen) eyeOpen.style.display = 'block';
  if (eyeClosed) eyeClosed.style.display = 'none';
}

function showLoginScreen(message) {
  stopSessionWatchers();
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  clearLoginFields();
  if (message) showToast(message, true);
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  initAdminDashboard();
  startSessionWatchers();
}

function doLogin() {
  var user = document.getElementById('adminUser').value.trim();
  var pass = document.getElementById('adminPass').value;
  var errorEl = document.getElementById('loginError');
  var loginBtn = document.getElementById('loginBtn');

  if (!user || !pass) {
    if (errorEl) {
      errorEl.textContent = 'Please enter both username and password';
      errorEl.style.display = 'block';
    }
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  DB.login(user, pass).then(function(res) {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';

    if (res.success) {
      if (errorEl) errorEl.style.display = 'none';
      showDashboard();
    } else {
      if (errorEl) {
        errorEl.textContent = res.error || 'Invalid credentials';
        errorEl.style.display = 'block';
      }
      showToast(res.error || 'Invalid credentials', true);
    }
  }).catch(function() {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
    showToast('Server error. Please try again.', true);
  });
}

function doLogout() {
  DB.logout().then(function() {
    showLoginScreen(null);
  });
}

// ---- SESSION WATCHERS (Server-verified idle timeout) ----
var lastPingTime = 0;

function pingActivity() {
  var now = Date.now();
  if (now - lastPingTime > 5000) { // throttle: max once per 5 sec
    lastPingTime = now;
    DB.heartbeat();
  }
}

function checkSessionPeriodically() {
  DB.checkSession().then(function(res) {
    if (res.success && res.loggedIn === false) {
      if (res.reason === 'idle_timeout') {
        showLoginScreen('Session expired due to inactivity. Please login again.');
      } else {
        showLoginScreen(null);
      }
    }
  });
}

function startSessionWatchers() {
  var activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  for (var i = 0; i < activityEvents.length; i++) {
    document.addEventListener(activityEvents[i], pingActivity, true);
  }

  if (idleCheckTimer) clearInterval(idleCheckTimer);
  idleCheckTimer = setInterval(checkSessionPeriodically, 15000); // check every 15 sec

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkSessionPeriodically();
    }
  });
  window.addEventListener('focus', function() {
    checkSessionPeriodically();
  });
}

function stopSessionWatchers() {
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
    idleCheckTimer = null;
  }
}

// ---- CHANGE PASSWORD ----
function openChangePasswordModal() {
  document.getElementById('changePassModal').classList.add('active');
  document.getElementById('cp_current').value = '';
  document.getElementById('cp_new').value = '';
  document.getElementById('cp_confirm').value = '';
  document.getElementById('cp_error').style.display = 'none';
}

function closeChangePasswordModal() {
  document.getElementById('changePassModal').classList.remove('active');
}

function submitChangePassword() {
  var current = document.getElementById('cp_current').value;
  var newPass = document.getElementById('cp_new').value;
  var confirm = document.getElementById('cp_confirm').value;
  var errorEl = document.getElementById('cp_error');

  if (!current || !newPass || !confirm) {
    errorEl.textContent = 'Please fill all fields';
    errorEl.style.display = 'block';
    return;
  }
  if (newPass !== confirm) {
    errorEl.textContent = 'New passwords do not match';
    errorEl.style.display = 'block';
    return;
  }
  if (newPass.length < 6) {
    errorEl.textContent = 'New password must be at least 6 characters';
    errorEl.style.display = 'block';
    return;
  }

  DB.changePassword(current, newPass).then(function(res) {
    if (res.success) {
      showToast('Password changed successfully');
      closeChangePasswordModal();
    } else {
      errorEl.textContent = res.error || 'Failed to change password';
      errorEl.style.display = 'block';
    }
  });
}

// ---- TABS ----
function switchTab(tabName, btnEl) {
  var contents = document.querySelectorAll('.tab-content');
  for (var i = 0; i < contents.length; i++) contents[i].classList.remove('active');

  var btns = document.querySelectorAll('.tab-btn');
  for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');

  var tabContent = document.getElementById('tab-' + tabName);
  if (tabContent) tabContent.classList.add('active');
  if (btnEl) btnEl.classList.add('active');

  if (tabName === 'manage') renderLaptopTable();
  if (tabName === 'orders') renderOrdersTable();
}

function resetForm() {
  document.getElementById('laptopForm').reset();
  document.getElementById('f_editId').value = '';
  document.getElementById('submitBtn').textContent = 'Add Laptop';
}

function handleLaptopSubmit(e) {
  e.preventDefault();

  var laptopData = {
    brand: document.getElementById('f_brand').value,
    model: document.getElementById('f_model').value,
    processorBrand: document.getElementById('f_procBrand').value,
    processorModel: document.getElementById('f_procModel').value,
    ramSize: document.getElementById('f_ramSize').value,
    ramType: document.getElementById('f_ramType').value,
    storageType: document.getElementById('f_storageType').value,
    storageCapacity: document.getElementById('f_storageCap').value,
    displaySize: document.getElementById('f_displaySize').value,
    displayResolution: document.getElementById('f_displayRes').value,
    displayType: document.getElementById('f_displayType').value,
    graphics: document.getElementById('f_graphics').value,
    os: document.getElementById('f_os').value,
    battery: document.getElementById('f_battery').value,
    weight: document.getElementById('f_weight').value,
    color: document.getElementById('f_color').value,
    warranty: document.getElementById('f_warranty').value,
    price: Number(document.getElementById('f_price').value),
    stock: Number(document.getElementById('f_stock').value),
    image: document.getElementById('f_image').value,
    description: document.getElementById('f_description').value
  };

  var editId = document.getElementById('f_editId').value;
  if (editId) laptopData.id = editId;

  DB.saveLaptop(laptopData).then(function(res) {
    if (res.success) {
      showToast(editId ? 'Laptop updated successfully' : 'Laptop added successfully');
      resetForm();
      DB.fetchLaptops().then(function() {
        renderLaptopTable();
        updateStats();
      });
    } else if (res.error === 'Unauthorized. Please login as admin.') {
      showLoginScreen('Session expired. Please login again.');
    } else {
      showToast('Error saving laptop', true);
    }
  });
}

function editLaptop(id) {
  var lp = getLaptopById(id);
  if (!lp) return;

  document.getElementById('f_brand').value = lp.brand;
  document.getElementById('f_model').value = lp.model;
  document.getElementById('f_procBrand').value = lp.processorBrand;
  document.getElementById('f_procModel').value = lp.processorModel;
  document.getElementById('f_ramSize').value = lp.ramSize;
  document.getElementById('f_ramType').value = lp.ramType;
  document.getElementById('f_storageType').value = lp.storageType;
  document.getElementById('f_storageCap').value = lp.storageCapacity;
  document.getElementById('f_displaySize').value = lp.displaySize;
  document.getElementById('f_displayRes').value = lp.displayResolution;
  document.getElementById('f_displayType').value = lp.displayType;
  document.getElementById('f_graphics').value = lp.graphics;
  document.getElementById('f_os').value = lp.os;
  document.getElementById('f_battery').value = lp.battery;
  document.getElementById('f_weight').value = lp.weight;
  document.getElementById('f_color').value = lp.color;
  document.getElementById('f_warranty').value = lp.warranty;
  document.getElementById('f_price').value = lp.price;
  document.getElementById('f_stock').value = lp.stock;
  document.getElementById('f_image').value = lp.image;
  document.getElementById('f_description').value = lp.description || '';
  document.getElementById('f_editId').value = lp.id;
  document.getElementById('submitBtn').textContent = 'Update Laptop';

  var contents = document.querySelectorAll('.tab-content');
  for (var i = 0; i < contents.length; i++) contents[i].classList.remove('active');
  var btns = document.querySelectorAll('.tab-btn');
  for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');

  document.getElementById('tab-add').classList.add('active');
  var addBtn = document.querySelector('.tab-btn[data-tab="add"]');
  if (addBtn) addBtn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteLaptopHandler(id) {
  if (confirm('Are you sure you want to delete this laptop?')) {
    DB.deleteLaptop(id).then(function(res) {
      if (res.success) {
        DB.fetchLaptops().then(function() {
          renderLaptopTable();
          updateStats();
          showToast('Laptop deleted');
        });
      } else if (res.error === 'Unauthorized. Please login as admin.') {
        showLoginScreen('Session expired. Please login again.');
      }
    });
  }
}

function renderLaptopTable() {
  var laptops = getLaptops();
  var tbody = document.getElementById('laptopTableBody');
  if (!tbody) return;

  if (laptops.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">No laptops added yet.</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < laptops.length; i++) {
    var lp = laptops[i];
    html += '<tr>';
    html += '<td><img src="' + lp.image + '" style="width:60px; height:45px; object-fit:contain;" onerror="this.src=\'https://via.placeholder.com/60x45\'"></td>';
    html += '<td>' + lp.brand + '</td>';
    html += '<td>' + lp.model + '</td>';
    html += '<td>' + lp.processorModel + ', ' + lp.ramSize + ', ' + lp.storageCapacity + '</td>';
    html += '<td>' + formatPrice(lp.price) + '</td>';
    html += '<td><strong>' + lp.stock + '</strong></td>';
    html += '<td><div class="action-btns">';
    html += '<button type="button" class="btn btn-outline icon-btn" onclick="editLaptop(\'' + lp.id + '\')">Edit</button>';
    html += '<button type="button" class="btn btn-danger icon-btn" onclick="deleteLaptopHandler(\'' + lp.id + '\')">Delete</button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function getStatusClass(status) {
  if (status === 'confirmed') return 'badge-confirmed';
  if (status === 'declined') return 'badge-declined';
  if (status === 'refund') return 'badge-refund';
  return 'badge-pending';
}

function getStatusLabel(status) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'declined') return 'Declined';
  if (status === 'refund') return 'Refund';
  return 'Pending';
}

var CURRENT_ORDERS = [];

function renderOrdersTable() {
  DB.fetchOrders().then(function(orders) {
    CURRENT_ORDERS = orders;
    var tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">No orders yet.</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < orders.length; i++) {
      var order = orders[i];
      var currentStatus = order.status || 'pending';
      var itemsHtml = '';
      for (var j = 0; j < order.items.length; j++) {
        itemsHtml += order.items[j].name + ' x' + order.items[j].qty + '<br>';
      }
      html += '<tr>';
      html += '<td>' + order.id + '</td>';
      html += '<td>' + order.customerName + '</td>';
      html += '<td>' + order.customerPhone + '<br><small>' + order.customerEmail + '</small></td>';
      html += '<td>' + itemsHtml + '</td>';
      html += '<td>' + formatPrice(order.total) + '</td>';
      html += '<td>' + order.paymentMethod + '</td>';
      html += '<td><span class="badge ' + getStatusClass(currentStatus) + '">' + getStatusLabel(currentStatus) + '</span></td>';
      html += '<td><div class="action-btns">';
      html += '<select class="status-dropdown" onchange="changeOrderStatus(\'' + order.id + '\', this.value)" data-current="' + currentStatus + '">';
      html += '<option value="pending"' + (currentStatus === 'pending' ? ' selected' : '') + '>Pending</option>';
      html += '<option value="confirmed"' + (currentStatus === 'confirmed' ? ' selected' : '') + '>Confirmed</option>';
      html += '<option value="declined"' + (currentStatus === 'declined' ? ' selected' : '') + '>Declined</option>';
      html += '<option value="refund"' + (currentStatus === 'refund' ? ' selected' : '') + '>Refund</option>';
      html += '</select>';
      html += '<button type="button" class="btn btn-outline icon-btn" onclick="printInvoice(\'' + order.id + '\')">Print Invoice</button>';
      html += '<button type="button" class="btn btn-danger icon-btn" onclick="deleteOrderHandler(\'' + order.id + '\')">Delete</button>';
      html += '</div></td></tr>';
    }
    tbody.innerHTML = html;
  });
}

function changeOrderStatus(orderId, newStatus) {
  DB.updateOrderStatus(orderId, newStatus).then(function(res) {
    if (res.success) {
      showToast('Order status updated');
      DB.fetchLaptops().then(function() {
        renderOrdersTable();
        renderLaptopTable();
        updateStats();
      });
    } else if (res.error === 'Unauthorized. Please login as admin.') {
      showLoginScreen('Session expired. Please login again.');
    } else {
      showToast('Failed to update status', true);
    }
  });
}

function deleteOrderHandler(orderId) {
  if (!confirm('Are you sure you want to permanently delete this order?')) return;
  DB.deleteOrder(orderId).then(function(res) {
    if (res.success) {
      showToast('Order deleted');
      renderOrdersTable();
      updateStats();
    } else if (res.error === 'Unauthorized. Please login as admin.') {
      showLoginScreen('Session expired. Please login again.');
    }
  });
}

function printInvoice(orderId) {
  var order = null;
  for (var i = 0; i < CURRENT_ORDERS.length; i++) {
    if (CURRENT_ORDERS[i].id === orderId) order = CURRENT_ORDERS[i];
  }
  if (!order) {
    showToast('Order not found', true);
    return;
  }

  var currentStatus = order.status || 'pending';
  var statusColor = '#fef3c7';
  var statusTextColor = '#92400e';
  var statusLabel = 'Pending';

  if (currentStatus === 'confirmed') {
    statusColor = '#dcfce7'; statusTextColor = '#166534'; statusLabel = 'Confirmed';
  } else if (currentStatus === 'declined') {
    statusColor = '#fee2e2'; statusTextColor = '#991b1b'; statusLabel = 'Declined';
  } else if (currentStatus === 'refund') {
    statusColor = '#fef3c7'; statusTextColor = '#92400e'; statusLabel = 'Refund';
  }

  var itemsRows = '';
  for (var j = 0; j < order.items.length; j++) {
    var it = order.items[j];
    itemsRows += '<tr>' +
      '<td>' + (j + 1) + '</td>' +
      '<td>' + it.name + ' (' + it.brand + ')</td>' +
      '<td style="text-align:center;">' + it.qty + '</td>' +
      '<td style="text-align:right;">' + formatPrice(it.price) + '</td>' +
      '<td style="text-align:right;">' + formatPrice(it.subtotal) + '</td>' +
      '</tr>';
  }

  var invoiceHtml = '<!DOCTYPE html><html><head><title>Invoice ' + order.id + '</title>' +
    '<style>' +
    'body{font-family:Arial, sans-serif; padding:40px; color:#1e293b;}' +
    '.invoice-header{display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1e40af; padding-bottom:20px; margin-bottom:20px;}' +
    '.company-name{font-size:1.8rem; font-weight:800; color:#1e40af;}' +
    '.invoice-title{font-size:1.4rem; font-weight:700; text-align:right; color:#1e293b;}' +
    '.info-grid{display:flex; justify-content:space-between; margin-bottom:30px; gap:20px;}' +
    '.info-block h4{color:#64748b; font-size:0.8rem; text-transform:uppercase; margin-bottom:6px;}' +
    '.info-block p{font-size:0.95rem; margin-bottom:2px;}' +
    'table{width:100%; border-collapse:collapse; margin-bottom:20px;}' +
    'th{background:#1e40af; color:white; padding:10px; text-align:left; font-size:0.85rem;}' +
    'td{padding:10px; border-bottom:1px solid #e2e8f0; font-size:0.9rem;}' +
    '.total-row{font-size:1.2rem; font-weight:800; text-align:right; padding-top:15px;}' +
    '.footer-note{margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; font-size:0.8rem; color:#64748b; text-align:center;}' +
    '.status-badge{display:inline-block; padding:4px 12px; border-radius:12px; font-size:0.8rem; font-weight:600; background:' + statusColor + '; color:' + statusTextColor + ';}' +
    '@media print { body{padding:20px;} }' +
    '</style></head><body>' +
    '<div class="invoice-header">' +
    '<div><div class="company-name">Laptop Valley</div><p style="color:#64748b; font-size:0.85rem;">Premium Laptop Store - Pakistan</p></div>' +
    '<div><div class="invoice-title">INVOICE</div><p style="color:#64748b; font-size:0.85rem;">Order ID: ' + order.id + '</p><p style="color:#64748b; font-size:0.85rem;">Date: ' + new Date(order.date).toLocaleDateString() + '</p></div>' +
    '</div>' +
    '<div class="info-grid">' +
    '<div class="info-block">' +
    '<h4>Billed To</h4>' +
    '<p><strong>' + order.customerName + '</strong></p>' +
    '<p>' + order.address + '</p>' +
    '<p>' + order.city + ' - ' + order.pin + '</p>' +
    '<p>Phone: ' + order.customerPhone + '</p>' +
    '<p>Email: ' + order.customerEmail + '</p>' +
    '</div>' +
    '<div class="info-block" style="text-align:right;">' +
    '<h4>Payment Info</h4>' +
    '<p>Method: ' + order.paymentMethod + '</p>' +
    '<p>Status: <span class="status-badge">' + statusLabel + '</span></p>' +
    (order.notes ? '<p style="margin-top:8px;">Notes: ' + order.notes + '</p>' : '') +
    '</div>' +
    '</div>' +
    '<table>' +
    '<thead><tr><th>#</th><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr></thead>' +
    '<tbody>' + itemsRows + '</tbody>' +
    '</table>' +
    '<div class="total-row">Total Amount: ' + formatPrice(order.total) + '</div>' +
    '<div class="footer-note">' +
    '<p>Thank you for shopping with Laptop Valley!</p>' +
    '<p>For queries, contact us at +92-300-1234567 or support@laptopvalley.pk</p>' +
    '</div>' +
    '</body></html>';

  var printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showToast('Please allow popups to print invoice', true);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();

  printWindow.onload = function() {
    printWindow.focus();
    printWindow.print();
  };
}

function updateStats() {
  DB.fetchOrders().then(function(orders) {
    var laptops = getLaptops();
    var pending = 0;
    var revenue = 0;
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].status === 'pending') pending++;
      if (orders[i].status !== 'declined' && orders[i].status !== 'refund') {
        revenue += orders[i].total;
      }
    }
    document.getElementById('statLaptops').textContent = laptops.length;
    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statRevenue').textContent = formatPrice(revenue);
  });
}

function initAdminDashboard() {
  DB.fetchLaptops().then(function() {
    updateStats();
    renderLaptopTable();
    renderOrdersTable();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);

  var toggleEye = document.getElementById('togglePassEye');
  var passField = document.getElementById('adminPass');
  var eyeOpen = document.getElementById('eyeOpen');
  var eyeClosed = document.getElementById('eyeClosed');

  if (toggleEye && passField) {
    toggleEye.addEventListener('click', function() {
      if (passField.type === 'password') {
        passField.type = 'text';
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
      } else {
        passField.type = 'password';
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
      }
    });
  }

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  var changePassBtn = document.getElementById('changePasswordBtn');
  if (changePassBtn) changePassBtn.addEventListener('click', openChangePasswordModal);

  var tabBtns = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].addEventListener('click', function() {
      var tabName = this.getAttribute('data-tab');
      switchTab(tabName, this);
    });
  }

  var laptopForm = document.getElementById('laptopForm');
  if (laptopForm) laptopForm.addEventListener('submit', handleLaptopSubmit);

  var passInput = document.getElementById('adminPass');
  if (passInput) {
    passInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') doLogin();
    });
  }

  // Check with SERVER (not just local storage) if already logged in
  DB.checkSession().then(function(res) {
    if (res.success && res.loggedIn === true) {
      showDashboard();
    } else {
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('adminDashboard').style.display = 'none';
    }
  });
});
