// Partilerin defter görünümü: eski parti defterindeki gibi ay ay, her satırda
//   Atölye   Model = Kat × Asorti çarpanı = İş adedi   Not   Durum
// Açık (kapanmamış) işler üstte; tamamlananlar ayın en altında, yeşil.
import { ayEtiketi } from '../utils/partiAktar';
import { partiDurumEtiketi } from '../data/db';

const sayi = (n) => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

export const partiDefterAyi = (p) => {
    if (/^\d{4}-\d{2}$/.test(p.defterAy || '')) return p.defterAy;
    const t = new Date(p.createdAt);
    return Number.isNaN(t.getTime()) ? '' : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};

// İş adedi: kesilen → planlanan (kat × asorti çarpanı)
export const partiDefterAdedi = (p) => Number(p.kesilenAdet ?? p.toplamAdet ?? 0) || 0;

// Kat adedi: renklerin kat sayıları toplamı (defterden aktarılanda kayıtlı kat)
export const partiKatAdedi = (p) => {
    if (Number(p.katAdedi) > 0) return Number(p.katAdedi);
    const kat = (p.renkler || []).reduce((t, r) => t + (Number(r.katSayisi) || 0), 0);
    return kat > 0 ? kat : null;
};

// Asorti çarpanı: bir serideki adet (beden dağılımı toplamı)
export const partiAsortiCarpani = (p) => {
    if (Number(p.asortiCarpani) > 0) return Number(p.asortiCarpani);
    const c = (p.asorti?.bedenler || []).reduce((t, b) => t + (Number(p.asorti?.dagilim?.[b]) || 0), 0);
    return c > 0 ? c : null;
};

// Açık işler önce (açılış sırasıyla), tamamlananlar sonda
export const partiDefterSirala = (a, b) => ((a.durum === 'tamamlandi') - (b.durum === 'tamamlandi'))
    || new Date(a.createdAt) - new Date(b.createdAt)
    || String(a.partiNo).localeCompare(String(b.partiNo), 'tr', { numeric: true });

export default function PartiDefteri({ partiler, firmalar, onAc }) {
    const firmaAdi = (id) => firmalar.find(f => f.id === id)?.ad || '';
    const aylar = {};
    partiler.forEach(p => { (aylar[partiDefterAyi(p)] ||= []).push(p); });
    const sirali = Object.keys(aylar).sort().reverse();

    return (
        <div className="parti-defteri">
            {sirali.map(ay => {
                const satirlar = aylar[ay].sort(partiDefterSirala);
                const acik = satirlar.filter(p => p.durum !== 'tamamlandi');
                const toplamAdet = satirlar.reduce((t, p) => t + partiDefterAdedi(p), 0);
                const acikAdet = acik.reduce((t, p) => t + partiDefterAdedi(p), 0);
                return (
                    <section key={ay} className="defter-sayfa">
                        <header className="defter-ay">
                            <span className="defter-ay-ad">{ayEtiketi(ay) || 'Tarihsiz'}</span>
                            <span className="defter-ay-toplam">
                                <strong>{acik.length} açık iş · {sayi(acikAdet)} adet</strong>
                                {satirlar.length > acik.length && ` · ${satirlar.length - acik.length} tamamlandı`}
                                {` · toplam ${sayi(toplamAdet)} adet`}
                            </span>
                        </header>
                        <ol className="defter-satirlar">
                            {satirlar.map(p => {
                                const kat = partiKatAdedi(p);
                                const carpan = partiAsortiCarpani(p);
                                const tamam = p.durum === 'tamamlandi';
                                return (
                                    <li key={p.id} className={`defter-satir${tamam ? ' defter-satir--tamam' : ''}`}
                                        onClick={() => onAc(p)} role="button" tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter') onAc(p); }}
                                        title={`${p.partiNo} — ${p.urunAdi || p.urunKodu}`}>
                                        <span className="defter-atolye">{firmaAdi(p.dikimhaneId) || <em>Atölye yok</em>}</span>
                                        <span className="defter-hesap">
                                            <span className="defter-model">{p.urunKodu}</span>
                                            <span className="defter-esit">=</span>
                                            {kat && carpan ? <>
                                                <span className="defter-kat" title="Kat adedi">{sayi(kat)}</span>
                                                <span className="defter-carpi">×</span>
                                                <span className="defter-carpan" title="Asorti çarpanı (bir serideki adet)">{sayi(carpan)}</span>
                                                <span className="defter-esit">=</span>
                                            </> : null}
                                            <strong className="defter-adet" title="İş adedi">{sayi(partiDefterAdedi(p))}</strong>
                                        </span>
                                        <span className="defter-not">{p.notlar || ''}</span>
                                        <span className={`defter-durum badge ${p.durum}`}>{partiDurumEtiketi(p)}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                );
            })}
        </div>
    );
}
