<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$dbPath = $dataDir . '/laptopvalley.db';
$isNewDb = !file_exists($dbPath);

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Auto-create tables on first run
$pdo->exec("
    CREATE TABLE IF NOT EXISTS laptops (
        id TEXT PRIMARY KEY,
        brand TEXT,
        model TEXT,
        processorBrand TEXT,
        processorModel TEXT,
        ramSize TEXT,
        ramType TEXT,
        storageType TEXT,
        storageCapacity TEXT,
        displaySize TEXT,
        displayResolution TEXT,
        displayType TEXT,
        graphics TEXT,
        os TEXT,
        battery TEXT,
        weight TEXT,
        color TEXT,
        warranty TEXT,
        price REAL,
        stock INTEGER,
        image TEXT,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        date TEXT,
        customerName TEXT,
        customerPhone TEXT,
        customerEmail TEXT,
        address TEXT,
        city TEXT,
        pin TEXT,
        paymentMethod TEXT,
        notes TEXT,
        items TEXT,
        total REAL,
        status TEXT
    );
");

// Seed default laptops if database is empty
$count = $pdo->query("SELECT COUNT(*) FROM laptops")->fetchColumn();
if ($count == 0) {
    $defaultLaptops = [
        [
            'id' => 'lp001', 'brand' => 'Dell', 'model' => 'XPS 15 9530',
            'processorBrand' => 'Intel', 'processorModel' => 'Core i7-13700H',
            'ramSize' => '16GB', 'ramType' => 'DDR5',
            'storageType' => 'SSD', 'storageCapacity' => '512GB',
            'displaySize' => '15.6 inch', 'displayResolution' => 'FHD+ 1920x1200', 'displayType' => 'IPS',
            'graphics' => 'NVIDIA RTX 4050 6GB', 'os' => 'Windows 11 Home',
            'battery' => '86Wh, up to 13 hrs', 'weight' => '1.86 kg', 'color' => 'Platinum Silver',
            'warranty' => '1 Year', 'price' => 425000, 'stock' => 8,
            'image' => 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=500',
            'description' => 'Premium build with stunning display, powerful performance for creators and professionals.'
        ],
        [
            'id' => 'lp002', 'brand' => 'Apple', 'model' => 'MacBook Air M2',
            'processorBrand' => 'Apple', 'processorModel' => 'Apple M2 8-core',
            'ramSize' => '8GB', 'ramType' => 'Unified Memory',
            'storageType' => 'SSD', 'storageCapacity' => '256GB',
            'displaySize' => '13.6 inch', 'displayResolution' => 'Retina 2560x1664', 'displayType' => 'IPS',
            'graphics' => 'Apple 8-core GPU Integrated', 'os' => 'macOS',
            'battery' => 'Up to 18 hrs', 'weight' => '1.24 kg', 'color' => 'Midnight',
            'warranty' => '1 Year', 'price' => 335000, 'stock' => 12,
            'image' => 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500',
            'description' => 'Incredibly thin and light, powered by the efficient M2 chip with all day battery life.'
        ],
        [
            'id' => 'lp003', 'brand' => 'ASUS', 'model' => 'ROG Strix G16',
            'processorBrand' => 'Intel', 'processorModel' => 'Core i9-13980HX',
            'ramSize' => '32GB', 'ramType' => 'DDR5',
            'storageType' => 'SSD', 'storageCapacity' => '1TB',
            'displaySize' => '16 inch', 'displayResolution' => 'QHD+ 240Hz', 'displayType' => 'IPS',
            'graphics' => 'NVIDIA RTX 4070 8GB', 'os' => 'Windows 11 Home',
            'battery' => '90Wh', 'weight' => '2.5 kg', 'color' => 'Eclipse Gray',
            'warranty' => '2 Years', 'price' => 585000, 'stock' => 5,
            'image' => 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500',
            'description' => 'Ultimate gaming powerhouse with high refresh rate display and top tier cooling.'
        ],
        [
            'id' => 'lp004', 'brand' => 'HP', 'model' => 'Pavilion 15',
            'processorBrand' => 'AMD', 'processorModel' => 'Ryzen 5 7530U',
            'ramSize' => '8GB', 'ramType' => 'DDR4',
            'storageType' => 'SSD', 'storageCapacity' => '512GB',
            'displaySize' => '15.6 inch', 'displayResolution' => 'FHD 1920x1080', 'displayType' => 'IPS',
            'graphics' => 'AMD Radeon Graphics Integrated', 'os' => 'Windows 11 Home',
            'battery' => '41Wh, up to 8 hrs', 'weight' => '1.75 kg', 'color' => 'Natural Silver',
            'warranty' => '1 Year', 'price' => 165000, 'stock' => 15,
            'image' => 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500',
            'description' => 'Reliable everyday laptop perfect for students and home office use.'
        ]
    ];

    $seedStmt = $pdo->prepare("
        INSERT INTO laptops (id, brand, model, processorBrand, processorModel, ramSize, ramType, storageType, storageCapacity, displaySize, displayResolution, displayType, graphics, os, battery, weight, color, warranty, price, stock, image, description)
        VALUES (:id, :brand, :model, :processorBrand, :processorModel, :ramSize, :ramType, :storageType, :storageCapacity, :displaySize, :displayResolution, :displayType, :graphics, :os, :battery, :weight, :color, :warranty, :price, :stock, :image, :description)
    ");
    foreach ($defaultLaptops as $laptop) {
        $seedStmt->execute($laptop);
    }
}

// Router
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {
    case 'get_laptops':
        $stmt = $pdo->query("SELECT * FROM laptops ORDER BY price ASC");
        $laptops = $stmt->fetchAll();
        foreach ($laptops as &$lp) {
            $lp['price'] = (float)$lp['price'];
            $lp['stock'] = (int)$lp['stock'];
        }
        echo json_encode(['success' => true, 'laptops' => $laptops]);
        break;

    case 'save_laptop':
        $id = $input['id'] ?? ('lp' . round(microtime(true) * 1000));
        $stmt = $pdo->prepare("
            INSERT INTO laptops (id, brand, model, processorBrand, processorModel, ramSize, ramType, storageType, storageCapacity, displaySize, displayResolution, displayType, graphics, os, battery, weight, color, warranty, price, stock, image, description)
            VALUES (:id, :brand, :model, :processorBrand, :processorModel, :ramSize, :ramType, :storageType, :storageCapacity, :displaySize, :displayResolution, :displayType, :graphics, :os, :battery, :weight, :color, :warranty, :price, :stock, :image, :description)
            ON CONFLICT(id) DO UPDATE SET
                brand=excluded.brand, model=excluded.model, processorBrand=excluded.processorBrand, processorModel=excluded.processorModel,
                ramSize=excluded.ramSize, ramType=excluded.ramType, storageType=excluded.storageType, storageCapacity=excluded.storageCapacity,
                displaySize=excluded.displaySize, displayResolution=excluded.displayResolution, displayType=excluded.displayType,
                graphics=excluded.graphics, os=excluded.os, battery=excluded.battery, weight=excluded.weight, color=excluded.color,
                warranty=excluded.warranty, price=excluded.price, stock=excluded.stock, image=excluded.image, description=excluded.description
        ");
        $stmt->execute([
            ':id' => $id,
            ':brand' => $input['brand'],
            ':model' => $input['model'],
            ':processorBrand' => $input['processorBrand'],
            ':processorModel' => $input['processorModel'],
            ':ramSize' => $input['ramSize'],
            ':ramType' => $input['ramType'],
            ':storageType' => $input['storageType'],
            ':storageCapacity' => $input['storageCapacity'],
            ':displaySize' => $input['displaySize'],
            ':displayResolution' => $input['displayResolution'],
            ':displayType' => $input['displayType'],
            ':graphics' => $input['graphics'],
            ':os' => $input['os'],
            ':battery' => $input['battery'],
            ':weight' => $input['weight'],
            ':color' => $input['color'],
            ':warranty' => $input['warranty'],
            ':price' => (float)$input['price'],
            ':stock' => (int)$input['stock'],
            ':image' => $input['image'],
            ':description' => $input['description'] ?? ''
        ]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;

    case 'delete_laptop':
        $stmt = $pdo->prepare("DELETE FROM laptops WHERE id = ?");
        $stmt->execute([$input['id']]);
        echo json_encode(['success' => true]);
        break;

    case 'create_order':
        $pdo->beginTransaction();
        try {
            $items = $input['items'] ?? [];
            if (empty($items)) {
                throw new Exception("No items in order.");
            }

            // Verify live stock atomically for all items
            foreach ($items as $item) {
                $stmt = $pdo->prepare("SELECT stock, model FROM laptops WHERE id = ?");
                $stmt->execute([$item['id']]);
                $laptop = $stmt->fetch();

                if (!$laptop) {
                    throw new Exception("Product {$item['name']} not found.");
                }
                if ($laptop['stock'] < $item['qty']) {
                    throw new Exception("Only {$laptop['stock']} units left for {$laptop['model']}. Please reduce quantity.");
                }

                // Decrement live stock in database
                $update = $pdo->prepare("UPDATE laptops SET stock = stock - ? WHERE id = ?");
                $update->execute([$item['qty'], $item['id']]);
            }

            $orderId = 'ORD' . round(microtime(true) * 1000);
            $date = date('c');

            $orderStmt = $pdo->prepare("
                INSERT INTO orders (id, date, customerName, customerPhone, customerEmail, address, city, pin, paymentMethod, notes, items, total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $orderStmt->execute([
                $orderId,
                $date,
                $input['customerName'],
                $input['customerPhone'],
                $input['customerEmail'],
                $input['address'],
                $input['city'],
                $input['pin'],
                $input['paymentMethod'],
                $input['notes'] ?? '',
                json_encode($items),
                (float)$input['total']
            ]);

            $pdo->commit();
            echo json_encode(['success' => true, 'orderId' => $orderId, 'date' => $date]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_orders':
        $stmt = $pdo->query("SELECT * FROM orders ORDER BY date DESC");
        $orders = $stmt->fetchAll();
        foreach ($orders as &$ord) {
            $ord['items'] = json_decode($ord['items'], true);
            $ord['total'] = (float)$ord['total'];
        }
        echo json_encode(['success' => true, 'orders' => $orders]);
        break;

    case 'update_order_status':
        $orderId = $input['id'];
        $newStatus = $input['status'];

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if (!$order) {
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            exit;
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
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_order':
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$input['id']]);
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
        break;
}
