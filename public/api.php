<?php
// HİS ERP - Sunucu API'si
// Yapılandırma config.php'dedir (şablon: config.example.php).
// Yardımcı dosyalar inc/ klasöründedir (web'den doğrudan erişime kapalı).
//
// Uç noktalar:
//   GET  api.php                       → tüm veriler (oturum gerekli)
//   POST api.php                       → değişiklikleri kaydet (delta, yetki kontrollü)
//   GET  api.php?auth=durum            → oturum durumu / ilk kurulum gerekli mi
//   POST api.php?auth=giris|cikis|kurulum
//   POST api.php?kullanici=ekle|guncelle|sil
//   POST api.php?foto=upload|sil
//   POST api.php?irsaliye_oku=1
//   *    api.php?push=subscribe|unsubscribe|son|test
//   POST api.php?sefer=durak|konum             (şoför: durak tamamla, konum paylaş)

// PHP uyarıları JSON cevabın önüne basılıp cevabı bozmasın (hatalar sunucu günlüğüne yazılır)
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

function jsonYanit($veri, $kod = 200) {
    http_response_code($kod);
    echo json_encode($veri, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonHata($kod, $hata, $mesaj) {
    jsonYanit(['error' => $hata, 'mesaj' => $mesaj], $kod);
}

function jsonGovde() {
    $g = json_decode(file_get_contents('php://input'), true);
    return is_array($g) ? $g : [];
}

// Yüklenen fotoğrafların klasörü (uploads/ web'den açılabilir olmalı; varsayılan: api.php'nin yanı)
function veriDizini() {
    global $DATA_DIR;
    return !empty($DATA_DIR) ? rtrim($DATA_DIR, '/\\') : __DIR__;
}

// Yedekler ve bildirim anahtarı gibi GİZLİ dosyaların klasörü.
// Nginx sunucularda .htaccess çalışmadığı için bu klasörün adı tahmin edilemez yapılır
// (config.php'deki veritabanı şifresinden türetilir; kurulumdan kuruluma değişir).
function ozelDizin() {
    global $OZEL_DIR, $DATA_DIR, $DB_PASS, $DB_NAME, $DB_DSN;
    if (!empty($OZEL_DIR)) return rtrim($OZEL_DIR, '/\\');
    if (!empty($DATA_DIR)) return rtrim($DATA_DIR, '/\\');
    $tohum = ($DB_PASS ?? '') . '|' . ($DB_NAME ?? '') . '|' . ($DB_DSN ?? '') . '|his-erp-ozel';
    return __DIR__ . '/ozel-' . substr(hash('sha256', $tohum), 0, 32);
}

// ---- YAPILANDIRMA ----
// HISERP_CONFIG ortam değişkeni sadece geliştirme ortamı içindir (dev/config.php)
$configYolu = getenv('HISERP_CONFIG') ?: __DIR__ . '/config.php';
if (!file_exists($configYolu)) jsonHata(500, 'yapilandirma', 'config.php bulunamadı.');
require $configYolu;

require __DIR__ . '/inc/db.php';
require __DIR__ . '/inc/auth.php';
require __DIR__ . '/inc/sync.php';
require __DIR__ . '/inc/push.php';
require __DIR__ . '/inc/dosya.php';
require __DIR__ . '/inc/sefer.php';

// ---- CSRF KORUMASI ----
// Değişiklik yapan her istek özel bir başlık taşımalı. Tarayıcılar başka bir
// siteden bu başlıkla istek göndermeye izin vermez (CORS ön kontrolü).
if ($_SERVER['REQUEST_METHOD'] === 'POST' && (!isset($_SERVER['HTTP_X_HISERP']) || $_SERVER['HTTP_X_HISERP'] !== '1')) {
    jsonHata(403, 'csrf', 'Geçersiz istek.');
}
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    jsonHata(405, 'yontem', 'Desteklenmeyen istek.');
}

// ---- VERİTABANI ----
try {
    $pdo = dbBaglan();
    semaGuncelle($pdo);
} catch (PDOException $e) {
    error_log('HİS ERP veritabanı hatası: ' . $e->getMessage());
    jsonHata(500, 'db', 'Veritabanı bağlantı hatası.');
}

oturumBaslat();
// Giriş/çıkış dışındaki isteklerde oturum dosyası kilidini hemen bırak:
// aynı kullanıcının paralel istekleri birbirini beklemesin.
if (!isset($_GET['auth'])) {
    aktifKullanici($pdo);
    session_write_close();
}

// ---- YÖNLENDİRME ----
if (isset($_GET['auth']))         authIstegi($pdo, (string)$_GET['auth']);
if (isset($_GET['kullanici']))    kullaniciIstegi($pdo, (string)$_GET['kullanici']);
if (isset($_GET['foto']))         fotoIstegi($pdo);
if (isset($_GET['irsaliye_oku'])) irsaliyeOkuIstegi($pdo);
if (isset($_GET['push']))         pushIstegi($pdo, (string)$_GET['push']);
if (isset($_GET['sefer']))        seferIstegi($pdo, (string)$_GET['sefer']);

$ben = girisGerekli($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonYanit(veriOku($pdo, $ben));
}

// POST: değişiklikleri kaydet
$yeniBildirim = veriYaz($pdo, $ben, jsonGovde());
echo json_encode(['success' => true]);

// Yanıt gönderildikten SONRA push dağıt (istemciyi bekletmemek için)
if ($yeniBildirim) {
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        @ob_end_flush();
        @flush();
    }
    ignore_user_abort(true);
    sendPushToAll($pdo, $yeniBildirim === true ? null : $yeniBildirim);
}
exit;
