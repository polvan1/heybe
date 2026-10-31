// Firmaları Excel/CSV'den içe aktarma ve şablon.
// Sütunlar başlık adından tanınır (sıra önemli değil): Firma Adı, Firma Türü, Yetkili Kişi,
// Telefon, Adres (ayrıca İl / İlçe sütunları adrese eklenir), Günlük Kapasite, Ödeme Vadesi, Notlar.
import { excelIndir } from './excel';
import { FIRMA_TIPLERI } from './firma';

const kucuk = (s) => String(s ?? '').trim().toLocaleLowerCase('tr');
const metin = (v) => String(v ?? '').trim();

// "Dikimhane", "atölye", "Ütü Paket", "kumaş" ... → firma türü (bilinmiyorsa null)
export function firmaTipiCoz(deger) {
    const s = kucuk(deger);
    if (!s) return null;
    if (/kesim/.test(s)) return 'kesimhane';
    if (/bask|nakış|nakis|print/.test(s)) return 'baskici';
    if (/ütü|utu|paket/.test(s)) return 'utupaketci';
    if (/kuma/.test(s)) return 'kumasci';
    if (/atöly|atoly|dikim|konfeksiyon|fason/.test(s)) return 'atolye';
    return FIRMA_TIPLERI.find(t => kucuk(t.value) === s || kucuk(t.label) === s || kucuk(t.kisa) === s)?.value || null;
}

// Excel sayıya çevirdiği numaranın baştaki 0'ını geri koyar: 5321234567 → 05321234567
export function telefonDuzelt(deger) {
    let s = typeof deger === 'number' ? String(Math.round(deger)) : metin(deger);
    if (/^[2-5]\d{9}$/.test(s)) s = `0${s}`;
    return s;
}

const tamSayi = (v, enAz, enCok) => {
    const n = parseInt(String(v ?? '').replace(/\D+/g, ''), 10);
    return Number.isFinite(n) && n >= enAz && n <= enCok ? n : null;
};

export const firmaAdiAnahtari = (ad) => kucuk(ad).replace(/\s+/g, ' ');

// Satırlar → [{ ad, tip, tipVerildi, yetkiliKisi, telefon, adres, gunlukKapasite, odemeVadesi, notlar }]
export function firmaSatirlariniCoz(satirlar, { varsayilanTip = 'atolye' } = {}) {
    const baslikNo = satirlar.findIndex(r => r.some(h => /firma|ünvan|unvan|^ad$|adı|^isim$/.test(kucuk(h))));
    if (baslikNo < 0) return [];
    const basliklar = satirlar[baslikNo].map(kucuk);
    const alinan = new Set();
    const bul = (kosul) => {
        const i = basliklar.findIndex((h, idx) => h && !alinan.has(idx) && kosul(h));
        if (i >= 0) alinan.add(i);
        return i;
    };
    // Sıra önemli: "Firma Türü" ve "Yetkili Kişi" ad sütunu sanılmasın diye önce bulunur
    const tipIdx = bul(h => /tür|tur|tip|kategori|faaliyet/.test(h));
    const yetkiliIdx = bul(h => /yetkili|ilgili|kişi|kisi|sorumlu/.test(h));
    const telIdx = bul(h => /tel|gsm|cep|numara|phone|^no$/.test(h));
    const ilceIdx = bul(h => /ilçe|ilce/.test(h));
    const ilIdx = bul(h => h === 'il' || /şehir|sehir/.test(h));
    const adresIdx = bul(h => /adres|address/.test(h));
    const kapasiteIdx = bul(h => /kapasite/.test(h));
    const vadeIdx = bul(h => /vade/.test(h));
    const notIdx = bul(h => /not|açıklama|aciklama/.test(h));
    const adIdx = bul(h => /firma|ünvan|unvan|^ad$|adı|isim|name/.test(h));

    const firmalar = [];
    satirlar.slice(baslikNo + 1).forEach(r => {
        const h = (i) => (i >= 0 ? r[i] ?? '' : '');
        const ad = metin(h(adIdx >= 0 ? adIdx : 0));
        if (!ad) return;
        const tipVerildi = firmaTipiCoz(h(tipIdx));
        const tip = tipVerildi || varsayilanTip;
        const adres = [metin(h(adresIdx)), metin(h(ilceIdx)), metin(h(ilIdx))].filter(Boolean).join(', ');
        firmalar.push({
            ad,
            tip,
            tipVerildi: !!tipVerildi,
            tipMetni: metin(h(tipIdx)),
            yetkiliKisi: metin(h(yetkiliIdx)),
            telefon: telefonDuzelt(h(telIdx)),
            adres,
            gunlukKapasite: tip === 'kumasci' ? null : tamSayi(h(kapasiteIdx), 1, 1000000),
            odemeVadesi: tamSayi(h(vadeIdx), 1, 31),
            notlar: metin(h(notIdx)),
        });
    });
    return firmalar;
}

// Mevcut firmaya yazılacak değişiklikler: sadece dosyada dolu olan alanlar
export function firmaGuncellemesi(f) {
    const d = {};
    if (f.tipVerildi) d.tip = f.tip;
    ['yetkiliKisi', 'telefon', 'adres', 'notlar'].forEach(k => { if (f[k]) d[k] = f[k]; });
    if (f.gunlukKapasite) d.gunlukKapasite = f.gunlukKapasite;
    if (f.odemeVadesi) d.odemeVadesi = f.odemeVadesi;
    return d;
}

export function yeniFirmaVerisi(f) {
    return {
        ad: f.ad, tip: f.tip, yetkiliKisi: f.yetkiliKisi, telefon: f.telefon, adres: f.adres,
        gunlukKapasite: f.gunlukKapasite, odemeVadesi: f.odemeVadesi, notlar: f.notlar, aktif: true,
    };
}

export function firmaSablonuIndir() {
    excelIndir('firma_sablonu', [{
        ad: 'Firmalar',
        sutunlar: [
            { baslik: 'Firma Adı', genislik: 30 },
            { baslik: 'Firma Türü', genislik: 14, secenekler: FIRMA_TIPLERI.map(t => t.kisa) },
            { baslik: 'Yetkili Kişi', genislik: 20 },
            { baslik: 'Telefon', genislik: 16 },
            { baslik: 'Adres', genislik: 40 },
            { baslik: 'Günlük Kapasite', tip: 'sayi', genislik: 15 },
            { baslik: 'Ödeme Vadesi (Ayın Günü)', tip: 'sayi', genislik: 24 },
            { baslik: 'Notlar', genislik: 30 },
        ],
        satirlar: [
            ['Örnek Dikim Atölyesi', 'Dikimhane', 'Ali Yılmaz', '0532 000 00 00', 'Merkez Mah. 1. Sok. No:1, Kayseri', 300, 20, ''],
            ['Örnek Kumaş Ltd.', 'Kumaşçı', 'Ayşe Demir', '0352 000 00 00', 'Organize Sanayi, Kayseri', '', 30, 'Süprem, ribana'],
        ],
    }]);
}
