var EMAILJS_PUBLIC_KEY = "JJp5Iruhyn8-EVRb2";
var EMAILJS_SERVICE_ID = "service_sj761t8";
var EMAILJS_TEMPLATE_ID = "template_clvct8d";
var STORE_EMAIL = "laptop-valley@outlook.com";

try {
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }
} catch (e) {
  console.error('EmailJS init failed', e);
}

function renderOrderSummary() {
  var cart = getCart();
  var container = document.getElementById('orderItemsSummary');

  if (cart.length === 0) {
    window.location.href = 'index.html';
    return;
  }

  var html = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var lp = getLaptopById(item.id);
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
    var items = [];
    for (var i = 0; i < cart.length; i++) {
      var lp = getLaptopById(cart[i].id);
      if (lp) {
        items.push({
          id: lp.id,
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
      total: getCartTotal()
    };

    var btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Processing with Live Database...';

    // 1. Submit order to PHP/SQLite server database
    DB.createOrder(orderData).then(function(res) {
      if (!res.success) {
        btn.disabled = false;
        btn.textContent = 'Place Order';
        showToast(res.error || 'Failed to place order. Out of stock!', true);
        return;
      }

      var orderId = res.orderId;
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

      clearCart();

      // 2. Send email notification via EmailJS
      if (typeof emailjs !== 'undefined') {
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
          .then(function() {
            showOrderSuccess(orderId, orderData, false);
          })
          .catch(function(err) {
            console.error('Email failed:', err);
            showOrderSuccess(orderId, orderData, true);
          });
      } else {
        showOrderSuccess(orderId, orderData, true);
      }
    }).catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Place Order';
      showToast('Server error. Please try again.', true);
    });
  });
}

function showOrderSuccess(orderId, orderData, emailFailed) {
  var wrapper = document.querySelector('.checkout-wrapper');
  var html = '<div class="card" style="grid-column:1/-1; text-align:center; padding:60px 30px;">';
  html += '<h2 style="color:#1e40af; margin:20px 0 10px;">Order Placed Successfully!</h2>';
  html += '<p style="color:#64748b; margin-bottom:20px;">Order ID: <strong>' + orderId + '</strong></p>';
  html += '<p style="max-width:500px; margin:0 auto 20px; color:#64748b;">Thank you, ' + orderData.customerName + '! Your order for <strong>' + formatPrice(orderData.total) + '</strong> has been saved to the database. Our team will contact you at <strong>' + orderData.customerPhone + '</strong> via Call or WhatsApp within 24 hours to confirm the details.</p>';
  if (emailFailed) {
    html += '<p style="color:#ef4444; font-size:0.85rem;">Note: Confirmation email may be delayed, but your order is safely saved in the server database.</p>';
  }
  html += '<a href="index.html" class="btn btn-primary" style="margin-top:15px; display:inline-block;">Continue Shopping</a>';
  html += '</div>';
  wrapper.innerHTML = html;
}

// Initial fetch from live database before rendering checkout
DB.fetchLaptops().then(function() {
  validateCart();
  renderOrderSummary();
});
