<?php
// Only send the cookie over HTTPS when the site is actually being served over HTTPS,
// so this still works during local/plain-HTTP development.
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? '') == 443)
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $isHttps
]);
session_start();

// Thrown deliberately with a message that is safe to show the customer
// (stock issues, bad input, etc). Anything else gets logged server-side
// and only a generic message is sent to the client.
class OrderException extends Exception {}

function getClientIp() {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// ---- CSRF PROTECTION ----
// Every session gets a random token, sent back on every response as the
// X-CSRF-Token header. The client must echo it back on state-changing
// requests (order creation, admin writes) or they're rejected. SameSite=Lax
// already blocks the classic cross-site <form> attack, but this covers the
// remaining gaps (older browsers, non-navigation cross-site requests) too.
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
header('X-CSRF-Token: ' . $_SESSION['csrf_token']);

function requireCsrfToken($input) {
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($input['csrfToken'] ?? '');
    if ($sessionToken === '' || $providedToken === '' || !hash_equals($sessionToken, $providedToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Your session security token is missing or expired. Please refresh the page and try again.']);
        exit;
    }
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$dbPath = $dataDir . '/laptopvalley.db';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Exception $e) {
    error_log('DB connection failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Service temporarily unavailable. Please try again later.']);
    exit;
}

// ---- CREATE TABLES ----
$pdo->exec("
    CREATE TABLE IF NOT EXISTS laptops (
        id TEXT PRIMARY KEY,
        brand TEXT, model TEXT, processorBrand TEXT, processorModel TEXT,
        ramSize TEXT, ramType TEXT, storageType TEXT, storageCapacity TEXT,
        displaySize TEXT, displayResolution TEXT, displayType TEXT,
        graphics TEXT, os TEXT, battery TEXT, weight TEXT, color TEXT,
        warranty TEXT, price REAL, stock INTEGER, image TEXT, images TEXT DEFAULT '[]', category TEXT DEFAULT 'Laptop', subcategory TEXT DEFAULT '',
        desktopProcessorBrand TEXT DEFAULT '', desktopProcessorModel TEXT DEFAULT '', desktopRamSize TEXT DEFAULT '', desktopRamType TEXT DEFAULT '',
        desktopStorageType TEXT DEFAULT '', desktopStorageCapacity TEXT DEFAULT '', desktopGraphics TEXT DEFAULT '', desktopMotherboard TEXT DEFAULT '',
        desktopPsu TEXT DEFAULT '', desktopCaseType TEXT DEFAULT '', desktopCooling TEXT DEFAULT '', desktopOs TEXT DEFAULT '', description TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, date TEXT, customerName TEXT, customerPhone TEXT,
        customerEmail TEXT, address TEXT, city TEXT, pin TEXT, paymentMethod TEXT,
        notes TEXT, items TEXT, total REAL, status TEXT
    );

    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
        rl_key TEXT PRIMARY KEY,
        count INTEGER,
        window_start INTEGER
    );

    CREATE TABLE IF NOT EXISTS login_lockouts (
        ip_key TEXT PRIMARY KEY,
        failed_attempts INTEGER DEFAULT 0,
        locked_until INTEGER DEFAULT NULL
    );
");

// ---- IMAGE STORAGE MIGRATION ----
// Older databases have only a single `image` field. Add a JSON `images` field
// and seed it from the legacy value so existing laptops continue to display.
try {
    $columns = $pdo->query("PRAGMA table_info(laptops)")->fetchAll();
    $hasImagesColumn = false;
    foreach ($columns as $column) {
        if (($column['name'] ?? '') === 'images') {
            $hasImagesColumn = true;
            break;
        }
    }
    if (!$hasImagesColumn) {
        $pdo->exec("ALTER TABLE laptops ADD COLUMN images TEXT DEFAULT '[]'");
    }

    $legacyRows = $pdo->query("SELECT id, image, images FROM laptops")->fetchAll();
    $migrateImages = $pdo->prepare("UPDATE laptops SET images = ? WHERE id = ?");
    foreach ($legacyRows as $row) {
        $existing = [];
        if (!empty($row['images'])) {
            $decoded = json_decode($row['images'], true);
            if (is_array($decoded)) {
                $existing = array_values(array_filter($decoded, 'is_string'));
            }
        }
        if (empty($existing) && !empty($row['image'])) {
            $existing = [$row['image']];
            $migrateImages->execute([json_encode($existing, JSON_UNESCAPED_SLASHES), $row['id']]);
        }
    }
} catch (Exception $e) {
    error_log('Image schema migration failed: ' . $e->getMessage());
}

// ---- PRODUCT CATEGORY MIGRATION ----
try {
    $columns = $pdo->query("PRAGMA table_info(laptops)")->fetchAll();
    $columnNames = [];
    foreach ($columns as $column) {
        $columnNames[] = $column['name'] ?? '';
    }
    if (!in_array('category', $columnNames, true)) {
        $pdo->exec("ALTER TABLE laptops ADD COLUMN category TEXT DEFAULT 'Laptop'");
    }
    if (!in_array('subcategory', $columnNames, true)) {
        $pdo->exec("ALTER TABLE laptops ADD COLUMN subcategory TEXT DEFAULT ''");
    }
    $pdo->exec("UPDATE laptops SET category = 'Laptop' WHERE category IS NULL OR TRIM(category) = ''");
    $pdo->exec("UPDATE laptops SET subcategory = 'Laptop' WHERE category = 'Laptop' AND (subcategory IS NULL OR TRIM(subcategory) = '')");
} catch (Exception $e) {
    error_log('Product category migration failed: ' . $e->getMessage());
}

// ---- DESKTOP PC SCHEMA MIGRATION ----
try {
    $columns = $pdo->query("PRAGMA table_info(laptops)")->fetchAll();
    $columnNames = [];
    foreach ($columns as $column) {
        $columnNames[] = $column['name'] ?? '';
    }
    $desktopColumns = [
        'desktopProcessorBrand' => "TEXT DEFAULT ''",
        'desktopProcessorModel' => "TEXT DEFAULT ''",
        'desktopRamSize' => "TEXT DEFAULT ''",
        'desktopRamType' => "TEXT DEFAULT ''",
        'desktopStorageType' => "TEXT DEFAULT ''",
        'desktopStorageCapacity' => "TEXT DEFAULT ''",
        'desktopGraphics' => "TEXT DEFAULT ''",
        'desktopMotherboard' => "TEXT DEFAULT ''",
        'desktopPsu' => "TEXT DEFAULT ''",
        'desktopCaseType' => "TEXT DEFAULT ''",
        'desktopCooling' => "TEXT DEFAULT ''",
        'desktopOs' => "TEXT DEFAULT ''"
    ];
    foreach ($desktopColumns as $name => $definition) {
        if (!in_array($name, $columnNames, true)) {
            $pdo->exec("ALTER TABLE laptops ADD COLUMN $name $definition");
        }
    }
} catch (Exception $e) {
    error_log('Desktop PC schema migration failed: ' . $e->getMessage());
}

// ---- IMAGE HELPERS ----
function getLaptopImagesFromRow($row) {
    $images = [];
    if (!empty($row['images'])) {
        $decoded = json_decode($row['images'], true);
        if (is_array($decoded)) {
            foreach ($decoded as $image) {
                if (is_string($image) && trim($image) !== '') {
                    $images[] = trim($image);
                }
            }
        }
    }
    if (empty($images) && !empty($row['image'])) {
        $images[] = trim($row['image']);
    }
    return array_slice($images, 0, 3);
}

function isManagedLaptopImage($path) {
    return is_string($path)
        && preg_match('#^assets/laptops/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$#i', $path);
}

function deleteManagedLaptopImage($path) {
    if (!isManagedLaptopImage($path)) return;
    $absolute = __DIR__ . '/' . $path;
    if (is_file($absolute)) {
        @unlink($absolute);
    }
}

function ensureLaptopImageDirectory() {
    $dir = __DIR__ . '/assets/laptops';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new Exception('Could not create laptop image directory.');
    }
    return $dir;
}

function imageMimeToExtension($mime) {
    if ($mime === 'image/jpeg') return 'jpg';
    if ($mime === 'image/png') return 'png';
    if ($mime === 'image/webp') return 'webp';
    return null;
}

function storeLaptopUpload($file, $laptopId, $slot) {
    if (!isset($file) || !is_array($file)) return null;
    $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) return null;
    if ($error !== UPLOAD_ERR_OK) {
        throw new OrderException('One of the selected images could not be uploaded. Please try again.');
    }

    $maxBytes = 5 * 1024 * 1024;
    if ((int)($file['size'] ?? 0) <= 0 || (int)$file['size'] > $maxBytes) {
        throw new OrderException('Each laptop image must be 5 MB or smaller.');
    }

    $tmp = $file['tmp_name'] ?? '';
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        throw new OrderException('Invalid image upload. Please select an image from your computer.');
    }

    $imageInfo = @getimagesize($tmp);
    if (!$imageInfo || empty($imageInfo['mime'])) {
        throw new OrderException('Only valid JPG, PNG, or WebP images are allowed.');
    }

    $extension = imageMimeToExtension($imageInfo['mime']);
    if ($extension === null) {
        throw new OrderException('Only JPG, PNG, or WebP images are allowed.');
    }

    $dir = ensureLaptopImageDirectory();
    $safeId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$laptopId);
    $filename = 'lp_' . $safeId . '_' . bin2hex(random_bytes(8)) . '_i' . (int)$slot . '.' . $extension;
    $absolutePath = $dir . '/' . $filename;
    if (!move_uploaded_file($tmp, $absolutePath)) {
        throw new Exception('Could not move the uploaded laptop image into storage.');
    }

    @chmod($absolutePath, 0644);
    return 'assets/laptops/' . $filename;
}

// ---- HELPER: Simple fixed-window rate limiter, keyed by e.g. 'login_1.2.3.4' ----
// Returns true if the request is allowed, false if the caller is over the limit.
function checkRateLimit($pdo, $key, $maxRequests, $windowSeconds) {
    $now = time();
    $stmt = $pdo->prepare("SELECT count, window_start FROM rate_limits WHERE rl_key = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();

    if (!$row || ($now - $row['window_start']) > $windowSeconds) {
        $pdo->prepare("
            INSERT INTO rate_limits (rl_key, count, window_start) VALUES (?, 1, ?)
            ON CONFLICT(rl_key) DO UPDATE SET count = 1, window_start = excluded.window_start
        ")->execute([$key, $now]);
        return true;
    }

    if ($row['count'] >= $maxRequests) {
        return false;
    }

    $pdo->prepare("UPDATE rate_limits SET count = count + 1 WHERE rl_key = ?")->execute([$key]);
    return true;
}

// ---- HELPER: Login lockout, tracked per SOURCE IP rather than per username. ----
// This is deliberate: a lockout keyed by username lets anyone lock the real
// admin out just by failing logins against a known username. Keying it by IP
// means an attacker only ever locks themselves out, from wherever they're
// attacking from - whether they keep guessing one username or spread guesses
// across several.
function isIpLockedOut($pdo, $ip) {
    $stmt = $pdo->prepare("SELECT locked_until FROM login_lockouts WHERE ip_key = ?");
    $stmt->execute([$ip]);
    $row = $stmt->fetch();
    if ($row && $row['locked_until'] && $row['locked_until'] > time()) {
        return (int)$row['locked_until'];
    }
    return false;
}

function recordFailedLogin($pdo, $ip) {
    $stmt = $pdo->prepare("SELECT failed_attempts FROM login_lockouts WHERE ip_key = ?");
    $stmt->execute([$ip]);
    $row = $stmt->fetch();
    $attempts = ($row ? (int)$row['failed_attempts'] : 0) + 1;
    $lockUntil = ($attempts >= 5) ? (time() + (15 * 60)) : null;

    $pdo->prepare("
        INSERT INTO login_lockouts (ip_key, failed_attempts, locked_until) VALUES (?, ?, ?)
        ON CONFLICT(ip_key) DO UPDATE SET failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until
    ")->execute([$ip, $attempts, $lockUntil]);
}

function resetLoginAttempts($pdo, $ip) {
    $pdo->prepare("
        INSERT INTO login_lockouts (ip_key, failed_attempts, locked_until) VALUES (?, 0, NULL)
        ON CONFLICT(ip_key) DO UPDATE SET failed_attempts = 0, locked_until = NULL
    ")->execute([$ip]);
}

// ---- HELPER: Validate + sanitize (trim) the customer-supplied order fields. ----
// Throws OrderException (safe, user-facing message) on any bad field.
function validateOrderInput($input) {
    $errors = [];

    $customerName = trim($input['customerName'] ?? '');
    if ($customerName === '' || mb_strlen($customerName) > 100) {
        $errors[] = 'name';
    }

    $customerPhone = trim($input['customerPhone'] ?? '');
    if (!preg_match('/^[0-9+\-\s()]{6,20}$/', $customerPhone)) {
        $errors[] = 'phone number';
    }

    $customerEmail = trim($input['customerEmail'] ?? '');
    if (!filter_var($customerEmail, FILTER_VALIDATE_EMAIL) || strlen($customerEmail) > 150) {
        $errors[] = 'email';
    }

    $address = trim($input['address'] ?? '');
    if ($address === '' || mb_strlen($address) > 300) {
        $errors[] = 'address';
    }

    $city = trim($input['city'] ?? '');
    if ($city === '' || mb_strlen($city) > 50) {
        $errors[] = 'city';
    }

    $pin = trim($input['pin'] ?? '');
    if (!preg_match('/^[A-Za-z0-9\-\s]{2,12}$/', $pin)) {
        $errors[] = 'PIN/postal code';
    }

    $allowedPaymentMethods = ['COD', 'EasyPaisa', 'JazzCash', 'BankTransfer'];
    $paymentMethod = trim($input['paymentMethod'] ?? '');
    if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
        $errors[] = 'payment method';
    }

    $notes = trim($input['notes'] ?? '');
    if (mb_strlen($notes) > 500) {
        $errors[] = 'notes (max 500 characters)';
    }

    if (!empty($errors)) {
        throw new OrderException('Please check the following field(s): ' . implode(', ', $errors));
    }

    return [
        'customerName' => $customerName,
        'customerPhone' => $customerPhone,
        'customerEmail' => $customerEmail,
        'address' => $address,
        'city' => $city,
        'pin' => $pin,
        'paymentMethod' => $paymentMethod,
        'notes' => $notes
    ];
}

// ---- SEED DEFAULT ADMIN (only runs once, if admins table is empty) ----
$adminCount = $pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn();
if ($adminCount == 0) {
    $defaultHash = password_hash('Hasan@admin123', PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
    $stmt->execute(['laptop-valley', $defaultHash]);
}

// ---- SEED DEFAULT LAPTOPS (only runs once) ----
$count = $pdo->query("SELECT COUNT(*) FROM laptops")->fetchColumn();
if ($count == 0) {
    $defaultLaptops = [
        ['id' => 'lp001', 'category' => 'Laptop', 'subcategory' => 'Laptop', 'brand' => 'Dell', 'model' => 'XPS 15 9530', 'processorBrand' => 'Intel', 'processorModel' => 'Core i7-13700H', 'ramSize' => '16GB', 'ramType' => 'DDR5', 'storageType' => 'SSD', 'storageCapacity' => '512GB', 'displaySize' => '15.6 inch', 'displayResolution' => 'FHD+ 1920x1200', 'displayType' => 'IPS', 'graphics' => 'NVIDIA RTX 4050 6GB', 'os' => 'Windows 11 Home', 'battery' => '86Wh, up to 13 hrs', 'weight' => '1.86 kg', 'color' => 'Platinum Silver', 'warranty' => '1 Year', 'price' => 425000, 'stock' => 8, 'image' => 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=500', 'description' => 'Premium build with stunning display, powerful performance for creators and professionals.'],
        ['id' => 'lp002', 'category' => 'Laptop', 'subcategory' => 'Laptop', 'brand' => 'Apple', 'model' => 'MacBook Air M2', 'processorBrand' => 'Apple', 'processorModel' => 'Apple M2 8-core', 'ramSize' => '8GB', 'ramType' => 'Unified Memory', 'storageType' => 'SSD', 'storageCapacity' => '256GB', 'displaySize' => '13.6 inch', 'displayResolution' => 'Retina 2560x1664', 'displayType' => 'IPS', 'graphics' => 'Apple 8-core GPU Integrated', 'os' => 'macOS', 'battery' => 'Up to 18 hrs', 'weight' => '1.24 kg', 'color' => 'Midnight', 'warranty' => '1 Year', 'price' => 335000, 'stock' => 12, 'image' => 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500', 'description' => 'Incredibly thin and light, powered by the efficient M2 chip with all day battery life.'],
        ['id' => 'lp003', 'category' => 'Laptop', 'subcategory' => 'Laptop', 'brand' => 'ASUS', 'model' => 'ROG Strix G16', 'processorBrand' => 'Intel', 'processorModel' => 'Core i9-13980HX', 'ramSize' => '32GB', 'ramType' => 'DDR5', 'storageType' => 'SSD', 'storageCapacity' => '1TB', 'displaySize' => '16 inch', 'displayResolution' => 'QHD+ 240Hz', 'displayType' => 'IPS', 'graphics' => 'NVIDIA RTX 4070 8GB', 'os' => 'Windows 11 Home', 'battery' => '90Wh', 'weight' => '2.5 kg', 'color' => 'Eclipse Gray', 'warranty' => '2 Years', 'price' => 585000, 'stock' => 5, 'image' => 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500', 'description' => 'Ultimate gaming powerhouse with high refresh rate display and top tier cooling.'],
        ['id' => 'lp004', 'category' => 'Laptop', 'subcategory' => 'Laptop', 'brand' => 'HP', 'model' => 'Pavilion 15', 'processorBrand' => 'AMD', 'processorModel' => 'Ryzen 5 7530U', 'ramSize' => '8GB', 'ramType' => 'DDR4', 'storageType' => 'SSD', 'storageCapacity' => '512GB', 'displaySize' => '15.6 inch', 'displayResolution' => 'FHD 1920x1080', 'displayType' => 'IPS', 'graphics' => 'AMD Radeon Graphics Integrated', 'os' => 'Windows 11 Home', 'battery' => '41Wh, up to 8 hrs', 'weight' => '1.75 kg', 'color' => 'Natural Silver', 'warranty' => '1 Year', 'price' => 165000, 'stock' => 15, 'image' => 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500', 'description' => 'Reliable everyday laptop perfect for students and home office use.']
    ];

    $seedStmt = $pdo->prepare("
        INSERT INTO laptops (id, category, subcategory, brand, model, processorBrand, processorModel, ramSize, ramType, storageType, storageCapacity, displaySize, displayResolution, displayType, graphics, os, battery, weight, color, warranty, price, stock, image, description)
        VALUES (:id, :category, :subcategory, :brand, :model, :processorBrand, :processorModel, :ramSize, :ramType, :storageType, :storageCapacity, :displaySize, :displayResolution, :displayType, :graphics, :os, :battery, :weight, :color, :warranty, :price, :stock, :image, :description)
    ");
    foreach ($defaultLaptops as $laptop) {
        $seedStmt->execute($laptop);
    }
}

// ---- HELPER: Check if request is authenticated as admin ----
function requireAdmin() {
    if (empty($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized. Please login as admin.']);
        exit;
    }
}

$action = $_GET['action'] ?? '';
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'multipart/form-data') !== false) {
    $input = $_POST;
} else {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
}

switch ($action) {

    // ---- PUBLIC: Get laptops (anyone can view store) ----
    case 'get_laptops':
        $stmt = $pdo->query("SELECT * FROM laptops ORDER BY price ASC");
        $laptops = $stmt->fetchAll();
        foreach ($laptops as &$lp) {
            $lp['price'] = (float)$lp['price'];
            $lp['stock'] = (int)$lp['stock'];
            $lp['category'] = $lp['category'] ?: 'Laptop';
            $lp['subcategory'] = $lp['subcategory'] ?? '';
            $lp['images'] = getLaptopImagesFromRow($lp);
            $lp['image'] = $lp['images'][0] ?? '';
        }
        echo json_encode(['success' => true, 'laptops' => $laptops]);
        break;

    // ---- PUBLIC: Place an order (any buyer can order) ----
    case 'create_order':
        requireCsrfToken($input);

        $items = $input['items'] ?? [];
        if (empty($items)) {
            echo json_encode(['success' => false, 'error' => 'No items in order.']);
            break;
        }

        // Rate limit: max 10 orders per IP per 10 minutes, to stop stock-draining spam.
        if (!checkRateLimit($pdo, 'create_order_' . getClientIp(), 10, 600)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Too many orders submitted from this network. Please try again in a few minutes.']);
            break;
        }

        $pdo->beginTransaction();
        try {
            // Validates length/format on every customer-supplied field and
            // whitelists paymentMethod, so free-form junk never reaches the DB.
            $customer = validateOrderInput($input);

            $orderItems = [];
            $total = 0;

            foreach ($items as $item) {
                $id = $item['id'] ?? '';
                $qty = filter_var($item['qty'] ?? null, FILTER_VALIDATE_INT);

                if ($id === '' || $qty === false || $qty < 1) {
                    throw new OrderException("Invalid item or quantity in order.");
                }

                $stmt = $pdo->prepare("SELECT id, category, subcategory, brand, model, price, stock FROM laptops WHERE id = ?");
                $stmt->execute([$id]);
                $laptop = $stmt->fetch();

                if (!$laptop) {
                    throw new OrderException("One of the selected products is no longer available.");
                }
                if ($laptop['stock'] < $qty) {
                    throw new OrderException("Only {$laptop['stock']} units left for {$laptop['model']}. Please reduce quantity.");
                }

                // Price and line total always come from the database, never from the
                // client's request, so a tampered browser payload can't change what's charged.
                $unitPrice = (float)$laptop['price'];
                $lineTotal = $unitPrice * $qty;
                $total += $lineTotal;

                $orderItems[] = [
                    'id' => $laptop['id'],
                    'name' => $laptop['model'],
                    'category' => $laptop['category'] ?: 'Laptop',
                    'subcategory' => $laptop['subcategory'] ?: '',
                    'brand' => $laptop['brand'] ?: '',
                    'price' => $unitPrice,
                    'qty' => $qty
                ];

                $update = $pdo->prepare("UPDATE laptops SET stock = stock - ? WHERE id = ?");
                $update->execute([$qty, $id]);
            }

            // Generate a unique order ID as ORD + exactly 12 numeric digits.
            // Examples: ORD000000000001, ORD482731905614
            // The 12-digit portion is random for every new order, leading zeroes
            // are preserved, and collisions are rejected before insertion.
            do {
                $orderNumber = sprintf('%012d', random_int(1, 999999999999));
                $orderId = 'ORD' . $orderNumber;
                $checkOrder = $pdo->prepare("SELECT 1 FROM orders WHERE id = ? LIMIT 1");
                $checkOrder->execute([$orderId]);
            } while ($checkOrder->fetchColumn());

            $date = date('c');

            $orderStmt = $pdo->prepare("
                INSERT INTO orders (id, date, customerName, customerPhone, customerEmail, address, city, pin, paymentMethod, notes, items, total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $orderStmt->execute([
                $orderId, $date, $customer['customerName'], $customer['customerPhone'], $customer['customerEmail'],
                $customer['address'], $customer['city'], $customer['pin'], $customer['paymentMethod'],
                $customer['notes'], json_encode($orderItems), $total
            ]);

            $pdo->commit();
            // Total is echoed back from the server-computed value, not the client's.
            echo json_encode(['success' => true, 'orderId' => $orderId, 'date' => $date, 'total' => $total]);
        } catch (OrderException $e) {
            // Safe, deliberate message (stock/validation) - fine to show the customer.
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            // Unexpected error (DB, etc) - log details server-side, don't leak internals.
            $pdo->rollBack();
            error_log('create_order error: ' . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Could not place your order. Please try again.']);
        }
        break;

    // ---- ADMIN LOGIN (with brute-force protection) ----
    case 'login':
        $ip = getClientIp();

        // General throttle: max 15 attempts per IP per 10 minutes.
        if (!checkRateLimit($pdo, 'login_' . $ip, 15, 600)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Too many login attempts from this network. Please try again later.']);
            break;
        }

        // Lockout is per IP, not per username - see isIpLockedOut() above for why.
        $lockedUntil = isIpLockedOut($pdo, $ip);
        if ($lockedUntil !== false) {
            $minsLeft = ceil(($lockedUntil - time()) / 60);
            echo json_encode(['success' => false, 'error' => "Too many failed attempts from this network. Try again in {$minsLeft} minute(s)."]);
            break;
        }

        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ?");
        $stmt->execute([$username]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, $admin['password_hash'])) {
            resetLoginAttempts($pdo, $ip);

            session_regenerate_id(true);
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_username'] = $admin['username'];
            $_SESSION['last_activity'] = time();

            echo json_encode(['success' => true]);
        } else {
            recordFailedLogin($pdo, $ip);
            echo json_encode(['success' => false, 'error' => 'Invalid username or password']);
        }
        break;

    // ---- CHECK SESSION (used on page load to verify still logged in) ----
    case 'check_session':
        if (!empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
            // Server-side idle timeout check (10 minutes)
            $idleLimit = 10 * 60;
            if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $idleLimit) {
                session_unset();
                session_destroy();
                echo json_encode(['success' => true, 'loggedIn' => false, 'reason' => 'idle_timeout']);
            } else {
                $_SESSION['last_activity'] = time();
                echo json_encode(['success' => true, 'loggedIn' => true]);
            }
        } else {
            echo json_encode(['success' => true, 'loggedIn' => false]);
        }
        break;

    // ---- HEARTBEAT (called on user activity to keep session alive) ----
    case 'heartbeat':
        if (!empty($_SESSION['admin_logged_in'])) {
            $_SESSION['last_activity'] = time();
        }
        echo json_encode(['success' => true]);
        break;

    // ---- LOGOUT ----
    case 'logout':
        session_unset();
        session_destroy();
        echo json_encode(['success' => true]);
        break;

    // ---- CHANGE PASSWORD (requires being logged in + current password) ----
    case 'change_password':
        requireAdmin();
        requireCsrfToken($input);
        $currentPass = $input['currentPassword'] ?? '';
        $newPass = $input['newPassword'] ?? '';

        if (strlen($newPass) < 8) {
            echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters']);
            break;
        }

        $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ?");
        $stmt->execute([$_SESSION['admin_username']]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($currentPass, $admin['password_hash'])) {
            echo json_encode(['success' => false, 'error' => 'Current password is incorrect']);
            break;
        }

        $newHash = password_hash($newPass, PASSWORD_BCRYPT);
        $pdo->prepare("UPDATE admins SET password_hash = ? WHERE id = ?")->execute([$newHash, $admin['id']]);
        echo json_encode(['success' => true]);
        break;

    // ---- PROTECTED: Save product (admin only) ----
    // Uses multipart/form-data so admins can upload up to three local images.
    case 'save_laptop':
        requireAdmin();
        requireCsrfToken($input);

        $id = trim($input['id'] ?? '');
        $category = trim($input['category'] ?? 'Laptop');
        $subcategory = trim($input['subcategory'] ?? '');
        if (!in_array($category, ['Laptop', 'Accessories', 'Desktop PC'], true)) {
            echo json_encode(['success' => false, 'error' => 'Invalid product category.']);
            break;
        }
        if ($category === 'Laptop' && $subcategory === '') $subcategory = 'Laptop';
        if ($category === 'Desktop PC' && $subcategory === '') $subcategory = 'Custom Build';
        if ($id === '') {
            $id = 'lp' . date('YmdHis') . bin2hex(random_bytes(3));
        }

        $existingStmt = $pdo->prepare("SELECT * FROM laptops WHERE id = ?");
        $existingStmt->execute([$id]);
        $existingLaptop = $existingStmt->fetch();
        $currentImages = $existingLaptop ? getLaptopImagesFromRow($existingLaptop) : [];
        $finalImages = [];
        $movedFiles = [];

        try {
            // Empty file inputs keep the existing image in that slot unless the
            // admin explicitly ticks the remove checkbox.
            for ($slot = 1; $slot <= 3; $slot++) {
                $file = $_FILES['image' . $slot] ?? null;
                $hasFile = is_array($file) && (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
                $remove = !empty($input['remove' . $slot]) && $input['remove' . $slot] !== 'false';

                if ($hasFile) {
                    $storedPath = storeLaptopUpload($file, $id, $slot);
                    if ($storedPath !== null) {
                        $movedFiles[] = $storedPath;
                        $finalImages[] = $storedPath;
                    }
                } elseif (!$remove && isset($currentImages[$slot - 1])) {
                    $finalImages[] = $currentImages[$slot - 1];
                }
            }

            $finalImages = array_slice($finalImages, 0, 3);
            $firstImage = $finalImages[0] ?? '';

            $sql = "INSERT INTO laptops (id, category, subcategory, brand, model, processorBrand, processorModel, ramSize, ramType, storageType, storageCapacity, displaySize, displayResolution, displayType, graphics, os, battery, weight, color, warranty, price, stock, image, images, desktopProcessorBrand, desktopProcessorModel, desktopRamSize, desktopRamType, desktopStorageType, desktopStorageCapacity, desktopGraphics, desktopMotherboard, desktopPsu, desktopCaseType, desktopCooling, desktopOs, description)
                    VALUES (:id, :category, :subcategory, :brand, :model, :processorBrand, :processorModel, :ramSize, :ramType, :storageType, :storageCapacity, :displaySize, :displayResolution, :displayType, :graphics, :os, :battery, :weight, :color, :warranty, :price, :stock, :image, :images, :desktopProcessorBrand, :desktopProcessorModel, :desktopRamSize, :desktopRamType, :desktopStorageType, :desktopStorageCapacity, :desktopGraphics, :desktopMotherboard, :desktopPsu, :desktopCaseType, :desktopCooling, :desktopOs, :description)
                    ON CONFLICT(id) DO UPDATE SET
                        category=excluded.category, subcategory=excluded.subcategory,
                        brand=excluded.brand, model=excluded.model, processorBrand=excluded.processorBrand, processorModel=excluded.processorModel,
                        ramSize=excluded.ramSize, ramType=excluded.ramType, storageType=excluded.storageType, storageCapacity=excluded.storageCapacity,
                        displaySize=excluded.displaySize, displayResolution=excluded.displayResolution, displayType=excluded.displayType,
                        graphics=excluded.graphics, os=excluded.os, battery=excluded.battery, weight=excluded.weight, color=excluded.color,
                        desktopProcessorBrand=excluded.desktopProcessorBrand, desktopProcessorModel=excluded.desktopProcessorModel, desktopRamSize=excluded.desktopRamSize, desktopRamType=excluded.desktopRamType,
                        desktopStorageType=excluded.desktopStorageType, desktopStorageCapacity=excluded.desktopStorageCapacity, desktopGraphics=excluded.desktopGraphics, desktopMotherboard=excluded.desktopMotherboard,
                        desktopPsu=excluded.desktopPsu, desktopCaseType=excluded.desktopCaseType, desktopCooling=excluded.desktopCooling, desktopOs=excluded.desktopOs,
                        warranty=excluded.warranty, price=excluded.price, stock=excluded.stock, image=excluded.image, images=excluded.images, description=excluded.description";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':category' => $category,
                ':subcategory' => $subcategory,
                ':brand' => trim($input['brand'] ?? ''),
                ':model' => trim($input['model'] ?? ''),
                ':processorBrand' => trim($input['processorBrand'] ?? ''),
                ':processorModel' => trim($input['processorModel'] ?? ''),
                ':ramSize' => trim($input['ramSize'] ?? ''),
                ':ramType' => trim($input['ramType'] ?? ''),
                ':storageType' => trim($input['storageType'] ?? ''),
                ':storageCapacity' => trim($input['storageCapacity'] ?? ''),
                ':displaySize' => trim($input['displaySize'] ?? ''),
                ':displayResolution' => trim($input['displayResolution'] ?? ''),
                ':displayType' => trim($input['displayType'] ?? ''),
                ':graphics' => trim($input['graphics'] ?? ''),
                ':os' => trim($input['os'] ?? ''),
                ':battery' => trim($input['battery'] ?? ''),
                ':weight' => trim($input['weight'] ?? ''),
                ':color' => trim($input['color'] ?? ''),
                ':desktopProcessorBrand' => trim($input['desktopProcessorBrand'] ?? ''),
                ':desktopProcessorModel' => trim($input['desktopProcessorModel'] ?? ''),
                ':desktopRamSize' => trim($input['desktopRamSize'] ?? ''),
                ':desktopRamType' => trim($input['desktopRamType'] ?? ''),
                ':desktopStorageType' => trim($input['desktopStorageType'] ?? ''),
                ':desktopStorageCapacity' => trim($input['desktopStorageCapacity'] ?? ''),
                ':desktopGraphics' => trim($input['desktopGraphics'] ?? ''),
                ':desktopMotherboard' => trim($input['desktopMotherboard'] ?? ''),
                ':desktopPsu' => trim($input['desktopPsu'] ?? ''),
                ':desktopCaseType' => trim($input['desktopCaseType'] ?? ''),
                ':desktopCooling' => trim($input['desktopCooling'] ?? ''),
                ':desktopOs' => trim($input['desktopOs'] ?? ''),
                ':warranty' => trim($input['warranty'] ?? ''),
                ':price' => (float)($input['price'] ?? 0),
                ':stock' => (int)($input['stock'] ?? 0),
                ':image' => $firstImage,
                ':images' => json_encode($finalImages, JSON_UNESCAPED_SLASHES),
                ':description' => trim($input['description'] ?? '')
            ]);

            $retained = array_flip($finalImages);
            foreach ($currentImages as $oldImage) {
                if (isManagedLaptopImage($oldImage) && !isset($retained[$oldImage])) {
                    deleteManagedLaptopImage($oldImage);
                }
            }

            echo json_encode(['success' => true, 'id' => $id, 'images' => $finalImages]);
        } catch (Throwable $e) {
            foreach ($movedFiles as $movedFile) {
                deleteManagedLaptopImage($movedFile);
            }
            error_log('save_product error: ' . $e->getMessage());
            if ($e instanceof OrderException) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Could not save the product. Please check the form and try again.']);
            }
        }
        break;

    // ---- PROTECTED: Delete product (admin only) ----
    case 'delete_laptop':
        requireAdmin();
        requireCsrfToken($input);
        $id = $input['id'] ?? '';

        $find = $pdo->prepare("SELECT images, image FROM laptops WHERE id = ?");
        $find->execute([$id]);
        $product = $find->fetch();

        $stmt = $pdo->prepare("DELETE FROM laptops WHERE id = ?");
        $stmt->execute([$id]);

        if ($product) {
            foreach (getLaptopImagesFromRow($product) as $imagePath) {
                deleteManagedLaptopImage($imagePath);
            }
        }

        echo json_encode(['success' => true]);
        break;

    // ---- PROTECTED: Get all orders (admin only) ----
    case 'get_orders':
        requireAdmin();
        $stmt = $pdo->query("SELECT * FROM orders ORDER BY date DESC");
        $orders = $stmt->fetchAll();
        foreach ($orders as &$ord) {
            $ord['items'] = json_decode($ord['items'], true);
            $ord['total'] = (float)$ord['total'];
        }
        echo json_encode(['success' => true, 'orders' => $orders]);
        break;

    // ---- PROTECTED: Update order status (admin only) ----
    case 'update_order_status':
        requireAdmin();
        requireCsrfToken($input);
        $orderId = $input['id'] ?? '';
        $newStatus = $input['status'] ?? '';

        $allowedStatuses = ['pending', 'confirmed', 'declined', 'refund'];
        if (!in_array($newStatus, $allowedStatuses, true)) {
            echo json_encode(['success' => false, 'error' => 'Invalid status value.']);
            break;
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if (!$order) {
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            break;
        }

        $oldStatus = $order['status'];
        $items = json_decode($order['items'], true);

        $shouldRestore = ($oldStatus === 'pending' || $oldStatus === 'confirmed') && ($newStatus === 'declined' || $newStatus === 'refund');
        $shouldDeduct = ($oldStatus === 'declined' || $oldStatus === 'refund') && ($newStatus === 'pending' || $newStatus === 'confirmed');

        $pdo->beginTransaction();
        try {
            if ($shouldRestore) {
                foreach ($items as $item) {
                    $pdo->prepare("UPDATE laptops SET stock = stock + ? WHERE id = ?")->execute([$item['qty'], $item['id']]);
                }
            } elseif ($shouldDeduct) {
                foreach ($items as $item) {
                    $pdo->prepare("UPDATE laptops SET stock = MAX(0, stock - ?) WHERE id = ?")->execute([$item['qty'], $item['id']]);
                }
            }

            $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?")->execute([$newStatus, $orderId]);
            $pdo->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('update_order_status error: ' . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Could not update order status. Please try again.']);
        }
        break;

    // ---- PROTECTED: Delete order (admin only) ----
    case 'delete_order':
        requireAdmin();
        requireCsrfToken($input);
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$input['id']]);
        echo json_encode(['success' => true]);
        break;

    // ---- PUBLIC: Prime the CSRF token for this session (see header above) ----
    case 'csrf_token':
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
        break;
}
