import { useState } from 'react';
import { Coins, RefreshCw, Calculator } from 'lucide-react';
import Notice from './ui/Notice';
import { useApp } from '../context/AppContext';
import { useKurlar, elleKurKaydet, paraSembolu } from '../data/kur';

// Ayarlar: güncel döviz kurları (TCMB / elle) ve tüm modeller için varsayılan maliyet oranları
export default function MaliyetAyarlari() {
    const { currentUser, maliyetAyar, maliyetAyarKaydet } = useApp();
    const { kurlar, tarih, kaynak, eski, elle, yenile } = useKurlar();
    const admin = currentUser?.rol === 'admin';
    const [form, setForm] = useState(() => ({
        genelGiderOrani: String(maliyetAyar.genelGiderOrani ?? ''),
        hedefKarMarji: String(maliyetAyar.hedefKarMarji ?? ''),
        dakikaUcreti: String(maliyetAyar.dakikaUcreti || ''),
    }));
    const [kurForm, setKurForm] = useState(null); // elle giriş açıkken { USD, EUR, GBP }
    const [mesaj, setMesaj] = useState(null);
    const [yenileniyor, setYenileniyor] = useState(false);

    const oranKaydet = () => {
        maliyetAyarKaydet({
            genelGiderOrani: Number(form.genelGiderOrani) || 0,
            hedefKarMarji: Math.min(Number(form.hedefKarMarji) || 0, 95),
            dakikaUcreti: Number(form.dakikaUcreti) || 0,
        });
        setMesaj({ tone: 'success', metin: 'Maliyet ayarları kaydedildi.' });
    };
    const kurKaydet = async (kaldir) => {
        try {
            await elleKurKaydet(kaldir ? null : { USD: Number(kurForm.USD) || 0, EUR: Number(kurForm.EUR) || 0, GBP: Number(kurForm.GBP) || 0 });
            setKurForm(null);
            setMesaj({ tone: 'success', metin: kaldir ? 'Elle kur kaldırıldı; TCMB kuru kullanılacak.' : 'Elle kur kaydedildi.' });
        } catch (e) {
            setMesaj({ tone: 'danger', metin: e.message || 'Kaydedilemedi.' });
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title"><Coins size={18} /> Döviz ve Maliyet</h3>
            </div>
            <div className="ayar-kurlar">
                {['USD', 'EUR', 'GBP'].map(k => (
                    <div key={k}><span>1 {paraSembolu(k)} {k}</span><strong>{kurlar[k] ? `${Number(kurlar[k]).toLocaleString('tr-TR', { maximumFractionDigits: 4 })} ₺` : '—'}</strong></div>
                ))}
            </div>
            <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
                <span>{kaynak || 'Kur yok'}{tarih ? ` · ${tarih}` : ''}{eski ? ' · güncel kur alınamadı, son bilinen kur' : ''}</span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={yenileniyor}
                    onClick={async () => { setYenileniyor(true); await yenile(); setYenileniyor(false); }}>
                    <RefreshCw size={13} /> Yenile
                </button>
                {admin && !kurForm && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKurForm({ USD: kurlar.USD || '', EUR: kurlar.EUR || '', GBP: kurlar.GBP || '' })}>Elle gir</button>
                )}
                {admin && elle && !kurForm && <button type="button" className="btn btn-ghost btn-sm" onClick={() => kurKaydet(true)}>TCMB'ye dön</button>}
            </div>
            {kurForm && (
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                    {['USD', 'EUR', 'GBP'].map(k => (
                        <div key={k} className="form-group">
                            <label className="form-label" htmlFor={`kur-${k}`}>{k} (₺)</label>
                            <input id={`kur-${k}`} className="form-input" type="number" step="0.0001" value={kurForm[k]} onChange={e => setKurForm({ ...kurForm, [k]: e.target.value })} />
                        </div>
                    ))}
                    <div className="form-group" style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => kurKaydet(false)}>Kaydet</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKurForm(null)}>Vazgeç</button>
                    </div>
                </div>
            )}

            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0' }}><Calculator size={16} /> Varsayılan maliyet oranları</div>
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label" htmlFor="ayar-genel-gider">Genel gider %</label>
                    <input id="ayar-genel-gider" className="form-input" type="number" step="0.1" value={form.genelGiderOrani} onChange={e => setForm({ ...form, genelGiderOrani: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="ayar-hedef-marj">Hedef kâr marjı %</label>
                    <input id="ayar-hedef-marj" className="form-input" type="number" step="0.1" value={form.hedefKarMarji} onChange={e => setForm({ ...form, hedefKarMarji: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="ayar-dk-ucret">Dakika ücreti (₺/dk)</label>
                    <input id="ayar-dk-ucret" className="form-input" type="number" step="0.01" value={form.dakikaUcreti} onChange={e => setForm({ ...form, dakikaUcreti: e.target.value })} placeholder="Operasyon işçiliği için" />
                </div>
            </div>
            <div className="text-xs text-muted" style={{ marginBottom: '10px' }}>
                Modelin maliyet kartında oran girilmezse bu değerler kullanılır. Dakika ücreti, operasyon sürelerinden tahmini dikim işçiliğini hesaplar.
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={oranKaydet}>Oranları Kaydet</button>
            {mesaj && <Notice tone={mesaj.tone} style={{ marginTop: '10px' }}>{mesaj.metin}</Notice>}
        </div>
    );
}
