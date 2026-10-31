// Ürünleri Excel/CSV'den içe aktarma ve şablon.
// Bedenler iki şekilde okunur:
//  1) Her beden ayrı sütun (S | M | L | XL | 2X ...): hücredeki sayı o bedenin asorti adedi
//     (1 = asortide 1 adet), boş/0 = o beden yok. "x", "✓", "var" de 1 sayılır.
//  2) Eski şablon: tek "Bedenler" sütununda "S,M,L,XL" → asorti otomatik dağıtılır.
import { excelIndir } from './excel';
import { excelOku } from './excelOku';

export const SABLON_BEDENLERI = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const ESANLAMLI = {
    XXS: '2XS', '2X': '2XL', XXL: '2XL', '3X': '3XL', XXXL: '3XL', '4X': '4XL', XXXXL: '4XL',
    '5X': '5XL', XXXXXL: '5XL', STANDART: 'STD', TEK: 'STD', 'TEKEBAT': 'STD',
};

// Sütun başlığı bir beden mi? (S, XL, 2X, XXL, 36, 2-3 ...) → standart ad, değilse null
export function bedenAdi(baslik) {
    let b = String(baslik ?? '').trim().toLocaleUpperCase('tr').replace(/\s+/g, '').replace('İ', 'I');
    if (!b) return null;
    b = ESANLAMLI[b] || b;
    if (/^(2XS|XS|S|M|L|XL|[2-6]XL|STD)$/.test(b)) return b;
    if (/^\d{1,2}([-/]\d{1,2})?$/.test(b)) return b.replace('/', '-');   // numara (36, 38) veya yaş (2-3)
    return null;
}

const kucuk = (s) => String(s ?? '').trim().toLocaleLowerCase('tr');

// "1,50" / "1.50" / 1.5 → 1.5 ; boş veya anlamsız → 0
export function sayiOku(deger) {
    if (typeof deger === 'number') return Number.isFinite(deger) ? deger : 0;
    let s = String(deger ?? '').trim().replace(/[₺\s]|TL/gi, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

// Beden hücresi → asorti adedi (0 = beden yok)
function bedenAdedi(deger) {
    if (typeof deger === 'number') return deger > 0 ? Math.max(1, Math.round(deger)) : 0;
    const s = kucuk(deger);
    if (!s || s === '0' || s === '-' || s === 'yok' || s === 'hayır') return 0;
    if (['x', '✓', '✔', 'var', 'evet', '+', 'v'].includes(s)) return 1;
    const n = sayiOku(s);
    return n > 0 ? Math.max(1, Math.round(n)) : 0;
}

// Eski "Bedenler" metni için otomatik dağılım: ortadaki beden 3, kenarlar 1, diğerleri 2
export function otomatikDagilim(bedenler) {
    const d = {};
    bedenler.forEach((b, i) => {
        d[b] = i === Math.floor(bedenler.length / 2) ? 3 : (i === 0 || i === bedenler.length - 1 ? 1 : 2);
    });
    return d;
}

// CSV / TXT / Excel'den kopyalanmış metin (; , veya sekme ile ayrılmış) → satırlar
export function metniSatirlaraBol(metin) {
    const satirlar = String(metin).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!satirlar.length) return [];
    const ilk = satirlar[0];
    const ayrac = ilk.includes('\t') ? '\t' : ilk.includes(';') ? ';' : ',';
    return satirlar.map(l => l.split(ayrac).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()));
}

// Satırlar → { urunler: [{ urunKodu, urunAdi, bedenler, dagilim, kesimFiyat, dikimFiyat, utuFiyat, bedenYok }], bedenSutunlari }
export function urunSatirlariniCoz(satirlar) {
    // Başlık satırı: "kod" ya da "ad" içeren ilk satır (üstte açıklama satırları olabilir)
    const baslikNo = satirlar.findIndex(r => r.some(h => /kod|code|ürün|urun|^ad$|ad[ıi]|name|model/.test(kucuk(h))));
    if (baslikNo < 0) return { urunler: [], bedenSutunlari: [] };
    const basliklar = satirlar[baslikNo].map(kucuk);

    const bul = (kosul, haric = []) => basliklar.findIndex((h, i) => !haric.includes(i) && h && kosul(h));
    const kodIdx = bul(h => h.includes('kod') || h.includes('code'));
    const bedenMetinIdx = bul(h => h.includes('beden') || h.includes('size'), [kodIdx]);
    const kesimIdx = bul(h => h.includes('kesim'));
    const dikimIdx = bul(h => h.includes('dikim'));
    const utuIdx = bul(h => h.includes('ütü') || h.includes('utu') || h.includes('paket'));
    const fiyatlar = [kodIdx, bedenMetinIdx, kesimIdx, dikimIdx, utuIdx];
    const adIdx = bul(h => h.includes('ürün ad') || h.includes('urun ad') || h === 'ad' || h.includes('adı') || h.includes('adi')
        || h.includes('name') || h.includes('isim') || h.includes('model') || h.includes('ürün') || h.includes('urun'), fiyatlar);

    // Beden sütunları: başlığı beden olan, diğer alanlara ait olmayan sütunlar
    const kullanilan = new Set([...fiyatlar, adIdx].filter(i => i >= 0));
    const bedenSutunlari = [];
    satirlar[baslikNo].forEach((h, i) => {
        if (kullanilan.has(i)) return;
        const ad = bedenAdi(h);
        if (ad && !bedenSutunlari.some(b => b.ad === ad)) bedenSutunlari.push({ i, ad });
    });

    const urunler = [];
    satirlar.slice(baslikNo + 1).forEach(r => {
        const hucre = (i) => (i >= 0 ? r[i] ?? '' : '');
        const urunKodu = String(hucre(kodIdx >= 0 ? kodIdx : 0)).trim();
        const urunAdi = String(hucre(adIdx >= 0 ? adIdx : (kodIdx === 0 ? 1 : 0))).trim();
        if (!urunKodu && !urunAdi) return;

        let bedenler = [];
        let dagilim = {};
        bedenSutunlari.forEach(({ i, ad }) => {
            const adet = bedenAdedi(r[i]);
            if (adet > 0) { bedenler.push(ad); dagilim[ad] = adet; }
        });
        if (!bedenler.length && bedenMetinIdx >= 0 && String(hucre(bedenMetinIdx)).trim()) {
            bedenler = String(hucre(bedenMetinIdx)).split(/[,;\s/]+/).map(b => bedenAdi(b) || b.trim().toUpperCase()).filter(Boolean);
            bedenler = [...new Set(bedenler)];
            dagilim = otomatikDagilim(bedenler);
        }
        const bedenYok = bedenler.length === 0;
        if (bedenYok) { bedenler = ['S', 'M', 'L', 'XL', '2XL']; dagilim = otomatikDagilim(bedenler); }

        urunler.push({
            urunKodu, urunAdi, bedenler, dagilim, bedenYok,
            kesimFiyat: sayiOku(hucre(kesimIdx)),
            dikimFiyat: sayiOku(hucre(dikimIdx)),
            utuFiyat: sayiOku(hucre(utuIdx)),
        });
    });
    return { urunler, bedenSutunlari };
}

// Seçilen dosyayı (xlsx / csv / txt) oku → satırlar
export async function urunDosyasiOku(dosya) {
    const ad = kucuk(dosya.name);
    if (ad.endsWith('.xls')) throw new Error('Eski Excel biçimi (.xls) okunamıyor. Excel\'de "Farklı Kaydet → Excel Çalışma Kitabı (.xlsx)" ile kaydedip tekrar deneyin.');
    if (ad.endsWith('.xlsx') || ad.endsWith('.xlsm')) return excelOku(dosya);
    return metniSatirlaraBol(await dosya.text());
}

// Şablon: her beden ayrı sütun, 1 = asortide 1 adet
export function urunSablonuIndir() {
    const sutunlar = [
        { baslik: 'Ürün Kodu', genislik: 12 },
        { baslik: 'Ürün Adı', genislik: 30 },
        ...SABLON_BEDENLERI.map(b => ({ baslik: b, tip: 'sayi', genislik: 6 })),
        { baslik: 'Kesim Fiyat', tip: 'para', genislik: 12 },
        { baslik: 'Dikim Fiyat', tip: 'para', genislik: 12 },
        { baslik: 'Ütü Fiyat', tip: 'para', genislik: 12 },
    ];
    const ornek = (kod, ad, bedenler, fiyatlar) => [kod, ad, ...SABLON_BEDENLERI.map(b => bedenler[b] ?? ''), ...fiyatlar];
    excelIndir('urun_sablonu', [{
        ad: 'Ürünler',
        sutunlar,
        satirlar: [
            ornek('001', 'Fermuarlı Tayt', { S: 1, M: 1, L: 1, XL: 1 }, [1.5, 3, 1]),
            ornek('002', 'Erkek Basic T-Shirt', { S: 1, M: 2, L: 2, XL: 1, '2XL': 1 }, [1.75, 3.5, 1.25]),
        ],
    }]);
}
