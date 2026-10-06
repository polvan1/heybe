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

// ============================================================
// YAPAY ZEKÂ İRSALİYE OKUMA (Kumaş Stok)
// Telefonla çekilen irsaliye fotoğrafını Claude'a gönderir;
// kumaş türü / renk / top adedi / miktar satırlarını JSON döndürür.
// ============================================================
function irsaliyeOkuIstegi($pdo) {
    global $ANTHROPIC_API_KEY;
    yetkiGerekli($pdo, 'stok_takibi');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
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
