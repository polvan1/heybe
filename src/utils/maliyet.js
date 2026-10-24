// Model (ürün) maliyet kartı ve parti kârlılığı hesapları.
//
// urun.maliyet = {
//   kalemler: [{ id, kategori, ad, miktar, birim, birimFiyat, paraBirimi }],   // adet başına
//   operasyonlar: [{ id, ad, dakika }],                                        // adet başına standart süre (SAM)
//   satisFiyati, satisParaBirimi,                                              // birim satış/teklif fiyatı
//   genelGiderOrani, hedefKarMarji,                                            // boşsa genel ayar
// }
// Fason (kesim/dikim/ütü) birim fiyatları ürünün kendi alanlarından (kesimFiyat, dikimFiyat, utuFiyat) gelir.
// Kâr marjı SATIŞ üzerinden hesaplanır: marj = (satış − maliyet) / satış.
import { tlKarsiligi } from '../data/kur';

export const MALIYET_KATEGORILERI = [
    { value: 'kumas', label: 'Kumaş' },
    { value: 'aksesuar', label: 'Aksesuar' },
    { value: 'baski', label: 'Baskı / Nakış' },
    { value: 'yikama', label: 'Yıkama / Boya' },
    { value: 'ambalaj', label: 'Ambalaj' },
    { value: 'diger', label: 'Diğer' },
];
export const kategoriAdi = (k) => MALIYET_KATEGORILERI.find(x => x.value === k)?.label || 'Diğer';

const sayi = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bosMu = (v) => v === '' || v === null || v === undefined;

// Ürünün tanımlı bir maliyet kartı var mı?
export const maliyetTanimliMi = (urun) => !!urun?.maliyet && (
    (urun.maliyet.kalemler || []).length > 0 || sayi(urun.maliyet.satisFiyati) > 0);

export function modelMaliyeti(urun, { kurlar = {}, ayar = {} } = {}) {
    const m = urun?.maliyet || {};
    let kurEksik = false;
    const kalemler = (m.kalemler || []).map(k => {
        const birimTl = tlKarsiligi(sayi(k.birimFiyat), k.paraBirimi, kurlar);
        if (birimTl === null) kurEksik = true;
        return { ...k, tl: (birimTl ?? 0) * sayi(k.miktar) };
    });
    const kategoriler = {};
    kalemler.forEach(k => { kategoriler[k.kategori || 'diger'] = (kategoriler[k.kategori || 'diger'] || 0) + k.tl; });
    const malzeme = kalemler.reduce((t, k) => t + k.tl, 0);

    const fason = { kesim: sayi(urun?.kesimFiyat), dikim: sayi(urun?.dikimFiyat), utu: sayi(urun?.utuFiyat) };
    fason.toplam = fason.kesim + fason.dikim + fason.utu;

    const toplamDakika = (m.operasyonlar || []).reduce((t, o) => t + sayi(o.dakika), 0);
    const dakikaUcreti = sayi(ayar.dakikaUcreti);
    const operasyon = { toplamDakika, tahminiIscilik: dakikaUcreti > 0 ? toplamDakika * dakikaUcreti : null };

    const genelGiderOrani = bosMu(m.genelGiderOrani) ? sayi(ayar.genelGiderOrani) : sayi(m.genelGiderOrani);
    const hedefKarMarji = bosMu(m.hedefKarMarji) ? sayi(ayar.hedefKarMarji) : sayi(m.hedefKarMarji);
    const direkt = malzeme + fason.toplam;
    const genelGider = direkt * genelGiderOrani / 100;
    const birimMaliyet = direkt + genelGider;
    const onerilenSatis = hedefKarMarji < 100 ? birimMaliyet / (1 - hedefKarMarji / 100) : null;

    const satisTl = sayi(m.satisFiyati) > 0 ? tlKarsiligi(sayi(m.satisFiyati), m.satisParaBirimi, kurlar) : null;
    if (sayi(m.satisFiyati) > 0 && satisTl === null) kurEksik = true;
    const kar = satisTl !== null ? satisTl - birimMaliyet : null;
    const karMarji = satisTl ? (kar / satisTl) * 100 : null;

    return {
        kalemler, kategoriler, malzeme, fason, operasyon, direkt,
        genelGiderOrani, genelGider, birimMaliyet, hedefKarMarji, onerilenSatis,
        satisTl, kar, karMarji, kurEksik,
    };
}

// Partide çıkan (üretilen) adet: tamamlanana kadar kesilen / planlanan
export const partiUretimAdedi = (p) => sayi(p.sonCikanAdet) || sayi(p.dikimdenCikanAdet) || sayi(p.kesilenAdet) || sayi(p.toplamAdet);

// Parti kârlılığı: planlanan (model kartı × adet) ve gerçekleşen
// (fason borçları + partiye bağlı kumaş alımları + kartındaki diğer kalemler + genel gider)
export function partiMaliyeti(parti, { urun, cariHareketler = [], kumasStoklar = [], kurlar = {}, ayar = {} }) {
    const model = modelMaliyeti(urun, { kurlar, ayar });
    const adet = partiUretimAdedi(parti);
    const planlanan = model.birimMaliyet * sayi(parti.toplamAdet);

    const fasonBorclari = cariHareketler.filter(h => h.partiId === parti.id && h.tip === 'borc');
    const fason = fasonBorclari.reduce((t, h) => t + sayi(h.tutar), 0);
    const kumasKayitlari = kumasStoklar.filter(k => k.partiId === parti.id && sayi(k.tutar) > 0);
    const kumasGercek = kumasKayitlari.reduce((t, k) => t + sayi(k.tutar), 0);
    // Partiye kumaş alımı bağlanmadıysa kumaş, model kartından tahmin edilir
    const kumasTahmini = kumasKayitlari.length === 0;
    const kumas = kumasTahmini ? (model.kategoriler.kumas || 0) * adet : kumasGercek;
    const digerMalzeme = (model.malzeme - (model.kategoriler.kumas || 0)) * adet;
    // Fason borcu henüz yazılmadıysa (parti sürüyor) kalan aşamalar model fiyatıyla tahmin edilir
    const fasonTahmini = fasonBorclari.length === 0;
    const fasonTutar = fasonTahmini ? model.fason.toplam * adet : fason;
    const direkt = kumas + digerMalzeme + fasonTutar;
    const genelGider = direkt * model.genelGiderOrani / 100;
    const gerceklesen = direkt + genelGider;
    const gelir = model.satisTl !== null ? model.satisTl * adet : null;
    const kar = gelir !== null ? gelir - gerceklesen : null;

    return {
        adet, planlanan, gerceklesen, birimGerceklesen: adet ? gerceklesen / adet : 0,
        kumas, kumasTahmini, digerMalzeme, fason: fasonTutar, fasonTahmini, genelGider,
        gelir, kar, karMarji: gelir ? (kar / gelir) * 100 : null, model,
    };
}

// Maliyeti kim görür: kesimhane, fasoncu ve şoför görmez (sunucu da göndermez)
export function maliyetGorur(user) {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    if (['kesimhane', 'fasoncu', 'sofor'].includes(user.rol)) return false;
    return ['urunler', 'raporlar', 'cari_hesaplar'].some(y => (user.yetkiler || []).includes(y));
}
