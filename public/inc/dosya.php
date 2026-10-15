<?php
// HİS ERP - Fotoğraf yükleme ve yapay zekâ irsaliye okuma

// ============================================================
// FOTOĞRAF YÜKLEME (uploads/ klasörü)
// ============================================================
function fotoIstegi($pdo) {
    girisGerekli($pdo);
    $uploadDir = veriDizini() . '/uploads';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
        // Güvenlik: uploads içinde PHP çalıştırılamasın
        @file_put_contents($uploadDir . '/.htaccess', "php_flag engine off\n<FilesMatch \"\\.ph\">\nRequire all denied\n</FilesMatch>\n");
    }

    if ($_GET['foto'] === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        $data = isset($body['data']) ? $body['data'] : '';
        // Sadece görsel data-url kabul et
        if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#', $data, $m)) {
            http_response_code(400);
            echo json_encode(['error' => 'Gecersiz gorsel verisi']);
            exit;
        }
        $binary = base64_decode(substr($data, strpos($data, ',') + 1), true);
        if ($binary === false || strlen($binary) > 3 * 1024 * 1024) { // max 3MB
            http_response_code(400);
            echo json_encode(['error' => 'Gorsel cozumlenemedi veya cok buyuk']);
            exit;
        }
        $ad = bin2hex(random_bytes(10)) . '.jpg';
        if (file_put_contents($uploadDir . '/' . $ad, $binary) === false) {
            http_response_code(500);
            echo json_encode(['error' => 'Dosya kaydedilemedi']);
            exit;
        }
        echo json_encode(['url' => 'uploads/' . $ad]);
        exit;
    }

    if ($_GET['foto'] === 'sil' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        $url = isset($body['url']) ? $body['url'] : '';
        // Yol güvenliği: sadece uploads/ içindeki düz dosya adları
        if (preg_match('#^uploads/([a-f0-9]+\.jpg)$#', $url, $m)) {
            @unlink($uploadDir . '/' . $m[1]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Bilinmeyen foto islemi']);
    exit;
}

// Yapay zekâ irsaliye okuma: inc/yapayzeka.php
