var DETAIL_IMAGE_INDEX = 0;
var DETAIL_IMAGE_LIST = [];
var DETAIL_LAPTOP_ID = '';

function escapeStoreHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function productCategory(product) {
  return product && product.category ? product.category : 'Laptop';
}

function productSubcategory(product) {
  return product && product.subcategory ? product.subcategory : (productCategory(product) === 'Laptop' ? 'Laptop' : (productCategory(product) === 'Desktop PC' ? 'Custom Build' : 'Accessory'));
}

function renderLaptops(products) {
  var grid = document.getElementById('laptopGrid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">No products found.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < products.length; i++) {
    var product = products[i];
    var category = productCategory(product);
    var available = getAvailableStock(product.id);

    var stockLabel = '';
    var stockClass = '';
    if (available === 0) {
      stockLabel = 'Out of Stock'; stockClass = 'out-stock';
    } else if (available <= 3) {
      stockLabel = 'Only ' + available + ' left'; stockClass = 'low-stock';
    } else {
      stockLabel = available + ' In Stock'; stockClass = 'in-stock';
    }

    var specItems = [];
    if (category === 'Laptop') {
      specItems.push(product.processorModel);
      specItems.push((product.ramSize || '') + ' ' + (product.ramType || ''));
      specItems.push((product.storageCapacity || '') + ' ' + (product.storageType || ''));
      specItems.push((product.displaySize || '') + ' ' + (product.displayResolution || ''));
    } else if (category === 'Desktop PC') {
      specItems.push(product.desktopProcessorModel || product.processorModel);
      specItems.push((product.desktopRamSize || product.ramSize || '') + ' ' + (product.desktopRamType || product.ramType || ''));
      specItems.push((product.desktopStorageCapacity || product.storageCapacity || '') + ' ' + (product.desktopStorageType || product.storageType || ''));
      if (product.desktopGraphics || product.graphics) specItems.push(product.desktopGraphics || product.graphics);
    } else {
      specItems.push(productSubcategory(product));
      if (product.warranty) specItems.push('Warranty: ' + product.warranty);
      specItems.push('In stock: ' + available);
    }

    html += '<div class="laptop-card">';
    html += '<div class="laptop-img"><img src="' + escapeStoreHtml(getLaptopPrimaryImage(product)) + '" alt="' + escapeStoreHtml(product.model) + '" onerror="this.src=\'assets/laptop-placeholder.svg\'"></div>';
    html += '<div class="laptop-info">';
    html += '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">';
    html += '<div class="laptop-brand">' + escapeStoreHtml(product.brand) + '</div>';
    html += '<span style="font-size:0.7rem; padding:4px 8px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-weight:700;">' + escapeStoreHtml(category) + '</span>';
    html += '</div>';
    html += '<div class="laptop-name">' + escapeStoreHtml(product.model) + '</div>';
    html += '<ul class="laptop-specs">';
    for (var s = 0; s < specItems.length; s++) {
      if (specItems[s]) html += '<li>' + escapeStoreHtml(specItems[s]) + '</li>';
    }
    html += '</ul>';
    html += '<div class="laptop-price-row">';
    html += '<span class="laptop-price">' + formatPrice(product.price) + '</span>';
    html += '<span class="stock-badge ' + stockClass + '">' + stockLabel + '</span>';
    html += '</div>';
    html += '<div class="laptop-actions">';
    html += '<button class="btn btn-outline" onclick="viewDetails(\'' + escapeStoreHtml(product.id) + '\')">Details</button>';
    html += '<button class="btn btn-primary" onclick="addToCartHandler(\'' + escapeStoreHtml(product.id) + '\')" ' + (available === 0 ? 'disabled' : '') + '>Add to Cart</button>';
    html += '</div></div></div>';
  }
  grid.innerHTML = html;
}

function loadBrandFilter() {
  var products = getLaptops();
  var brands = [];
  for (var i = 0; i < products.length; i++) {
    if (products[i].brand && brands.indexOf(products[i].brand) === -1) brands.push(products[i].brand);
  }
  brands.sort();

  var select = document.getElementById('filterBrand');
  if (!select) return;

  // Brand list unchanged since last time: don't touch the dropdown at all
  var signature = brands.join('|');
  if (select.getAttribute('data-brands') === signature) return;

  var previous = select.value;
  select.innerHTML = '<option value="">All Brands</option>';
  for (var j = 0; j < brands.length; j++) {
    var opt = document.createElement('option');
    opt.value = brands[j];
    opt.textContent = brands[j];
    select.appendChild(opt);
  }
  select.value = brands.indexOf(previous) !== -1 ? previous : '';
  select.setAttribute('data-brands', signature);
}

function syncStoreFilters() {
  var categoryEl = document.getElementById('filterCategory');
  var ramEl = document.getElementById('filterRam');
  var category = categoryEl ? categoryEl.value : '';
  if (ramEl) ramEl.style.display = category === 'Accessories' ? 'none' : '';
  var title = document.getElementById('shopTitle');
  if (title) {
    title.textContent = category === 'Laptop' ? 'Available Laptops' : (category === 'Desktop PC' ? 'Available Desktop PCs' : (category === 'Accessories' ? 'Available Accessories' : 'Available Products'));
  }
}

function applyFilters() {
  var products = getLaptops();
  var brandEl = document.getElementById('filterBrand');
  var categoryEl = document.getElementById('filterCategory');
  var ramEl = document.getElementById('filterRam');
  var sortEl = document.getElementById('sortPrice');
  var searchEl = document.getElementById('searchBox');
  var brand = brandEl ? brandEl.value : '';
  var category = categoryEl ? categoryEl.value : '';
  var ram = ramEl ? ramEl.value : '';
  var sort = sortEl ? sortEl.value : '';
  var search = searchEl ? searchEl.value.toLowerCase().trim() : '';

  var filtered = [];
  for (var i = 0; i < products.length; i++) {
    var product = products[i];
    var match = true;
    if (brand && product.brand !== brand) match = false;
    if (category && productCategory(product) !== category) match = false;
    if (ram) {
      var categoryForRam = productCategory(product);
      var productRam = categoryForRam === 'Desktop PC' ? (product.desktopRamSize || product.ramSize) : product.ramSize;
      if (categoryForRam === 'Accessories' || (categoryForRam !== 'Laptop' && categoryForRam !== 'Desktop PC') || productRam !== ram) match = false;
    }
    if (search) {
      var haystack = [product.model, product.brand, product.subcategory, product.category, product.description].join(' ').toLowerCase();
      if (haystack.indexOf(search) === -1) match = false;
    }
    if (match) filtered.push(product);
  }

  if (sort === 'low') filtered.sort(function(a, b) { return Number(a.price) - Number(b.price); });
  if (sort === 'high') filtered.sort(function(a, b) { return Number(b.price) - Number(a.price); });

  syncStoreFilters();
  renderLaptops(filtered);
}

function viewDetails(id) {
  var product = getLaptopById(id);
  if (!product) return;

  DETAIL_LAPTOP_ID = id;
  DETAIL_IMAGE_LIST = getLaptopImages(product);
  DETAIL_IMAGE_INDEX = 0;

  var available = getAvailableStock(id);
  var stockText = '';
  var stockClass = '';
  if (available === 0) { stockText = 'Out of Stock'; stockClass = 'out-stock'; }
  else if (available <= 3) { stockText = 'Only ' + available + ' units left'; stockClass = 'low-stock'; }
  else { stockText = available + ' units available'; stockClass = 'in-stock'; }

  if (!DETAIL_IMAGE_LIST.length) DETAIL_IMAGE_LIST = ['assets/laptop-placeholder.svg'];

  var category = productCategory(product);
  var html = '<div class="detail-grid">';
  html += '<div class="detail-gallery">';
  html += '<button type="button" class="gallery-arrow gallery-prev" onclick="changeDetailImage(-1)" aria-label="Previous image">&#10094;</button>';
  html += '<div class="detail-gallery-main"><img id="detailMainImage" src="' + escapeStoreHtml(DETAIL_IMAGE_LIST[0]) + '" alt="' + escapeStoreHtml(product.model) + '" onerror="this.src=\'assets/laptop-placeholder.svg\'"></div>';
  html += '<button type="button" class="gallery-arrow gallery-next" onclick="changeDetailImage(1)" aria-label="Next image">&#10095;</button>';
  html += '<div class="detail-gallery-counter" id="detailImageCounter"></div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="laptop-brand">' + escapeStoreHtml(product.brand) + ' · ' + escapeStoreHtml(productSubcategory(product)) + '</div>';
  html += '<h2 style="margin:8px 0;">' + escapeStoreHtml(product.model) + '</h2>';
  html += '<div class="laptop-price" style="font-size:1.8rem;">' + formatPrice(product.price) + '</div>';
  html += '<p style="margin:12px 0; color:#64748b; font-size:0.9rem;">' + escapeStoreHtml(product.description || '') + '</p>';
  html += '<span class="stock-badge ' + stockClass + '">' + escapeStoreHtml(stockText) + '</span>';
  html += '</div></div>';

  html += '<h3 style="margin-top:20px; color:#1e40af;">Product Details</h3>';
  html += '<table class="spec-table">';
  html += '<tr><td>Category</td><td>' + escapeStoreHtml(category) + '</td></tr>';
  html += '<tr><td>Subcategory</td><td>' + escapeStoreHtml(productSubcategory(product)) + '</td></tr>';
  html += '<tr><td>Brand</td><td>' + escapeStoreHtml(product.brand) + '</td></tr>';
  if (category === 'Laptop') {
    html += '<tr><td>Processor</td><td>' + escapeStoreHtml((product.processorBrand || '') + ' ' + (product.processorModel || '')) + '</td></tr>';
    html += '<tr><td>RAM</td><td>' + escapeStoreHtml((product.ramSize || '') + ' ' + (product.ramType || '')) + '</td></tr>';
    html += '<tr><td>Storage</td><td>' + escapeStoreHtml((product.storageCapacity || '') + ' ' + (product.storageType || '')) + '</td></tr>';
    html += '<tr><td>Display</td><td>' + escapeStoreHtml((product.displaySize || '') + ' - ' + (product.displayResolution || '') + ' (' + (product.displayType || '') + ')') + '</td></tr>';
    html += '<tr><td>Graphics</td><td>' + escapeStoreHtml(product.graphics || '') + '</td></tr>';
    html += '<tr><td>Operating System</td><td>' + escapeStoreHtml(product.os || '') + '</td></tr>';
    html += '<tr><td>Battery</td><td>' + escapeStoreHtml(product.battery || '') + '</td></tr>';
    html += '<tr><td>Weight</td><td>' + escapeStoreHtml(product.weight || '') + '</td></tr>';
    html += '<tr><td>Color</td><td>' + escapeStoreHtml(product.color || '') + '</td></tr>';
  } else if (category === 'Desktop PC') {
    html += '<tr><td>Processor</td><td>' + escapeStoreHtml((product.desktopProcessorBrand || product.processorBrand || '') + ' ' + (product.desktopProcessorModel || product.processorModel || '')) + '</td></tr>';
    html += '<tr><td>RAM</td><td>' + escapeStoreHtml((product.desktopRamSize || product.ramSize || '') + ' ' + (product.desktopRamType || product.ramType || '')) + '</td></tr>';
    html += '<tr><td>Storage</td><td>' + escapeStoreHtml((product.desktopStorageCapacity || product.storageCapacity || '') + ' ' + (product.desktopStorageType || product.storageType || '')) + '</td></tr>';
    html += '<tr><td>Graphics</td><td>' + escapeStoreHtml(product.desktopGraphics || product.graphics || '') + '</td></tr>';
    html += '<tr><td>Motherboard</td><td>' + escapeStoreHtml(product.desktopMotherboard || '') + '</td></tr>';
    html += '<tr><td>Power Supply</td><td>' + escapeStoreHtml(product.desktopPsu || '') + '</td></tr>';
    html += '<tr><td>Case / Form Factor</td><td>' + escapeStoreHtml(product.desktopCaseType || '') + '</td></tr>';
    html += '<tr><td>Cooling</td><td>' + escapeStoreHtml(product.desktopCooling || '') + '</td></tr>';
    html += '<tr><td>Operating System</td><td>' + escapeStoreHtml(product.desktopOs || product.os || '') + '</td></tr>';
  }
  html += '<tr><td>Warranty</td><td>' + escapeStoreHtml(product.warranty || 'No Warranty') + '</td></tr>';
  html += '</table>';
  html += '<button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="addToCartHandler(\'' + escapeStoreHtml(product.id) + '\'); closeModal();" ' + (available === 0 ? 'disabled' : '') + '>Add to Cart - ' + formatPrice(product.price) + '</button>';

  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('detailModal').classList.add('active');
  updateDetailImageControls();
}

function updateDetailImageControls() {
  var img = document.getElementById('detailMainImage');
  if (!img || !DETAIL_IMAGE_LIST.length) return;
  img.src = DETAIL_IMAGE_LIST[DETAIL_IMAGE_INDEX];
  var counter = document.getElementById('detailImageCounter');
  if (counter) counter.textContent = 'Image ' + (DETAIL_IMAGE_INDEX + 1) + ' of ' + DETAIL_IMAGE_LIST.length;
  var prev = document.querySelector('.gallery-prev');
  var next = document.querySelector('.gallery-next');
  var disabled = DETAIL_IMAGE_LIST.length <= 1;
  if (prev) { prev.disabled = disabled; prev.style.visibility = disabled ? 'hidden' : 'visible'; }
  if (next) { next.disabled = disabled; next.style.visibility = disabled ? 'hidden' : 'visible'; }
}

function changeDetailImage(direction) {
  if (DETAIL_IMAGE_LIST.length <= 1) return;
  DETAIL_IMAGE_INDEX += direction;
  if (DETAIL_IMAGE_INDEX < 0) DETAIL_IMAGE_INDEX = DETAIL_IMAGE_LIST.length - 1;
  if (DETAIL_IMAGE_INDEX >= DETAIL_IMAGE_LIST.length) DETAIL_IMAGE_INDEX = 0;
  updateDetailImageControls();
}

function closeModal() { document.getElementById('detailModal').classList.remove('active'); }
function showToast(msg, isError) {
  var toast = document.getElementById('toast'); if (!toast) return;
  toast.textContent = msg; toast.className = 'toast' + (isError ? ' error' : ''); toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 2500);
}
function showOutOfStockPopup(modelName) {
  var textEl = document.getElementById('stockModalText');
  if (textEl) textEl.textContent = modelName ? modelName + ' is currently out of stock. Please wait for restock by seller.' : 'This product is currently out of stock. Please wait for restock by seller.';
  var modal = document.getElementById('stockModal'); if (modal) modal.classList.add('active');
}
function closeStockModal() { var modal = document.getElementById('stockModal'); if (modal) modal.classList.remove('active'); }
function addToCartHandler(id) {
  var product = getLaptopById(id); if (!product) return;
  var available = getAvailableStock(id);
  if (available <= 0) { showOutOfStockPopup(product.model); renderLaptops(getLaptops()); return; }
  addToCart(id, 1); updateCartBadge(); renderCartSidebar(); renderLaptops(getLaptops());
  showToast('Added to cart! ' + (available - 1) + ' left in stock');
}
function applyUrlCategoryFilter() {
  var category = '';
  var rawHash = window.location.hash.replace(/^#/, '');
  if (rawHash.indexOf('?') !== -1) {
    category = new URLSearchParams(rawHash.split('?')[1] || '').get('category') || '';
  }
  if (!category) {
    var params = new URLSearchParams(window.location.search);
    category = params.get('category') || '';
  }
  var categoryEl = document.getElementById('filterCategory');
  if (!categoryEl) return;
  var allowed = ['Laptop', 'Accessories', 'Desktop PC'];
  categoryEl.value = allowed.indexOf(category) !== -1 ? category : '';
}

function refreshStoreData() {
  DB.fetchLaptops().then(function() {
    validateCart(); loadBrandFilter(); applyUrlCategoryFilter(); applyFilters(); updateCartBadge();
  }).catch(function(err) {
    console.error('Failed to load products:', err);
    var grid = document.getElementById('laptopGrid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px; color:#dc2626;">Could not load products. Please refresh the page.</p>';
  });
}

document.addEventListener('DOMContentLoaded', function() {
  refreshStoreData();
  setInterval(function() {
    DB.fetchLaptops().then(function() { validateCart(); loadBrandFilter(); applyFilters(); updateCartBadge(); })
      .catch(function(err) { console.error('Live inventory refresh failed:', err); });
  }, 7000);
});
