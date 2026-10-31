// Etiket yazdırma penceresi: ürün (seri) etiketi termal 30×50 mm 3'lü (varsayılan) ya da
// partiden açıldıysa QR'lı parti etiketi. Kâğıt ölçüleri yazıcıya göre ayarlanır, cihazda hatırlanır.
import { useState } from 'react';
import { Printer, Settings2, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import { yazdirUrunEtiketi, etiketAyariOku, etiketAyariKaydet, VARSAYILAN_ETIKET_AYARI, seriAdedi } from '../utils/urunEtiketi';
import { yazdirPartiEtiketi } from '../utils/partiEtiketi';

// urun: { urunKodu, urunAdi, asorti }; parti verilirse QR'lı parti etiketi de seçilebilir
export default function EtiketYazdir({ urun, varsayilanAdet = 1, parti = null, firmalar = [], onClose }) {
    const [format, setFormat] = useState('urun');   // urun | parti | parti-a4
    const [adet, setAdet] = useState(String(varsayilanAdet));
    const [ayar, setAyar] = useState(etiketAyariOku);
    const [ayarAcik, setAyarAcik] = useState(false);
    const seri = seriAdedi(urun.asorti);
    const ayarDegis = (alan, deger) => setAyar(a => ({ ...a, [alan]: deger }));

    const yazdir = () => {
        if (format === 'urun') {
            etiketAyariKaydet(ayar);
            yazdirUrunEtiketi([{ ...urun, adet }], ayar);
        } else {
            yazdirPartiEtiketi(parti, { kopya: adet, boyut: format === 'parti-a4' ? 'a4' : 'etiket', firmalar });
        }
        onClose();
    };

    const sayiAlani = (alan, etiket, adim = '0.5') => (
        <div className="form-group">
            <label className="form-label" htmlFor={`etiket-${alan}`}>{etiket}</label>
            <input id={`etiket-${alan}`} className="form-input" type="number" step={adim} min="0" inputMode="decimal"
                value={ayar[alan]} onChange={e => ayarDegis(alan, e.target.value)} />
        </div>
    );

    return (
        <Modal
            title={`Etiket — ${urun.urunKodu || ''}`}
            onClose={onClose}
            footer={<>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className="btn btn-primary" onClick={yazdir} disabled={!(parseInt(adet, 10) > 0)}>
                    <Printer size={16} /> Yazdır
                </button>
            </>}
        >
            {parti && (
                <div className="form-group">
                    <label className="form-label" htmlFor="etiket-format">Etiket türü</label>
                    <select id="etiket-format" className="form-input" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="urun">Ürün etiketi — termal 30×50 mm, 3'lü</option>
                        <option value="parti">Parti etiketi (QR) — termal 10×7 cm</option>
                        <option value="parti-a4">Parti etiketi (QR) — A4'e 8'li</option>
                    </select>
                </div>
            )}

            {format === 'urun' && (
                <div className="etiket-onizleme" aria-label="Etiket önizleme">
                    <div className="etiket-onizleme-sol">
                        <span className="etiket-rozet">CODE:</span>
                        <strong className="etiket-kod">{urun.urunKodu}</strong>
                        {(urun.asorti?.bedenler || []).length > 0 && <>
                            <span className="etiket-rozet">SIZES:</span>
                            <table className="etiket-beden">
                                <tbody>
                                    <tr>{urun.asorti.bedenler.map(b => <td key={b}>{b}</td>)}</tr>
                                    <tr>{urun.asorti.bedenler.map(b => <td key={b}>{urun.asorti.dagilim?.[b] ?? ''}</td>)}</tr>
                                </tbody>
                            </table>
                        </>}
                    </div>
                    <div className="etiket-onizleme-sag">
                        <span className="etiket-ad">{urun.urunAdi}</span>
                        {ayar.yerliUretim && <span className="etiket-yerli">YERLİ<br />ÜRETİM</span>}
                    </div>
                </div>
            )}

            <div className="form-group">
                <label className="form-label" htmlFor="etiket-adet">
                    {format === 'urun' ? 'Etiket adedi (seri/paket)' : 'Etiket adedi (paket/çuval)'}
                </label>
                <input id="etiket-adet" className="form-input" type="number" min="1" max="3000" inputMode="numeric"
                    value={adet} onChange={e => setAdet(e.target.value)} />
                {format === 'urun' && seri > 0 && (
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                        Bir seri {seri} adet. {parti ? 'Varsayılan adet partinin seri (paket) sayısıdır.' : ''} Yan yana {ayar.sutun} etiket basılır.
                    </div>
                )}
            </div>

            {format === 'urun' && (
                <>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAyarAcik(v => !v)} aria-expanded={ayarAcik}>
                        <Settings2 size={14} /> Kâğıt ayarları ({ayar.genislik}×{ayar.yukseklik} mm, {ayar.sutun}'lü)
                    </button>
                    {ayarAcik && (
                        <div className="etiket-ayar">
                            <div className="form-row">
                                {sayiAlani('genislik', 'Etiket eni (mm)')}
                                {sayiAlani('yukseklik', 'Etiket boyu (mm)')}
                                {sayiAlani('sutun', 'Yan yana', '1')}
                            </div>
                            <div className="form-row">
                                {sayiAlani('ara', 'Etiketler arası (mm)')}
                                {sayiAlani('kenar', 'Kenar payı (mm)')}
                                <div className="form-group">
                                    <label className="form-label" htmlFor="etiket-dondur">Yazı yönü</label>
                                    <select id="etiket-dondur" className="form-input" value={ayar.dondur} onChange={e => ayarDegis('dondur', Number(e.target.value))}>
                                        <option value={90}>Yan (görseldeki gibi)</option>
                                        <option value={-90}>Yan (ters)</option>
                                        <option value={0}>Düz</option>
                                    </select>
                                </div>
                            </div>
                            <label className="firma-aktif-anahtar" style={{ marginBottom: '8px' }}>
                                <input type="checkbox" checked={!!ayar.yerliUretim} onChange={e => ayarDegis('yerliUretim', e.target.checked)} />
                                <span>"Yerli Üretim" yazısı</span>
                            </label>
                            <div className="text-xs text-muted">
                                Yazıcı ayarlarında kâğıt boyutunu {(Number(ayar.kenar) * 2 + Number(ayar.sutun) * Number(ayar.genislik) + (Number(ayar.sutun) - 1) * Number(ayar.ara)) || 0}×{ayar.yukseklik} mm
                                ve kenar boşluğunu "Yok" seçin. Etiketler kayıyorsa "Etiketler arası" ve "Kenar payı"nı değiştirin.
                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAyar({ ...VARSAYILAN_ETIKET_AYARI })} style={{ marginLeft: '4px' }}>
                                    <RotateCcw size={13} /> Varsayılan
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
            {format !== 'urun' && (
                <p className="text-sm text-muted">
                    Etiket QR kodu, telefonla ya da Partiler → "QR Okut" ile okutulunca bu partiyi açar ve sıradaki adıma ilerletmeyi sağlar.
                </p>
            )}
        </Modal>
    );
}
