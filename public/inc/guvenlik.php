<?php
// HİS ERP - Sunucu tarafı güvenlik kuralları
//
// 1) Silme şifresi: kritik kayıtların silinmesi sunucuda doğrulanan bir şifre ister.
//    Şifre uygulama kodunda DEĞİL, veritabanında (password_hash) tutulur. Yönetici
//    Ayarlar'dan belirler; belirlenmemişse kişinin kendi giriş şifresi kullanılır.
//    Doğru şifre girilince oturuma 10 dakikalık "silme izni" yazılır; sync'teki
//    korumalı silmeler bu izin olmadan reddedilir.
// 2) Pasif firma: yeni partiye, irsaliyeye veya kumaş girişine pasif firma atanamaz.
// 3) Fasoncu: sadece kendi firmasının işlerini görür (diğer firmalar, fiyatlar, cari yok).

const SILME_IZNI_SURESI = 600;           // sn
const SILME_MAX_HATALI = 5;              // bu kadar hatalı denemeden sonra 15 dk kilit
const SILME_KORUMALI = ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_firmalar', 'myhis_urunler',
    'myhis_stoklar', 'myhis_stokHareketleri', 'myhis_kumasStok', 'myhis_kumasTurleri',
    'myhis_cariHareketler', 'myhis_isAkisi'];

function ayarOku($pdo, $anahtar) {
    $stmt = $pdo->prepare("SELECT s_value FROM settings WHERE s_key = ?");
    $stmt->execute([$anahtar]);
    $v = $stmt->fetchColumn();
    return $v === false ? null : $v;
}

function silmeIzniVar() {
    return !empty($_SESSION['silmeIzni']) && (int)$_SESSION['silmeIzni'] > time();
}

// ?auth=silme_onay (POST {sifre}) | silme_sifresi (POST {sifre, mevcutSifre}) | silme_bilgi (GET)
// auth= istekleri oturumu açık tutar; silme izni oturuma buradan yazılır.
function silmeIstegi($pdo, $islem) {
    $ben = girisGerekli($pdo);
    $hash = ayarOku($pdo, 'silme_sifresi');

    if ($islem === 'silme_bilgi') {
        jsonYanit(['ayarli' => $hash !== null && $hash !== '', 'izin' => silmeIzniVar()]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
    $govde = jsonGovde();

    if ($islem === 'silme_onay') {
        $anahtar = 'silme:' . substr(hash('sha256', (string)$ben['id']), 0, 32);
        if (silmeKilitliMi($pdo, $anahtar)) jsonHata(429, 'kilitli', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
        $sifre = (string)($govde['sifre'] ?? '');
        $dogru = $sifre !== '' && ($hash ? password_verify($sifre, $hash) : sifreDogrula($sifre, $ben['sifre'] ?? ''));
        if (!$dogru) {
            hataliGirisKaydet($pdo, $anahtar);
            jsonHata(403, 'sifre_hatali', 'Şifre hatalı — silme işlemi iptal edildi.');
        }
        $pdo->prepare("DELETE FROM giris_denemeleri WHERE id = ?")->execute([$anahtar]);
        $_SESSION['silmeIzni'] = time() + SILME_IZNI_SURESI;
        jsonYanit(['success' => true, 'sure' => SILME_IZNI_SURESI]);
    }

    if ($islem === 'silme_sifresi') {
        if ($ben['rol'] !== 'admin') jsonHata(403, 'yetki_yok', 'Silme şifresini sadece yönetici belirleyebilir.');
        if (!sifreDogrula((string)($govde['mevcutSifre'] ?? ''), $ben['sifre'] ?? '')) {
            jsonHata(403, 'sifre_hatali', 'Giriş şifreniz hatalı.');
        }
        $yeni = (string)($govde['sifre'] ?? '');
        if ($yeni === '') {
            $pdo->prepare("DELETE FROM settings WHERE s_key = 'silme_sifresi'")->execute();
            gunlugeYaz($pdo, $ben, 'Silme Şifresi', 'Ortak silme şifresi kaldırıldı (herkes kendi giriş şifresini kullanır)');
            jsonYanit(['success' => true, 'ayarli' => false]);
        }
        if (mb_strlen($yeni) < 4) jsonHata(400, 'zayif_sifre', 'Silme şifresi en az 4 karakter olmalı.');
        $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES ('silme_sifresi', ?)")->execute([password_hash($yeni, PASSWORD_DEFAULT)]);
        gunlugeYaz($pdo, $ben, 'Silme Şifresi', 'Ortak silme şifresi değiştirildi');
        jsonYanit(['success' => true, 'ayarli' => true]);
    }
    jsonHata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
}

// Hatalı silme şifresi denemeleri (giriş denemeleriyle aynı tabloda, ayrı anahtarla)
function silmeKilitliMi($pdo, $anahtar) {
    $stmt = $pdo->prepare("SELECT sayi, ilkDeneme FROM giris_denemeleri WHERE id = ?");
    $stmt->execute([$anahtar]);
    $r = $stmt->fetch();
    if (!$r) return false;
    if (time() - (int)$r['ilkDeneme'] > KILIT_SURESI) {
        $pdo->prepare("DELETE FROM giris_denemeleri WHERE id = ?")->execute([$anahtar]);
        return false;
    }
    return (int)$r['sayi'] >= SILME_MAX_HATALI;
}

// Sync: korumalı koleksiyonlarda silme varsa geçerli silme izni gerekir
function silmeKontrol($degisiklikler) {
    foreach (SILME_KORUMALI as $anahtar) {
        if (!empty($degisiklikler[$anahtar]['delete']) && !silmeIzniVar()) {
            jsonHata(403, 'silme_onayi_gerekli', 'Silme işlemi için güvenlik şifresi doğrulanmalı. Tekrar deneyin.');
        }
    }
}

// Sync: yeni kayda (ya da firması değiştirilen kayda) pasif firma atanamaz
const PASIF_FIRMA_ALANLARI = [
    'myhis_partiler' => ['partiler', ['kesimhaneId', 'dikimhaneId', 'utupaketciId']],
    'myhis_irsaliyeler' => ['irsaliyeler', ['gonderenFirmaId', 'alanFirmaId']],
    'myhis_kumasStok' => ['kumas_stok', ['gelenFirmaId', 'kesimhaneId']],
];

function pasifFirmaKontrol($pdo, $degisiklikler) {
    $kontrolVar = false;
    foreach (PASIF_FIRMA_ALANLARI as $anahtar => $_) if (!empty($degisiklikler[$anahtar]['upsert'])) $kontrolVar = true;
    if (!$kontrolVar) return;

    $firmalar = [];
    foreach (tabloOku($pdo, 'firmalar') as $f) $firmalar[$f['id']] = $f;
    // Aynı istekte firma yeniden aktifleştiriliyorsa onu esas al
    foreach (($degisiklikler['myhis_firmalar']['upsert'] ?? []) as $f) {
        if (is_array($f) && !empty($f['id'])) $firmalar[$f['id']] = $f;
    }
    $pasifMi = fn($id) => isset($firmalar[$id]) && array_key_exists('aktif', $firmalar[$id])
        && ($firmalar[$id]['aktif'] === false || $firmalar[$id]['aktif'] === 0 || $firmalar[$id]['aktif'] === '0');

    foreach (PASIF_FIRMA_ALANLARI as $anahtar => [$tablo, $alanlar]) {
        foreach (($degisiklikler[$anahtar]['upsert'] ?? []) as $kayit) {
            if (!is_array($kayit) || empty($kayit['id'])) continue;
            $mevcut = null;
            foreach ($alanlar as $alan) {
                $id = $kayit[$alan] ?? null;
                if (!$id || !$pasifMi($id)) continue;
                if ($mevcut === null) $mevcut = kayitGetir($pdo, $tablo, $kayit['id']) ?: [];
                if (($mevcut[$alan] ?? null) === $id) continue; // zaten bu firmadaydı (geçmiş kayıt)
                jsonHata(403, 'pasif_firma', ($firmalar[$id]['ad'] ?? 'Seçilen firma') . ' pasif durumda; yeni işe atanamaz. Önce firmayı aktifleştirin.');
            }
        }
    }
}

// ---- Fasoncu ----
function partiFirmaya($p, $firmaId) {
    if (($p['kesimhaneId'] ?? null) === $firmaId || ($p['dikimhaneId'] ?? null) === $firmaId || ($p['utupaketciId'] ?? null) === $firmaId) return true;
    foreach ((is_array($p['firmaAtamalari'] ?? null) ? $p['firmaAtamalari'] : []) as $a) {
        if (is_array($a) && ($a['firmaId'] ?? null) === $firmaId) return true;
    }
    return false;
}

function fasoncuVerisi($pdo, $ben) {
    $firmaId = !empty($ben['firmaId']) ? (string)$ben['firmaId'] : '';
    $sonuc = array_fill_keys(array_keys(TABLO_HARITASI), []);
    if ($firmaId !== '') {
        $sonuc['myhis_partiler'] = array_values(array_map(function ($p) use ($firmaId) {
            // Sadece kendi işinin birim fiyatı görünür
            if (($p['kesimhaneId'] ?? null) !== $firmaId) unset($p['kesimBirimFiyat']);
            if (($p['dikimhaneId'] ?? null) !== $firmaId) unset($p['dikimBirimFiyat']);
            if (($p['utupaketciId'] ?? null) !== $firmaId) unset($p['utuBirimFiyat']);
            if (isset($p['firmaAtamalari']) && is_array($p['firmaAtamalari'])) {
                $p['firmaAtamalari'] = array_values(array_filter($p['firmaAtamalari'], fn($a) => is_array($a) && ($a['firmaId'] ?? null) === $firmaId));
            }
            return $p;
        }, array_filter(tabloOku($pdo, 'partiler'), fn($p) => partiFirmaya($p, $firmaId))));
        $sonuc['myhis_irsaliyeler'] = array_values(array_filter(tabloOku($pdo, 'irsaliyeler'), fn($i) => irsaliyeFirmayaAit($i, $firmaId)));
        $sonuc['myhis_cariHareketler'] = array_values(array_filter(tabloOku($pdo, 'cari_hareketler'), fn($h) => ($h['firmaId'] ?? null) === $firmaId));
        $sonuc['myhis_isAkisi'] = array_values(array_filter(tabloOku($pdo, 'is_akisi'), fn($a) => ($a['firmaId'] ?? null) === $firmaId));
    }
    $sonuc['myhis_urunler'] = array_map(fn($u) => array_diff_key($u, array_flip(KESIMHANE_URUN_GIZLI)), tabloOku($pdo, 'urunler'));
    $sonuc['myhis_firmalar'] = array_map(fn($f) => $f['id'] === $firmaId ? $f : array_intersect_key($f, array_flip(KESIMHANE_FIRMA_ALANLARI)), tabloOku($pdo, 'firmalar'));
    $sonuc['myhis_bildirimler'] = array_values(array_filter(tabloOku($pdo, 'bildirimler'), fn($b) => ($b['kullaniciId'] ?? null) === $ben['id']));
    $sonuc['myhis_kullanicilar'] = [array_intersect_key(kullaniciGuvenli($ben), array_flip(['id', 'ad', 'rol', 'firmaId', 'aktif']))];
    return $sonuc;
}
