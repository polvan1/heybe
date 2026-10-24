import { useMemo, useState } from 'react';
import { Plus, Trash2, Calculator, Clock, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import Notice from './ui/Notice';
import { useApp } from '../context/AppContext';
import { useKurlar, PARA_BIRIMLERI, paraBicim, paraSembolu } from '../data/kur';
import { MALIYET_KATEGORILERI, modelMaliyeti } from '../utils/maliyet';

const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const BIRIMLER = ['kg', 'metre', 'adet', 'takım', 'paket'];
const yuzde = (v) => (v === null || v === undefined ? '—' : `%${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`);

// Model (ürün) maliyet kartı: malzeme kalemleri (dövizli), fason fiyatları, operasyonlar (dakika),
// genel gider ve kâr marjı → birim maliyet, önerilen satış fiyatı, mevcut fiyattaki kâr
export default function MaliyetKarti({ urun, onClose }) {
    const { urunGuncelle, urunler, kumasTurleri, maliyetAyar } = useApp();
    const { kurlar, tarih, kaynak, eski, yenile } = useKurlar();
    const ilk = urun.maliyet || {};
    const [m, setM] = useState({
        kalemler: ilk.kalemler?.length ? ilk.kalemler : [{ id: yeniId(), kategori: 'kumas', ad: '', miktar: '', birim: 'kg', birimFiyat: '', paraBirimi: 'TRY' }],
        operasyonlar: ilk.operasyonlar || [],
        satisFiyati: ilk.satisFiyati ?? '',
        satisParaBirimi: ilk.satisParaBirimi || 'TRY',
        genelGiderOrani: ilk.genelGiderOrani ?? '',
        hedefKarMarji: ilk.hedefKarMarji ?? '',
    });

    const hesap = useMemo(() => modelMaliyeti({ ...urun, maliyet: m }, { kurlar, ayar: maliyetAyar }), [urun, m, kurlar, maliyetAyar]);
    // Diğer modellerde kullanılan operasyonlar öneri olarak (ad → son dakika)
    const operasyonOnerileri = useMemo(() => {
        const harita = new Map();
        urunler.forEach(u => (u.maliyet?.operasyonlar || []).forEach(o => { if (o.ad) harita.set(o.ad, o.dakika); }));
        return [...harita.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    }, [urunler]);

    const kalemGuncelle = (id, alan, deger) => setM(x => ({ ...x, kalemler: x.kalemler.map(k => k.id === id ? { ...k, [alan]: deger } : k) }));
    const kalemEkle = (kategori = 'aksesuar') => setM(x => ({ ...x, kalemler: [...x.kalemler, { id: yeniId(), kategori, ad: '', miktar: '1', birim: kategori === 'kumas' ? 'kg' : 'adet', birimFiyat: '', paraBirimi: 'TRY' }] }));
    const kalemSil = (id) => setM(x => ({ ...x, kalemler: x.kalemler.filter(k => k.id !== id) }));
    const opGuncelle = (id, alan, deger) => setM(x => ({
        ...x,
        operasyonlar: x.operasyonlar.map(o => {
            if (o.id !== id) return o;
            const yeni = { ...o, [alan]: deger };
            // Bilinen operasyon adı seçilince dakikası önerilir
            if (alan === 'ad' && !o.dakika) { const bilinen = operasyonOnerileri.find(([ad]) => ad === deger); if (bilinen) yeni.dakika = String(bilinen[1]); }
            return yeni;
        }),
    }));

    const kaydet = () => {
        const temiz = {
            kalemler: m.kalemler.filter(k => k.ad.trim() || Number(k.birimFiyat) > 0)
                .map(k => ({ ...k, ad: k.ad.trim(), miktar: Number(k.miktar) || 0, birimFiyat: Number(k.birimFiyat) || 0 })),
            operasyonlar: m.operasyonlar.filter(o => o.ad.trim()).map(o => ({ ...o, ad: o.ad.trim(), dakika: Number(o.dakika) || 0 })),
            satisFiyati: Number(m.satisFiyati) || null,
            satisParaBirimi: m.satisParaBirimi,
            genelGiderOrani: m.genelGiderOrani === '' ? null : Number(m.genelGiderOrani),
            hedefKarMarji: m.hedefKarMarji === '' ? null : Number(m.hedefKarMarji),
            guncelleme: new Date().toISOString(),
        };
        urunGuncelle(urun.id, { maliyet: temiz });
        onClose();
    };

    const usd = Number(kurlar.USD) > 0 ? kurlar.USD : null;
    const karRenk = hesap.karMarji === null ? '' : hesap.karMarji < 0 ? 'zarar' : hesap.karMarji < (hesap.hedefKarMarji || 0) ? 'dusuk' : 'iyi';

    return (
        <Modal
            title={<><Calculator size={18} style={{ verticalAlign: '-3px' }} /> Maliyet Kartı — {urun.urunKodu}</>}
            onClose={onClose}
            footer={<>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className="btn btn-primary" onClick={kaydet}>Kaydet</button>
            </>}
        >
            <div className="maliyet-kart">
                <div className="text-sm text-muted">{urun.urunAdi} · tüm tutarlar adet başına</div>

                {/* Malzeme kalemleri */}
                <section>
                    <h4>Malzeme ve dış hizmet kalemleri</h4>
                    <datalist id="kumas-turu-onerileri">{kumasTurleri.map(t => <option key={t.id} value={t.ad} />)}</datalist>
                    {m.kalemler.map(k => (
                        <div key={k.id} className="maliyet-kalem">
                            <select className="form-input" value={k.kategori} onChange={e => kalemGuncelle(k.id, 'kategori', e.target.value)} aria-label="Kategori">
                                {MALIYET_KATEGORILERI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <input className="form-input" value={k.ad} onChange={e => kalemGuncelle(k.id, 'ad', e.target.value)} placeholder={k.kategori === 'kumas' ? 'Kumaş (ör. Süprem 30/1)' : 'Kalem adı'}
                                list={k.kategori === 'kumas' ? 'kumas-turu-onerileri' : undefined} aria-label="Kalem adı" />
                            <div className="maliyet-kalem-sayi">
                                <input className="form-input" type="number" inputMode="decimal" step="0.001" value={k.miktar} onChange={e => kalemGuncelle(k.id, 'miktar', e.target.value)} placeholder="Miktar" aria-label="Miktar" />
                                <select className="form-input" value={k.birim} onChange={e => kalemGuncelle(k.id, 'birim', e.target.value)} aria-label="Birim">
                                    {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={k.birimFiyat} onChange={e => kalemGuncelle(k.id, 'birimFiyat', e.target.value)} placeholder="Birim fiyat" aria-label="Birim fiyat" />
                                <select className="form-input" value={k.paraBirimi} onChange={e => kalemGuncelle(k.id, 'paraBirimi', e.target.value)} aria-label="Para birimi">
                                    {PARA_BIRIMLERI.map(p => <option key={p.kod} value={p.kod}>{p.kod}</option>)}
                                </select>
                            </div>
                            <div className="maliyet-kalem-tl">{paraBicim(hesap.kalemler.find(x => x.id === k.id)?.tl || 0)}</div>
                            <button type="button" className="btn-icon" onClick={() => kalemSil(k.id)} aria-label="Kalemi sil" style={{ color: 'var(--accent-danger)' }}><Trash2 size={15} /></button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => kalemEkle('kumas')}><Plus size={14} /> Kumaş</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => kalemEkle('aksesuar')}><Plus size={14} /> Aksesuar</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => kalemEkle('baski')}><Plus size={14} /> Baskı/Nakış</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => kalemEkle('diger')}><Plus size={14} /> Diğer</button>
                    </div>
                </section>

                {/* Fason */}
                <section>
                    <h4>Fason işçilik <span className="text-xs text-muted">(ürünün kesim/dikim/ütü fiyatları — ürünü düzenleyerek değişir)</span></h4>
                    <div className="maliyet-fason">
                        <div><span>Kesim</span><strong>{paraBicim(hesap.fason.kesim)}</strong></div>
                        <div><span>Dikim</span><strong>{paraBicim(hesap.fason.dikim)}</strong></div>
                        <div><span>Ütü/Paket</span><strong>{paraBicim(hesap.fason.utu)}</strong></div>
                    </div>
                </section>

                {/* Operasyonlar */}
                <section>
                    <h4><Clock size={15} style={{ verticalAlign: '-2px' }} /> Operasyonlar (teknik föy)</h4>
                    <datalist id="operasyon-onerileri">{operasyonOnerileri.map(([ad]) => <option key={ad} value={ad} />)}</datalist>
                    {m.operasyonlar.length === 0 && <div className="text-xs text-muted" style={{ marginBottom: '6px' }}>Dikim işlemlerini (ör. omuz çatma, yaka takma, overlok) ve adet başına dakikasını girin.</div>}
                    {m.operasyonlar.map((o, i) => (
                        <div key={o.id} className="maliyet-operasyon">
                            <span className="maliyet-operasyon-sira">{i + 1}</span>
                            <input className="form-input" value={o.ad} onChange={e => opGuncelle(o.id, 'ad', e.target.value)} placeholder="Operasyon adı" list="operasyon-onerileri" aria-label="Operasyon adı" />
                            <input className="form-input" type="number" inputMode="decimal" step="0.01" value={o.dakika} onChange={e => opGuncelle(o.id, 'dakika', e.target.value)} placeholder="dk" aria-label="Dakika" />
                            <button type="button" className="btn-icon" onClick={() => setM(x => ({ ...x, operasyonlar: x.operasyonlar.filter(y => y.id !== o.id) }))} aria-label="Operasyonu sil" style={{ color: 'var(--accent-danger)' }}><Trash2 size={15} /></button>
                        </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setM(x => ({ ...x, operasyonlar: [...x.operasyonlar, { id: yeniId(), ad: '', dakika: '' }] }))}><Plus size={14} /> Operasyon ekle</button>
                    {hesap.operasyon.toplamDakika > 0 && (
                        <div className="maliyet-operasyon-ozet">
                            Toplam <strong>{hesap.operasyon.toplamDakika.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} dk</strong>/adet
                            {hesap.operasyon.tahminiIscilik !== null
                                ? <> · dakika ücretiyle tahmini dikim işçiliği <strong>{paraBicim(hesap.operasyon.tahminiIscilik)}</strong> (anlaşmalı dikim {paraBicim(hesap.fason.dikim)})</>
                                : <> · tahmini işçilik için Ayarlar'dan dakika ücreti girin</>}
                        </div>
                    )}
                </section>

                {/* Fiyat ve oranlar */}
                <section>
                    <h4>Satış ve oranlar</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="satis-fiyati">Satış / teklif fiyatı</label>
                            <div className="fiyat-para">
                                <input id="satis-fiyati" className="form-input" type="number" inputMode="decimal" step="0.01" value={m.satisFiyati} onChange={e => setM({ ...m, satisFiyati: e.target.value })} placeholder="İsteğe bağlı" />
                                <select className="form-input" value={m.satisParaBirimi} onChange={e => setM({ ...m, satisParaBirimi: e.target.value })} aria-label="Satış para birimi">
                                    {PARA_BIRIMLERI.map(p => <option key={p.kod} value={p.kod}>{p.kod}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="genel-gider">Genel gider %</label>
                            <input id="genel-gider" className="form-input" type="number" step="0.1" value={m.genelGiderOrani} onChange={e => setM({ ...m, genelGiderOrani: e.target.value })} placeholder={`Varsayılan %${maliyetAyar.genelGiderOrani}`} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="hedef-marj">Hedef kâr marjı %</label>
                            <input id="hedef-marj" className="form-input" type="number" step="0.1" value={m.hedefKarMarji} onChange={e => setM({ ...m, hedefKarMarji: e.target.value })} placeholder={`Varsayılan %${maliyetAyar.hedefKarMarji}`} />
                        </div>
                    </div>
                </section>

                {/* Özet */}
                <section className="maliyet-ozet">
                    <div className="maliyet-ozet-satir"><span>Malzeme</span><span>{paraBicim(hesap.malzeme)}</span></div>
                    <div className="maliyet-ozet-satir"><span>Fason işçilik</span><span>{paraBicim(hesap.fason.toplam)}</span></div>
                    <div className="maliyet-ozet-satir"><span>Genel gider ({yuzde(hesap.genelGiderOrani)})</span><span>{paraBicim(hesap.genelGider)}</span></div>
                    <div className="maliyet-ozet-satir toplam"><span>Birim maliyet</span><span>{paraBicim(hesap.birimMaliyet)}{usd ? <small> · {paraBicim(hesap.birimMaliyet / usd, 'USD')}</small> : null}</span></div>
                    <div className="maliyet-ozet-satir"><span>Önerilen satış ({yuzde(hesap.hedefKarMarji)} marj)</span><span>{paraBicim(hesap.onerilenSatis)}{usd && hesap.onerilenSatis ? <small> · {paraBicim(hesap.onerilenSatis / usd, 'USD')}</small> : null}</span></div>
                    {hesap.satisTl !== null && (
                        <div className={`maliyet-ozet-satir kar ${karRenk}`}>
                            <span>Mevcut fiyatta kâr ({paraBicim(Number(m.satisFiyati), m.satisParaBirimi)})</span>
                            <span>{paraBicim(hesap.kar)} · {yuzde(hesap.karMarji)}</span>
                        </div>
                    )}
                </section>

                <div className="maliyet-kur">
                    {Object.keys(kurlar).length
                        ? <>Kur ({kaynak}{tarih ? `, ${tarih}` : ''}): {Object.entries(kurlar).map(([k, v]) => `1 ${paraSembolu(k)} = ${Number(v).toLocaleString('tr-TR')} ₺`).join(' · ')}</>
                        : 'Döviz kuru alınamadı.'}
                    <button type="button" className="btn-icon" onClick={yenile} aria-label="Kurları yenile" title="Kurları yenile"><RefreshCw size={13} /></button>
                </div>
                {(eski || hesap.kurEksik) && <Notice tone="warning">{hesap.kurEksik ? 'Bazı dövizli kalemlerin kuru yok; TL karşılıkları eksik hesaplandı.' : 'Güncel kur alınamadı; son bilinen kur kullanılıyor.'}</Notice>}
            </div>
        </Modal>
    );
}
