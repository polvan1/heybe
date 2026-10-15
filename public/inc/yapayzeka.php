<?php
// HİS ERP - Yapay zekâ ile görsel okuma (irsaliye fotoğrafları)
//
// Birden fazla sağlayıcı desteklenir; config.php'de anahtarı olanlar sırayla
// denenir (biri kota/bağlantı hatası verirse sıradakine geçilir):
//   1) Google Gemini   — $GEMINI_API_KEY     (ücretsiz katmanı var, Google AI Studio)
//   2) Groq            — $GROQ_API_KEY       (ücretsiz katmanı var, Llama 4 Scout görsel)
//   3) OpenRouter      — $OPENROUTER_API_KEY (":free" modeller)
//   4) Anthropic Claude— $ANTHROPIC_API_KEY  (ücretli)
// $AI_SAGLAYICI ile ilk denenecek sağlayıcı seçilebilir ('gemini', 'groq', 'openrouter', 'anthropic').

function aiAyar($ad, $varsayilan = '') {
    return isset($GLOBALS[$ad]) && $GLOBALS[$ad] !== '' && $GLOBALS[$ad] !== null ? (string)$GLOBALS[$ad] : $varsayilan;
}

// Anahtarı tanımlı sağlayıcılar, deneme sırasıyla
function aiSaglayicilari() {
    $hepsi = [];
    if (aiAyar('GEMINI_API_KEY') !== '') {
        // Ücretsiz katmanda bir model "yoğun" (503/429) cevabı verebilir: sıradaki Gemini modeli denenir
        $modeller = array_values(array_unique(array_filter([aiAyar('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'])));
        $hepsi['gemini'] = ['ad' => 'Google Gemini', 'model' => $modeller[0], 'yedekModeller' => array_slice($modeller, 1)];
    }
    if (aiAyar('GROQ_API_KEY') !== '') $hepsi['groq'] = ['ad' => 'Groq', 'model' => aiAyar('GROQ_MODEL', 'meta-llama/llama-4-scout-17b-16e-instruct')];
    if (aiAyar('OPENROUTER_API_KEY') !== '') $hepsi['openrouter'] = ['ad' => 'OpenRouter', 'model' => aiAyar('OPENROUTER_MODEL', 'openrouter/free')];
    if (aiAyar('ANTHROPIC_API_KEY') !== '') $hepsi['anthropic'] = ['ad' => 'Anthropic Claude', 'model' => aiAyar('ANTHROPIC_MODEL', 'claude-sonnet-5-5')];
    $ilk = aiAyar('AI_SAGLAYICI');
    if ($ilk !== '' && isset($hepsi[$ilk])) $hepsi = [$ilk => $hepsi[$ilk]] + $hepsi;
    return $hepsi;
}

function aiHttpPost($url, $govde, $basliklar, $zamanAsimi = 60) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($govde, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $zamanAsimi,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $basliklar),
    ]);
    $yanit = curl_exec($ch);
    $kod = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hata = curl_error($ch);
    curl_close($ch);
    if ($yanit === false) return [0, null, $hata ?: 'bağlantı kurulamadı'];
    return [$kod, json_decode($yanit, true), null];
}

// Tek sağlayıcıya istek: [metin, hataMesajı]
function aiSaglayiciCagir($kimlik, $model, $prompt, $mediaType, $base64) {
    if ($kimlik === 'gemini') {
        $taban = rtrim(aiAyar('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta'), '/');
        [$kod, $j, $hata] = aiHttpPost("$taban/models/" . rawurlencode($model) . ':generateContent', [
            'contents' => [[
                'role' => 'user',
                'parts' => [
                    ['inline_data' => ['mime_type' => $mediaType, 'data' => $base64]],
                    ['text' => $prompt],
                ],
            ]],
            'generationConfig' => ['temperature' => 0, 'responseMimeType' => 'application/json'],
        ], ['x-goog-api-key: ' . aiAyar('GEMINI_API_KEY')]);
        if ($hata) return [null, $hata];
        $metin = '';
        foreach (($j['candidates'][0]['content']['parts'] ?? []) as $p) $metin .= $p['text'] ?? '';
        if ($kod !== 200 || $metin === '') return [null, $j['error']['message'] ?? ('HTTP ' . $kod)];
        return [$metin, null];
    }

    if ($kimlik === 'groq' || $kimlik === 'openrouter') {
        $url = $kimlik === 'groq'
            ? rtrim(aiAyar('GROQ_API_URL', 'https://api.groq.com/openai/v1'), '/') . '/chat/completions'
            : rtrim(aiAyar('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1'), '/') . '/chat/completions';
        $anahtar = $kimlik === 'groq' ? aiAyar('GROQ_API_KEY') : aiAyar('OPENROUTER_API_KEY');
        [$kod, $j, $hata] = aiHttpPost($url, [
            'model' => $model,
            'temperature' => 0,
            'messages' => [[
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => $prompt],
                    ['type' => 'image_url', 'image_url' => ['url' => "data:$mediaType;base64,$base64"]],
                ],
            ]],
        ], ['Authorization: Bearer ' . $anahtar]);
        if ($hata) return [null, $hata];
        $metin = $j['choices'][0]['message']['content'] ?? '';
        if ($kod !== 200 || $metin === '') return [null, $j['error']['message'] ?? ('HTTP ' . $kod)];
        return [$metin, null];
    }

    // anthropic
    [$kod, $j, $hata] = aiHttpPost('https://api.anthropic.com/v1/messages', [
        'model' => $model,
        'max_tokens' => 2500,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $base64]],
                ['type' => 'text', 'text' => $prompt],
            ],
        ]],
    ], ['x-api-key: ' . aiAyar('ANTHROPIC_API_KEY'), 'anthropic-version: 2023-06-01']);
    if ($hata) return [null, $hata];
    $metin = $j['content'][0]['text'] ?? '';
    if ($kod !== 200 || $metin === '') return [null, $j['error']['message'] ?? ('HTTP ' . $kod)];
    return [$metin, null];
}

// Model cevabından JSON nesnesini ayıkla (```json çitleri / önce-sonra metin olabilir)
function aiJsonAyikla($metin) {
    $metin = trim((string)$metin);
    $metin = preg_replace('/^```(?:json)?\s*|\s*```$/', '', $metin);
    $j = json_decode($metin, true);
    if (is_array($j)) return $j;
    $bas = strpos($metin, '{');
    $son = strrpos($metin, '}');
    if ($bas !== false && $son > $bas) {
        $j = json_decode(substr($metin, $bas, $son - $bas + 1), true);
        if (is_array($j)) return $j;
    }
    return null;
}

// Görseli okuyup JSON döndürür. Dönüş: ['veri' => array, 'saglayici' => ad] ya da ['hata' => kod, 'mesaj' => ...]
function aiGorselJsonOku($prompt, $mediaType, $base64) {
    $saglayicilar = aiSaglayicilari();
    if (!$saglayicilar) {
        return ['hata' => 'anahtar_yok', 'mesaj' => 'Yapay zekâ okuma kapalı: sunucuya bir yapay zekâ API anahtarı eklenmemiş (ör. ücretsiz Google Gemini anahtarı → GitHub Secrets: GEMINI_API_KEY).'];
    }
    $hatalar = [];
    foreach ($saglayicilar as $kimlik => $s) {
        foreach (array_merge([$s['model']], $s['yedekModeller'] ?? []) as $model) {
            [$metin, $hata] = aiSaglayiciCagir($kimlik, $model, $prompt, $mediaType, $base64);
            if ($hata !== null) {
                $hatalar[] = $s['ad'] . " ($model): " . $hata;
                // Anahtar geçersizse aynı sağlayıcının diğer modellerini denemenin anlamı yok
                if (stripos($hata, 'API key') !== false || stripos($hata, 'unauthorized') !== false) break;
                continue;
            }
            $veri = aiJsonAyikla($metin);
            if ($veri === null) { $hatalar[] = $s['ad'] . " ($model): cevap JSON değil"; continue; }
            return ['veri' => $veri, 'saglayici' => $s['ad'] . ' (' . $model . ')'];
        }
    }
    error_log('HİS ERP yapay zekâ okuma hatası: ' . implode(' | ', $hatalar));
    return ['hata' => 'ai_hatasi', 'mesaj' => 'Görsel okunamadı. ' . implode(' | ', $hatalar)];
}

// İstekteki data-url görselini doğrula: [mediaType, base64]
function aiGorselAl($data) {
    if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,(.+)$#s', (string)$data, $m)) {
        jsonHata(400, 'gecersiz_gorsel', 'Geçersiz görsel.');
    }
    if (strlen($m[2]) > 8 * 1024 * 1024) jsonHata(400, 'gorsel_cok_buyuk', 'Görsel çok büyük.');
    return ['image/' . ($m[1] === 'jpg' ? 'jpeg' : $m[1]), $m[2]];
}

function aiListe($dizi, $sinir = 200) {
    $temiz = [];
    foreach ((array)$dizi as $x) {
        $x = trim(mb_substr((string)$x, 0, 120));
        if ($x !== '') $temiz[] = '"' . str_replace('"', "'", $x) . '"';
        if (count($temiz) >= $sinir) break;
    }
    return $temiz ? implode(', ', $temiz) : '(yok)';
}

// ---- Kumaş irsaliyesi (Kumaş Stok) ----
function kumasIrsaliyePrompt($turler) {
    return "Bu fotoğraf bir tekstil kumaş irsaliyesi/sevk pusulası. İçeriğini dikkatle oku.\n"
        . "Sistemde tanımlı kumaş türleri: " . aiListe($turler) . "\n\n"
        . "Görevin: irsaliyedeki HER kumaş satırı için şu bilgileri çıkar:\n"
        . "- kumasTuru: tanımlı türlerden en uygun olanı seç; hiçbiri uymuyorsa irsaliyede yazan adı aynen kullan\n"
        . "- renk: satırdaki renk (yoksa boş bırak)\n"
        . "- topAdedi: top/rulo adedi (sayı; yoksa null)\n"
        . "- miktar: kilogram veya metre miktarı (sayı; ondalık nokta ile)\n"
        . "- birim: \"kg\", \"metre\" veya \"top\"\n"
        . "Ayrıca irsaliyeyi GÖNDEREN firma adını ve irsaliye numarasını bulmaya çalış.\n\n"
        . "YALNIZCA şu şemada geçerli JSON döndür, başka hiçbir metin yazma:\n"
        . "{\"firma\": \"...\", \"irsaliyeNo\": \"...\", \"satirlar\": [{\"kumasTuru\": \"...\", \"renk\": \"...\", \"topAdedi\": 0, \"miktar\": 0, \"birim\": \"kg\"}]}\n"
        . "Okunamayan alanları boş string veya null yap. Emin olmadığın sayıları tahmin etme, null bırak.";
}

// ---- Kesim sevk irsaliyesi (HİS A5 şablonu, elle doldurulmuş) ----
function sevkIrsaliyePrompt($baglam) {
    return "Bu fotoğraf, HİS ERP'nin A5 \"KESİM SEVK İRSALİYESİ\" formunun ELLE doldurulmuş hali "
        . "(form kodu HIS-KS1). Kesimhane, kestiği ürünleri dikim atölyesine gönderirken doldurur.\n"
        . "Formda: Tarih, İrsaliye No, Gönderen Kesimhane, Alan Atölye, Parti No alanları ve "
        . "Sıra | Model No | Renk | Beden Dağılımı | Adet sütunlu bir tablo vardır. El yazısını dikkatle oku.\n\n"
        . "Bilinen model numaraları (ürün kodu — adı): " . aiListe($baglam['modeller'] ?? []) . "\n"
        . "Bilinen atölyeler: " . aiListe($baglam['atolyeler'] ?? []) . "\n"
        . "Bilinen kesimhaneler: " . aiListe($baglam['kesimhaneler'] ?? []) . "\n"
        . "Açık parti numaraları: " . aiListe($baglam['partiler'] ?? []) . "\n\n"
        . "Kurallar:\n"
        . "- Tablodaki DOLU her satırı ayrı satır olarak döndür; boş satırları atla.\n"
        . "- model: yazılan model numarası. Bilinen bir koda açıkça benziyorsa o kodu aynen yaz.\n"
        . "- renk: yazılan renk adı (Türkçe, ilk harfi büyük).\n"
        . "- adet: satırın toplam adedi (tam sayı). Beden dağılımı yazılıysa bedenler nesnesine koy, ör. {\"S\": 20, \"M\": 30}.\n"
        . "- Bir hücre okunamıyorsa tahmin etme: sayı için null, metin için boş string yaz.\n"
        . "- tarih: YYYY-AA-GG biçiminde (okunamazsa boş).\n\n"
        . "YALNIZCA şu şemada geçerli JSON döndür, başka metin yazma:\n"
        . "{\"formKodu\": \"HIS-KS1\", \"tarih\": \"\", \"irsaliyeNo\": \"\", \"gonderen\": \"\", \"alan\": \"\", \"partiNo\": \"\", "
        . "\"satirlar\": [{\"model\": \"\", \"renk\": \"\", \"bedenler\": {}, \"adet\": 0}], \"toplamAdet\": null, \"notlar\": \"\"}";
}

// POST api.php?irsaliye_oku=1   { data: dataUrl, tur: 'kumas'|'sevk', ... }
function irsaliyeOkuIstegi($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonHata(405, 'yontem', 'POST gerekli.');
    $govde = jsonGovde();
    $tur = ($govde['tur'] ?? 'kumas') === 'sevk' ? 'sevk' : 'kumas';
    if ($tur === 'sevk') {
        $ben = girisGerekli($pdo);
        if (!yetkiVar($ben, 'irsaliyeler') && !yetkiVar($ben, 'partiler')) jsonHata(403, 'yetki_yok', 'Bu işlem için yetkiniz yok.');
    } else {
        yetkiGerekli($pdo, 'kumas_stok');
    }
    [$mediaType, $base64] = aiGorselAl($govde['data'] ?? '');
    $prompt = $tur === 'sevk'
        ? sevkIrsaliyePrompt(is_array($govde['baglam'] ?? null) ? $govde['baglam'] : [])
        : kumasIrsaliyePrompt(is_array($govde['kumas_turleri'] ?? null) ? $govde['kumas_turleri'] : []);

    $sonuc = aiGorselJsonOku($prompt, $mediaType, $base64);
    if (isset($sonuc['hata'])) {
        // anahtar_yok 200 ile döner (istemci kullanıcıya açıklama gösterir)
        if ($sonuc['hata'] !== 'anahtar_yok') http_response_code(502);
        echo json_encode(['error' => $sonuc['hata'], 'mesaj' => $sonuc['mesaj']], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $okuma = $sonuc['veri'];
    if (!isset($okuma['satirlar']) || !is_array($okuma['satirlar'])) $okuma['satirlar'] = [];
    jsonYanit(['success' => true, 'okuma' => $okuma, 'saglayici' => $sonuc['saglayici']]);
}

// GET api.php?ai=durum → hangi sağlayıcılar tanımlı (anahtarlar ASLA dönmez)
function aiDurumIstegi($pdo) {
    girisGerekli($pdo);
    $liste = [];
    foreach (aiSaglayicilari() as $kimlik => $s) $liste[] = ['kimlik' => $kimlik, 'ad' => $s['ad'], 'model' => $s['model']];
    jsonYanit(['etkin' => count($liste) > 0, 'saglayicilar' => $liste]);
}
