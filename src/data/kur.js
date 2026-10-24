// Döviz kurları (sunucu TCMB'den alır: public/inc/kur.php) ve para birimi yardımcıları.
// Kurlar oturum boyunca bellekte, internetsiz kullanım için cihazda (localStorage) tutulur.
import { useEffect, useState } from 'react';
import { apiIstek } from './api';

export const PARA_BIRIMLERI = [
    { kod: 'TRY', sembol: '₺', ad: 'Türk Lirası' },
    { kod: 'USD', sembol: '$', ad: 'ABD Doları' },
    { kod: 'EUR', sembol: '€', ad: 'Euro' },
    { kod: 'GBP', sembol: '£', ad: 'İngiliz Sterlini' },
];
export const paraSembolu = (kod) => PARA_BIRIMLERI.find(p => p.kod === (kod || 'TRY'))?.sembol || kod;

const DEPO = 'hiserp_kurlar';
let bellek = null;          // { kurlar, tarih, kaynak, eski, elle }
let istek = null;
const dinleyiciler = new Set();

function cihazdanOku() {
    try { return JSON.parse(localStorage.getItem(DEPO) || 'null'); } catch (e) { return null; }
}

function yayinla(veri) {
    bellek = veri;
    try { localStorage.setItem(DEPO, JSON.stringify(veri)); } catch (e) { /* depolama kapalı */ }
    dinleyiciler.forEach(f => f(veri));
}

export function kurlariGetir({ yenile = false } = {}) {
    if (bellek && !yenile) return Promise.resolve(bellek);
    if (istek && !yenile) return istek;
    istek = apiIstek(`kur=durum${yenile ? '&yenile=1' : ''}`)
        .then(v => { yayinla(v); return v; })
        .catch(() => {
            const eski = bellek || cihazdanOku();
            if (eski) { const v = { ...eski, eski: true }; bellek = v; return v; }
            return { kurlar: {}, tarih: '', kaynak: '', eski: true };
        })
        .finally(() => { istek = null; });
    return istek;
}

export async function elleKurKaydet(kurlar) {
    const v = await apiIstek('kur=elle', { kurlar });
    yayinla(v);
    return v;
}

// 1 birim döviz = kaç TL (TRY için 1; kur yoksa null)
export function kurDegeri(kod, kurlar) {
    if (!kod || kod === 'TRY') return 1;
    const k = Number(kurlar?.[kod]);
    return k > 0 ? k : null;
}

// Tutarı TL'ye çevir. Kur bilinmiyorsa null döner (çağıran "kur yok" uyarısı gösterir).
export function tlKarsiligi(tutar, kod, kurlar) {
    const k = kurDegeri(kod, kurlar);
    return k === null ? null : (Number(tutar) || 0) * k;
}

export function paraBicim(tutar, kod = 'TRY', basamak = 2) {
    if (tutar === null || tutar === undefined || Number.isNaN(Number(tutar))) return '—';
    return `${Number(tutar).toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak })} ${paraSembolu(kod)}`;
}

// React: güncel kurlar (ilk çağrıda sunucudan alınır, sonra tüm bileşenler paylaşır)
export function useKurlar() {
    const [veri, setVeri] = useState(() => bellek || cihazdanOku());
    useEffect(() => {
        dinleyiciler.add(setVeri);
        kurlariGetir().then(setVeri);
        return () => { dinleyiciler.delete(setVeri); };
    }, []);
    return {
        kurlar: veri?.kurlar || {},
        tarih: veri?.tarih || '',
        kaynak: veri?.kaynak || '',
        eski: !!veri?.eski,
        elle: !!veri?.elle,
        yenile: () => kurlariGetir({ yenile: true }).then(setVeri),
    };
}
