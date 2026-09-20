var ADMIN_USERNAME = "admin";
var ADMIN_PASSWORD = "admin123";

function showToast(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 2500);
}

function doLogin() {
  var userEl = document.getElementById('adminUser');
  var passEl = document.getElementById('adminPass');
  var errorEl = document.getElementById('loginError');

  var user = userEl.value;
  var pass = passEl.value;

  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    sessionStorage.setItem('lv_admin_logged', 'true');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    initAdminDashboard();
  } else {
    if (errorEl) errorEl.style.display = 'block';
    showToast('Invalid credentials', true);
  }
}

function doLogout() {
  sessionStorage.removeItem('lv_admin_logged');
  location.reload();
}

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

  if (!laptopData.brand || !laptopData.model || !laptopData.processorBrand ||
      !laptopData.processorModel || !laptopData.ramSize || !laptopData.ramType ||
      !laptopData.storageType || !laptopData.storageCapacity || !laptopData.displaySize ||
      !laptopData.displayResolution || !laptopData.displayType || !laptopData.graphics ||
      !laptopData.os || !laptopData.battery || !laptopData.weight || !laptopData.color ||
      !laptopData.warranty || !laptopData.image) {
    showToast('Please fill all required fields', true);
    return;
  }

  if (isNaN(laptopData.price) || laptopData.price <= 0) {
    showToast('Please enter a valid price', true);
    return;
  }

  if (isNaN(laptopData.stock) || laptopData.stock < 0) {
    showToast('Please enter a valid stock quantity', true);
    return;
  }

  var editId = document.getElementById('f_editId').value;

  if (editId) {
    updateLaptop(editId, laptopData);
    showToast('Laptop updated successfully');
  } else {
    addLaptop(laptopData);
    showToast('Laptop added successfully');
  }

  resetForm();
  renderLaptopTable();
  updateStats();
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
    deleteLaptop(id);
    renderLaptopTable();
    updateStats();
    showToast('Laptop deleted');
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
    html += '<td>' + lp.stock + '</td>';
    html += '<td><div class="action-btns">';
    html += '<button type="button" class="btn btn-outline icon-btn" onclick="editLaptop(\'' + lp.id + '\')">Edit</button>';
    html += '<button type="button" class="btn btn-danger icon-btn" onclick="deleteLaptopHandler(\'' + lp.id + '\')">Delete</button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function renderOrdersTable() {
  var orders = getOrders();
  var tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">No orders yet.</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
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
    html += '<td><span class="badge ' + (order.status === 'confirmed' ? 'badge-confirmed' : 'badge-pending') + '">' + order.status + '</span></td>';
    html += '<td><div class="action-btns">';
    if (order.status === 'pending') {
      html += '<button type="button" class="btn btn-success icon-btn" onclick="confirmOrder(\'' + order.id + '\')">Confirm</button>';
    }
    html += '<button type="button" class="btn btn-outline icon-btn" onclick="printInvoice(\'' + order.id + '\')">Print Invoice</button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function confirmOrder(orderId) {
  updateOrderStatus(orderId, 'confirmed');
  renderOrdersTable();
  updateStats();
  showToast('Order marked as confirmed');
}

// ---- PRINT INVOICE ----
function printInvoice(orderId) {
  var orders = getOrders();
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) order = orders[i];
  }
  if (!order) {
    showToast('Order not found', true);
    return;
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

  var statusColor = order.status === 'confirmed' ? '#dcfce7' : '#fef3c7';
  var statusTextColor = order.status === 'confirmed' ? '#166534' : '#92400e';

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
    '<p>Status: <span class="status-badge">' + order.status + '</span></p>' +
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
  var laptops = getLaptops();
  var orders = getOrders();
  var pending = 0;
  var revenue = 0;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].status === 'pending') pending++;
    revenue += orders[i].total;
  }

  document.getElementById('statLaptops').textContent = laptops.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statRevenue').textContent = formatPrice(revenue);
}

function initAdminDashboard() {
  updateStats();
  renderLaptopTable();
  renderOrdersTable();
}

document.addEventListener('DOMContentLoaded', function() {
  var loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

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

  if (sessionStorage.getItem('lv_admin_logged') === 'true') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    initAdminDashboard();
  }
});