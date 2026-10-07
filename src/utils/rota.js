// Sevkiyat rota planlama (alım-teslim problemi)
//
// Her görev bir taşımadır: bir firmadan mal ALINIR, başka bir firmaya TESLİM edilir
// (ör. irsaliye: kesimhane → atölye). Araç bir başlangıç noktasından çıkar ve tüm
// görevleri, her alım kendi teslimatından ÖNCE olacak şekilde en kısa sırayla dolaşır.
//
// Mesafe: kuş uçuşu (haversine) × yol katsayısı. Gerçek yol ağı kullanılmaz; şehir
// içinde yol mesafesi kuş uçuşunun ortalama ~1,3 katıdır. Sıralama için yeterince iyidir.

export const YOL_KATSAYISI = 1.3;
export const ORT_HIZ_KMS = 25;      // şehir içi ortalama hız (km/saat)
export const DURAK_DK = 10;         // her durakta yükleme/boşaltma süresi (dakika)
const KESIN_COZUM_SINIRI = 8;       // bu kadar göreve kadar kesin (en iyi) çözüm

export function kusUcusuKm(a, b) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const yolKm = (a, b) => kusUcusuKm(a, b) * YOL_KATSAYISI;

export function konumVarMi(k) {
    return !!k && Number.isFinite(+k.lat) && Number.isFinite(+k.lng) && !(+k.lat === 0 && +k.lng === 0);
}

// Olaylar: görev i için 2i = alım, 2i+1 = teslim
function olaylariKur(gorevler) {
    const olaylar = [];
    gorevler.forEach((g, i) => {
        olaylar.push({ tip: 'alim', gorevIndex: i, konum: g.alim });
        olaylar.push({ tip: 'teslim', gorevIndex: i, konum: g.teslim });
    });
    return olaylar;
}

// Kesin çözüm: bit maskesi üzerinde dinamik programlama (Held-Karp + öncelik kısıtı)
function kesinCoz(bas, olaylar, donus) {
    const n = olaylar.length;
    const TAM = (1 << n) - 1;
    const d = (i, j) => yolKm(olaylar[i].konum, olaylar[j].konum);
    const mesafe = Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => d(i, j)));
    const basMesafe = Float64Array.from(olaylar, o => yolKm(bas, o.konum));

    const maliyet = new Float64Array((1 << n) * n).fill(Infinity);
    const onceki = new Int16Array((1 << n) * n).fill(-1);
    // Sadece alım olayları ilk olabilir
    for (let i = 0; i < n; i += 2) maliyet[(1 << i) * n + i] = basMesafe[i];

    for (let mask = 1; mask <= TAM; mask++) {
        for (let son = 0; son < n; son++) {
            const m = maliyet[mask * n + son];
            if (m === Infinity) continue;
            for (let s = 0; s < n; s++) {
                if (mask & (1 << s)) continue;
                if (s & 1 && !(mask & (1 << (s - 1)))) continue; // teslim, alımdan önce olamaz
                const yeni = mask | (1 << s);
                const c = m + mesafe[son][s];
                if (c < maliyet[yeni * n + s]) {
                    maliyet[yeni * n + s] = c;
                    onceki[yeni * n + s] = son;
                }
            }
        }
    }
    let enIyi = Infinity, enSon = -1;
    for (let son = 0; son < n; son++) {
        const c = maliyet[TAM * n + son] + (donus ? yolKm(olaylar[son].konum, bas) : 0);
        if (c < enIyi) { enIyi = c; enSon = son; }
    }
    const sira = [];
    let mask = TAM, son = enSon;
    while (son !== -1) {
        sira.push(son);
        const p = onceki[mask * n + son];
        mask &= ~(1 << son);
        son = p;
    }
    return sira.reverse();
}

function siraMaliyeti(bas, olaylar, sira, donus) {
    let c = 0, onceki = bas;
    for (const i of sira) { c += yolKm(onceki, olaylar[i].konum); onceki = olaylar[i].konum; }
    if (donus && sira.length) c += yolKm(onceki, bas);
    return c;
}

function gecerliMi(sira) {
    const gorulen = new Set();
    for (const i of sira) {
        if (i & 1 && !gorulen.has(i - 1)) return false;
        gorulen.add(i);
    }
    return true;
}

// Sezgisel çözüm: en yakın uygun olay + tek olay taşıma (or-opt) iyileştirmesi
function sezgiselCoz(bas, olaylar, donus) {
    const n = olaylar.length;
    const sira = [];
    const kalan = new Set(olaylar.map((_, i) => i));
    let konum = bas;
    while (kalan.size) {
        let en = -1, enD = Infinity;
        for (const i of kalan) {
            if (i & 1 && kalan.has(i - 1)) continue;
            const dd = yolKm(konum, olaylar[i].konum);
            if (dd < enD) { enD = dd; en = i; }
        }
        sira.push(en); kalan.delete(en); konum = olaylar[en].konum;
    }
    let iyilesti = true, tur = 0;
    let mevcut = siraMaliyeti(bas, olaylar, sira, donus);
    while (iyilesti && tur++ < 200) {
        iyilesti = false;
        for (let i = 0; i < n && !iyilesti; i++) {
            for (let j = 0; j < n && !iyilesti; j++) {
                if (i === j) continue;
                const aday = sira.slice();
                const [x] = aday.splice(i, 1);
                aday.splice(j, 0, x);
                if (!gecerliMi(aday)) continue;
                const c = siraMaliyeti(bas, olaylar, aday, donus);
                if (c < mevcut - 1e-9) { sira.splice(0, n, ...aday); mevcut = c; iyilesti = true; }
            }
        }
    }
    return sira;
}

// gorevler: [{ id, etiket, alim: {ad, lat, lng}, teslim: {ad, lat, lng} }]
// Dönüş: { duraklar, toplamKm, sureDk, yontem }
export function rotaPlanla({ baslangic, gorevler, donus = false }) {
    if (!konumVarMi(baslangic) || !gorevler.length) return null;
    const olaylar = olaylariKur(gorevler);
    const kesin = gorevler.length <= KESIN_COZUM_SINIRI;
    const sira = kesin ? kesinCoz(baslangic, olaylar, donus) : sezgiselCoz(baslangic, olaylar, donus);

    // Aynı noktadaki ardışık olayları tek durakta birleştir
    const duraklar = [{ tip: 'baslangic', konum: baslangic, alimlar: [], teslimler: [], km: 0 }];
    for (const i of sira) {
        const o = olaylar[i];
        const g = gorevler[o.gorevIndex];
        const son = duraklar[duraklar.length - 1];
        const ayniYer = son.tip !== 'baslangic' && kusUcusuKm(son.konum, o.konum) < 0.05;
        const durak = ayniYer ? son : { tip: 'durak', konum: o.konum, alimlar: [], teslimler: [], km: yolKm(son.konum, o.konum) };
        (o.tip === 'alim' ? durak.alimlar : durak.teslimler).push(g);
        if (!ayniYer) duraklar.push(durak);
    }
    if (donus) {
        const son = duraklar[duraklar.length - 1];
        duraklar.push({ tip: 'donus', konum: baslangic, alimlar: [], teslimler: [], km: yolKm(son.konum, baslangic) });
    }
    const toplamKm = duraklar.reduce((t, d) => t + d.km, 0);
    const durakSayisi = duraklar.filter(d => d.tip === 'durak').length;
    const sureDk = Math.round((toplamKm / ORT_HIZ_KMS) * 60 + durakSayisi * DURAK_DK);
    return { duraklar, toplamKm, sureDk, yontem: kesin ? 'kesin' : 'sezgisel' };
}

// Aynı görevleri verilen (ör. irsaliye tarihine göre) sırayla tek tek götürüp getirmenin
// maliyeti — optimizasyonun ne kadar kazandırdığını göstermek için
export function siraliRotaKm({ baslangic, gorevler, donus = false }) {
    let c = 0, k = baslangic;
    for (const g of gorevler) { c += yolKm(k, g.alim) + yolKm(g.alim, g.teslim); k = g.teslim; }
    if (donus && gorevler.length) c += yolKm(k, baslangic);
    return c;
}

// Google Haritalar yol tarifi bağlantısı (en fazla 9 ara durak)
export function googleHaritaLinki(duraklar) {
    const noktalar = duraklar.map(d => `${(+d.konum.lat).toFixed(6)},${(+d.konum.lng).toFixed(6)}`);
    if (noktalar.length < 2) return null;
    const [origin, ...geri] = noktalar;
    const destination = geri.pop();
    const ara = geri.slice(0, 9);
    const p = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
    if (ara.length) p.set('waypoints', ara.join('|'));
    return { url: 'https://www.google.com/maps/dir/?' + p.toString(), eksikDurak: Math.max(0, geri.length - 9) };
}

// ============================================================
// ÇOKLU ARAÇ
// Görevler araçlara dağıtılır; hedef: en geç biten aracın bitiş süresini en aza
// indirmek (herkes mümkün olduğunca erken işini bitirsin), eşitlikte toplam km.
// Her aracın kendi sırası yukarıdaki tek araç çözücüsüyle bulunur.
// araclar: [{ id, baslangic: {ad, lat, lng}, donus }]
// Dönüş: { planlar: [{ aracId, plan|null, gorevler }], enUzunDk, toplamKm }
// ============================================================
function planSuresi(p) {
    return p ? p.sureDk : 0;
}

export function cokluAracPlanla({ araclar, gorevler }) {
    const uygun = araclar.filter(a => konumVarMi(a.baslangic));
    if (!uygun.length || !gorevler.length) return null;

    const onbellek = new Map();
    const coz = (arac, liste) => {
        if (!liste.length) return null;
        const anahtar = arac.id + '|' + liste.map(g => g.id).sort().join(',');
        if (!onbellek.has(anahtar)) onbellek.set(anahtar, rotaPlanla({ baslangic: arac.baslangic, gorevler: liste, donus: arac.donus }));
        return onbellek.get(anahtar);
    };
    const degerlendir = (atama) => {
        const planlar = uygun.map((a, i) => coz(a, atama[i]));
        return {
            planlar,
            enUzun: Math.max(...planlar.map(planSuresi)),
            toplamKm: planlar.reduce((t, p) => t + (p ? p.toplamKm : 0), 0),
        };
    };
    const dahaIyi = (x, y) => x.enUzun < y.enUzun - 0.5 || (Math.abs(x.enUzun - y.enUzun) <= 0.5 && x.toplamKm < y.toplamKm - 1e-6);

    // 1) Açgözlü yerleştirme: uzun taşımalar önce, her biri en az zarar verdiği araca
    const sirali = gorevler.slice().sort((a, b) => yolKm(b.alim, b.teslim) - yolKm(a.alim, a.teslim));
    let atama = uygun.map(() => []);
    for (const g of sirali) {
        let enIyi = null, enIyiI = 0;
        uygun.forEach((_, i) => {
            const deneme = atama.map((l, j) => (j === i ? [...l, g] : l));
            const d = degerlendir(deneme);
            if (!enIyi || dahaIyi(d, enIyi)) { enIyi = d; enIyiI = i; }
        });
        atama[enIyiI].push(g);
    }

    // 2) İyileştirme: bir görevi başka araca taşı ya da iki aracın görevini takas et
    let mevcut = degerlendir(atama);
    for (let tur = 0; tur < 40; tur++) {
        let iyilesti = false;
        for (let i = 0; i < atama.length && !iyilesti; i++) {
            for (const g of atama[i]) {
                for (let j = 0; j < atama.length && !iyilesti; j++) {
                    if (i === j) continue;
                    // taşıma
                    const tasima = atama.map((l, k) => (k === i ? l.filter(x => x !== g) : k === j ? [...l, g] : l));
                    const dt = degerlendir(tasima);
                    if (dahaIyi(dt, mevcut)) { atama = tasima; mevcut = dt; iyilesti = true; break; }
                    // takas
                    for (const h of atama[j]) {
                        const takas = atama.map((l, k) => (k === i ? [...l.filter(x => x !== g), h] : k === j ? [...l.filter(x => x !== h), g] : l));
                        const dk = degerlendir(takas);
                        if (dahaIyi(dk, mevcut)) { atama = takas; mevcut = dk; iyilesti = true; break; }
                    }
                }
                if (iyilesti) break;
            }
        }
        if (!iyilesti) break;
    }

    return {
        planlar: uygun.map((a, i) => ({ aracId: a.id, plan: mevcut.planlar[i], gorevler: atama[i] })),
        enUzunDk: mevcut.enUzun,
        toplamKm: mevcut.toplamKm,
    };
}

export const kmYazi = (x) => (+x || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' km';
export const sureYazi = (dk) => (dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${Math.round(dk)} dk`);

// Planlanan durakları sefer kaydına çevirir (şoför ekranı ve sunucu bu yapıyı kullanır)
export function seferDuraklari(duraklar) {
    const is = (g) => ({ irsaliyeId: g.id, etiket: g.etiket, adet: g.adet, urunAdi: g.urunAdi || '' });
    return duraklar.map(d => ({
        tip: d.tip,
        ad: d.konum.ad || '',
        lat: +d.konum.lat,
        lng: +d.konum.lng,
        firmaId: d.konum.firmaId || null,
        km: Math.round(d.km * 10) / 10,
        alimlar: d.alimlar.map(is),
        teslimler: d.teslimler.map(is),
        durum: d.tip === 'durak' ? 'bekliyor' : null,
    }));
}

// Kayıtlı sefer duraklarını haritanın beklediği biçime çevirir
export function seferHaritaDuraklari(sefer) {
    return (sefer.duraklar || []).map(d => ({ tip: d.tip, konum: { lat: d.lat, lng: d.lng, ad: d.ad }, tamam: d.durum === 'tamamlandi' }));
}
