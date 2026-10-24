// Cari hesap ekstresi: tarih aralığındaki tüm hareketler (kapatılmış hesaplar dahil),
// dönem başı devir ve yürüyen bakiye. Bakiye = borç − ödeme (pozitif: firmaya borçluyuz).
import { excelIndir } from './excel';
import { raporYazdir, tlBicim } from './raporYazdir';
import { FIRMA_TIP_LABELS } from '../data/db';

const gun = (t) => (t ? String(t).slice(0, 10) : '');
const hareketTarihi = (h) => h.tarih || h.createdAt || '';

// bas / bit: 'YYYY-MM-DD' (boşsa sınırsız)
export function cariEkstreHesapla(hareketler, { bas = '', bit = '', partiler = [] } = {}) {
    const sirali = [...hareketler].sort((a, b) => String(hareketTarihi(a)).localeCompare(String(hareketTarihi(b))));
    let devir = 0;
    let bakiye = 0;
    let donemBorc = 0;
    let donemOdeme = 0;
    const satirlar = [];
    sirali.forEach(h => {
        const tutar = Number(h.tutar) || 0;
        const borc = h.tip === 'borc' ? tutar : 0;
        const odeme = h.tip === 'borc' ? 0 : tutar;
        const g = gun(hareketTarihi(h));
        if (bas && g < bas) { devir += borc - odeme; return; }
        if (bit && g > bit) return;
        if (!satirlar.length) bakiye = devir;
        bakiye += borc - odeme;
        donemBorc += borc;
        donemOdeme += odeme;
        const parti = h.partiId ? partiler.find(p => p.id === h.partiId) : null;
        satirlar.push({
            tarih: hareketTarihi(h),
            belge: parti?.partiNo || (h.kumasStokId ? 'Kumaş' : ''),
            aciklama: h.aciklama || (parti ? `${parti.urunKodu || ''} ${parti.urunAdi || ''}`.trim() : ''),
            borc: borc || null,
            odeme: odeme || null,
            bakiye,
            durum: h.hesaplandi ? 'Kapatıldı' : 'Açık',
        });
    });
    if (!satirlar.length) bakiye = devir;
    return { devir, satirlar, donemBorc, donemOdeme, sonBakiye: bakiye };
}

const SUTUNLAR = [
    { baslik: 'Tarih', tip: 'tarih' },
    { baslik: 'Belge' },
    { baslik: 'Açıklama', genislik: 46 },
    { baslik: 'Borç', tip: 'para' },
    { baslik: 'Ödeme', tip: 'para' },
    { baslik: 'Bakiye', tip: 'para' },
    { baslik: 'Durum' },
];

const donemMetni = (bas, bit) => {
    const f = (g) => (g ? new Date(g + 'T00:00:00').toLocaleDateString('tr-TR') : '');
    if (bas && bit) return `${f(bas)} – ${f(bit)}`;
    if (bas) return `${f(bas)} sonrası`;
    if (bit) return `${f(bit)} öncesi`;
    return 'Tüm hareketler';
};

function tabloVerisi(ekstre, bas) {
    const satirlar = ekstre.satirlar.map(s => [s.tarih, s.belge, s.aciklama, s.borc, s.odeme, s.bakiye, s.durum]);
    if (bas) satirlar.unshift([bas + 'T00:00:00', '', 'Devreden bakiye', null, null, ekstre.devir, '']);
    return {
        satirlar,
        toplamSatiri: ['TOPLAM', '', '', ekstre.donemBorc, ekstre.donemOdeme, ekstre.sonBakiye, ''],
    };
}

export function cariEkstreExcel(firma, hareketler, secenek = {}) {
    const ekstre = cariEkstreHesapla(hareketler, secenek);
    const { satirlar, toplamSatiri } = tabloVerisi(ekstre, secenek.bas);
    excelIndir(`Cari_Ekstre_${firma.ad}`, [{
        ad: firma.ad,
        ustBilgi: [`${firma.ad} — Cari Hesap Ekstresi`, `${FIRMA_TIP_LABELS[firma.tip] || ''} · Dönem: ${donemMetni(secenek.bas, secenek.bit)}`,
            'Bakiye = borç − ödeme (pozitif: firmaya borçlu olduğumuz tutar)'],
        sutunlar: SUTUNLAR, satirlar, toplamSatiri,
    }]);
}

export function cariEkstrePdf(firma, hareketler, secenek = {}) {
    const ekstre = cariEkstreHesapla(hareketler, secenek);
    const { satirlar, toplamSatiri } = tabloVerisi(ekstre, secenek.bas);
    raporYazdir({
        baslik: 'Cari Hesap Ekstresi',
        altBaslik: `${firma.ad} · ${FIRMA_TIP_LABELS[firma.tip] || ''} · ${donemMetni(secenek.bas, secenek.bit)}`,
        ozet: [
            { etiket: 'Devreden', deger: tlBicim(ekstre.devir) },
            { etiket: 'Dönem borç', deger: tlBicim(ekstre.donemBorc) },
            { etiket: 'Dönem ödeme', deger: tlBicim(ekstre.donemOdeme) },
            { etiket: ekstre.sonBakiye >= 0 ? 'Bakiye (borcumuz)' : 'Bakiye (alacağımız)', deger: tlBicim(Math.abs(ekstre.sonBakiye)), vurgu: true },
        ],
        tablolar: [{ sutunlar: SUTUNLAR, satirlar, toplamSatiri }],
        not: 'Bakiye = borç − ödeme. "Kapatıldı" satırları "Hesabı Kapat" ile uzlaşılmış hareketlerdir.',
    });
}
