<?php
// HİS ERP - Veritabanı bağlantısı ve şema yönetimi
// MySQL (üretim, cPanel) ve SQLite (geliştirme/test) desteklenir.

function dbBaglan() {
    global $DB_DSN, $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
    $secenekler = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
    if (!empty($DB_DSN)) {
        // Örn. 'sqlite:/yol/veritabani.sqlite' (geliştirme ortamı)
        $pdo = new PDO($DB_DSN, isset($DB_USER) ? $DB_USER : null, isset($DB_PASS) ? $DB_PASS : null, $secenekler);
    } else {
        $secenekler[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4";
        $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, $secenekler);
    }
    return $pdo;
}

function dbSurucu($pdo) {
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
}

// ============================================================
// ŞEMA
// Her tablo: kolon => tanım. 'id' her tabloda birincil anahtardır.
// Yeni kurulumda tablolar oluşturulur; mevcut kurulumda yalnızca
// EKSİK kolonlar eklenir (mevcut veriye dokunulmaz).
// ============================================================
const SEMA_SURUMU = 6;

function semaTanimi() {
    $ts = 'VARCHAR(40) DEFAULT NULL';     // ISO tarih metni
    $ref = 'VARCHAR(40) DEFAULT NULL';    // başka kayda id referansı
    $metin = 'TEXT DEFAULT NULL';
    $json = 'LONGTEXT DEFAULT NULL';
    $sayi = 'DOUBLE DEFAULT NULL';
    $tam = 'INT DEFAULT NULL';
    $bool = 'TINYINT(1) DEFAULT 0';

    return [
        'firmalar' => [
            'ad' => 'VARCHAR(255) DEFAULT NULL', 'tip' => 'VARCHAR(40) DEFAULT NULL',
            'telefon' => 'VARCHAR(40) DEFAULT NULL', 'email' => 'VARCHAR(160) DEFAULT NULL',
            'adres' => $metin, 'yetkiliKisi' => 'VARCHAR(160) DEFAULT NULL',
            'odemeVadesi' => $tam, 'gunlukKapasite' => $tam, 'notlar' => $metin,
            'lat' => $sayi, 'lng' => $sayi, 'konumAdres' => 'VARCHAR(255) DEFAULT NULL',
            'aktif' => 'TINYINT(1) DEFAULT 1', 'createdAt' => $ts, 'updatedAt' => $ts,
        ],
        'urunler' => [
            'urunKodu' => 'VARCHAR(80) DEFAULT NULL', 'urunAdi' => 'VARCHAR(255) DEFAULT NULL',
            'aciklama' => $metin, 'bedenler' => 'VARCHAR(255) DEFAULT NULL', 'asorti' => $json,
            'kesimFiyat' => $sayi, 'dikimFiyat' => $sayi, 'utuFiyat' => $sayi,
            'fiyatlar' => $json, 'firmaFiyatlari' => $json, 'foto' => 'VARCHAR(255) DEFAULT NULL',
            'stokAdet' => $sayi, 'aktif' => 'TINYINT(1) DEFAULT 1', 'createdAt' => $ts, 'updatedAt' => $ts,
        ],
        'partiler' => [
            'partiNo' => 'VARCHAR(30) DEFAULT NULL', 'urunId' => $ref,
            'urunKodu' => 'VARCHAR(80) DEFAULT NULL', 'urunAdi' => 'VARCHAR(255) DEFAULT NULL',
            'toplamAdet' => $sayi, 'kalanAdet' => $sayi, 'dikimdenCikanAdet' => $sayi, 'sonCikanAdet' => $sayi,
            'renkler' => $json, 'asorti' => $json, 'durum' => 'VARCHAR(20) DEFAULT NULL',
            'kesimhaneId' => $ref, 'dikimhaneId' => $ref, 'utupaketciId' => $ref,
            'kesimBirimFiyat' => $sayi, 'dikimBirimFiyat' => $sayi, 'utuBirimFiyat' => $sayi,
            'dikimBaslamaTarihi' => $ts, 'dikimBitisTarihi' => $ts,
            'firmaAtamalari' => $json, 'teslimatGecmisi' => $json, 'fotolar' => $json,
            'notlar' => $metin, 'arsivde' => $bool, 'createdAt' => $ts, 'updatedAt' => $ts,
        ],
        'cari_hareketler' => [
            'firmaId' => $ref, 'partiId' => $ref, 'tip' => 'VARCHAR(20) DEFAULT NULL',
            'tutar' => $sayi, 'aciklama' => $metin, 'tarih' => $ts,
            'hesaplandi' => $bool, 'hesapTarihi' => $ts, 'createdAt' => $ts,
        ],
        'is_akisi' => [
            'partiId' => $ref, 'adim' => 'VARCHAR(40) DEFAULT NULL', 'firmaId' => $ref,
            'girilenAdet' => $sayi, 'cikanAdet' => $sayi, 'durum' => 'VARCHAR(20) DEFAULT NULL',
            'baslangicTarihi' => $ts, 'bitisTarihi' => $ts,
        ],
        'bildirimler' => [
            'tip' => 'VARCHAR(40) DEFAULT NULL', 'baslik' => 'VARCHAR(255) DEFAULT NULL',
            'mesaj' => $metin, 'link' => 'VARCHAR(255) DEFAULT NULL', 'okundu' => $bool, 'tarih' => $ts,
            'kullaniciId' => $ref,   // doluysa sadece o kullanıcıya (ör. şoföre) gösterilir
        ],
        'araclar' => [
            'ad' => 'VARCHAR(80) DEFAULT NULL', 'plaka' => 'VARCHAR(20) DEFAULT NULL', 'soforId' => $ref,
            'renk' => 'VARCHAR(20) DEFAULT NULL', 'aktif' => 'TINYINT(1) DEFAULT 1', 'notlar' => $metin,
            'sonLat' => $sayi, 'sonLng' => $sayi, 'sonKonumZamani' => $ts, 'createdAt' => $ts,
        ],
        'seferler' => [
            'aracId' => $ref, 'soforId' => $ref, 'tarih' => $ts, 'durum' => "VARCHAR(20) DEFAULT 'atandi'",
            'duraklar' => $json, 'toplamKm' => $sayi, 'sureDk' => $tam,
            'olusturanId' => $ref, 'olusturanAd' => 'VARCHAR(120) DEFAULT NULL',
            'baslamaZamani' => $ts, 'bitisZamani' => $ts, 'createdAt' => $ts, 'updatedAt' => $ts,
        ],
        'stoklar' => [
            'ad' => 'VARCHAR(255) DEFAULT NULL', 'tip' => 'VARCHAR(40) DEFAULT NULL',
            'renk' => 'VARCHAR(80) DEFAULT NULL', 'birim' => 'VARCHAR(20) DEFAULT NULL',
            'miktar' => $sayi, 'kalanMiktar' => $sayi, 'firmaId' => $ref, 'notlar' => $metin, 'createdAt' => $ts,
        ],
        'stok_hareketleri' => [
            'stokId' => $ref, 'urunId' => $ref, 'tip' => 'VARCHAR(20) DEFAULT NULL',
            'miktar' => $sayi, 'aciklama' => $metin, 'tarih' => $ts,
        ],
        'irsaliyeler' => [
            'irsaliyeNo' => 'VARCHAR(30) DEFAULT NULL', 'partiId' => $ref, 'partiNo' => 'VARCHAR(30) DEFAULT NULL',
            'urunKodu' => 'VARCHAR(80) DEFAULT NULL', 'urunAdi' => 'VARCHAR(255) DEFAULT NULL',
            'toplamAdet' => $tam, 'renkler' => $json, 'asorti' => $json,
            'tip' => "VARCHAR(40) DEFAULT 'genel'", 'durum' => "VARCHAR(20) DEFAULT 'taslak'",
            'gonderenFirmaId' => $ref, 'gonderenFirmaAdi' => 'VARCHAR(255) DEFAULT NULL',
            'alanFirmaId' => $ref, 'alanFirmaAdi' => 'VARCHAR(255) DEFAULT NULL',
            'gonderenTel' => 'VARCHAR(40) DEFAULT NULL', 'gonderenAdres' => $metin,
            'alanTel' => 'VARCHAR(40) DEFAULT NULL', 'alanAdres' => $metin, 'notlar' => $metin,
            'tarih' => $ts, 'onayTarihi' => $ts, 'teslimTarihi' => $ts, 'iptalTarihi' => $ts,
            'createdAt' => $ts, 'updatedAt' => $ts,
        ],
        'kullanicilar' => [
            'ad' => 'VARCHAR(120) DEFAULT NULL', 'email' => 'VARCHAR(160) DEFAULT NULL',
            'telefon' => 'VARCHAR(40) DEFAULT NULL', 'rol' => "VARCHAR(20) DEFAULT 'fasoncu'",
            'yetkiler' => $json, 'sifre' => 'VARCHAR(255) DEFAULT NULL',
            'aktif' => 'TINYINT(1) DEFAULT 1', 'firmaId' => $ref, 'createdAt' => $ts,
        ],
        'islem_gunlugu' => [
            'tarih' => $ts, 'kullaniciAd' => 'VARCHAR(120) DEFAULT NULL', 'kullaniciId' => $ref,
            'islem' => 'VARCHAR(80) DEFAULT NULL', 'detay' => $metin,
        ],
        'kumas_stok' => [
            'kumasAdi' => 'VARCHAR(160) DEFAULT NULL', 'renk' => 'VARCHAR(80) DEFAULT NULL',
            'miktar' => 'DOUBLE DEFAULT 0', 'topAdedi' => $sayi, 'birim' => "VARCHAR(20) DEFAULT 'kg'",
            'gelenFirmaId' => $ref, 'gelenFirmaAdi' => 'VARCHAR(255) DEFAULT NULL',
            'partiId' => $ref, 'partiNo' => 'VARCHAR(30) DEFAULT NULL',
            'referansNo' => 'VARCHAR(160) DEFAULT NULL', 'notlar' => $metin, 'tarih' => $ts, 'createdAt' => $ts,
        ],
        'kumas_turleri' => [
            'ad' => 'VARCHAR(160) DEFAULT NULL', 'birim' => "VARCHAR(20) DEFAULT 'kg'", 'createdAt' => $ts,
        ],
        'push_subscriptions' => [
            'endpoint' => 'TEXT NOT NULL', 'p256dh' => 'VARCHAR(255) DEFAULT NULL',
            'auth' => 'VARCHAR(64) DEFAULT NULL', 'kullaniciId' => $ref, 'createdAt' => $ts,
        ],
        'giris_denemeleri' => [
            'sayi' => 'INT DEFAULT 0', 'ilkDeneme' => 'INT DEFAULT 0',
        ],
    ];
}

// Veri tablolarına eklenen genel JSON kolonu: uygulamanın gönderdiği ama tabloda
// karşılığı olmayan alanlar burada saklanır (hiçbir alan sessizce kaybolmasın).
const EK_KOLON = 'ekAlanlar';
const EK_KOLONSUZ = ['kullanicilar', 'push_subscriptions', 'giris_denemeleri'];

function tabloKolonlari($pdo, $tablo, $tazele = false) {
    static $onbellek = [];
    if (!$tazele && isset($onbellek[$tablo])) return $onbellek[$tablo];
    $kolonlar = [];
    if (dbSurucu($pdo) === 'sqlite') {
        foreach ($pdo->query("PRAGMA table_info(`$tablo`)")->fetchAll() as $r) $kolonlar[] = $r['name'];
    } else {
        foreach ($pdo->query("SHOW COLUMNS FROM `$tablo`")->fetchAll() as $r) $kolonlar[] = $r['Field'];
    }
    return $onbellek[$tablo] = $kolonlar;
}

function semaGuncelle($pdo) {
    // settings tablosu şema sürümünü tutar; sürüm güncelse hiçbir şey yapılmaz
    $mysql = dbSurucu($pdo) === 'mysql';
    $ek = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS `settings` (`s_key` VARCHAR(60) NOT NULL, `s_value` LONGTEXT DEFAULT NULL, PRIMARY KEY (`s_key`))$ek");

    $stmt = $pdo->prepare("SELECT s_value FROM settings WHERE s_key = 'sema_surumu'");
    $stmt->execute();
    $mevcut = $stmt->fetchColumn();
    if ((int)$mevcut >= SEMA_SURUMU) return;

    foreach (semaTanimi() as $tablo => $kolonlar) {
        $idTip = $tablo === 'push_subscriptions' ? 'VARCHAR(64)' : 'VARCHAR(40)';
        if (!in_array($tablo, EK_KOLONSUZ, true)) $kolonlar[EK_KOLON] = 'LONGTEXT DEFAULT NULL';
        $parcalar = ["`id` $idTip NOT NULL"];
        foreach ($kolonlar as $k => $tanim) $parcalar[] = "`$k` $tanim";
        $parcalar[] = 'PRIMARY KEY (`id`)';
        $pdo->exec("CREATE TABLE IF NOT EXISTS `$tablo` (" . implode(', ', $parcalar) . ")$ek");

        $varOlan = tabloKolonlari($pdo, $tablo, true);
        foreach ($kolonlar as $k => $tanim) {
            if (!in_array($k, $varOlan, true)) {
                // NOT NULL kolonlar mevcut satırlar yüzünden eklenemeyebilir → nullable ekle
                $tanim = str_replace('NOT NULL', 'DEFAULT NULL', $tanim);
                $pdo->exec("ALTER TABLE `$tablo` ADD COLUMN `$k` $tanim");
            }
        }
    }
    $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES ('sema_surumu', ?)")->execute([(string)SEMA_SURUMU]);
}
