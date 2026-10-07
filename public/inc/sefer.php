<?php
// HİS ERP - Şoför işlemleri
//   POST ?sefer=durak  { seferId, durakNo, islem: 'tamamla' | 'geri_al' }
//        Durağı tamamlar; o duraktaki alımlar irsaliyeyi "onaylandı", teslimler
//        "teslim edildi" yapar. Sevk sorumlularına bildirim + push gider.
//   POST ?sefer=konum  { lat, lng }
//        Şoförün o anki konumu, aktif seferindeki araca yazılır (canlı takip).

function seferGetir($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM seferler WHERE id = ?");
    $stmt->execute([$id]);
    $s = $stmt->fetch();
    return $s ? satirCoz($s) : null;
}

function seferKaydet($pdo, $s) {
    $pdo->prepare("UPDATE seferler SET durum = ?, duraklar = ?, baslamaZamani = ?, bitisZamani = ?, updatedAt = ? WHERE id = ?")
        ->execute([$s['durum'], json_encode($s['duraklar'], JSON_UNESCAPED_UNICODE), $s['baslamaZamani'] ?? null, $s['bitisZamani'] ?? null, simdiIso(), $s['id']]);
}

function simdiIso() {
    return gmdate('Y-m-d\TH:i:s.v\Z');
}

// Sevk sorumlularına (harita yetkisi olanlar) bildirim
function sevkSorumlularinaBildir($pdo, $baslik, $mesaj, $link) {
    $pdo->prepare("INSERT INTO bildirimler (id, tip, baslik, mesaj, link, okundu, tarih, kullaniciId) VALUES (?, 'sefer', ?, ?, ?, 0, ?, NULL)")
        ->execute([yeniId(), $baslik, $mesaj, $link, simdiIso()]);
    $hedefler = [];
    foreach (tumKullanicilar($pdo) as $k) {
        if ($k['aktif'] && $k['rol'] !== 'sofor' && yetkiVar($k, 'harita')) $hedefler[] = $k['id'];
    }
    return $hedefler;
}

function irsaliyeGuncelle($pdo, $id, $alanlar) {
    $kolonlar = tabloKolonlari($pdo, 'irsaliyeler');
    $set = []; $degerler = [];
    foreach ($alanlar as $k => $v) {
        if (!in_array($k, $kolonlar, true)) continue;
        $set[] = "`$k` = ?"; $degerler[] = $v;
    }
    if (!$set) return;
    $degerler[] = $id;
    $pdo->prepare("UPDATE irsaliyeler SET " . implode(', ', $set) . " WHERE id = ?")->execute($degerler);
}

function seferIstegi($pdo, $islem) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
    $ben = girisGerekli($pdo);
    $g = jsonGovde();

    if ($islem === 'konum') {
        $lat = isset($g['lat']) ? (float)$g['lat'] : null;
        $lng = isset($g['lng']) ? (float)$g['lng'] : null;
        if ($lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180) jsonHata(400, 'konum', 'Geçersiz konum.');
        $pdo->prepare("UPDATE araclar SET sonLat = ?, sonLng = ?, sonKonumZamani = ? WHERE soforId = ?")
            ->execute([$lat, $lng, simdiIso(), $ben['id']]);
        jsonYanit(['success' => true]);
    }

    if ($islem === 'durak') {
        $s = seferGetir($pdo, (string)($g['seferId'] ?? ''));
        if (!$s) jsonHata(404, 'yok', 'Sefer bulunamadı.');
        $kendiSeferi = ($s['soforId'] ?? null) === $ben['id'];
        if (!$kendiSeferi && !yetkiVar($ben, 'harita')) jsonHata(403, 'yetki_yok', 'Bu sefer size atanmamış.');
        if (in_array($s['durum'], ['iptal'], true)) jsonHata(400, 'iptal', 'Bu sefer iptal edilmiş.');

        $no = (int)($g['durakNo'] ?? -1);
        $duraklar = is_array($s['duraklar']) ? $s['duraklar'] : [];
        if (!isset($duraklar[$no]) || ($duraklar[$no]['tip'] ?? '') !== 'durak') jsonHata(400, 'durak', 'Geçersiz durak.');
        $geriAl = ($g['islem'] ?? 'tamamla') === 'geri_al';
        $d = &$duraklar[$no];
        $simdi = simdiIso();

        $pdo->beginTransaction();
        try {
            if ($geriAl) {
                $d['durum'] = 'bekliyor';
                unset($d['tamamlanmaZamani']);
            } else {
                if (($d['durum'] ?? '') === 'tamamlandi') { $pdo->rollBack(); jsonYanit(['success' => true, 'sefer' => $s]); }
                $d['durum'] = 'tamamlandi';
                $d['tamamlanmaZamani'] = $simdi;
                // Alım: mal araca yüklendi → irsaliye en az "onaylandı"
                foreach ((array)($d['alimlar'] ?? []) as $is) {
                    $stmt = $pdo->prepare("SELECT durum FROM irsaliyeler WHERE id = ?");
                    $stmt->execute([$is['irsaliyeId'] ?? '']);
                    if ($stmt->fetchColumn() === 'taslak') irsaliyeGuncelle($pdo, $is['irsaliyeId'], ['durum' => 'onaylandi', 'onayTarihi' => $simdi, 'updatedAt' => $simdi]);
                }
                // Teslim: irsaliye teslim edildi
                foreach ((array)($d['teslimler'] ?? []) as $is) {
                    irsaliyeGuncelle($pdo, $is['irsaliyeId'] ?? '', ['durum' => 'teslim_edildi', 'teslimTarihi' => $simdi, 'updatedAt' => $simdi]);
                }
            }
            unset($d);

            // Sefer durumu
            $bekleyen = array_filter($duraklar, fn($x) => ($x['tip'] ?? '') === 'durak' && ($x['durum'] ?? '') !== 'tamamlandi');
            $biten = array_filter($duraklar, fn($x) => ($x['tip'] ?? '') === 'durak' && ($x['durum'] ?? '') === 'tamamlandi');
            $s['duraklar'] = $duraklar;
            if (!$bekleyen) { $s['durum'] = 'tamamlandi'; $s['bitisZamani'] = $simdi; }
            elseif ($biten) { $s['durum'] = 'yolda'; $s['bitisZamani'] = null; }
            else { $s['durum'] = 'atandi'; }
            if ($biten && empty($s['baslamaZamani'])) $s['baslamaZamani'] = $simdi;
            seferKaydet($pdo, $s);

            $hedefler = [];
            if (!$geriAl) {
                $durakAdi = $duraklar[$no]['ad'] ?? 'Durak';
                $teslimEtiketleri = array_map(fn($x) => $x['etiket'] ?? '', (array)($duraklar[$no]['teslimler'] ?? []));
                $mesaj = $ben['ad'] . ' — ' . $durakAdi . ($teslimEtiketleri ? ': ' . implode(', ', $teslimEtiketleri) . ' teslim edildi' : ': yük alındı');
                $baslik = $s['durum'] === 'tamamlandi' ? 'Sefer tamamlandı' : 'Durak tamamlandı (' . count($biten) . '/' . (count($biten) + count($bekleyen)) . ')';
                $hedefler = sevkSorumlularinaBildir($pdo, $baslik, $mesaj, '/harita');
                gunlugeYaz($pdo, $ben, 'Durak Tamamlandı', $mesaj);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('HİS ERP sefer hatası: ' . $e->getMessage());
            jsonHata(500, 'kayit_hatasi', 'Durak kaydedilemedi.');
        }

        echo json_encode(['success' => true, 'sefer' => $s], JSON_UNESCAPED_UNICODE);
        if ($hedefler) {
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            ignore_user_abort(true);
            sendPushToAll($pdo, $hedefler);
        }
        exit;
    }

    if ($islem === 'iptal') {
        // Sevk sorumlusu seferi iptal eder; şoförün bitirdiği duraklar olduğu gibi kalır
        if (!yetkiVar($ben, 'harita')) jsonHata(403, 'yetki_yok', 'Bu işlem için yetkiniz yok.');
        $s = seferGetir($pdo, (string)($g['seferId'] ?? ''));
        if (!$s) jsonHata(404, 'yok', 'Sefer bulunamadı.');
        if ($s['durum'] === 'tamamlandi') jsonHata(400, 'bitti', 'Tamamlanmış sefer iptal edilemez.');
        $s['durum'] = 'iptal';
        $s['bitisZamani'] = simdiIso();
        seferKaydet($pdo, $s);
        if (!empty($s['soforId'])) {
            $pdo->prepare("INSERT INTO bildirimler (id, tip, baslik, mesaj, link, okundu, tarih, kullaniciId) VALUES (?, 'sefer', 'Seferiniz iptal edildi', ?, '/gorevlerim', 0, ?, ?)")
                ->execute([yeniId(), $ben['ad'] . ' seferi iptal etti.', simdiIso(), $s['soforId']]);
        }
        gunlugeYaz($pdo, $ben, 'Sefer İptal Edildi', $s['id']);
        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        if (!empty($s['soforId'])) {
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            ignore_user_abort(true);
            sendPushToAll($pdo, [$s['soforId']]);
        }
        exit;
    }

    jsonHata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
}
