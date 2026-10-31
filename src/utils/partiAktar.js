// Partileri Excel'den aktarma ve şablon — eski parti defteri düzeninde:
//   Ay | Atölye | Model | Adet | Birim Fiyat | Tutar (= Adet × Fiyat) | Not | Durum | Kesimhane | Ütü/Paketçi
// Defterdeki "Hacı (050-1 = 636 × 6 = 3816" satırı → Atölye: Hacı, Model: 050-1, Adet: 636, Fiyat: 6.
import { excelIndir } from './excel';
import { sayiOku } from './excelOku';

const kucuk = (s) => String(s ?? '').trim().toLocaleLowerCase('tr');
const metin = (v) => (typeof v === 'number' ? String(v) : String(v ?? '').trim());

const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const iki = (n) => String(n).padStart(2, '0');

// "11.AY", "11", "Kasım", "2026-11", "11.2026", "05.11.2026", Excel tarihi → "YYYY-AA" (okunamazsa '')
export function ayCoz(deger, bugun = new Date()) {
    const yil = bugun.getFullYear();
    if (typeof deger === 'number') {
        if (deger >= 1 && deger <= 12) return `${yil}-${iki(Math.round(deger))}`;
        if (deger > 20000) {   // Excel tarih seri numarası
            const t = new Date(Date.UTC(1899, 11, 30) + Math.round(deger) * 86400000);
            return `${t.getUTCFullYear()}-${iki(t.getUTCMonth() + 1)}`;
        }
        return '';
    }
    const s = kucuk(deger);
    if (!s) return '';
    let m = /^(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?$/.exec(s);             // 2026-11, 2026-11-05
    if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${iki(m[2])}`;
    m = /^\d{1,2}[./-](\d{1,2})[./-](\d{4})$/.exec(s);                      // 05.11.2026
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${iki(m[1])}`;
    m = /^(\d{1,2})[./-](\d{4})$/.exec(s);                                  // 11.2026
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${iki(m[1])}`;
    m = /^(\d{1,2})\s*\.?\s*(ay)?\.?$/.exec(s);                             // 11, 11.AY, 11. ay
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${yil}-${iki(m[1])}`;
    const ay = AYLAR.findIndex(a => s.startsWith(a));
    if (ay >= 0) {
        const y = /(\d{4})/.exec(s);
        return `${y ? y[1] : yil}-${iki(ay + 1)}`;
    }
    return '';
}

export const ayEtiketi = (ay) => {
    const m = /^(\d{4})-(\d{2})$/.exec(ay || '');
    if (!m) return '';
    const ad = AYLAR[+m[2] - 1];
    return `${+m[2]}. AY — ${ad.charAt(0).toLocaleUpperCase('tr')}${ad.slice(1)} ${m[1]}`;
};

// Durum metni → parti durumu (boş = dikimde: defterdeki iş atölyeye verilmiştir)
export function durumCoz(deger) {
    const s = kucuk(deger);
    if (!s) return 'dikimde';
    if (/kesim/.test(s)) return 'kesimde';
    if (/ütü|utu|paket/.test(s)) return 'utupakette';
    if (/tamam|bitti|teslim|kapandı|kapandi|^x$|✓|✔/.test(s)) return 'tamamlandi';
    if (/dikim|atöly|atoly/.test(s)) return 'dikimde';
    return null;
}
export const DURUM_ADLARI = { kesimde: 'Kesimde', dikimde: 'Dikimde', utupakette: 'Ütü/Pakette', tamamlandi: 'Tamamlandı' };

// Model kodu karşılaştırma anahtarı: büyük/küçük harf ve boşluk önemsiz
export const modelAnahtari = (kod) => metin(kod).toLocaleUpperCase('tr').replace(/\s+/g, '');
export const firmaAnahtari = (ad) => kucuk(ad).replace(/\s+/g, ' ');

// Satırlar → [{ partiNo, ay, atolye, model, kat, carpan, adet, not, durum, kesimhane, utupaketci, hatalar[], uyarilar[] }]
// Defter satırı "Hacı (050-1 = 636 × 6 = 3816": 636 kat adedi, 6 asorti çarpanı (seri adedi), 3816 iş adedi.
export function partiSatirlariniCoz(satirlar, { bugun = new Date() } = {}) {
    const baslikNo = satirlar.findIndex(r => r.some(h => /atöly|atoly|model|adet|kat/.test(kucuk(h))));
    if (baslikNo < 0) return [];
    const basliklar = satirlar[baslikNo].map(kucuk);
    const alinan = new Set();
    const bul = (kosul) => {
        const i = basliklar.findIndex((h, idx) => h && !alinan.has(idx) && kosul(h));
        if (i >= 0) alinan.add(i);
        return i;
    };
    // Sıra önemli: "Kat Adedi" iş adedi sanılmasın, "Model Kodu" atölye sanılmasın
    const partiNoIdx = bul(h => /parti/.test(h));   // sistemden alınan dökümde: kayıtlı parti tekrar açılmaz
    const katIdx = bul(h => /^kat|kat ad|kat say/.test(h));
    const carpanIdx = bul(h => /çarpan|carpan|asorti|seri/.test(h));
    const fiyatIdx = bul(h => /fiyat/.test(h));      // ilk gönderilen şablonda çarpan "Birim Fiyat" adıyla yazılmıştı
    const tutarIdx = bul(h => /tutar/.test(h));
    const adetIdx = bul(h => /adet|miktar|toplam/.test(h));
    const ayIdx = bul(h => /^ay$|^ay\b|tarih|dönem|donem/.test(h));
    const notIdx = bul(h => /not|açıklama|aciklama/.test(h));
    const durumIdx = bul(h => /durum/.test(h));
    const kesimIdx = bul(h => /kesim/.test(h));
    const utuIdx = bul(h => /ütü|utu|paket/.test(h));
    const modelIdx = bul(h => /model|kod|ürün|urun/.test(h));
    const atolyeIdx = bul(h => /atöly|atoly|dikim|fason|firma|usta|isim|^ad/.test(h));
    const eskiSablon = katIdx < 0 && carpanIdx < 0 && fiyatIdx >= 0;

    let sonAy = '';   // defterde ay başlıkta bir kez yazılır: boş satırlar üsttekinin ayını alır
    const sonuc = [];
    satirlar.slice(baslikNo + 1).forEach(r => {
        const h = (i) => (i >= 0 ? r[i] ?? '' : '');
        const atolye = metin(h(atolyeIdx));
        const model = metin(h(modelIdx));
        if (!atolye && !model) return;
        const ayHam = h(ayIdx);
        const ay = ayCoz(ayHam, bugun) || sonAy || `${bugun.getFullYear()}-${iki(bugun.getMonth() + 1)}`;
        sonAy = ay;
        let kat, carpan, yazilanAdet;
        if (eskiSablon) {
            // Eski şablon: Adet = kat, Birim Fiyat = asorti çarpanı, Tutar = iş adedi
            kat = Math.round(sayiOku(h(adetIdx)));
            carpan = Math.round(sayiOku(h(fiyatIdx)));
            yazilanAdet = Math.round(sayiOku(h(tutarIdx)));
        } else {
            kat = Math.round(sayiOku(h(katIdx)));
            carpan = Math.round(sayiOku(h(carpanIdx)));
            yazilanAdet = Math.round(sayiOku(h(adetIdx)));
        }
        const hesap = kat > 0 && carpan > 0 ? kat * carpan : 0;
        const adet = hesap || yazilanAdet;
        const durum = durumCoz(h(durumIdx));
        const hatalar = [];
        const uyarilar = [];
        if (!atolye) hatalar.push('Atölye yok');
        if (!model) hatalar.push('Model yok');
        if (!(adet > 0)) hatalar.push('Adet yok');
        if (eskiSablon) uyarilar.push('Eski şablon: "Birim Fiyat" asorti çarpanı olarak okundu');
        if (metin(ayHam) && !ayCoz(ayHam, bugun)) uyarilar.push(`"${metin(ayHam)}" ay olarak okunamadı`);
        if (!durum) uyarilar.push(`"${metin(h(durumIdx))}" durumu tanınmadı → Dikimde`);
        if (hesap && yazilanAdet > 0 && yazilanAdet !== hesap) {
            uyarilar.push(`İş adedi ${yazilanAdet.toLocaleString('tr-TR')} yazılmış, ${kat} × ${carpan} = ${hesap.toLocaleString('tr-TR')} alındı`);
        }
        sonuc.push({
            partiNo: metin(h(partiNoIdx)),
            ay, atolye, model,
            kat: kat > 0 ? kat : null,
            carpan: carpan > 0 ? carpan : null,
            adet,
            not: metin(h(notIdx)),
            durum: durum || 'dikimde',
            kesimhane: metin(h(kesimIdx)),
            utupaketci: metin(h(utuIdx)),
            hatalar, uyarilar,
        });
    });
    return sonuc;
}

const SABLON_SUTUNLARI = [
    { baslik: 'Ay', genislik: 9 },
    { baslik: 'Atölye', genislik: 22 },
    { baslik: 'Model', genislik: 11 },
    { baslik: 'Kat Adedi', tip: 'sayi', genislik: 11 },
    { baslik: 'Asorti Çarpanı', tip: 'sayi', genislik: 14 },
    { baslik: 'İş Adedi', tip: 'sayi', genislik: 11, formul: (n) => `IF(AND(D${n}<>"",E${n}<>""),D${n}*E${n},"")` },
    { baslik: 'Not', genislik: 16 },
    { baslik: 'Durum', genislik: 13, secenekler: Object.values(DURUM_ADLARI) },
    { baslik: 'Kesimhane', genislik: 18 },
    { baslik: 'Ütü/Paketçi', genislik: 18 },
];

// satirlar: [[ay, atölye, model, kat, çarpan, '', not, durum, kesimhane, ütü], ...] — boşsa boş şablon
export function partiSablonuIndir({ dosyaAdi = 'parti_sablonu', satirlar = [] } = {}) {
    excelIndir(dosyaAdi, partiSablonuSayfalari(satirlar));
}

export function partiSablonuSayfalari(satirlar = []) {
    return [
        { ad: 'Partiler', sutunlar: SABLON_SUTUNLARI, satirlar, bosSatir: 200 },
        {
            ad: 'Nasıl Doldurulur',
            sutunlar: SABLON_SUTUNLARI,
            ustBilgi: [
                'Partiler sayfasına defterdeki gibi her satıra bir iş yazın. Program yalnızca "Partiler" sayfasını okur.',
                'Ay: 11.AY, 11, Kasım veya tarih yazabilirsiniz. Boş bırakılan satır üstteki satırın ayını alır.',
                'Defterdeki "636 × 6 = 3816": Kat Adedi 636, Asorti Çarpanı 6 (bir serideki adet); İş Adedi kendisi hesaplanır.',
                'Atölye ve Model kayıtlı değilse aktarırken otomatik eklenir. Durum boşsa "Dikimde" olur; "Tamamlandı" yazılırsa parti kapanır.',
            ],
            satirlar: [
                ['11.AY', 'Örnek Atölye', '050-1', 636, 6, '', '', '', '', ''],
                ['', 'Örnek Atölye 2', '040', 648, 6, '', 'not', 'Dikimde', '', ''],
            ],
        },
    ];
}
