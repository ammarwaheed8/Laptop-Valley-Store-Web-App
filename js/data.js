var DEFAULT_LAPTOPS = [
  {
    id: "lp001",
    brand: "Dell",
    model: "XPS 15 9530",
    processorBrand: "Intel",
    processorModel: "Core i7-13700H",
    ramSize: "16GB",
    ramType: "DDR5",
    storageType: "SSD",
    storageCapacity: "512GB",
    displaySize: "15.6 inch",
    displayResolution: "FHD+ 1920x1200",
    displayType: "IPS",
    graphics: "NVIDIA RTX 4050 6GB",
    os: "Windows 11 Home",
    battery: "86Wh, up to 13 hrs",
    weight: "1.86 kg",
    color: "Platinum Silver",
    warranty: "1 Year",
    price: 425000,
    stock: 8,
    image: "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=500",
    description: "Premium build with stunning display, powerful performance for creators and professionals."
  },
  {
    id: "lp002",
    brand: "Apple",
    model: "MacBook Air M2",
    processorBrand: "Apple",
    processorModel: "Apple M2 8-core",
    ramSize: "8GB",
    ramType: "Unified Memory",
    storageType: "SSD",
    storageCapacity: "256GB",
    displaySize: "13.6 inch",
    displayResolution: "Retina 2560x1664",
    displayType: "IPS",
    graphics: "Apple 8-core GPU Integrated",
    os: "macOS",
    battery: "Up to 18 hrs",
    weight: "1.24 kg",
    color: "Midnight",
    warranty: "1 Year",
    price: 335000,
    stock: 12,
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500",
    description: "Incredibly thin and light, powered by the efficient M2 chip with all day battery life."
  },
  {
    id: "lp003",
    brand: "ASUS",
    model: "ROG Strix G16",
    processorBrand: "Intel",
    processorModel: "Core i9-13980HX",
    ramSize: "32GB",
    ramType: "DDR5",
    storageType: "SSD",
    storageCapacity: "1TB",
    displaySize: "16 inch",
    displayResolution: "QHD+ 240Hz",
    displayType: "IPS",
    graphics: "NVIDIA RTX 4070 8GB",
    os: "Windows 11 Home",
    battery: "90Wh",
    weight: "2.5 kg",
    color: "Eclipse Gray",
    warranty: "2 Years",
    price: 585000,
    stock: 5,
    image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500",
    description: "Ultimate gaming powerhouse with high refresh rate display and top tier cooling."
  },
  {
    id: "lp004",
    brand: "HP",
    model: "Pavilion 15",
    processorBrand: "AMD",
    processorModel: "Ryzen 5 7530U",
    ramSize: "8GB",
    ramType: "DDR4",
    storageType: "SSD",
    storageCapacity: "512GB",
    displaySize: "15.6 inch",
    displayResolution: "FHD 1920x1080",
    displayType: "IPS",
    graphics: "AMD Radeon Graphics Integrated",
    os: "Windows 11 Home",
    battery: "41Wh, up to 8 hrs",
    weight: "1.75 kg",
    color: "Natural Silver",
    warranty: "1 Year",
    price: 165000,
    stock: 15,
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500",
    description: "Reliable everyday laptop perfect for students and home office use."
  }
];

function getLaptops() {
  var data = localStorage.getItem('lv_laptops');
  if (!data) {
    localStorage.setItem('lv_laptops', JSON.stringify(DEFAULT_LAPTOPS));
    return DEFAULT_LAPTOPS.slice();
  }
  try {
    var parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) throw new Error('Invalid data');
    return parsed;
  } catch (e) {
    localStorage.setItem('lv_laptops', JSON.stringify(DEFAULT_LAPTOPS));
    return DEFAULT_LAPTOPS.slice();
  }
}

function saveLaptops(laptops) {
  localStorage.setItem('lv_laptops', JSON.stringify(laptops));
}

function addLaptop(laptop) {
  var laptops = getLaptops();
  laptop.id = 'lp' + Date.now();
  laptops.push(laptop);
  saveLaptops(laptops);
  return laptop;
}

function updateLaptop(id, updated) {
  var laptops = getLaptops();
  for (var i = 0; i < laptops.length; i++) {
    if (laptops[i].id === id) {
      updated.id = id;
      laptops[i] = updated;
    }
  }
  saveLaptops(laptops);
}

function deleteLaptop(id) {
  var laptops = getLaptops();
  var filtered = [];
  for (var i = 0; i < laptops.length; i++) {
    if (laptops[i].id !== id) filtered.push(laptops[i]);
  }
  saveLaptops(filtered);
}

function getLaptopById(id) {
  var laptops = getLaptops();
  for (var i = 0; i < laptops.length; i++) {
    if (laptops[i].id === id) return laptops[i];
  }
  return null;
}

function getCart() {
  var cart = localStorage.getItem('lv_cart');
  if (!cart) return [];
  try {
    var parsed = JSON.parse(cart);
    if (!Array.isArray(parsed)) return [];
    return parsed;
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

// ---- SELF-HEALING CART VALIDATION ----
// Runs automatically on every page load to fix any corrupted/stale cart data.
// - Removes cart items for laptops that no longer exist
// - Caps quantity to available stock (in case stock was reduced/laptop edited)
// - Removes duplicate entries for same laptop id
// - Removes zero or negative quantities
function validateCart() {
  var cart = getCart();
  var laptops = getLaptops();
  var mergedMap = {};

  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    if (!item || !item.id || typeof item.qty !== 'number' || item.qty <= 0) continue;

    var lp = null;
    for (var j = 0; j < laptops.length; j++) {
      if (laptops[j].id === item.id) lp = laptops[j];
    }

    if (!lp) continue; // laptop deleted, skip

    var qty = item.qty;
    if (mergedMap[item.id]) {
      qty = mergedMap[item.id] + item.qty; // merge duplicate entries
    }

    if (qty > lp.stock) qty = lp.stock; // cap to available stock
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
  var laptops = getLaptops();
  var total = 0;
  for (var i = 0; i < cart.length; i++) {
    for (var j = 0; j < laptops.length; j++) {
      if (laptops[j].id === cart[i].id) {
        total += laptops[j].price * cart[i].qty;
      }
    }
  }
  return total;
}

function getCartCount() {
  var cart = getCart();
  var count = 0;
  for (var i = 0; i < cart.length; i++) count += cart[i].qty;
  return count;
}

function getOrders() {
  var orders = localStorage.getItem('lv_orders');
  if (!orders) return [];
  try {
    var parsed = JSON.parse(orders);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem('lv_orders', JSON.stringify(orders));
}

function addOrder(order) {
  var orders = getOrders();
  order.id = 'ORD' + Date.now();
  order.date = new Date().toISOString();
  order.status = 'pending';
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

function updateOrderStatus(orderId, status) {
  var orders = getOrders();
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) orders[i].status = status;
  }
  saveOrders(orders);
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