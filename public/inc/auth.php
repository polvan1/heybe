<?php
// HİS ERP - Kimlik doğrulama, oturum ve yetki kontrolü
// Oturum sunucu tarafında (PHP session) tutulur; tarayıcıda sadece
// HttpOnly bir çerez bulunur. Şifreler password_hash (bcrypt) ile saklanır.

const OTURUM_SURESI = 30 * 24 * 3600;   // 30 gün (telefonda sürekli giriş istenmesin)
const MAX_HATALI_GIRIS = 10;            // bu kadar hatalı denemeden sonra...
const KILIT_SURESI = 15 * 60;           // ...15 dakika bekletilir

const ROLLER = ['admin', 'uretim', 'muhasebe', 'fasoncu', 'izleyici'];

const TUM_YETKILER = ['anasayfa', 'islerim', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi',
    'firmalar', 'cari_hesaplar', 'irsaliyeler', 'harita', 'raporlar', 'kullanicilar', 'ayarlar'];

// Hangi sayfa yetkisi hangi veri gruplarına YAZMA izni verir.
// (src/data/db.js içindeki işlemlerin dokunduğu koleksiyonlara göre)
const YETKI_YAZMA = [
    'anasayfa'      => ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    'partiler'      => ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    'urunler'       => ['myhis_urunler'],
    'stok_takibi'   => ['myhis_stoklar', 'myhis_stokHareketleri', 'myhis_kumasStok', 'myhis_kumasTurleri', 'myhis_urunler'],
    'firmalar'      => ['myhis_firmalar'],
    'cari_hesaplar' => ['myhis_cariHareketler', 'myhis_partiler'],
    'irsaliyeler'   => ['myhis_irsaliyeler'],
];
// Giriş yapmış herkesin yazabildiği gruplar (bildirim okundu, işlem günlüğü)
const HERKES_YAZAR = ['myhis_bildirimler', 'myhis_islemGunlugu'];

function oturumBaslat() {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    ini_set('session.gc_maxlifetime', (string)OTURUM_SURESI);
    ini_set('session.use_strict_mode', '1');
    session_name('HISERPSESS');
    session_set_cookie_params([
        'lifetime' => OTURUM_SURESI,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// Yanıtta asla şifre hash'i dönmez
function kullaniciGuvenli($k) {
    if (!$k) return null;
    unset($k['sifre']);
    return $k;
}

function kullaniciSatiriniCoz($k) {
    if (!$k) return null;
    $k['aktif'] = !isset($k['aktif']) || $k['aktif'] === null || (int)$k['aktif'] === 1;
    $y = isset($k['yetkiler']) ? json_decode((string)$k['yetkiler'], true) : null;
    $k['yetkiler'] = is_array($y) ? array_values($y) : [];
    return $k;
}

function kullaniciGetir($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM kullanicilar WHERE id = ?");
    $stmt->execute([$id]);
    return kullaniciSatiriniCoz($stmt->fetch() ?: null);
}

function tumKullanicilar($pdo) {
    return array_map('kullaniciSatiriniCoz', $pdo->query("SELECT * FROM kullanicilar")->fetchAll());
}

// Oturumdaki kullanıcı (her istekte veritabanından tazelenir: pasif yapılan
// ya da yetkisi değişen kullanıcı anında etkilenir)
function aktifKullanici($pdo) {
    static $onbellek = false;
    if ($onbellek !== false) return $onbellek;
    $onbellek = null;
    if (!empty($_SESSION['kullaniciId'])) {
        $k = kullaniciGetir($pdo, $_SESSION['kullaniciId']);
        if ($k && $k['aktif']) $onbellek = $k;
    }
    return $onbellek;
}

function girisGerekli($pdo) {
    $k = aktifKullanici($pdo);
    if (!$k) jsonHata(401, 'oturum_yok', 'Oturum açmanız gerekiyor.');
    return $k;
}

function yetkiVar($k, $yetki) {
    if (!$k) return false;
    if ($k['rol'] === 'admin') return true;
    return in_array($yetki, $k['yetkiler'], true);
}

function yetkiGerekli($pdo, $yetki) {
    $k = girisGerekli($pdo);
    if (!yetkiVar($k, $yetki)) jsonHata(403, 'yetki_yok', 'Bu işlem için yetkiniz yok.');
    return $k;
}

function yazabilirMi($k, $koleksiyon) {
    if ($k['rol'] === 'admin') return true;
    if (in_array($koleksiyon, HERKES_YAZAR, true)) return true;
    if ($k['rol'] === 'izleyici') return false; // izleyici sadece görüntüler
    foreach ($k['yetkiler'] as $y) {
        if (isset(YETKI_YAZMA[$y]) && in_array($koleksiyon, YETKI_YAZMA[$y], true)) return true;
    }
    return false;
}

// ---- Şifre ----
function sifreDogrula($girilen, $saklanan) {
    $saklanan = (string)$saklanan;
    if ($saklanan === '') return false;
    if (preg_match('/^[a-f0-9]{64}$/', $saklanan)) {
        // Eski sürüm: tuzsuz SHA-256
        return hash_equals($saklanan, hash('sha256', (string)$girilen));
    }
    if (strpos($saklanan, '$') === 0) {
        return password_verify((string)$girilen, $saklanan);
    }
    // Çok eski sürüm: düz metin
    return hash_equals($saklanan, (string)$girilen);
}

function sifreYukseltilmeli($saklanan) {
    $saklanan = (string)$saklanan;
    return strpos($saklanan, '$') !== 0 || password_needs_rehash($saklanan, PASSWORD_DEFAULT);
}

// ---- Hatalı giriş sınırlaması (IP başına) ----
function girisKilitliMi($pdo, $anahtar) {
    $stmt = $pdo->prepare("SELECT sayi, ilkDeneme FROM giris_denemeleri WHERE id = ?");
    $stmt->execute([$anahtar]);
    $r = $stmt->fetch();
    if (!$r) return false;
    if (time() - (int)$r['ilkDeneme'] > KILIT_SURESI) {
        $pdo->prepare("DELETE FROM giris_denemeleri WHERE id = ?")->execute([$anahtar]);
        return false;
    }
    return (int)$r['sayi'] >= MAX_HATALI_GIRIS;
}

function hataliGirisKaydet($pdo, $anahtar) {
    $stmt = $pdo->prepare("SELECT sayi, ilkDeneme FROM giris_denemeleri WHERE id = ?");
    $stmt->execute([$anahtar]);
    $r = $stmt->fetch();
    $sayi = $r ? (int)$r['sayi'] + 1 : 1;
    $ilk = $r ? (int)$r['ilkDeneme'] : time();
    $pdo->prepare("REPLACE INTO giris_denemeleri (id, sayi, ilkDeneme) VALUES (?, ?, ?)")->execute([$anahtar, $sayi, $ilk]);
}

function girisAnahtari() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?';
    return 'ip:' . substr(hash('sha256', $ip), 0, 32);
}

function yeniId($onEk = '') {
    return $onEk . base_convert((string)time(), 10, 36) . bin2hex(random_bytes(5));
}

function gunlugeYaz($pdo, $k, $islem, $detay) {
    try {
        $pdo->prepare("INSERT INTO islem_gunlugu (id, tarih, kullaniciAd, kullaniciId, islem, detay) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([yeniId(), gmdate('Y-m-d\TH:i:s.v\Z'), $k ? $k['ad'] : 'Sistem', $k ? $k['id'] : null, $islem, $detay]);
    } catch (Exception $e) { /* günlük hatası işlemi engellemesin */ }
}

// ============================================================
// ?auth=durum | giris | cikis | kurulum
// ============================================================
function authIstegi($pdo, $islem) {
    if ($islem === 'durum') {
        $sayi = (int)$pdo->query("SELECT COUNT(*) FROM kullanicilar")->fetchColumn();
        jsonYanit(['kurulumGerekli' => $sayi === 0, 'kullanici' => kullaniciGuvenli(aktifKullanici($pdo))]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
    $govde = jsonGovde();

    if ($islem === 'giris') {
        $anahtar = girisAnahtari();
        if (girisKilitliMi($pdo, $anahtar)) {
            jsonHata(429, 'kilitli', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
        }
        $aranan = mb_strtolower(trim((string)($govde['kimlik'] ?? '')), 'UTF-8');
        $sifre = (string)($govde['sifre'] ?? '');
        if ($aranan === '' || $sifre === '') jsonHata(400, 'eksik', 'Kullanıcı adı ve şifre girin.');

        $bulunan = null;
        foreach (tumKullanicilar($pdo) as $k) {
            $email = mb_strtolower((string)$k['email'], 'UTF-8');
            $ad = mb_strtolower((string)$k['ad'], 'UTF-8');
            if (($email !== '' && $email === $aranan) || ($ad !== '' && $ad === $aranan)) { $bulunan = $k; break; }
        }
        // Kullanıcı yok / pasif / şifre yanlış → aynı mesaj (kullanıcı adı tahminini zorlaştırır)
        if (!$bulunan || !$bulunan['aktif'] || !sifreDogrula($sifre, $bulunan['sifre'])) {
            hataliGirisKaydet($pdo, $anahtar);
            jsonHata(401, 'hatali_giris', 'Kullanıcı adı veya şifre hatalı.');
        }
        if (sifreYukseltilmeli($bulunan['sifre'])) {
            $pdo->prepare("UPDATE kullanicilar SET sifre = ? WHERE id = ?")
                ->execute([password_hash($sifre, PASSWORD_DEFAULT), $bulunan['id']]);
        }
        $pdo->prepare("DELETE FROM giris_denemeleri WHERE id = ?")->execute([$anahtar]);
        session_regenerate_id(true);
        $_SESSION['kullaniciId'] = $bulunan['id'];
        jsonYanit(['success' => true, 'kullanici' => kullaniciGuvenli($bulunan)]);
    }

    if ($islem === 'cikis') {
        $_SESSION = [];
        session_destroy();
        jsonYanit(['success' => true]);
    }

    if ($islem === 'kurulum') {
        // Sadece hiç kullanıcı yokken: ilk yönetici hesabı
        $sayi = (int)$pdo->query("SELECT COUNT(*) FROM kullanicilar")->fetchColumn();
        if ($sayi > 0) jsonHata(403, 'kurulu', 'Sistem zaten kurulmuş.');
        $ad = trim((string)($govde['ad'] ?? ''));
        $sifre = (string)($govde['sifre'] ?? '');
        if ($ad === '') jsonHata(400, 'eksik', 'Ad Soyad girin.');
        if (mb_strlen($sifre) < 6) jsonHata(400, 'zayif_sifre', 'Şifre en az 6 karakter olmalı.');
        $k = [
            'id' => yeniId('usr_'), 'ad' => $ad, 'email' => trim((string)($govde['email'] ?? '')), 'telefon' => '',
            'rol' => 'admin', 'yetkiler' => json_encode(TUM_YETKILER), 'sifre' => password_hash($sifre, PASSWORD_DEFAULT),
            'aktif' => 1, 'firmaId' => null, 'createdAt' => gmdate('Y-m-d\TH:i:s.v\Z'),
        ];
        kullaniciYaz($pdo, $k);
        session_regenerate_id(true);
        $_SESSION['kullaniciId'] = $k['id'];
        $yeni = kullaniciGetir($pdo, $k['id']);
        gunlugeYaz($pdo, $yeni, 'İlk Kurulum', "Yönetici hesabı oluşturuldu: $ad");
        jsonYanit(['success' => true, 'kullanici' => kullaniciGuvenli($yeni)]);
    }

    jsonHata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
}

function kullaniciYaz($pdo, $k) {
    $kolonlar = array_keys($k);
    $sql = "REPLACE INTO kullanicilar (`" . implode('`, `', $kolonlar) . "`) VALUES (" . implode(', ', array_fill(0, count($kolonlar), '?')) . ")";
    $pdo->prepare($sql)->execute(array_values($k));
}

// ============================================================
// ?kullanici=ekle | guncelle | sil   (Kullanıcılar sayfası)
// ============================================================
function kullaniciIstegi($pdo, $islem) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
    $ben = yetkiGerekli($pdo, 'kullanicilar');
    $benAdmin = $ben['rol'] === 'admin';
    $govde = jsonGovde();

    // Gelen alanları temizle
    $temizle = function ($g, $mevcut) use ($benAdmin, $ben) {
        $k = $mevcut ?: [];
        foreach (['ad', 'email', 'telefon'] as $alan) {
            if (array_key_exists($alan, $g)) $k[$alan] = trim((string)$g[$alan]);
        }
        if (array_key_exists('rol', $g)) {
            $rol = in_array($g['rol'], ROLLER, true) ? $g['rol'] : 'izleyici';
            if ($rol === 'admin' && !$benAdmin) jsonHata(403, 'yetki_yok', 'Yönetici hesabını sadece yönetici oluşturabilir.');
            $k['rol'] = $rol;
        }
        if (array_key_exists('yetkiler', $g) && is_array($g['yetkiler'])) {
            $y = array_values(array_intersect($g['yetkiler'], TUM_YETKILER));
            // Yönetici olmayan, sahip olmadığı yetkiyi başkasına veremez
            if (!$benAdmin) $y = array_values(array_intersect($y, $ben['yetkiler']));
            $k['yetkiler'] = $y;
        }
        if (array_key_exists('aktif', $g)) $k['aktif'] = $g['aktif'] ? true : false;
        if (array_key_exists('firmaId', $g)) $k['firmaId'] = $g['firmaId'] ? (string)$g['firmaId'] : null;
        return $k;
    };
    $kaydet = function ($k) use ($pdo) {
        $satir = $k;
        $satir['yetkiler'] = json_encode(isset($k['yetkiler']) ? $k['yetkiler'] : []);
        $satir['aktif'] = !empty($k['aktif']) ? 1 : 0;
        kullaniciYaz($pdo, $satir);
    };

    if ($islem === 'ekle') {
        $k = $temizle($govde, ['rol' => 'izleyici', 'yetkiler' => [], 'aktif' => true, 'firmaId' => null, 'email' => '', 'telefon' => '']);
        if (empty($k['ad'])) jsonHata(400, 'eksik', 'Ad Soyad girin.');
        $sifre = (string)($govde['sifre'] ?? '');
        if (mb_strlen($sifre) < 6) jsonHata(400, 'zayif_sifre', 'Şifre en az 6 karakter olmalı.');
        $k['id'] = yeniId('usr_');
        $k['sifre'] = password_hash($sifre, PASSWORD_DEFAULT);
        $k['createdAt'] = gmdate('Y-m-d\TH:i:s.v\Z');
        $kaydet($k);
        gunlugeYaz($pdo, $ben, 'Kullanıcı Eklendi', "{$k['ad']} ({$k['rol']})");
        jsonYanit(['success' => true, 'kullanici' => kullaniciGuvenli(kullaniciGetir($pdo, $k['id']))]);
    }

    $id = (string)($govde['id'] ?? '');
    $mevcut = $id !== '' ? kullaniciGetir($pdo, $id) : null;
    if (!$mevcut) jsonHata(404, 'yok', 'Kullanıcı bulunamadı.');
    if ($mevcut['rol'] === 'admin' && !$benAdmin) jsonHata(403, 'yetki_yok', 'Yönetici hesabını sadece yönetici değiştirebilir.');

    if ($islem === 'guncelle') {
        $k = $temizle($govde, $mevcut);
        if ($id === $ben['id']) {
            // Kişi kendini kilitleyemesin
            $k['aktif'] = true;
            $k['rol'] = $mevcut['rol'];
        }
        $sifre = (string)($govde['sifre'] ?? '');
        if ($sifre !== '') {
            if (mb_strlen($sifre) < 6) jsonHata(400, 'zayif_sifre', 'Şifre en az 6 karakter olmalı.');
            $k['sifre'] = password_hash($sifre, PASSWORD_DEFAULT);
        }
        $kaydet($k);
        gunlugeYaz($pdo, $ben, 'Kullanıcı Güncellendi', $k['ad'] . ($sifre !== '' ? ' (şifre değişti)' : ''));
        jsonYanit(['success' => true, 'kullanici' => kullaniciGuvenli(kullaniciGetir($pdo, $id))]);
    }

    if ($islem === 'sil') {
        if ($id === $ben['id']) jsonHata(400, 'kendini_silme', 'Oturumu açık olan kullanıcıyı silemezsiniz.');
        $pdo->prepare("DELETE FROM kullanicilar WHERE id = ?")->execute([$id]);
        gunlugeYaz($pdo, $ben, 'Kullanıcı Silindi', $mevcut['ad']);
        jsonYanit(['success' => true]);
    }

    jsonHata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
}
