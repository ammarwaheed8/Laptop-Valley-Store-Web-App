var idleCheckTimer = null;
var heartbeatTimer = null;

// Escapes a value for safe insertion into innerHTML (text content or inside a
// quoted HTML attribute). Used on every customer-supplied field (order data,
// item names) before it's built into HTML strings, so a malicious order can't
// run script in the admin's browser (stored XSS).
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  if (newPass.length < 8) {
    errorEl.textContent = 'New password must be at least 8 characters';
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

function renderCurrentImageSlots(lp) {
  var panel = document.getElementById('currentImagesPanel');
  var images = getLaptopImages(lp);
  for (var i = 1; i <= 3; i++) {
    var removeBox = document.getElementById('f_remove' + i);
    if (removeBox) {
      removeBox.checked = false;
      removeBox.disabled = !images[i - 1];
    }
  }

  if (!panel) return;
  if (!images.length) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  var html = '<div class="current-images-title">Current Images</div><div class="current-images-grid">';
  for (var j = 0; j < images.length; j++) {
    html += '<div class="current-image-card">';
    html += '<img src="' + escapeHtml(images[j]) + '" alt="Current laptop image ' + (j + 1) + '" onerror="this.src=\'assets/laptop-placeholder.svg\'">';
    html += '<span>Image ' + (j + 1) + '</span>';
    html += '</div>';
  }
  html += '</div><p class="image-help-text">Upload a new file in a slot to replace that image, or tick Remove existing image. Leave a slot untouched to keep its current image.</p>';
  panel.innerHTML = html;
  panel.style.display = 'block';
}

function resetImageFields() {
  for (var i = 1; i <= 3; i++) {
    var input = document.getElementById('f_image' + i);
    var removeBox = document.getElementById('f_remove' + i);
    if (input) input.value = '';
    if (removeBox) {
      removeBox.checked = false;
      removeBox.disabled = true;
    }
  }
  var panel = document.getElementById('currentImagesPanel');
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

var LAPTOP_ONLY_FIELDS = ['f_procBrand','f_procModel','f_ramSize','f_ramType','f_storageType','f_storageCap','f_displaySize','f_displayRes','f_displayType','f_graphics','f_os','f_battery','f_weight','f_color'];
var DESKTOP_ONLY_FIELDS = ['f_desktopProcBrand','f_desktopProcModel','f_desktopRamSize','f_desktopRamType','f_desktopStorageType','f_desktopStorageCap','f_desktopGraphics','f_desktopMotherboard','f_desktopPsu','f_desktopCaseType','f_desktopCooling','f_desktopOs'];
var LAPTOP_SUBCATEGORY_VALUES = ['Laptop'];
var DESKTOP_SUBCATEGORY_VALUES = ['Gaming PC','Office PC','Workstation','Mini PC','All-in-One PC','Custom Build','Other Desktop'];
var ACCESSORY_SUBCATEGORY_VALUES = ['Mouse','Keyboard','Headset','Laptop Bag','Charger / Adapter','Cooling Pad','Dock / Hub','Storage','RAM / Memory','Monitor','Cable','Other'];

function setFieldState(ids, enabled, required) {
  for (var i = 0; i < ids.length; i++) {
    var field = document.getElementById(ids[i]);
    if (!field) continue;
    field.disabled = !enabled;
    field.required = !!required && enabled;
  }
}

function selectSubcategoryForCategory(category, desired) {
  var select = document.getElementById('f_subcategory');
  if (!select) return;
  var allowed = category === 'Laptop' ? LAPTOP_SUBCATEGORY_VALUES : (category === 'Desktop PC' ? DESKTOP_SUBCATEGORY_VALUES : ACCESSORY_SUBCATEGORY_VALUES);
  for (var i = 0; i < select.options.length; i++) {
    var option = select.options[i];
    var isAllowed = allowed.indexOf(option.value) !== -1;
    option.style.display = isAllowed ? '' : 'none';
  }
  if (desired && allowed.indexOf(desired) !== -1) {
    select.value = desired;
  } else if (allowed.length) {
    select.value = allowed[0];
  } else {
    select.value = '';
  }
}

function syncProductFormMode() {
  var categoryEl = document.getElementById('f_category');
  var category = categoryEl ? categoryEl.value : 'Laptop';
  var laptopMode = category === 'Laptop';
  var desktopMode = category === 'Desktop PC';
  var accessoryMode = category === 'Accessories';

  var laptopWrap = document.getElementById('laptopSpecsFields');
  var desktopWrap = document.getElementById('desktopSpecsFields');
  if (laptopWrap) laptopWrap.style.display = laptopMode ? 'block' : 'none';
  if (desktopWrap) desktopWrap.style.display = desktopMode ? 'block' : 'none';

  setFieldState(LAPTOP_ONLY_FIELDS, laptopMode, laptopMode);
  setFieldState(DESKTOP_ONLY_FIELDS, desktopMode, desktopMode);

  selectSubcategoryForCategory(category, document.getElementById('f_subcategory') ? document.getElementById('f_subcategory').value : '');

  var heading = document.querySelector('#tab-add h2');
  if (heading) heading.textContent = laptopMode ? 'Add New Laptop' : (desktopMode ? 'Add New Desktop PC' : 'Add New Accessory');
  var submitBtn = document.getElementById('submitBtn');
  var editId = document.getElementById('f_editId');
  if (submitBtn && !(editId && editId.value)) {
    submitBtn.textContent = laptopMode ? 'Add Laptop' : (desktopMode ? 'Add Desktop PC' : 'Add Accessory');
  }
}

function validateProductBeforeSubmit(category) {
  var requiredIds = category === 'Laptop' ? LAPTOP_ONLY_FIELDS : (category === 'Desktop PC' ? DESKTOP_ONLY_FIELDS : []);
  for (var i = 0; i < requiredIds.length; i++) {
    var field = document.getElementById(requiredIds[i]);
    if (field && !field.disabled && !String(field.value || '').trim()) {
      showToast('Please complete all ' + (category === 'Desktop PC' ? 'Desktop PC' : 'laptop') + ' specifications before saving.', true);
      field.focus();
      return false;
    }
  }
  return true;
}

function resetForm() {
  document.getElementById('laptopForm').reset();
  document.getElementById('f_editId').value = '';
  document.getElementById('f_category').value = 'Laptop';
  document.getElementById('f_subcategory').value = 'Laptop';
  resetImageFields();
  syncProductFormMode();
}

function handleLaptopSubmit(e) {
  e.preventDefault();

  var category = document.getElementById('f_category').value;
  if (!validateProductBeforeSubmit(category)) return;

  var laptopData = {
    category: category,
    subcategory: document.getElementById('f_subcategory').value,
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
    desktopProcessorBrand: document.getElementById('f_desktopProcBrand').value,
    desktopProcessorModel: document.getElementById('f_desktopProcModel').value,
    desktopRamSize: document.getElementById('f_desktopRamSize').value,
    desktopRamType: document.getElementById('f_desktopRamType').value,
    desktopStorageType: document.getElementById('f_desktopStorageType').value,
    desktopStorageCapacity: document.getElementById('f_desktopStorageCap').value,
    desktopGraphics: document.getElementById('f_desktopGraphics').value,
    desktopMotherboard: document.getElementById('f_desktopMotherboard').value,
    desktopPsu: document.getElementById('f_desktopPsu').value,
    desktopCaseType: document.getElementById('f_desktopCaseType').value,
    desktopCooling: document.getElementById('f_desktopCooling').value,
    desktopOs: document.getElementById('f_desktopOs').value,
    warranty: document.getElementById('f_warranty').value,
    price: Number(document.getElementById('f_price').value),
    stock: Number(document.getElementById('f_stock').value),
    description: document.getElementById('f_description').value
  };

  var imageFiles = {};
  var removeImages = {};
  for (var i = 1; i <= 3; i++) {
    var input = document.getElementById('f_image' + i);
    var removeBox = document.getElementById('f_remove' + i);
    if (input && input.files && input.files[0]) imageFiles['image' + i] = input.files[0];
    if (removeBox && removeBox.checked) removeImages['remove' + i] = true;
  }

  var editId = document.getElementById('f_editId').value;
  if (editId) laptopData.id = editId;

  var submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = editId ? 'Updating...' : 'Adding...';

  DB.saveLaptop(laptopData, imageFiles, removeImages).then(function(res) {
    submitBtn.disabled = false;
    submitBtn.textContent = editId ? 'Update Product' : (category === 'Laptop' ? 'Add Laptop' : (category === 'Desktop PC' ? 'Add Desktop PC' : 'Add Accessory'));

    if (res.success) {
      showToast(editId ? 'Product updated successfully' : (category === 'Laptop' ? 'Laptop added successfully' : (category === 'Desktop PC' ? 'Desktop PC added successfully' : 'Accessory added successfully')));
      resetForm();
      DB.fetchLaptops().then(function() {
        renderLaptopTable();
        updateStats();
      });
    } else if (res.error === 'Unauthorized. Please login as admin.') {
      showLoginScreen('Session expired. Please login again.');
    } else {
      showToast(res.error ? ('Error saving laptop: ' + res.error) : 'Error saving laptop', true);
    }
  }).catch(function(err) {
    submitBtn.disabled = false;
    submitBtn.textContent = editId ? 'Update Product' : (category === 'Laptop' ? 'Add Laptop' : (category === 'Desktop PC' ? 'Add Desktop PC' : 'Add Accessory'));
    showToast(err.message || 'Error saving laptop', true);
  });
}

function editLaptop(id) {
  var lp = getLaptopById(id);
  if (!lp) return;

  document.getElementById('f_category').value = lp.category || 'Laptop';
  document.getElementById('f_subcategory').value = lp.subcategory || ((lp.category || 'Laptop') === 'Laptop' ? 'Laptop' : 'Other');
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
  document.getElementById('f_color').value = lp.color || '';
  document.getElementById('f_desktopProcBrand').value = lp.desktopProcessorBrand || lp.processorBrand || '';
  document.getElementById('f_desktopProcModel').value = lp.desktopProcessorModel || lp.processorModel || '';
  document.getElementById('f_desktopRamSize').value = lp.desktopRamSize || lp.ramSize || '';
  document.getElementById('f_desktopRamType').value = lp.desktopRamType || lp.ramType || '';
  document.getElementById('f_desktopStorageType').value = lp.desktopStorageType || lp.storageType || '';
  document.getElementById('f_desktopStorageCap').value = lp.desktopStorageCapacity || lp.storageCapacity || '';
  document.getElementById('f_desktopGraphics').value = lp.desktopGraphics || lp.graphics || '';
  document.getElementById('f_desktopMotherboard').value = lp.desktopMotherboard || '';
  document.getElementById('f_desktopPsu').value = lp.desktopPsu || '';
  document.getElementById('f_desktopCaseType').value = lp.desktopCaseType || '';
  document.getElementById('f_desktopCooling').value = lp.desktopCooling || '';
  document.getElementById('f_desktopOs').value = lp.desktopOs || lp.os || '';
  document.getElementById('f_warranty').value = lp.warranty || '';
  document.getElementById('f_price').value = lp.price;
  document.getElementById('f_stock').value = lp.stock;
  document.getElementById('f_description').value = lp.description || '';
  document.getElementById('f_editId').value = lp.id;
  document.getElementById('submitBtn').textContent = (lp.category === 'Accessories' ? 'Update Accessory' : (lp.category === 'Desktop PC' ? 'Update Desktop PC' : 'Update Laptop'));

  for (var k = 1; k <= 3; k++) {
    var fileInput = document.getElementById('f_image' + k);
    if (fileInput) fileInput.value = '';
  }
  renderCurrentImageSlots(lp);
  syncProductFormMode();

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
  if (confirm('Are you sure you want to delete this product?')) {
    DB.deleteLaptop(id).then(function(res) {
      if (res.success) {
        DB.fetchLaptops().then(function() {
          renderLaptopTable();
          updateStats();
          showToast('Product deleted');
        });
      } else if (res.error === 'Unauthorized. Please login as admin.') {
        showLoginScreen('Session expired. Please login again.');
      }
    });
  }
}

function renderLaptopTable() {
  var products = getLaptops();
  var tbody = document.getElementById('laptopTableBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">No products added yet.</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < products.length; i++) {
    var product = products[i];
    var category = product.category || 'Laptop';
    var specs = category === 'Laptop'
      ? (escapeHtml(product.processorModel || '') + ', ' + escapeHtml(product.ramSize || '') + ', ' + escapeHtml(product.storageCapacity || ''))
      : (category === 'Desktop PC'
        ? (escapeHtml(product.desktopProcessorModel || product.processorModel || '') + ', ' + escapeHtml(product.desktopRamSize || product.ramSize || '') + ', ' + escapeHtml(product.desktopStorageCapacity || product.storageCapacity || '') + (product.desktopGraphics ? ', ' + escapeHtml(product.desktopGraphics) : ''))
        : (escapeHtml(product.subcategory || 'Accessory')));
    html += '<tr>';
    html += '<td><img src="' + escapeHtml(getLaptopPrimaryImage(product)) + '" style="width:60px; height:45px; object-fit:contain;" onerror="this.src=\'assets/laptop-placeholder.svg\'"></td>';
    html += '<td>' + escapeHtml(category) + '</td>';
    html += '<td>' + escapeHtml(product.brand) + '</td>';
    html += '<td>' + escapeHtml(product.model) + '</td>';
    html += '<td>' + specs + '</td>';
    html += '<td>' + formatPrice(product.price) + '</td>';
    html += '<td><strong>' + escapeHtml(product.stock) + '</strong></td>';
    html += '<td><div class="action-btns">';
    html += '<button type="button" class="btn btn-outline icon-btn" onclick="editLaptop(\'' + escapeHtml(product.id) + '\')">Edit</button>';
    html += '<button type="button" class="btn btn-danger icon-btn" onclick="deleteLaptopHandler(\'' + escapeHtml(product.id) + '\')">Delete</button>';
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
        itemsHtml += escapeHtml(order.items[j].name) + ' x' + escapeHtml(order.items[j].qty) + '<br>';
      }
      html += '<tr>';
      html += '<td>' + escapeHtml(order.id) + '</td>';
      html += '<td>' + escapeHtml(order.customerName) + '</td>';
      html += '<td>' + escapeHtml(order.customerPhone) + '<br><small>' + escapeHtml(order.customerEmail) + '</small></td>';
      html += '<td>' + itemsHtml + '</td>';
      html += '<td>' + formatPrice(order.total) + '</td>';
      html += '<td>' + escapeHtml(order.paymentMethod) + '</td>';
      html += '<td><span class="badge ' + getStatusClass(currentStatus) + '">' + getStatusLabel(currentStatus) + '</span></td>';
      html += '<td><div class="action-btns">';
      html += '<select class="status-dropdown" onchange="changeOrderStatus(\'' + escapeHtml(order.id) + '\', this.value)" data-current="' + escapeHtml(currentStatus) + '">';
      html += '<option value="pending"' + (currentStatus === 'pending' ? ' selected' : '') + '>Pending</option>';
      html += '<option value="confirmed"' + (currentStatus === 'confirmed' ? ' selected' : '') + '>Confirmed</option>';
      html += '<option value="declined"' + (currentStatus === 'declined' ? ' selected' : '') + '>Declined</option>';
      html += '<option value="refund"' + (currentStatus === 'refund' ? ' selected' : '') + '>Refund</option>';
      html += '</select>';
      html += '<button type="button" class="btn btn-outline icon-btn" onclick="printInvoice(\'' + escapeHtml(order.id) + '\')">Print Invoice</button>';
      html += '<button type="button" class="btn btn-danger icon-btn" onclick="deleteOrderHandler(\'' + escapeHtml(order.id) + '\')">Delete</button>';
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
      showToast(res.error ? ('Failed to update status: ' + res.error) : 'Failed to update status', true);
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
      '<td>' + escapeHtml(it.name) + (it.brand ? ' (' + escapeHtml(it.brand) + ')' : '') + '</td>' +
      '<td style="text-align:center;">' + escapeHtml(it.qty) + '</td>' +
      '<td style="text-align:right;">' + formatPrice(it.price) + '</td>' +
      '<td style="text-align:right;">' + formatPrice(it.subtotal) + '</td>' +
      '</tr>';
  }

  var invoiceHtml = '<!DOCTYPE html><html><head><title>Invoice ' + escapeHtml(order.id) + '</title>' +
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
    '<div><div class="company-name">Laptop Valley</div><p style="color:#64748b; font-size:0.85rem;">Pakistan`s Premium Laptop & Tech Store</p></div>' +
    '<div><div class="invoice-title">INVOICE</div><p style="color:#64748b; font-size:0.85rem;">Order ID: ' + escapeHtml(order.id) + '</p><p style="color:#64748b; font-size:0.85rem;">Date: ' + new Date(order.date).toLocaleDateString() + '</p></div>' +
    '</div>' +
    '<div class="info-grid">' +
    '<div class="info-block">' +
    '<h4>Billed To</h4>' +
    '<p><strong>' + escapeHtml(order.customerName) + '</strong></p>' +
    '<p>' + escapeHtml(order.address) + '</p>' +
    '<p>' + escapeHtml(order.city) + ' - ' + escapeHtml(order.pin) + '</p>' +
    '<p>Phone: ' + escapeHtml(order.customerPhone) + '</p>' +
    '<p>Email: ' + escapeHtml(order.customerEmail) + '</p>' +
    '</div>' +
    '<div class="info-block" style="text-align:right;">' +
    '<h4>Payment Info</h4>' +
    '<p>Method: ' + escapeHtml(order.paymentMethod) + '</p>' +
    '<p>Status: <span class="status-badge">' + statusLabel + '</span></p>' +
    (order.notes ? '<p style="margin-top:8px;">Notes: ' + escapeHtml(order.notes) + '</p>' : '') +
    '</div>' +
    '</div>' +
    '<table>' +
    '<thead><tr><th>#</th><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr></thead>' +
    '<tbody>' + itemsRows + '</tbody>' +
    '</table>' +
    '<div class="total-row">Total Amount: ' + formatPrice(order.total) + '</div>' +
    '<div class="footer-note">' +
    '<p>Thank you for shopping with Laptop Valley!</p>' +
    '<p>For queries, contact us at +92-330-0002529, +92-302-1104868 or contact@laptopvalley.pk</p>' +
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
  }).catch(function(err) {
    console.error('Failed to load admin inventory:', err);
    showToast(err.message || 'Could not load products from server.', true);
    renderLaptopTable();
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
  syncProductFormMode();

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
