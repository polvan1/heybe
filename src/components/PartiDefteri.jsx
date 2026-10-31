// Partilerin defter görünümü: eski parti defterindeki gibi ay ay, her satırda
//   Atölye  (Model = Adet × Fiyat = Tutar)  Not
import { ayEtiketi } from '../utils/partiAktar';
import { partiDurumEtiketi } from '../data/db';

const sayi = (n) => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

export const partiDefterAyi = (p) => {
    if (/^\d{4}-\d{2}$/.test(p.defterAy || '')) return p.defterAy;
    const t = new Date(p.createdAt);
    return Number.isNaN(t.getTime()) ? '' : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};

// Atölyeye verilen adet: dikime gönderilen → kesilen → planlanan
export const partiDefterAdedi = (p) => p.dikimeGonderilenAdet ?? p.kesilenAdet ?? p.toplamAdet ?? 0;

export default function PartiDefteri({ partiler, firmalar, fiyatGorur, onAc }) {
    const firmaAdi = (id) => firmalar.find(f => f.id === id)?.ad || '';
    const aylar = {};
    partiler.forEach(p => { (aylar[partiDefterAyi(p)] ||= []).push(p); });
    const sirali = Object.keys(aylar).sort().reverse();

    return (
        <div className="parti-defteri">
            {sirali.map(ay => {
                // Ay içinde defterdeki yazılış sırası: önce açılan üstte
                const satirlar = aylar[ay].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                    || String(a.partiNo).localeCompare(String(b.partiNo), 'tr', { numeric: true }));
                const toplamAdet = satirlar.reduce((t, p) => t + partiDefterAdedi(p), 0);
                const toplamTutar = satirlar.reduce((t, p) => t + partiDefterAdedi(p) * (Number(p.dikimBirimFiyat) || 0), 0);
                return (
                    <section key={ay} className="defter-sayfa">
                        <header className="defter-ay">
                            <span className="defter-ay-ad">{ayEtiketi(ay) || 'Tarihsiz'}</span>
                            <span className="defter-ay-toplam">
                                {satirlar.length} iş · {sayi(toplamAdet)} adet{fiyatGorur && toplamTutar > 0 ? ` · ${sayi(toplamTutar)} ₺` : ''}
                            </span>
                        </header>
                        <ol className="defter-satirlar">
                            {satirlar.map(p => {
                                const adet = partiDefterAdedi(p);
                                const fiyat = Number(p.dikimBirimFiyat) || 0;
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
                                            <span className="defter-adet">{sayi(adet)}</span>
                                            {fiyatGorur && fiyat > 0 && <>
                                                <span className="defter-carpi">×</span>
                                                <span className="defter-fiyat">{sayi(fiyat)}</span>
                                                <span className="defter-esit">=</span>
                                                <strong className="defter-tutar">{sayi(adet * fiyat)}</strong>
                                            </>}
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
