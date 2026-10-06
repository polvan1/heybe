// Adresten konum bulma.
// 1) Uygulamayla gelen ilçe listesinde arar (internetsiz çalışır, ilçe merkezini verir)
// 2) Gerçek sunucuda ayrıca OpenStreetMap Nominatim adres servisine sorar (sokak düzeyi)
import ilceVerisi from '../data/istanbulIlceler.json';

const DEMO = import.meta.env.VITE_DEMO === '1';
const kucuk = (s) => String(s || '').toLocaleLowerCase('tr').normalize('NFC');

export function ilceBul(sorgu) {
    const q = kucuk(sorgu);
    if (!q) return [];
    return ilceVerisi.ilceler
        .filter(i => q.includes(kucuk(i.ad)) || kucuk(i.ad).startsWith(q))
        .slice(0, 5)
        .map(i => ({ ad: `${i.ad} (ilçe merkezi)`, lat: i.merkez[0], lng: i.merkez[1], kaynak: 'ilce' }));
}

// Dönüş: { sonuclar: [{ad, lat, lng, kaynak}], uyari? }
export async function adresAra(sorgu) {
    const ilceler = ilceBul(sorgu);
    if (DEMO) {
        return { sonuclar: ilceler, uyari: 'Demoda sadece ilçe adıyla arama yapılır (ör. "Bağcılar"). Gerçek sunucuda sokak adresi de bulunur.' };
    }
    try {
        const p = new URLSearchParams({
            format: 'jsonv2', limit: '5', countrycodes: 'tr', 'accept-language': 'tr',
            viewbox: '27.9,41.65,29.95,40.75', q: sorgu,
        });
        const r = await fetch('https://nominatim.openstreetmap.org/search?' + p.toString());
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const veri = await r.json();
        const adresler = veri.map(v => ({ ad: v.display_name, lat: +v.lat, lng: +v.lon, kaynak: 'osm' }));
        return { sonuclar: [...adresler, ...ilceler].slice(0, 6) };
    } catch (e) {
        return { sonuclar: ilceler, uyari: 'Adres servisine ulaşılamadı; sadece ilçe sonuçları gösteriliyor.' };
    }
}
