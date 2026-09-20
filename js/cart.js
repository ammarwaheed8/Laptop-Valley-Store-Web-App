function updateCartBadge() {
  validateCart();
  var el = document.getElementById('cartCount');
  if (el) el.textContent = getCartCount();
}

function toggleCart() {
  document.getElementById('cartSidebar').classList.toggle('active');
  document.getElementById('overlayBg').classList.toggle('active');
  renderCartSidebar();
}

function renderCartSidebar() {
  validateCart();
  var cart = getCart();
  var laptops = getLaptops();
  var container = document.getElementById('cartItemsContainer');
  var footer = document.getElementById('cartFooter');
  if (!container || !footer) return;

  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
    footer.innerHTML = '';
    updateCartBadge();
    return;
  }

  var html = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var lp = null;
    for (var j = 0; j < laptops.length; j++) {
      if (laptops[j].id === item.id) lp = laptops[j];
    }
    if (!lp) continue;

    var atMaxStock = item.qty >= lp.stock;

    html += '<div class="cart-item">';
    html += '<img src="' + lp.image + '" onerror="this.src=\'https://via.placeholder.com/70\'">';
    html += '<div class="cart-item-info">';
    html += '<h4>' + lp.model + '</h4>';
    html += '<div class="cart-item-price">' + formatPrice(lp.price) + '</div>';
    html += '<div class="qty-controls">';
    html += '<button onclick="changeQty(\'' + lp.id + '\', ' + (item.qty - 1) + ')">-</button>';
    html += '<span>' + item.qty + '</span>';
    html += '<button onclick="changeQty(\'' + lp.id + '\', ' + (item.qty + 1) + ')" ' + (atMaxStock ? 'disabled' : '') + '>+</button>';
    html += '</div>';
    if (atMaxStock) {
      html += '<div style="font-size:0.75rem; color:#ef4444; margin-top:4px;">Maximum stock reached</div>';
    }
    html += '<span class="remove-item" onclick="removeItem(\'' + lp.id + '\')">Remove</span>';
    html += '</div></div>';
  }
  container.innerHTML = html;

  var total = getCartTotal();
  footer.innerHTML = '<div class="cart-total-row"><span>Total:</span><span>' + formatPrice(total) + '</span></div>' +
    '<a href="checkout.html" class="btn btn-primary btn-block" style="text-align:center; display:block;">Proceed to Checkout</a>';

  updateCartBadge();
}

function changeQty(id, newQty) {
  var lp = getLaptopById(id);
  if (!lp) return;

  if (newQty > lp.stock) {
    if (typeof showOutOfStockPopup === 'function') {
      showOutOfStockPopup(lp.model);
    }
    return;
  }

  if (newQty <= 0) {
    removeItem(id);
    return;
  }

  updateCartQty(id, newQty);
  updateCartBadge();
  renderCartSidebar();

  if (typeof renderLaptops === 'function' && document.getElementById('laptopGrid')) {
    renderLaptops(getLaptops());
  }
}

function removeItem(id) {
  removeFromCart(id);
  updateCartBadge();
  renderCartSidebar();

  if (typeof renderLaptops === 'function' && document.getElementById('laptopGrid')) {
    renderLaptops(getLaptops());
  }
}