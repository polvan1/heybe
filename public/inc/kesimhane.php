<?php
// HİS ERP - Kesimhane yetkilisi rolü
//
// Kesimhane yetkilisi bir kesimhane firmasına bağlı kullanıcıdır (kullanicilar.firmaId).
//   - Sadece kendi kesimhanesinin partilerini, irsaliyelerini ve kumaş stoğunu görür.
//   - Parti oluşturabilir, kesim adetlerini girip "kesildi" / "dikime gönderildi"
//     olarak işaretleyebilir, kesimhanesine gelen kumaşı stoğa girebilir.
//   - Oluşturduğu irsaliyeler TASLAK olur; onaylama yetkisi yoktur.
// Parti/irsaliye numarası ve birim fiyatlar istemciye güvenilmeden sunucuda belirlenir
// (kesimhane diğer firmaların kayıtlarını ve fiyat anlaşmalarını göremez).

const KESIMHANE_FIRMA_ALANLARI = ['id', 'ad', 'tip', 'telefon', 'adres', 'yetkiliKisi', 'lat', 'lng', 'konumAdres', 'aktif'];
const KESIMHANE_URUN_GIZLI = ['kesimFiyat', 'dikimFiyat', 'utuFiyat', 'firmaFiyatlari', 'fiyatlar'];

// Kesimhanenin partide değiştirebileceği alanlar (gerisi sunucudaki halinden korunur)
const KESIMHANE_PARTI_ALANLARI = ['kesimDurumu', 'kesilenAdet', 'kesilenRenkler', 'kesimTarihi', 'kesimNotu',
    'gonderimTarihi', 'dikimeGonderilenAdet', 'fotolar', 'durum', 'kalanAdet', 'sonCikanAdet', 'teslimatGecmisi', 'dikimBaslamaTarihi', 'updatedAt'];
const KESIMHANE_IRSALIYE_ALANLARI = ['toplamAdet', 'notlar', 'renkler', 'updatedAt'];
// Kumaş alım fiyatı ve tedarikçi carisine bağlantı kesimhaneye gösterilmez, kesimhane değiştiremez
const KESIMHANE_KUMAS_GIZLI = ['birimFiyat', 'tutar', 'cariHareketId'];

function kesimhaneFirmaId($ben) {
    return !empty($ben['firmaId']) ? (string)$ben['firmaId'] : '';
}

function kayitGetir($pdo, $tablo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM `$tablo` WHERE id = ?");
    $stmt->execute([$id]);
    $satir = $stmt->fetch();
    return $satir ? satirCoz($satir) : null;
}

// Kumaş kaydı hangi kesimhanede? (eski kayıtlarda alan yoksa geldiği firma)
function kumasKesimhanesi($k) {
    if (!empty($k['kesimhaneId'])) return (string)$k['kesimhaneId'];
    return '';
}

// Kumaş girişine bağlı, henüz "Hesabı Kapat" yapılmamış cari borç (yoksa null)
function kumasBagliBorc($pdo, $kumas) {
    if (!$kumas || empty($kumas['cariHareketId'])) return null;
    $borc = kayitGetir($pdo, 'cari_hareketler', (string)$kumas['cariHareketId']);
    if (!$borc || !empty($borc['hesaplandi']) || ($borc['kumasStokId'] ?? null) !== $kumas['id']) return null;
    return $borc;
}

function irsaliyeFirmayaAit($i, $firmaId) {
    return ($i['gonderenFirmaId'] ?? null) === $firmaId || ($i['alanFirmaId'] ?? null) === $firmaId;
}

// GET: kesimhane yetkilisinin görebileceği veriler
function kesimhaneVerisi($pdo, $ben) {
    $firmaId = kesimhaneFirmaId($ben);
    $sonuc = array_fill_keys(array_keys(TABLO_HARITASI), []);
    if ($firmaId !== '') {
        $partiler = array_values(array_filter(tabloOku($pdo, 'partiler'), fn($p) => ($p['kesimhaneId'] ?? null) === $firmaId));
        // Fiyat bilgisi kesimhaneye gösterilmez
        $sonuc['myhis_partiler'] = array_map(function ($p) {
            unset($p['kesimBirimFiyat'], $p['dikimBirimFiyat'], $p['utuBirimFiyat']);
            return $p;
        }, $partiler);
        $sonuc['myhis_irsaliyeler'] = array_values(array_filter(tabloOku($pdo, 'irsaliyeler'), fn($i) => irsaliyeFirmayaAit($i, $firmaId)));
        $sonuc['myhis_kumasStok'] = array_values(array_map(
            fn($k) => array_diff_key($k, array_flip(KESIMHANE_KUMAS_GIZLI)),
            array_filter(tabloOku($pdo, 'kumas_stok'), fn($k) => kumasKesimhanesi($k) === $firmaId)));
    }
    $sonuc['myhis_kumasTurleri'] = tabloOku($pdo, 'kumas_turleri');
    $sonuc['myhis_urunler'] = array_map(fn($u) => array_diff_key($u, array_flip(KESIMHANE_URUN_GIZLI)), tabloOku($pdo, 'urunler'));
    $sonuc['myhis_firmalar'] = array_map(fn($f) => array_intersect_key($f, array_flip(KESIMHANE_FIRMA_ALANLARI)), tabloOku($pdo, 'firmalar'));
    $sonuc['myhis_bildirimler'] = array_values(array_filter(tabloOku($pdo, 'bildirimler'), fn($b) => ($b['kullaniciId'] ?? null) === $ben['id']));
    $sonuc['myhis_kullanicilar'] = [array_intersect_key(kullaniciGuvenli($ben), array_flip(['id', 'ad', 'rol', 'firmaId', 'aktif']))];
    return $sonuc;
}

// Ürün + firma için birim fiyat (src/data/db.js firmaFiyatBul ile aynı kural)
function sunucuFiyatBul($urun, $firmaId, $tip) {
    if (!$urun) return 0;
    $ozel = $firmaId ? ($urun['firmaFiyatlari'][$firmaId][$tip] ?? null) : null;
    if ($ozel !== null && $ozel !== '' && (float)$ozel > 0) return (float)$ozel;
    return (float)($urun[$tip . 'Fiyat'] ?? 0);
}

function sonrakiNumara($pdo, $tablo, $kolon, $desen, $ekNumaralar) {
    $max = 0;
    foreach ($pdo->query("SELECT `$kolon` FROM `$tablo`")->fetchAll(PDO::FETCH_COLUMN) as $no) {
        if (preg_match($desen, (string)$no, $m)) $max = max($max, (int)$m[1]);
    }
    foreach ($ekNumaralar as $no) {
        if (preg_match($desen, (string)$no, $m)) $max = max($max, (int)$m[1]);
    }
    return $max + 1;
}

function kesimhaneRed($mesaj) {
    jsonHata(403, 'yetki_yok', $mesaj);
}

// POST: kesimhane yetkilisinin gönderdiği değişiklikleri denetler ve düzeltir.
// Başka firmaya ait kayda dokunma → istek reddedilir. Numara, fiyat, durum gibi
// sunucunun belirlediği alanlar sessizce düzeltilir; düzeltme olduysa true döner
// (istemci güncel hali hemen tekrar çeker).
function kesimhaneYazimi($pdo, $ben, &$degisiklikler) {
    $firmaId = kesimhaneFirmaId($ben);
    if ($firmaId === '') kesimhaneRed('Hesabınıza kesimhane firması bağlanmamış. Yöneticinize başvurun.');
    $firma = kayitGetir($pdo, 'firmalar', $firmaId);
    $duzeltildi = false;

    foreach (['myhis_partiler', 'myhis_irsaliyeler', 'myhis_kumasTurleri'] as $anahtar) {
        if (!empty($degisiklikler[$anahtar]['delete'])) kesimhaneRed('Bu kayıtları silme yetkiniz yok.');
    }

    // ---- Partiler ----
    $partiNoDegisen = [];   // partiId → sunucunun verdiği parti no
    $yeniPartiNolari = [];
    $yeniPartiIdleri = [];
    $partiler = $degisiklikler['myhis_partiler']['upsert'] ?? [];
    foreach ($partiler as $i => $p) {
        if (!is_array($p) || empty($p['id'])) continue;
        $mevcut = kayitGetir($pdo, 'partiler', $p['id']);
        if ($mevcut) {
            if (($mevcut['kesimhaneId'] ?? null) !== $firmaId) kesimhaneRed('Bu parti kesimhanenize ait değil.');
            $yeni = $mevcut;
            foreach (KESIMHANE_PARTI_ALANLARI as $alan) {
                if (array_key_exists($alan, $p)) $yeni[$alan] = $p[$alan];
            }
            // Kesimhane sadece kesimden dikime geçirebilir
            $eskiDurum = $mevcut['durum'] ?? 'kesimde';
            $yeniDurum = $yeni['durum'] ?? $eskiDurum;
            if ($yeniDurum !== $eskiDurum && !($eskiDurum === 'kesimde' && $yeniDurum === 'dikimde')) {
                $yeni['durum'] = $eskiDurum;
                $duzeltildi = true;
            }
            $partiler[$i] = $yeni;
        } else {
            $urun = !empty($p['urunId']) ? kayitGetir($pdo, 'urunler', $p['urunId']) : null;
            $no = 'P-' . str_pad((string)sonrakiNumara($pdo, 'partiler', 'partiNo', '/^P-(\d+)$/', $yeniPartiNolari), 4, '0', STR_PAD_LEFT);
            $yeniPartiNolari[] = $no;
            $yeniPartiIdleri[$p['id']] = true;
            if (($p['partiNo'] ?? '') !== $no) { $partiNoDegisen[$p['id']] = $no; $duzeltildi = true; }
            $p['partiNo'] = $no;
            $p['kesimhaneId'] = $firmaId;
            $p['durum'] = 'kesimde';
            $p['arsivde'] = false;
            $p['firmaAtamalari'] = [];
            $p['kesimBirimFiyat'] = sunucuFiyatBul($urun, $firmaId, 'kesim');
            $p['dikimBirimFiyat'] = sunucuFiyatBul($urun, $p['dikimhaneId'] ?? null, 'dikim');
            $p['utuBirimFiyat'] = sunucuFiyatBul($urun, $p['utupaketciId'] ?? null, 'utu');
            $p['olusturanFirmaId'] = $firmaId;
            $duzeltildi = true; // fiyatlar istemcide yok; güncel hali çeksin
            $partiler[$i] = $p;
        }
    }
    if ($partiler) $degisiklikler['myhis_partiler']['upsert'] = $partiler;

    // ---- İrsaliyeler ----
    $yeniIrsNolari = [];
    $irsaliyeler = $degisiklikler['myhis_irsaliyeler']['upsert'] ?? [];
    foreach ($irsaliyeler as $i => $r) {
        if (!is_array($r) || empty($r['id'])) continue;
        $mevcut = kayitGetir($pdo, 'irsaliyeler', $r['id']);
        if ($mevcut) {
            if (!irsaliyeFirmayaAit($mevcut, $firmaId)) kesimhaneRed('Bu irsaliye firmanıza ait değil.');
            $yeni = $mevcut;
            foreach (KESIMHANE_IRSALIYE_ALANLARI as $alan) {
                if (array_key_exists($alan, $r)) $yeni[$alan] = $r[$alan];
            }
            // Onaylama/teslim kesimhanenin yetkisinde değil; sadece taslağını iptal edebilir
            $eskiDurum = $mevcut['durum'] ?? 'taslak';
            $istenen = $r['durum'] ?? $eskiDurum;
            if ($istenen === 'iptal' && $eskiDurum === 'taslak') {
                $yeni['durum'] = 'iptal';
                if (isset($r['iptalTarihi'])) $yeni['iptalTarihi'] = $r['iptalTarihi'];
            } elseif ($istenen !== $eskiDurum) {
                $duzeltildi = true;
            }
            $irsaliyeler[$i] = $yeni;
        } else {
            if (!irsaliyeFirmayaAit($r, $firmaId)) kesimhaneRed('Sadece kendi firmanızın irsaliyesini oluşturabilirsiniz.');
            if (!empty($r['partiId']) && !isset($yeniPartiIdleri[$r['partiId']])) {
                $parti = kayitGetir($pdo, 'partiler', $r['partiId']);
                if (!$parti || ($parti['kesimhaneId'] ?? null) !== $firmaId) kesimhaneRed('Bu parti kesimhanenize ait değil.');
            }
            $yil = date('Y');
            $no = 'IRS-' . $yil . '-' . str_pad((string)sonrakiNumara($pdo, 'irsaliyeler', 'irsaliyeNo', '/^IRS-' . $yil . '-(\d+)$/', $yeniIrsNolari), 4, '0', STR_PAD_LEFT);
            $yeniIrsNolari[] = $no;
            if (($r['irsaliyeNo'] ?? '') !== $no) { $r['irsaliyeNo'] = $no; $duzeltildi = true; }
            if (($r['durum'] ?? '') !== 'taslak') { $r['durum'] = 'taslak'; unset($r['onayTarihi']); $duzeltildi = true; }
            if (!empty($r['partiId']) && isset($partiNoDegisen[$r['partiId']])) $r['partiNo'] = $partiNoDegisen[$r['partiId']];
            $r['olusturanFirmaId'] = $firmaId;
            $irsaliyeler[$i] = $r;
        }
    }
    if ($irsaliyeler) $degisiklikler['myhis_irsaliyeler']['upsert'] = $irsaliyeler;

    // ---- Kumaş stoğu ----
    $kumaslar = $degisiklikler['myhis_kumasStok']['upsert'] ?? [];
    foreach ($kumaslar as $i => $k) {
        if (!is_array($k) || empty($k['id'])) continue;
        $mevcut = kayitGetir($pdo, 'kumas_stok', $k['id']);
        if ($mevcut && kumasKesimhanesi($mevcut) !== $firmaId) kesimhaneRed('Bu kumaş kaydı kesimhanenize ait değil.');
        if (($k['kesimhaneId'] ?? null) !== $firmaId) $duzeltildi = true;
        $k['kesimhaneId'] = $firmaId;
        $k['kesimhaneAdi'] = $firma['ad'] ?? '';
        // Fiyat alanları istemciden alınmaz; mevcut kayıttakiler korunur
        foreach (KESIMHANE_KUMAS_GIZLI as $alan) {
            if ($mevcut && array_key_exists($alan, $mevcut)) $k[$alan] = $mevcut[$alan];
            else unset($k[$alan]);
        }
        // Miktar değiştiyse tedarikçi carisindeki bağlı (kapanmamış) borç da güncellenir
        $borc = kumasBagliBorc($pdo, $mevcut);
        if ($borc) {
            $tutar = round((float)($k['miktar'] ?? 0) * (float)($mevcut['birimFiyat'] ?? 0), 2);
            if (abs($tutar - (float)($borc['tutar'] ?? 0)) > 0.001) {
                $borc['tutar'] = $tutar;
                $borc['miktar'] = (float)($k['miktar'] ?? 0);
                $degisiklikler['myhis_cariHareketler']['upsert'][] = $borc;
                $k['tutar'] = $tutar;
            }
        }
        $kumaslar[$i] = $k;
    }
    if ($kumaslar) $degisiklikler['myhis_kumasStok']['upsert'] = $kumaslar;
    foreach (($degisiklikler['myhis_kumasStok']['delete'] ?? []) as $id) {
        $mevcut = is_string($id) ? kayitGetir($pdo, 'kumas_stok', $id) : null;
        if ($mevcut && kumasKesimhanesi($mevcut) !== $firmaId) kesimhaneRed('Bu kumaş kaydı kesimhanenize ait değil.');
        // Silinen girişin kapanmamış cari borcu da silinir
        $borc = kumasBagliBorc($pdo, $mevcut);
        if ($borc) $degisiklikler['myhis_cariHareketler']['delete'][] = $borc['id'];
    }

    return $duzeltildi;
}
