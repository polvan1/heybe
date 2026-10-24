<?php
// HİS ERP - Döviz kurları (TCMB)
//
// Türkiye Cumhuriyet Merkez Bankası'nın günlük kur dosyasından (today.xml) USD, EUR ve
// GBP döviz satış kurları alınır; 1 saat önbellekte tutulur (settings: kur_onbellek).
// TCMB'ye ulaşılamazsa son alınan kur "eski" işaretiyle döner. Yönetici kurları elle de
// girebilir (settings: kur_elle); elle kur tanımlıysa o kullanılır.
//
// ?kur=durum              GET  → { kurlar: {USD, EUR, GBP}, tarih, kaynak, eski }
// ?kur=durum&yenile=1     GET  → önbelleği beklemeden TCMB'den tekrar dener (en sık 5 dk'da bir)
// ?kur=elle               POST {kurlar: {USD, EUR, GBP} | null} → elle kur (sadece yönetici)

const KUR_KODLARI = ['USD', 'EUR', 'GBP'];
const KUR_ONBELLEK_SURESI = 3600;
const KUR_EN_SIK_YENILEME = 300;

function kurAyarOku($pdo, $anahtar) {
    $stmt = $pdo->prepare("SELECT s_value FROM settings WHERE s_key = ?");
    $stmt->execute([$anahtar]);
    $v = $stmt->fetchColumn();
    return $v === false ? null : json_decode((string)$v, true);
}

function kurAyarYaz($pdo, $anahtar, $deger) {
    $pdo->prepare("REPLACE INTO settings (s_key, s_value) VALUES (?, ?)")->execute([$anahtar, json_encode($deger, JSON_UNESCAPED_UNICODE)]);
}

// TCMB XML metninden kurları çıkar (birim: 1 döviz = x TL, döviz satış)
function tcmbKurCoz($xml) {
    $eski = libxml_use_internal_errors(true);
    $doc = simplexml_load_string((string)$xml);
    libxml_use_internal_errors($eski);
    if (!$doc) return null;
    $kurlar = [];
    foreach ($doc->Currency as $c) {
        $kod = (string)$c['Kod'];
        if (!in_array($kod, KUR_KODLARI, true)) continue;
        $birim = (float)str_replace(',', '.', (string)$c->Unit) ?: 1;
        $satis = (float)str_replace(',', '.', (string)$c->ForexSelling);
        if ($satis > 0) $kurlar[$kod] = round($satis / $birim, 4);
    }
    if (count($kurlar) === 0) return null;
    return ['kurlar' => $kurlar, 'tarih' => (string)($doc['Tarih'] ?? '')];
}

function tcmbKurIndir() {
    $url = getenv('TCMB_KUR_URL') ?: (isset($GLOBALS['TCMB_KUR_URL']) && $GLOBALS['TCMB_KUR_URL'] ? $GLOBALS['TCMB_KUR_URL'] : 'https://www.tcmb.gov.tr/kurlar/today.xml');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'HIS-ERP/1.0',
    ]);
    $govde = curl_exec($ch);
    $kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($govde === false || $kod !== 200) return null;
    return tcmbKurCoz($govde);
}

// Geçerli kurlar: elle girilmişse o, değilse TCMB (önbellekli)
function guncelKurlar($pdo, $yenile = false) {
    $elle = kurAyarOku($pdo, 'kur_elle');
    if (is_array($elle) && !empty($elle['kurlar'])) {
        return ['kurlar' => $elle['kurlar'], 'tarih' => $elle['tarih'] ?? '', 'kaynak' => 'Elle girildi', 'eski' => false, 'elle' => true];
    }
    $onbellek = kurAyarOku($pdo, 'kur_onbellek');
    $yas = $onbellek ? time() - (int)($onbellek['alinma'] ?? 0) : PHP_INT_MAX;
    $sinir = $yenile ? KUR_EN_SIK_YENILEME : KUR_ONBELLEK_SURESI;
    if ($onbellek && $yas < $sinir) {
        return ['kurlar' => $onbellek['kurlar'], 'tarih' => $onbellek['tarih'] ?? '', 'kaynak' => 'TCMB', 'eski' => false, 'elle' => false];
    }
    $yeni = tcmbKurIndir();
    if ($yeni) {
        $yeni['alinma'] = time();
        kurAyarYaz($pdo, 'kur_onbellek', $yeni);
        return ['kurlar' => $yeni['kurlar'], 'tarih' => $yeni['tarih'], 'kaynak' => 'TCMB', 'eski' => false, 'elle' => false];
    }
    if ($onbellek) {
        return ['kurlar' => $onbellek['kurlar'], 'tarih' => $onbellek['tarih'] ?? '', 'kaynak' => 'TCMB', 'eski' => true, 'elle' => false];
    }
    return ['kurlar' => (object)[], 'tarih' => '', 'kaynak' => '', 'eski' => true, 'elle' => false];
}

function kurIstegi($pdo, $islem) {
    $ben = girisGerekli($pdo);
    if ($islem === 'durum') jsonYanit(guncelKurlar($pdo, !empty($_GET['yenile'])));

    if ($islem === 'elle') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
        if ($ben['rol'] !== 'admin') jsonHata(403, 'yetki_yok', 'Kurları sadece yönetici girebilir.');
        $govde = jsonGovde();
        if (empty($govde['kurlar'])) {
            $pdo->prepare("DELETE FROM settings WHERE s_key = 'kur_elle'")->execute();
            gunlugeYaz($pdo, $ben, 'Döviz Kuru', 'Elle kur kaldırıldı; TCMB kuru kullanılacak');
            jsonYanit(guncelKurlar($pdo, true));
        }
        $kurlar = [];
        foreach (KUR_KODLARI as $kod) {
            $v = isset($govde['kurlar'][$kod]) ? (float)$govde['kurlar'][$kod] : 0;
            if ($v > 0) $kurlar[$kod] = round($v, 4);
        }
        if (!$kurlar) jsonHata(400, 'eksik', 'En az bir geçerli kur girin.');
        kurAyarYaz($pdo, 'kur_elle', ['kurlar' => $kurlar, 'tarih' => date('d.m.Y')]);
        gunlugeYaz($pdo, $ben, 'Döviz Kuru', 'Elle kur girildi: ' . implode(', ', array_map(fn($k, $v) => "$k $v", array_keys($kurlar), $kurlar)));
        jsonYanit(guncelKurlar($pdo));
    }
    jsonHata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
}
