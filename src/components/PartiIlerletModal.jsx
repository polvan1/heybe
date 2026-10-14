import { useState } from 'react';
import { Scissors, Send, ChevronRight, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import Notice from './ui/Notice';
import { useApp } from '../context/AppContext';
import { DURUM_LABELS } from '../data/db';

// Partinin bir sonraki adımı: kesimde → (kesildi) → dikime gönder → ütü/paket → tamamlandı
export function sonrakiAdim(parti) {
    if (!parti) return null;
    if (parti.durum === 'kesimde') {
        return parti.kesimDurumu === 'kesildi'
            ? { anahtar: 'gonder', etiket: 'Dikime gönder', ikon: Send }
            : { anahtar: 'kesildi', etiket: 'Kesildi', ikon: Scissors };
    }
    if (parti.durum === 'dikimde') return { anahtar: 'ilerlet', etiket: 'Ütü/Pakete', ikon: ChevronRight };
    if (parti.durum === 'utupakette') return { anahtar: 'ilerlet', etiket: 'Tamamla', ikon: CheckCircle2 };
    return null;
}

// Kesimhane yetkilisi sadece kesim adımlarını yürütebilir
export function adimYapabilirMi(kullanici, parti) {
    if (!parti || !sonrakiAdim(parti)) return false;
    if (kullanici?.rol === 'kesimhane') return parti.durum === 'kesimde';
    return true;
}

function varsayilanAdet(parti) {
    if (parti.durum === 'kesimde') return parti.kesilenAdet || parti.toplamAdet || 0;
    return parti.sonCikanAdet || parti.kesilenAdet || parti.toplamAdet || 0;
}

export default function PartiIlerletModal({ parti, onClose }) {
    const { firmalar, partiKesildi, partiIlerlet } = useApp();
    const adim = sonrakiAdim(parti);
    const [renkAdetleri, setRenkAdetleri] = useState(() =>
        (parti.renkler || []).map(r => ({ renk: r.renk, planlanan: r.toplam || 0, adet: String(r.toplam || 0) })));
    const [adet, setAdet] = useState(String(varsayilanAdet(parti)));
    const [not, setNot] = useState('');

    if (!adim) return null;
    const firmaAdi = (id) => firmalar.find(f => f.id === id)?.ad || '—';
    const renkliKesim = adim.anahtar === 'kesildi' && renkAdetleri.length > 0;
    const kesilenToplam = renkliKesim
        ? renkAdetleri.reduce((t, r) => t + (parseInt(r.adet, 10) || 0), 0)
        : (parseInt(adet, 10) || 0);
    const girilenAdet = renkliKesim ? kesilenToplam : (parseInt(adet, 10) || 0);
    const gecerli = girilenAdet > 0;

    const kesimiKaydet = (dikimeGonder) => {
        if (!gecerli) return;
        partiKesildi(parti.id, {
            kesilenRenkler: renkliKesim ? renkAdetleri.map(r => ({ renk: r.renk, planlanan: r.planlanan, adet: parseInt(r.adet, 10) || 0 })) : [],
            kesilenAdet: girilenAdet,
            kesimNotu: not.trim(),
        });
        if (dikimeGonder) partiIlerlet(parti.id, girilenAdet);
        onClose();
    };

    const ilerlet = () => {
        if (!gecerli) return;
        partiIlerlet(parti.id, girilenAdet);
        onClose();
    };

    let baslik, aciklama, footer;
    if (adim.anahtar === 'kesildi') {
        baslik = `Kesim tamamlandı — ${parti.partiNo}`;
        aciklama = 'Kesilen adetleri girin. Plandan farklıysa gerçek kesilen adedi yazın.';
        footer = (
            <>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className="btn btn-ghost" onClick={() => kesimiKaydet(true)} disabled={!gecerli}>
                    <Send size={16} /> Kesildi + dikime gönder
                </button>
                <button className="btn btn-primary" onClick={() => kesimiKaydet(false)} disabled={!gecerli}>
                    <Scissors size={16} /> Kesildi olarak kaydet
                </button>
            </>
        );
    } else if (adim.anahtar === 'gonder') {
        baslik = `Dikime gönder — ${parti.partiNo}`;
        aciklama = `Parti ${firmaAdi(parti.dikimhaneId)} dikimhanesine gönderilecek ve durumu "Dikimde" olacak.`;
        footer = (
            <>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className="btn btn-primary" onClick={ilerlet} disabled={!gecerli}><Send size={16} /> Dikime gönderildi</button>
            </>
        );
    } else {
        const sonraki = parti.durum === 'dikimde' ? 'utupakette' : 'tamamlandi';
        baslik = `${DURUM_LABELS[parti.durum]} → ${DURUM_LABELS[sonraki]} — ${parti.partiNo}`;
        aciklama = sonraki === 'tamamlandi'
            ? 'Çıkan adet ürün stoğuna eklenir ve firmalara borç kaydı yazılır.'
            : parti.utupaketciId
                ? `Parti ${firmaAdi(parti.utupaketciId)} ütü/paketçisine geçecek; sevk irsaliyesi otomatik düzenlenir.`
                : 'Parti ütü/paket aşamasına geçecek. Ütü/paketçi atanmadığı için irsaliye düzenlenmez (Parti Detay\'dan atayabilirsiniz).';
        footer = (
            <>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className="btn btn-primary" onClick={ilerlet} disabled={!gecerli}><adim.ikon size={16} /> {sonraki === 'tamamlandi' ? 'Tamamlandı' : 'İlerlet'}</button>
            </>
        );
    }

    return (
        <Modal title={baslik} onClose={onClose} footer={footer}>
            <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>{aciklama}</p>

            {renkliKesim ? (
                <div className="form-group">
                    <label className="form-label">Renk bazında kesilen adet</label>
                    <div className="kesim-renkler">
                        {renkAdetleri.map((r, i) => (
                            <div key={i} className="kesim-renk-satir">
                                <div className="kesim-renk-ad">
                                    <strong>{r.renk}</strong>
                                    <span>Plan: {r.planlanan.toLocaleString('tr-TR')}</span>
                                </div>
                                <input
                                    className="form-input"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={r.adet}
                                    onChange={e => setRenkAdetleri(renkAdetleri.map((x, j) => j === i ? { ...x, adet: e.target.value } : x))}
                                    aria-label={`${r.renk} kesilen adet`}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="kesim-toplam">
                        <span>Toplam kesilen</span>
                        <strong>{kesilenToplam.toLocaleString('tr-TR')} / {(parti.toplamAdet || 0).toLocaleString('tr-TR')}</strong>
                    </div>
                </div>
            ) : (
                <div className="form-group">
                    <label className="form-label" htmlFor="ilerlet-adet">
                        {adim.anahtar === 'kesildi' ? 'Kesilen adet *' : adim.anahtar === 'gonder' ? 'Gönderilen adet *' : 'Çıkan adet *'}
                    </label>
                    <input
                        id="ilerlet-adet"
                        className="form-input"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={adet}
                        onChange={e => setAdet(e.target.value)}
                        style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }}
                        autoFocus
                    />
                    <div className="text-xs text-muted mt-2">Parti planı: {(parti.toplamAdet || 0).toLocaleString('tr-TR')} adet</div>
                </div>
            )}

            {adim.anahtar === 'kesildi' && (
                <div className="form-group">
                    <label className="form-label" htmlFor="kesim-not">Not</label>
                    <input id="kesim-not" className="form-input" value={not} onChange={e => setNot(e.target.value)} placeholder="Örn. 2 top kumaş eksik geldi" />
                </div>
            )}

            {!gecerli && <Notice tone="warning">Adet 0'dan büyük olmalı.</Notice>}
        </Modal>
    );
}
