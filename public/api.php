<?php
// HİS ERP - Üretim API'si (MySQL)
// Veritabanı bilgileri ve API anahtarı config.php dosyasındadır.
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---- YAPILANDIRMA ----
require __DIR__ . '/config.php';

// ---- API ANAHTARI KONTROLÜ ----
// Uygulama her istekte X-Api-Key başlığı gönderir. Anahtarsız istekler reddedilir.
$reqKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : (isset($_GET['key']) ? $_GET['key'] : '');
if (!is_string($reqKey) || !hash_equals($API_KEY, $reqKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Yetkisiz erisim']);
    exit;
}

// ---- VERİTABANI BAĞLANTISI ----
try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB baglanti hatasi']);
    exit;
}

// ============================================================
// OTOMATİK ŞEMA GÜNCELLEMELERİ (v2.3)
// Yeni sürümün ihtiyaç duyduğu tablo/kolonlar yoksa oluşturulur —
// böylece elle ALTER çalıştırmadan güncelleme yapılabilir.
// ============================================================
function ensureSchema($pdo) {
    // İşlem günlüğü tablosu
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `islem_gunlugu` (
            `id` VARCHAR(40) NOT NULL,
            `tarih` VARCHAR(40) DEFAULT NULL,
            `kullaniciAd` VARCHAR(120) DEFAULT NULL,
            `kullaniciId` VARCHAR(40) DEFAULT NULL,
            `islem` VARCHAR(80) DEFAULT NULL,
            `detay` TEXT DEFAULT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci");
    } catch (Exception $e) {}

    // Kumaş stok tablosu (v2.6)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `kumas_stok` (
            `id` VARCHAR(40) NOT NULL,
            `kumasAdi` VARCHAR(160) DEFAULT NULL,
            `renk` VARCHAR(80) DEFAULT NULL,
            `miktar` DOUBLE DEFAULT 0,
            `birim` VARCHAR(20) DEFAULT 'kg',
            `gelenFirmaId` VARCHAR(40) DEFAULT NULL,
            `gelenFirmaAdi` VARCHAR(255) DEFAULT NULL,
            `partiId` VARCHAR(40) DEFAULT NULL,
            `partiNo` VARCHAR(30) DEFAULT NULL,
            `referansNo` VARCHAR(160) DEFAULT NULL,
            `notlar` TEXT DEFAULT NULL,
            `tarih` VARCHAR(40) DEFAULT NULL,
            `createdAt` VARCHAR(40) DEFAULT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci");
    } catch (Exception $e) {}

    // Kumaş türleri tablosu (v2.6 — AI irsaliye okuma eşleştirmesi)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `kumas_turleri` (
            `id` VARCHAR(40) NOT NULL,
            `ad` VARCHAR(160) DEFAULT NULL,
            `birim` VARCHAR(20) DEFAULT 'kg',
            `createdAt` VARCHAR(40) DEFAULT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci");
    } catch (Exception $e) {}

    // Yeni kolonlar: [tablo, kolon, tanım]
    $kolonlar = [
        ['kullanicilar', 'firmaId', 'VARCHAR(40) DEFAULT NULL'],   // fasoncu kullanıcı → firma bağı
        ['partiler',     'fotolar', 'LONGTEXT DEFAULT NULL'],       // parti fotoğrafları (JSON dizi)
        ['urunler',      'foto',    'VARCHAR(255) DEFAULT NULL'],   // ürün numune fotoğrafı
        ['urunler',      'firmaFiyatlari', 'LONGTEXT DEFAULT NULL'], // v2.4: firma bazlı fiyat anlaşmaları (JSON)
        ['partiler',     'arsivde', 'TINYINT(1) DEFAULT 0'],         // v2.4: manuel arşiv işareti
        ['kumas_stok',   'topAdedi', 'DOUBLE DEFAULT NULL'],          // v2.6: top/rulo adedi
    ];
    foreach ($kolonlar as list($tablo, $kolon, $tanim)) {
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM `$tablo` LIKE " . $pdo->quote($kolon));
            if ($stmt->fetch() === false) {
                $pdo->exec("ALTER TABLE `$tablo` ADD COLUMN `$kolon` $tanim");
            }
        } catch (Exception $e) {}
    }
}
ensureSchema($pdo);

// ============================================================
// FOTOĞRAF YÜKLEME (uploads/ klasörü)
// ============================================================
if (isset($_GET['foto'])) {
    $uploadDir = __DIR__ . '/uploads';
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

// ============================================================
// YAPAY ZEKÂ İRSALİYE OKUMA (Kumaş Stok)
// Telefonla çekilen irsaliye fotoğrafını Claude'a gönderir;
// kumaş türü / renk / top adedi / miktar satırlarını JSON döndürür.
// ============================================================
if (isset($_GET['irsaliye_oku']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (empty($ANTHROPIC_API_KEY)) {
        echo json_encode(['error' => 'anahtar_yok', 'mesaj' => 'Yapay zekâ okuma için sunucudaki config.php dosyasına Anthropic API anahtarı eklenmelidir.']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $data = isset($body['data']) ? $body['data'] : '';
    $turler = isset($body['kumas_turleri']) && is_array($body['kumas_turleri']) ? $body['kumas_turleri'] : [];

    if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,(.+)$#s', $data, $m)) {
        http_response_code(400);
        echo json_encode(['error' => 'gecersiz_gorsel']);
        exit;
    }
    $mediaType = 'image/' . ($m[1] === 'jpg' ? 'jpeg' : $m[1]);
    $base64 = $m[2];
    if (strlen($base64) > 8 * 1024 * 1024) { // ~6MB görsel
        http_response_code(400);
        echo json_encode(['error' => 'gorsel_cok_buyuk']);
        exit;
    }

    $turListesi = count($turler) > 0 ? implode(', ', array_map(function($t){ return '"' . $t . '"'; }, $turler)) : '(tanımlı tür yok)';

    $prompt = "Bu fotoğraf bir tekstil kumaş irsaliyesi/sevk pusulası. İçeriğini dikkatle oku.\n"
        . "Sistemde tanımlı kumaş türleri: " . $turListesi . "\n\n"
        . "Görevin: irsaliyedeki HER kumaş satırı için şu bilgileri çıkar:\n"
        . "- kumasTuru: tanımlı türlerden en uygun olanı seç; hiçbiri uymuyorsa irsaliyede yazan adı aynen kullan\n"
        . "- renk: satırdaki renk (yoksa boş bırak)\n"
        . "- topAdedi: top/rulo adedi (sayı; yoksa null)\n"
        . "- miktar: kilogram veya metre miktarı (sayı; ondalık nokta ile)\n"
        . "- birim: \"kg\", \"metre\" veya \"top\"\n"
        . "Ayrıca irsaliyeyi GÖNDEREN firma adını ve irsaliye numarasını bulmaya çalış.\n\n"
        . "YALNIZCA şu şemada geçerli JSON döndür, başka hiçbir metin yazma:\n"
        . "{\"firma\": \"...\", \"irsaliyeNo\": \"...\", \"satirlar\": [{\"kumasTuru\": \"...\", \"renk\": \"...\", \"topAdedi\": 0, \"miktar\": 0, \"birim\": \"kg\"}]}\n"
        . "Okunamayan alanları boş string veya null yap. Emin olmadığın sayıları tahmin etme, null bırak.";

    $istek = [
        'model' => 'claude-opus-4-8',
        'max_tokens' => 2000,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $base64]],
                ['type' => 'text', 'text' => $prompt],
            ],
        ]],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($istek),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_HTTPHEADER => [
            'x-api-key: ' . $ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
            'content-type: application/json',
        ],
    ]);
    $yanit = curl_exec($ch);
    $kod = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlHata = curl_error($ch);
    curl_close($ch);

    if ($yanit === false) {
        http_response_code(502);
        echo json_encode(['error' => 'baglanti_hatasi', 'mesaj' => $curlHata]);
        exit;
    }
    $sonuc = json_decode($yanit, true);
    if ($kod !== 200 || !isset($sonuc['content'][0]['text'])) {
        $msg = isset($sonuc['error']['message']) ? $sonuc['error']['message'] : ('HTTP ' . $kod);
        http_response_code(502);
        echo json_encode(['error' => 'ai_hatasi', 'mesaj' => $msg]);
        exit;
    }

    // Model yanıtından JSON'u ayıkla (```json çitleri gelirse temizle)
    $metin = trim($sonuc['content'][0]['text']);
    $metin = preg_replace('/^```(?:json)?\s*|\s*```$/', '', $metin);
    $ayrisan = json_decode($metin, true);
    if (!is_array($ayrisan) || !isset($ayrisan['satirlar'])) {
        echo json_encode(['error' => 'ayristirilamadi', 'ham' => mb_substr($metin, 0, 500)]);
        exit;
    }

    echo json_encode(['success' => true, 'okuma' => $ayrisan], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// WEB PUSH (Telefon Bildirimleri)
// Payload'sız push kullanılır: push geldiğinde service worker
// en son bildirimi ?push=son endpoint'inden çekip gösterir.
// ============================================================

function b64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// openssl ES256 imzası DER formatındadır; JWS ham r||s (64 bayt) ister
function derToRawSignature($der) {
    $pos = 2; // SEQUENCE başlığını atla (kısa form varsayımı yeterli: imza ~70 bayt)
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        if (ord($der[$pos]) !== 0x02) return false; // INTEGER bekleniyor
        $len = ord($der[$pos + 1]);
        $int = substr($der, $pos + 2, $len);
        $pos += 2 + $len;
        $int = ltrim($int, "\x00");                    // baştaki sıfırları at
        $out .= str_pad($int, 32, "\x00", STR_PAD_LEFT); // 32 bayta tamamla
    }
    return strlen($out) === 64 ? $out : false;
}

function vapidJwt($audience) {
    global $VAPID_SUBJECT, $VAPID_PRIVATE_PEM;
    $header = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 3600,
        'sub' => $VAPID_SUBJECT,
    ]));
    $data = $header . '.' . $claims;
    $sig = '';
    if (!openssl_sign($data, $sig, $VAPID_PRIVATE_PEM, OPENSSL_ALGO_SHA256)) return false;
    $raw = derToRawSignature($sig);
    if ($raw === false) return false;
    return $data . '.' . b64url_encode($raw);
}

function ensurePushTable($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `push_subscriptions` (
            `id` VARCHAR(64) NOT NULL,
            `endpoint` TEXT NOT NULL,
            `p256dh` VARCHAR(255) DEFAULT NULL,
            `auth` VARCHAR(64) DEFAULT NULL,
            `createdAt` VARCHAR(40) DEFAULT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Exception $e) {}
}

// Tüm kayıtlı cihazlara payload'sız push gönder (uyandırma sinyali)
function sendPushToAll($pdo) {
    global $VAPID_PUBLIC;
    ensurePushTable($pdo);
    try {
        $subs = $pdo->query("SELECT id, endpoint FROM push_subscriptions")->fetchAll();
    } catch (Exception $e) {
        return;
    }
    foreach ($subs as $sub) {
        $endpoint = $sub['endpoint'];
        $parts = parse_url($endpoint);
        if (!$parts || empty($parts['scheme']) || empty($parts['host'])) continue;
        $aud = $parts['scheme'] . '://' . $parts['host'];
        $jwt = vapidJwt($aud);
        if (!$jwt) continue;

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_HTTPHEADER => [
                'TTL: 86400',
                'Urgency: high',
                'Content-Length: 0',
                'Authorization: vapid t=' . $jwt . ', k=' . $VAPID_PUBLIC,
            ],
        ]);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // Abonelik ölmüş (cihaz kaldırmış) → kayıttan sil
        if ($code === 404 || $code === 410) {
            try {
                $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE id = ?");
                $stmt->execute([$sub['id']]);
            } catch (Exception $e) {}
        }
    }
}

// ---- PUSH ENDPOINT'LERİ ----
if (isset($_GET['push'])) {
    $action = $_GET['push'];

    if ($action === 'subscribe' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || empty($body['endpoint'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Gecersiz abonelik']);
            exit;
        }
        ensurePushTable($pdo);
        $subId = substr(hash('sha256', $body['endpoint']), 0, 64);
        try {
            $stmt = $pdo->prepare("REPLACE INTO push_subscriptions (id, endpoint, p256dh, auth, createdAt) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $subId,
                $body['endpoint'],
                isset($body['keys']['p256dh']) ? $body['keys']['p256dh'] : null,
                isset($body['keys']['auth']) ? $body['keys']['auth'] : null,
                date('c'),
            ]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Abonelik kaydedilemedi']);
        }
        exit;
    }

    if ($action === 'unsubscribe' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if ($body && !empty($body['endpoint'])) {
            $subId = substr(hash('sha256', $body['endpoint']), 0, 64);
            try {
                $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE id = ?");
                $stmt->execute([$subId]);
            } catch (Exception $e) {}
        }
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'son') {
        // Service worker'ın push sonrası çektiği en yeni bildirim
        try {
            $rows = $pdo->query("SELECT * FROM bildirimler ORDER BY tarih DESC LIMIT 1")->fetchAll();
            echo json_encode(['bildirim' => count($rows) ? $rows[0] : null], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['bildirim' => null]);
        }
        exit;
    }

    if ($action === 'test' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        // Ayarlar sayfasındaki "Test Bildirimi Gönder" butonu
        sendPushToAll($pdo);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Bilinmeyen push islemi']);
    exit;
}

// ---- TABLO HARİTASI ----
$TABLE_MAP = [
    'myhis_firmalar'        => 'firmalar',
    'myhis_urunler'         => 'urunler',
    'myhis_partiler'        => 'partiler',
    'myhis_cariHareketler'  => 'cari_hareketler',
    'myhis_isAkisi'         => 'is_akisi',
    'myhis_bildirimler'     => 'bildirimler',
    'myhis_stoklar'         => 'stoklar',
    'myhis_stokHareketleri' => 'stok_hareketleri',
    'myhis_irsaliyeler'     => 'irsaliyeler',   // YENİ: önceki sürümde eksikti (irsaliyeler kayboluyordu)
    'myhis_kullanicilar'    => 'kullanicilar',  // YENİ: önceki sürümde eksikti (kullanıcılar kayboluyordu)
    'myhis_islemGunlugu'    => 'islem_gunlugu', // v2.3: işlem günlüğü (audit log)
    'myhis_kumasStok'       => 'kumas_stok',    // v2.6: gelen kumaş girişleri
    'myhis_kumasTurleri'    => 'kumas_turleri', // v2.6: tanımlı kumaş türleri (AI eşleştirme)
];

// JSON alanları
$JSON_COLUMNS = ['asorti', 'fiyatlar', 'renkler', 'teslimatGecmisi', 'firmaAtamalari', 'yetkiler', 'fotolar', 'firmaFiyatlari'];
// Boolean alanlar
$BOOL_COLUMNS = ['aktif', 'okundu', 'hesaplandi', 'tamamlandi', 'arsivde'];

// ---- YARDIMCI FONKSİYONLAR ----
function tableExists($pdo, $table) {
    try {
        $pdo->query("SELECT 1 FROM `$table` LIMIT 1");
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function getTableColumns($pdo, $table) {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $stmt = $pdo->query("SHOW COLUMNS FROM `$table`");
    $cols = [];
    while ($row = $stmt->fetch()) {
        $cols[] = $row['Field'];
    }
    $cache[$table] = $cols;
    return $cols;
}

function readTable($pdo, $table, $jsonCols, $boolCols) {
    if (!tableExists($pdo, $table)) return [];
    $stmt = $pdo->query("SELECT * FROM `$table`");
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        foreach ($row as $key => &$val) {
            if ($val !== null && in_array($key, $jsonCols)) {
                $decoded = json_decode($val, true);
                if ($decoded !== null) $val = $decoded;
            }
            if (in_array($key, $boolCols)) {
                $val = ($val == 1 || $val === true) ? true : false;
            }
        }
    }
    return $rows;
}

function syncTable($pdo, $table, $rows, $jsonCols) {
    if (!is_array($rows) || !tableExists($pdo, $table)) return;

    $columns = getTableColumns($pdo, $table);

    // Mevcut ID'leri çek
    $existingIds = [];
    $stmt = $pdo->query("SELECT id FROM `$table`");
    while ($r = $stmt->fetch()) {
        $existingIds[$r['id']] = true;
    }

    $incomingIds = [];
    $seenIds = [];

    foreach ($rows as $row) {
        if (!isset($row['id']) || empty($row['id'])) continue;
        if (isset($seenIds[$row['id']])) continue;
        $seenIds[$row['id']] = true;
        $incomingIds[$row['id']] = true;

        // Sadece tabloda var olan kolonları filtrele
        $filteredRow = [];
        foreach ($columns as $col) {
            if (array_key_exists($col, $row)) {
                $val = $row[$col];
                if (in_array($col, $jsonCols) && (is_array($val) || is_object($val))) {
                    $val = json_encode($val, JSON_UNESCAPED_UNICODE);
                }
                if ($val === true) $val = 1;
                if ($val === false) $val = 0;
                $filteredRow[$col] = $val;
            }
        }

        if (empty($filteredRow) || !isset($filteredRow['id'])) continue;

        // REPLACE INTO: varsa güncelle, yoksa ekle
        $cols = array_keys($filteredRow);
        $placeholders = array_fill(0, count($cols), '?');
        $sql = "REPLACE INTO `$table` (`" . implode('`, `', $cols) . "`) VALUES (" . implode(', ', $placeholders) . ")";
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($filteredRow));
        } catch (Exception $e) {
            // Tek kayıt hata verirse diğerlerine devam et
            error_log("Kayit hatasi ($table, ID: {$row['id']}): " . $e->getMessage());
        }
    }

    // Silinmiş kayıtları kaldır
    // (İstemci artık sadece DEĞİŞEN koleksiyonları gönderdiği için bu işlem
    //  yalnızca gerçekten güncellenen tabloda çalışır — diğer tablolara dokunulmaz)
    foreach ($existingIds as $eid => $_) {
        if (!isset($incomingIds[$eid])) {
            try {
                $stmt = $pdo->prepare("DELETE FROM `$table` WHERE id = ?");
                $stmt->execute([$eid]);
            } catch (Exception $e) {}
        }
    }
}

// ---- GÜNLÜK OTOMATİK YEDEK ----
// Her günün ilk POST isteğinde tüm veritabanı JSON olarak backups/ klasörüne kaydedilir.
// Son 14 günün yedeği saklanır. Klasör dışarıdan erişime kapatılır.
function dailyBackup($pdo, $TABLE_MAP, $JSON_COLUMNS, $BOOL_COLUMNS) {
    $dir = __DIR__ . '/backups';
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) return;
        // Yedek klasörünü web erişimine kapat
        @file_put_contents($dir . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        @file_put_contents($dir . '/index.html', '');
    }
    $file = $dir . '/yedek-' . date('Y-m-d') . '.json';
    if (file_exists($file)) return; // bugünün yedeği zaten alınmış

    $dump = [];
    foreach ($TABLE_MAP as $key => $table) {
        try {
            $dump[$key] = readTable($pdo, $table, $JSON_COLUMNS, $BOOL_COLUMNS);
        } catch (Exception $e) {
            $dump[$key] = [];
        }
    }
    @file_put_contents($file, json_encode($dump, JSON_UNESCAPED_UNICODE));

    // 14 günden eski yedekleri temizle
    $files = glob($dir . '/yedek-*.json');
    if ($files !== false) {
        sort($files);
        while (count($files) > 14) {
            @unlink(array_shift($files));
        }
    }
}

// ---- GET: Tüm verileri oku ----
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = [];
    foreach ($TABLE_MAP as $key => $table) {
        try {
            $result[$key] = readTable($pdo, $table, $JSON_COLUMNS, $BOOL_COLUMNS);
        } catch (Exception $e) {
            $result[$key] = [];
        }
    }
    try {
        $settingsStmt = $pdo->query("SELECT s_key, s_value FROM settings");
        while ($s = $settingsStmt->fetch()) {
            $result[$s['s_key']] = $s['s_value'];
        }
    } catch (Exception $e) {}
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- POST: Verileri kaydet ----
// İstemci yalnızca DEĞİŞEN koleksiyonları gönderir; sadece onlar senkronize edilir.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Gecersiz veri']);
        exit;
    }

    // Yazmadan önce günlük yedek al
    dailyBackup($pdo, $TABLE_MAP, $JSON_COLUMNS, $BOOL_COLUMNS);

    // YENİ bildirim var mı? (sync ÖNCESİ mevcut id'lerle karşılaştır)
    $yeniBildirimVar = false;
    if (isset($input['myhis_bildirimler']) && is_array($input['myhis_bildirimler'])) {
        $mevcutIds = [];
        try {
            $stmt = $pdo->query("SELECT id FROM bildirimler");
            while ($r = $stmt->fetch()) $mevcutIds[$r['id']] = true;
        } catch (Exception $e) {}
        foreach ($input['myhis_bildirimler'] as $b) {
            if (isset($b['id']) && !isset($mevcutIds[$b['id']])) {
                $yeniBildirimVar = true;
                break;
            }
        }
    }

    $errors = [];
    foreach ($TABLE_MAP as $key => $table) {
        if (isset($input[$key]) && is_array($input[$key])) {
            try {
                syncTable($pdo, $table, $input[$key], $JSON_COLUMNS);
            } catch (Exception $e) {
                $errors[] = "$table: " . $e->getMessage();
            }
        }
    }

    // Settings kaydet
    if (isset($input['myhis_tema'])) {
        try {
            $stmt = $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES ('myhis_tema', ?)");
            $stmt->execute([$input['myhis_tema']]);
        } catch (Exception $e) {}
    }

    if (count($errors) > 0) {
        http_response_code(500);
        echo json_encode(['error' => 'Bazi tablolarda hata: ' . implode('; ', $errors)]);
    } else {
        echo json_encode(['success' => true]);
    }

    // Yanıt gönderildikten SONRA push dağıt (istemciyi bekletmemek için)
    if ($yeniBildirimVar) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            // Klasik CGI/mod_php: çıktıyı kapatıp arka planda devam et
            @ob_end_flush();
            @flush();
        }
        ignore_user_abort(true);
        sendPushToAll($pdo);
    }
    exit;
}
?>
