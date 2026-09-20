var EMAILJS_PUBLIC_KEY = "3ti2fYTvCCe8bkNor";
var EMAILJS_SERVICE_ID = "service_fyhhn57";
var EMAILJS_TEMPLATE_ID = "template_0aa5n4b";
var STORE_EMAIL = "ammarwaheed898@gmail.com";

try {
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }
} catch (e) {
  console.error('EmailJS init failed', e);
}

function renderOrderSummary() {
  var cart = getCart();
  var laptops = getLaptops();
  var container = document.getElementById('orderItemsSummary');

  if (cart.length === 0) {
    window.location.href = 'index.html';
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
    html += '<div class="order-summary-item"><span>' + lp.model + ' x ' + item.qty + '</span><span>' + formatPrice(lp.price * item.qty) + '</span></div>';
  }
  container.innerHTML = html;
  document.getElementById('summaryTotal').textContent = formatPrice(getCartTotal());
}

function showToast(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 3000);
}

var checkoutFormEl = document.getElementById('checkoutForm');
if (checkoutFormEl) {
  checkoutFormEl.addEventListener('submit', function(e) {
    e.preventDefault();

    var cart = getCart();
    var laptops = getLaptops();
    var total = getCartTotal();

    var items = [];
    for (var i = 0; i < cart.length; i++) {
      var lp = null;
      for (var j = 0; j < laptops.length; j++) {
        if (laptops[j].id === cart[i].id) lp = laptops[j];
      }
      if (lp) {
        items.push({
          name: lp.model,
          brand: lp.brand,
          qty: cart[i].qty,
          price: lp.price,
          subtotal: lp.price * cart[i].qty
        });
      }
    }

    var orderData = {
      customerName: document.getElementById('custName').value,
      customerPhone: document.getElementById('custPhone').value,
      customerEmail: document.getElementById('custEmail').value,
      address: document.getElementById('custAddress').value,
      city: document.getElementById('custCity').value,
      pin: document.getElementById('custPin').value,
      paymentMethod: document.getElementById('paymentMethod').value,
      notes: document.getElementById('orderNotes').value,
      items: items,
      total: total
    };

    var btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing Order...';

    var itemsText = '';
    for (var k = 0; k < items.length; k++) {
      itemsText += items[k].name + ' (' + items[k].brand + ') x' + items[k].qty + ' - ' + formatPrice(items[k].subtotal) + '\n';
    }

    var templateParams = {
      to_email: STORE_EMAIL,
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone,
      customer_email: orderData.customerEmail,
      address: orderData.address + ', ' + orderData.city + ' - ' + orderData.pin,
      payment_method: orderData.paymentMethod,
      notes: orderData.notes || 'None',
      order_items: itemsText,
      total_amount: formatPrice(orderData.total),
      order_date: new Date().toLocaleString()
    };

    var savedOrder = addOrder(orderData);

    var allLaptops = getLaptops();
    for (var m = 0; m < allLaptops.length; m++) {
      for (var n = 0; n < items.length; n++) {
        if (allLaptops[m].model === items[n].name) {
          allLaptops[m].stock = Math.max(0, allLaptops[m].stock - items[n].qty);
        }
      }
    }
    saveLaptops(allLaptops);

    if (typeof emailjs !== 'undefined') {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
        .then(function() {
          clearCart();
          showOrderSuccess(savedOrder.id, orderData, false);
        })
        .catch(function(err) {
          console.error('Email failed:', err);
          clearCart();
          showOrderSuccess(savedOrder.id, orderData, true);
        });
    } else {
      clearCart();
      showOrderSuccess(savedOrder.id, orderData, true);
    }
  });
}

function showOrderSuccess(orderId, orderData, emailFailed) {
  var wrapper = document.querySelector('.checkout-wrapper');
  var html = '<div class="card" style="grid-column:1/-1; text-align:center; padding:60px 30px;">';
  html += '<h2 style="color:#1e40af; margin:20px 0 10px;">Order Placed Successfully!</h2>';
  html += '<p style="color:#64748b; margin-bottom:20px;">Order ID: <strong>' + orderId + '</strong></p>';
  html += '<p style="max-width:500px; margin:0 auto 20px; color:#64748b;">Thank you, ' + orderData.customerName + '! Your order for <strong>' + formatPrice(orderData.total) + '</strong> has been received. Our team will contact you at <strong>' + orderData.customerPhone + '</strong> via Call or WhatsApp within 24 hours to confirm the details.</p>';
  if (emailFailed) {
    html += '<p style="color:#ef4444; font-size:0.85rem;">Note: confirmation email may be delayed but your order is safely recorded.</p>';
  }
  html += '<a href="index.html" class="btn btn-primary" style="margin-top:15px; display:inline-block;">Continue Shopping</a>';
  html += '</div>';
  wrapper.innerHTML = html;
}

validateCart();
renderOrderSummary();