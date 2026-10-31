<?php
// Yapay zekâ irsaliye okuma testi (GitHub Actions ve geliştirme ortamı için).
// Kullanım: php scripts/ai-test.php <görsel.jpg> [beklenen.json]
// Dosya adı "kumas" ile başlıyorsa kumaşçı irsaliyesi/sipariş fişi, değilse kesim sevk irsaliyesi okunur.
// Anahtarlar ortam değişkenlerinden okunur (GEMINI_API_KEY vb.); asla ekrana yazılmaz.
if ($argc < 2) { fwrite(STDERR, "Görsel yolu gerekli\n"); exit(1); }

foreach (['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_API_URL', 'GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_API_URL', 'OPENROUTER_API_KEY',
          'OPENROUTER_MODEL', 'OPENROUTER_API_URL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'AI_SAGLAYICI'] as $ad) {
    $GLOBALS[$ad] = (string)(getenv($ad) ?: '');
}
function jsonHata($kod, $hata, $mesaj) { fwrite(STDERR, "$hata: $mesaj\n"); exit(1); }
function jsonGovde() { return []; }
require __DIR__ . '/../public/inc/yapayzeka.php';

if (!aiSaglayicilari()) {
    echo "::notice::Yapay zekâ anahtarı tanımlı değil (ör. GEMINI_API_KEY); okuma testi atlandı.\n";
    exit(0);
}
echo "Tanımlı sağlayıcılar: " . implode(', ', array_map(fn($s) => $s['ad'] . ' (' . $s['model'] . ')', aiSaglayicilari())) . "\n";

$gorsel = file_get_contents($argv[1]);
if ($gorsel === false) { fwrite(STDERR, "Görsel okunamadı\n"); exit(1); }
$tur = strtolower(pathinfo($argv[1], PATHINFO_EXTENSION)) === 'png' ? 'image/png' : 'image/jpeg';
$baglam = [
    'modeller' => ['HS-1021 — Basic Bisiklet Yaka Tişört', 'HS-2015 — Halter Yaka Atlet', 'HS-3002 — Çocuk Eşofman Takımı'],
    'atolyeler' => ['Akın Konfeksiyon', 'Ece Dikim Evi', 'Güneş Tekstil Atölyesi'],
    'kesimhaneler' => ['Yıldız Kesim', 'Doğan Kesimhane'],
    'partiler' => ['P-0009', 'P-0010'],
];
$bas = microtime(true);
$kumasModu = str_starts_with(basename($argv[1]), 'kumas');
$prompt = $kumasModu ? kumasIrsaliyePrompt(['Süprem', 'Ribana', 'Kaşkorse', 'İki İplik']) : sevkIrsaliyePrompt($baglam);
echo 'Okunan belge: ' . ($kumasModu ? 'kumaşçı fişi' : 'kesim sevk irsaliyesi') . "\n";
$sonuc = aiGorselJsonOku($prompt, $tur, base64_encode($gorsel));
$sure = round(microtime(true) - $bas, 1);
if (isset($sonuc['hata'])) {
    echo "::error::Okuma başarısız ($sure sn): {$sonuc['mesaj']}\n";
    exit(1);
}
echo "Okuyan: {$sonuc['saglayici']} — $sure sn\n";
echo json_encode($sonuc['veri'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";

// Kumaş fişi: tür + renk eşleşen satırda top, kg ve parti no karşılaştırılır
if ($kumasModu && !empty($argv[2]) && is_file($argv[2])) {
    $beklenen = json_decode(file_get_contents($argv[2]), true);
    $sade = fn($m) => preg_replace('/[^0-9A-ZÇĞİÖŞÜ]/u', '', mb_strtoupper(str_replace(['i', 'ı'], ['İ', 'I'], (string)$m), 'UTF-8'));
    $okunan = [];
    foreach ($sonuc['veri']['satirlar'] ?? [] as $s) {
        // Renk ayrılmadıysa uygulama da ayırır; testte tür + renk birleşik karşılaştırılır
        $okunan[$sade(($s['kumasTuru'] ?? '') . ($s['renk'] ?? ''))] = $s;
    }
    $dogru = 0;
    foreach ($beklenen['satirlar'] as $b) {
        $s = $okunan[$sade($b['kumasTuru'] . $b['renk'])] ?? null;
        $ok = $s && (int)($s['topAdedi'] ?? -1) === $b['topAdedi'] && abs((float)($s['miktar'] ?? -1) - $b['miktar']) < 0.01
            && $sade($s['lotNo'] ?? '') === $sade($b['lotNo']);
        if ($ok) $dogru++;
        echo ($ok ? '  ✓ ' : '  ✗ ') . "{$b['kumasTuru']} {$b['renk']} / {$b['topAdedi']} top / {$b['miktar']} kg / parti {$b['lotNo']}"
            . ($ok ? '' : ' → okunan: ' . ($s ? json_encode($s, JSON_UNESCAPED_UNICODE) : 'yok')) . "\n";
    }
    foreach (['firma', 'irsaliyeNo', 'tarih'] as $a) echo "  $a: " . ($sonuc['veri'][$a] ?? '') . " (beklenen: {$beklenen[$a]})\n";
    $toplam = count($beklenen['satirlar']);
    echo "Satır doğruluğu: $dogru / $toplam\n";
    if ($dogru < $toplam) echo "::warning::Kumaş fişi okuması $toplam satırdan $dogru tanesini doğru buldu.\n";
    elseif ($sade($sonuc['veri']['firma'] ?? '') !== $sade($beklenen['firma'])) echo "::warning::Gönderen firma yanlış okundu.\n";
    else echo "::notice::Kumaş fişi okuma testi başarılı ({$sonuc['saglayici']}, $sure sn).\n";
    exit(0);
}

// Beklenen değerlerle karşılaştır (model + renk + adet)
if (!empty($argv[2]) && is_file($argv[2])) {
    $beklenen = json_decode(file_get_contents($argv[2]), true);
    // Uygulamadaki eşleştirme gibi: büyük/küçük harf, boşluk ve tire farkı önemsiz
    $anahtarYap = fn($model, $renk) => preg_replace('/[^0-9A-ZÇĞİÖŞÜ|]/u', '', mb_strtoupper(str_replace(['i', 'ı'], ['İ', 'I'], $model . '|' . $renk), 'UTF-8'));
    $okunan = [];
    foreach ($sonuc['veri']['satirlar'] ?? [] as $s) {
        $okunan[$anahtarYap((string)($s['model'] ?? ''), (string)($s['renk'] ?? ''))] = (int)($s['adet'] ?? 0);
    }
    $dogru = 0;
    foreach ($beklenen['satirlar'] as $b) {
        $anahtar = $anahtarYap($b['model'], $b['renk']);
        $ok = isset($okunan[$anahtar]) && $okunan[$anahtar] === (int)$b['adet'];
        if ($ok) $dogru++;
        echo ($ok ? '  ✓ ' : '  ✗ ') . "{$b['model']} / {$b['renk']} / {$b['adet']}" . ($ok ? '' : ' → okunan: ' . ($okunan[$anahtar] ?? 'yok')) . "\n";
    }
    $alanlar = ['alan', 'gonderen', 'irsaliyeNo'];
    foreach ($alanlar as $a) echo "  $a: " . ($sonuc['veri'][$a] ?? '') . " (beklenen: {$beklenen[$a]})\n";
    $toplam = count($beklenen['satirlar']);
    echo "Satır doğruluğu: $dogru / $toplam\n";
    if ($dogru < $toplam) echo "::warning::Okuma $toplam satırdan $dogru tanesini doğru buldu.\n";
    else echo "::notice::Yapay zekâ okuma testi başarılı ({$sonuc['saglayici']}, $sure sn).\n";
}
