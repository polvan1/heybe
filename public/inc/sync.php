<?php
// HİS ERP - Veri okuma ve kayıt bazlı (delta) senkronizasyon
//
// İstemci artık bir koleksiyonun TAMAMINI göndermez; sadece değişen
// kayıtları (upsert) ve silinen kayıtların id'lerini (delete) gönderir:
//   POST { "degisiklikler": { "myhis_partiler": { "upsert": [...], "delete": ["id1"] } },
//          "myhis_tema": "dark" }
// Böylece iki kişi aynı anda çalışırken biri diğerinin kaydını silemez.

const TABLO_HARITASI = [
    'myhis_firmalar'        => 'firmalar',
    'myhis_urunler'         => 'urunler',
    'myhis_partiler'        => 'partiler',
    'myhis_cariHareketler'  => 'cari_hareketler',
    'myhis_isAkisi'         => 'is_akisi',
    'myhis_bildirimler'     => 'bildirimler',
    'myhis_stoklar'         => 'stoklar',
    'myhis_stokHareketleri' => 'stok_hareketleri',
    'myhis_irsaliyeler'     => 'irsaliyeler',
    'myhis_kullanicilar'    => 'kullanicilar',   // sadece okunur; yazma ?kullanici= ile
    'myhis_islemGunlugu'    => 'islem_gunlugu',
    'myhis_kumasStok'       => 'kumas_stok',
    'myhis_kumasTurleri'    => 'kumas_turleri',
    'myhis_araclar'         => 'araclar',
    'myhis_seferler'        => 'seferler',
];

const JSON_KOLONLAR = ['asorti', 'fiyatlar', 'renkler', 'teslimatGecmisi', 'firmaAtamalari', 'yetkiler', 'fotolar', 'firmaFiyatlari', 'duraklar'];
const BOOL_KOLONLAR = ['aktif', 'okundu', 'hesaplandi', 'tamamlandi', 'arsivde'];

function satirCoz($satir) {
    // Tabloda kolonu olmayan alanlar ekAlanlar içinde saklanır; geri birleştir
    if (array_key_exists(EK_KOLON, $satir)) {
        $ek = $satir[EK_KOLON] !== null ? json_decode($satir[EK_KOLON], true) : null;
        unset($satir[EK_KOLON]);
        if (is_array($ek)) {
            foreach ($ek as $k => $v) {
                if (!array_key_exists($k, $satir) || $satir[$k] === null) $satir[$k] = $v;
            }
        }
    }
    foreach ($satir as $kolon => $deger) {
        if ($deger !== null && in_array($kolon, JSON_KOLONLAR, true)) {
            $cozulen = json_decode($deger, true);
            if ($cozulen !== null) $satir[$kolon] = $cozulen;
        }
        if (in_array($kolon, BOOL_KOLONLAR, true)) {
            $satir[$kolon] = ($deger == 1 || $deger === true);
        }
    }
    return $satir;
}

// İstemci bu tabloları "en yeni başta" varsayar (ve eskileri bu sırayla budar)
const YENIDEN_ESKIYE = ['bildirimler', 'islem_gunlugu'];

function tabloOku($pdo, $tablo) {
    $sira = in_array($tablo, YENIDEN_ESKIYE, true) ? ' ORDER BY `tarih` DESC' : '';
    try {
        $satirlar = $pdo->query("SELECT * FROM `$tablo`$sira")->fetchAll();
    } catch (Exception $e) {
        return [];
    }
    return array_map('satirCoz', $satirlar);
}

// Hedefli bildirim: kullaniciId doluysa sadece o kişi görür
function bildirimGorurMu($b, $ben) {
    return empty($b['kullaniciId']) || $b['kullaniciId'] === $ben['id'];
}

// Şoför sadece işini yapmak için gerekeni görür: kendi seferleri, o seferlerdeki
// irsaliyeler, firmaların adres/konum/telefonu, kendisine gelen bildirimler.
function soforVerisi($pdo, $ben) {
    $sonuc = array_fill_keys(array_keys(TABLO_HARITASI), []);
    $seferler = array_values(array_filter(tabloOku($pdo, 'seferler'), fn($s) => ($s['soforId'] ?? null) === $ben['id']));
    $irsaliyeIdleri = [];
    foreach ($seferler as $s) {
        foreach ((array)($s['duraklar'] ?? []) as $d) {
            foreach (array_merge((array)($d['alimlar'] ?? []), (array)($d['teslimler'] ?? [])) as $g) {
                if (!empty($g['irsaliyeId'])) $irsaliyeIdleri[$g['irsaliyeId']] = true;
            }
        }
    }
    $sonuc['myhis_seferler'] = $seferler;
    $sonuc['myhis_irsaliyeler'] = array_values(array_filter(tabloOku($pdo, 'irsaliyeler'), fn($i) => isset($irsaliyeIdleri[$i['id']])));
    $sonuc['myhis_firmalar'] = array_map(fn($f) => array_intersect_key($f, array_flip(['id', 'ad', 'tip', 'telefon', 'adres', 'yetkiliKisi', 'lat', 'lng', 'konumAdres', 'aktif'])), tabloOku($pdo, 'firmalar'));
    $sonuc['myhis_araclar'] = array_values(array_filter(tabloOku($pdo, 'araclar'), fn($a) => ($a['soforId'] ?? null) === $ben['id']));
    $sonuc['myhis_bildirimler'] = array_values(array_filter(tabloOku($pdo, 'bildirimler'), fn($b) => ($b['kullaniciId'] ?? null) === $ben['id']));
    $sonuc['myhis_kullanicilar'] = [array_intersect_key(kullaniciGuvenli($ben), array_flip(['id', 'ad', 'rol', 'firmaId', 'aktif']))];
    return $sonuc;
}

// GET: kullanıcının görebileceği tüm veriler
function veriOku($pdo, $ben) {
    if ($ben['rol'] === 'sofor') {
        $sonuc = soforVerisi($pdo, $ben);
        try {
            foreach ($pdo->query("SELECT s_key, s_value FROM settings")->fetchAll() as $s) {
                if (in_array($s['s_key'], ['myhis_tema', 'myhis_merkez'], true)) $sonuc[$s['s_key']] = $s['s_value'];
            }
        } catch (Exception $e) {}
        return $sonuc;
    }
    $sonuc = [];
    foreach (TABLO_HARITASI as $anahtar => $tablo) {
        if ($tablo === 'kullanicilar') continue;
        $sonuc[$anahtar] = tabloOku($pdo, $tablo);
    }
    $sonuc['myhis_bildirimler'] = array_values(array_filter($sonuc['myhis_bildirimler'], fn($b) => bildirimGorurMu($b, $ben)));

    // Kullanıcılar: şifre hash'i ASLA dönmez. Kullanıcı yönetimi yetkisi
    // olmayanlar sadece ad/rol gibi temel bilgileri görür.
    $tamGorur = yetkiVar($ben, 'kullanicilar');
    $sonuc['myhis_kullanicilar'] = array_map(function ($k) use ($tamGorur) {
        $k = kullaniciGuvenli($k);
        if (!$tamGorur) {
            $k = array_intersect_key($k, array_flip(['id', 'ad', 'rol', 'firmaId', 'aktif']));
        }
        return $k;
    }, tumKullanicilar($pdo));

    try {
        foreach ($pdo->query("SELECT s_key, s_value FROM settings")->fetchAll() as $s) {
            if (strpos($s['s_key'], 'myhis_') === 0) $sonuc[$s['s_key']] = $s['s_value'];
        }
    } catch (Exception $e) {}
    return $sonuc;
}

// POST: delta kaydet
function veriYaz($pdo, $ben, $govde) {
    $degisiklikler = isset($govde['degisiklikler']) && is_array($govde['degisiklikler']) ? $govde['degisiklikler'] : [];

    // Önce yetki kontrolü: izinsiz tek bir grup bile varsa hiçbir şey yazılmaz
    $reddedilen = [];
    foreach ($degisiklikler as $anahtar => $_) {
        if (!isset(TABLO_HARITASI[$anahtar]) || $anahtar === 'myhis_kullanicilar' || !yazabilirMi($ben, $anahtar)) {
            $reddedilen[] = $anahtar;
        }
    }
    if ($reddedilen) {
        http_response_code(403);
        echo json_encode(['error' => 'yetki_yok', 'mesaj' => 'Bu verileri değiştirme yetkiniz yok.', 'reddedilen' => $reddedilen], JSON_UNESCAPED_UNICODE);
        exit;
    }

    gunlukYedek($pdo);

    // Yeni bildirim var mı? (push için; yazmadan önce kontrol)
    // Dönüş: false (push yok), true (herkese) ya da hedef kullanıcı id listesi
    $yeniBildirim = false;
    if (!empty($degisiklikler['myhis_bildirimler']['upsert'])) {
        $sorgu = $pdo->prepare("SELECT 1 FROM bildirimler WHERE id = ?");
        $hedefler = [];
        foreach ($degisiklikler['myhis_bildirimler']['upsert'] as $b) {
            if (!isset($b['id'])) continue;
            $sorgu->execute([$b['id']]);
            if ($sorgu->fetchColumn()) continue;
            if (empty($b['kullaniciId'])) { $yeniBildirim = true; break; }
            $hedefler[$b['kullaniciId']] = true;
        }
        if ($yeniBildirim !== true && $hedefler) $yeniBildirim = array_keys($hedefler);
    }

    $pdo->beginTransaction();
    try {
        foreach ($degisiklikler as $anahtar => $d) {
            $tablo = TABLO_HARITASI[$anahtar];
            $kolonlar = tabloKolonlari($pdo, $tablo);
            foreach ((isset($d['upsert']) && is_array($d['upsert']) ? $d['upsert'] : []) as $satir) {
                if (!is_array($satir) || empty($satir['id'])) continue;
                $filtreli = [];
                if (in_array(EK_KOLON, $kolonlar, true)) {
                    $ek = array_diff_key($satir, array_flip($kolonlar));
                    $filtreli[EK_KOLON] = $ek ? json_encode($ek, JSON_UNESCAPED_UNICODE) : null;
                }
                foreach ($kolonlar as $kolon) {
                    if ($kolon === EK_KOLON || !array_key_exists($kolon, $satir)) continue;
                    $deger = $satir[$kolon];
                    if (is_array($deger) || is_object($deger)) $deger = json_encode($deger, JSON_UNESCAPED_UNICODE);
                    if ($deger === true) $deger = 1;
                    if ($deger === false) $deger = 0;
                    $filtreli[$kolon] = $deger;
                }
                $k = array_keys($filtreli);
                $sql = "REPLACE INTO `$tablo` (`" . implode('`, `', $k) . "`) VALUES (" . implode(', ', array_fill(0, count($k), '?')) . ")";
                $pdo->prepare($sql)->execute(array_values($filtreli));
            }
            $sil = $pdo->prepare("DELETE FROM `$tablo` WHERE id = ?");
            foreach ((isset($d['delete']) && is_array($d['delete']) ? $d['delete'] : []) as $id) {
                if (is_string($id) && $id !== '') $sil->execute([$id]);
            }
        }
        if (isset($govde['myhis_tema']) && in_array($govde['myhis_tema'], ['light', 'dark'], true)) {
            $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES ('myhis_tema', ?)")->execute([$govde['myhis_tema']]);
        }
        // Sevkiyat aracının çıkış noktası (merkez): { ad, lat, lng }
        if (isset($govde['myhis_merkez']) && is_array($govde['myhis_merkez'])
            && (yetkiVar($ben, 'ayarlar') || yetkiVar($ben, 'harita'))) {
            $m = $govde['myhis_merkez'];
            $lat = isset($m['lat']) ? (float)$m['lat'] : null;
            $lng = isset($m['lng']) ? (float)$m['lng'] : null;
            if ($lat !== null && $lng !== null && abs($lat) <= 90 && abs($lng) <= 180) {
                $deger = json_encode(['ad' => mb_substr(trim((string)($m['ad'] ?? 'Merkez')), 0, 120), 'lat' => $lat, 'lng' => $lng], JSON_UNESCAPED_UNICODE);
                $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES ('myhis_merkez', ?)")->execute([$deger]);
            }
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('HİS ERP kayıt hatası: ' . $e->getMessage());
        jsonHata(500, 'kayit_hatasi', 'Veriler kaydedilemedi.');
    }
    return $yeniBildirim;
}

// Her günün ilk kaydında tüm veritabanının JSON yedeği (son 14 gün)
function gunlukYedek($pdo) {
    $dizin = veriDizini() . '/backups';
    if (!is_dir($dizin)) {
        if (!@mkdir($dizin, 0755, true)) return;
        @file_put_contents($dizin . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        @file_put_contents($dizin . '/index.html', '');
    }
    $dosya = $dizin . '/yedek-' . date('Y-m-d') . '.json';
    if (file_exists($dosya)) return;

    $dokum = [];
    foreach (TABLO_HARITASI as $anahtar => $tablo) $dokum[$anahtar] = tabloOku($pdo, $tablo);
    @file_put_contents($dosya, json_encode($dokum, JSON_UNESCAPED_UNICODE));

    $dosyalar = glob($dizin . '/yedek-*.json');
    if ($dosyalar !== false) {
        sort($dosyalar);
        while (count($dosyalar) > 14) @unlink(array_shift($dosyalar));
    }
}
