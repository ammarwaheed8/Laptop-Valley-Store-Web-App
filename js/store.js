function renderLaptops(laptops) {
  var grid = document.getElementById('laptopGrid');
  if (!grid) return;

  if (laptops.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">No laptops found.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < laptops.length; i++) {
    var lp = laptops[i];
    var available = getAvailableStock(lp.id);

    var stockLabel = '';
    var stockClass = '';

    if (available === 0) {
      stockLabel = 'Out of Stock';
      stockClass = 'out-stock';
    } else if (available <= 3) {
      stockLabel = 'Only ' + available + ' left';
      stockClass = 'low-stock';
    } else {
      stockLabel = available + ' In Stock';
      stockClass = 'in-stock';
    }

    html += '<div class="laptop-card">';
    html += '<div class="laptop-img"><img src="' + lp.image + '" alt="' + lp.model + '" onerror="this.src=\'https://via.placeholder.com/300x200?text=Laptop\'"></div>';
    html += '<div class="laptop-info">';
    html += '<div class="laptop-brand">' + lp.brand + '</div>';
    html += '<div class="laptop-name">' + lp.model + '</div>';
    html += '<ul class="laptop-specs">';
    html += '<li>' + lp.processorModel + '</li>';
    html += '<li>' + lp.ramSize + ' ' + lp.ramType + '</li>';
    html += '<li>' + lp.storageCapacity + ' ' + lp.storageType + '</li>';
    html += '<li>' + lp.displaySize + ' ' + lp.displayResolution + '</li>';
    html += '</ul>';
    html += '<div class="laptop-price-row">';
    html += '<span class="laptop-price">' + formatPrice(lp.price) + '</span>';
    html += '<span class="stock-badge ' + stockClass + '">' + stockLabel + '</span>';
    html += '</div>';
    html += '<div class="laptop-actions">';
    html += '<button class="btn btn-outline" onclick="viewDetails(\'' + lp.id + '\')">Details</button>';
    html += '<button class="btn btn-primary" onclick="addToCartHandler(\'' + lp.id + '\')" ' + (available === 0 ? 'disabled' : '') + '>Add to Cart</button>';
    html += '</div></div></div>';
  }
  grid.innerHTML = html;
}

function loadBrandFilter() {
  var laptops = getLaptops();
  var brands = [];
  for (var i = 0; i < laptops.length; i++) {
    if (brands.indexOf(laptops[i].brand) === -1) brands.push(laptops[i].brand);
  }
  var select = document.getElementById('filterBrand');
  if (!select) return;
  for (var j = 0; j < brands.length; j++) {
    var opt = document.createElement('option');
    opt.value = brands[j];
    opt.textContent = brands[j];
    select.appendChild(opt);
  }
}

function applyFilters() {
  var laptops = getLaptops();
  var brand = document.getElementById('filterBrand').value;
  var ram = document.getElementById('filterRam').value;
  var sort = document.getElementById('sortPrice').value;
  var search = document.getElementById('searchBox').value.toLowerCase();

  var filtered = [];
  for (var i = 0; i < laptops.length; i++) {
    var lp = laptops[i];
    var match = true;
    if (brand && lp.brand !== brand) match = false;
    if (ram && lp.ramSize !== ram) match = false;
    if (search && lp.model.toLowerCase().indexOf(search) === -1 && lp.brand.toLowerCase().indexOf(search) === -1) match = false;
    if (match) filtered.push(lp);
  }

  if (sort === 'low') filtered.sort(function(a, b) { return a.price - b.price; });
  if (sort === 'high') filtered.sort(function(a, b) { return b.price - a.price; });

  renderLaptops(filtered);
}

function viewDetails(id) {
  var lp = getLaptopById(id);
  if (!lp) return;

  var available = getAvailableStock(id);
  var stockText = '';
  var stockClass = '';

  if (available === 0) {
    stockText = 'Out of Stock';
    stockClass = 'out-stock';
  } else if (available <= 3) {
    stockText = 'Only ' + available + ' units left';
    stockClass = 'low-stock';
  } else {
    stockText = available + ' units available';
    stockClass = 'in-stock';
  }

  var html = '<div class="detail-grid">';
  html += '<div><img src="' + lp.image + '" style="width:100%; border-radius:10px;" onerror="this.src=\'https://via.placeholder.com/300x200\'"></div>';
  html += '<div>';
  html += '<div class="laptop-brand">' + lp.brand + '</div>';
  html += '<h2 style="margin:8px 0;">' + lp.model + '</h2>';
  html += '<div class="laptop-price" style="font-size:1.8rem;">' + formatPrice(lp.price) + '</div>';
  html += '<p style="margin:12px 0; color:#64748b; font-size:0.9rem;">' + (lp.description || '') + '</p>';
  html += '<span class="stock-badge ' + stockClass + '">' + stockText + '</span>';
  html += '</div></div>';
  html += '<h3 style="margin-top:20px; color:#1e40af;">Full Specifications</h3>';
  html += '<table class="spec-table">';
  html += '<tr><td>Processor</td><td>' + lp.processorBrand + ' ' + lp.processorModel + '</td></tr>';
  html += '<tr><td>RAM</td><td>' + lp.ramSize + ' ' + lp.ramType + '</td></tr>';
  html += '<tr><td>Storage</td><td>' + lp.storageCapacity + ' ' + lp.storageType + '</td></tr>';
  html += '<tr><td>Display</td><td>' + lp.displaySize + ' - ' + lp.displayResolution + ' (' + lp.displayType + ')</td></tr>';
  html += '<tr><td>Graphics</td><td>' + lp.graphics + '</td></tr>';
  html += '<tr><td>Operating System</td><td>' + lp.os + '</td></tr>';
  html += '<tr><td>Battery</td><td>' + lp.battery + '</td></tr>';
  html += '<tr><td>Weight</td><td>' + lp.weight + '</td></tr>';
  html += '<tr><td>Color</td><td>' + lp.color + '</td></tr>';
  html += '<tr><td>Warranty</td><td>' + lp.warranty + '</td></tr>';
  html += '</table>';
  html += '<button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="addToCartHandler(\'' + lp.id + '\'); closeModal();" ' + (available === 0 ? 'disabled' : '') + '>Add to Cart - ' + formatPrice(lp.price) + '</button>';

  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('detailModal').classList.add('active');
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('active');
}

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('active');
}

function showToast(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 2500);
}

function showOutOfStockPopup(modelName) {
  var textEl = document.getElementById('stockModalText');
  if (textEl) {
    if (modelName) {
      textEl.textContent = modelName + ' is currently out of stock. Please wait for restock, our team is working on it.';
    } else {
      textEl.textContent = 'This laptop is currently out of stock. Please wait for restock.';
    }
  }
  var modal = document.getElementById('stockModal');
  if (modal) modal.classList.add('active');
}

function closeStockModal() {
  var modal = document.getElementById('stockModal');
  if (modal) modal.classList.remove('active');
}

function addToCartHandler(id) {
  var lp = getLaptopById(id);
  if (!lp) return;

  var available = getAvailableStock(id);

  if (available <= 0) {
    showOutOfStockPopup(lp.model);
    renderLaptops(getLaptops());
    return;
  }

  addToCart(id, 1);
  updateCartBadge();
  renderCartSidebar();
  renderLaptops(getLaptops());
  showToast('Added to cart! ' + (available - 1) + ' left in stock');
}

document.addEventListener('DOMContentLoaded', function() {
  validateCart();
  loadBrandFilter();
  renderLaptops(getLaptops());
  updateCartBadge();
});