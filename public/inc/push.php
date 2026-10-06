<?php
// HİS ERP - Web Push (telefon bildirimleri)
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

// Tüm kayıtlı cihazlara payload'sız push gönder (uyandırma sinyali)
function sendPushToAll($pdo) {
    global $VAPID_PUBLIC;
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

// ---- PUSH ENDPOINT'LERİ (?push=...) — hepsi oturum gerektirir ----
function pushIstegi($pdo, $action) {
    $ben = girisGerekli($pdo);

    if ($action === 'anahtar') {
        // Ön yüz abone olurken bu public key'i kullanır (config.php tek kaynak)
        global $VAPID_PUBLIC;
        jsonYanit(['publicKey' => (string)$VAPID_PUBLIC]);
    }

    if ($action === 'subscribe' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || empty($body['endpoint'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Gecersiz abonelik']);
            exit;
        }
            $subId = substr(hash('sha256', $body['endpoint']), 0, 64);
        try {
            $stmt = $pdo->prepare("REPLACE INTO push_subscriptions (id, endpoint, p256dh, auth, kullaniciId, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $subId,
                $body['endpoint'],
                isset($body['keys']['p256dh']) ? $body['keys']['p256dh'] : null,
                isset($body['keys']['auth']) ? $body['keys']['auth'] : null,
                $ben['id'],
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
