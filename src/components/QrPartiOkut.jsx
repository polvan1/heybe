import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Camera, ExternalLink, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import Notice from './ui/Notice';
import PartiIlerletModal, { sonrakiAdim, adimYapabilirMi } from './PartiIlerletModal';
import { useApp } from '../context/AppContext';
import { partiDurumEtiketi } from '../data/db';
import { qrdanPartiBul } from '../utils/partiEtiketi';

// Görüntüden QR çöz: tarayıcının yerleşik BarcodeDetector'ı varsa o, yoksa jsQR
let dedektor;
async function qrCoz(kaynak, genislik, yukseklik, tuval) {
    if (dedektor === undefined) {
        try {
            dedektor = ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code'))
                ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
        } catch (e) { dedektor = null; }
    }
    if (dedektor) {
        const sonuc = await dedektor.detect(kaynak).catch(() => []);
        if (sonuc[0]?.rawValue) return sonuc[0].rawValue;
        return null;
    }
    const { default: jsQR } = await import('jsqr');
    const ctx = tuval.getContext('2d', { willReadFrequently: true });
    tuval.width = genislik; tuval.height = yukseklik;
    ctx.drawImage(kaynak, 0, 0, genislik, yukseklik);
    const veri = ctx.getImageData(0, 0, genislik, yukseklik);
    return jsQR(veri.data, genislik, yukseklik, { inversionAttempts: 'dontInvert' })?.data || null;
}

// Parti etiketindeki / irsaliyedeki QR'ı okutur → partiyi gösterir, tek dokunuşla ilerletir
export default function QrPartiOkut({ onClose }) {
    const navigate = useNavigate();
    const { partiler, currentUser } = useApp();
    const videoRef = useRef(null);
    const tuvalRef = useRef(null);
    const dosyaRef = useRef(null);
    const [kameraHata, setKameraHata] = useState('');
    const [okunan, setOkunan] = useState(null);     // { metin, parti }
    const [ilerletParti, setIlerletParti] = useState(null);
    const [tarama, setTarama] = useState(0);         // artınca kamera yeniden başlar

    useEffect(() => {
        if (okunan) return undefined;
        let akis = null; let iptal = false; let zamanlayici = null;
        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('desteklenmiyor');
                akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                if (iptal) { akis.getTracks().forEach(t => t.stop()); return; }
                const v = videoRef.current;
                v.srcObject = akis;
                await v.play().catch(() => {});
                const tara = async () => {
                    if (iptal) return;
                    if (v.readyState >= 2 && v.videoWidth) {
                        const olcek = Math.min(1, 640 / v.videoWidth);
                        const metin = await qrCoz(v, Math.round(v.videoWidth * olcek), Math.round(v.videoHeight * olcek), tuvalRef.current);
                        if (metin && !iptal) {
                            setOkunan({ metin, parti: qrdanPartiBul(metin, partiler) });
                            return;
                        }
                    }
                    zamanlayici = setTimeout(tara, 200);
                };
                tara();
            } catch (e) {
                setKameraHata('Kamera açılamadı. Tarayıcıya kamera izni verin ya da aşağıdan QR\'ın fotoğrafını çekin.');
            }
        })();
        return () => {
            iptal = true;
            clearTimeout(zamanlayici);
            akis?.getTracks().forEach(t => t.stop());
        };
    }, [okunan, tarama, partiler]);

    const fotoSecildi = async (e) => {
        const dosya = e.target.files?.[0];
        e.target.value = '';
        if (!dosya) return;
        const img = new Image();
        img.src = URL.createObjectURL(dosya);
        await img.decode().catch(() => {});
        const olcek = Math.min(1, 1200 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const metin = await qrCoz(img, Math.round(img.naturalWidth * olcek), Math.round(img.naturalHeight * olcek), tuvalRef.current);
        URL.revokeObjectURL(img.src);
        if (!metin) { setKameraHata('Fotoğrafta QR bulunamadı. QR\'ı yakından ve net çekin.'); return; }
        setOkunan({ metin, parti: qrdanPartiBul(metin, partiler) });
    };

    const yeniden = () => { setOkunan(null); setKameraHata(''); setTarama(t => t + 1); };
    const parti = okunan?.parti ? partiler.find(p => p.id === okunan.parti.id) || okunan.parti : null;
    const adim = parti ? sonrakiAdim(parti) : null;

    if (ilerletParti) {
        return <PartiIlerletModal parti={ilerletParti} onClose={() => { setIlerletParti(null); yeniden(); }} />;
    }

    return (
        <Modal
            title={<><QrCode size={18} style={{ verticalAlign: '-3px' }} /> QR Okut</>}
            onClose={onClose}
            footer={okunan ? (
                <>
                    <button className="btn btn-ghost" onClick={yeniden}><RotateCcw size={16} /> Tekrar okut</button>
                    {parti && <button className="btn btn-soft" onClick={() => { onClose(); navigate(`/parti/${parti.id}`); }}><ExternalLink size={16} /> Detay</button>}
                    {parti && adim && adimYapabilirMi(currentUser, parti) && (
                        <button className="btn btn-primary" onClick={() => setIlerletParti(parti)}><adim.ikon size={16} /> {adim.etiket}</button>
                    )}
                </>
            ) : <button className="btn btn-ghost" onClick={onClose}>Kapat</button>}
        >
            <canvas ref={tuvalRef} hidden />
            <input ref={dosyaRef} type="file" accept="image/*" capture="environment" hidden onChange={fotoSecildi} />
            {!okunan ? (
                <>
                    {!kameraHata && (
                        <div className="qr-kamera">
                            <video ref={videoRef} playsInline muted />
                            <div className="qr-cerceve" aria-hidden="true" />
                        </div>
                    )}
                    {kameraHata && <Notice tone="warning">{kameraHata}</Notice>}
                    <p className="text-sm text-muted" style={{ margin: '12px 0' }}>
                        Parti etiketindeki ya da irsaliyedeki QR kodu çerçeveye getirin.
                    </p>
                    <button className="btn btn-ghost btn-sm" onClick={() => dosyaRef.current?.click()}>
                        <Camera size={15} /> Fotoğraftan oku
                    </button>
                </>
            ) : parti ? (
                <div className="qr-sonuc">
                    <div className="qr-sonuc-ust">
                        <strong>{parti.partiNo}</strong>
                        <span className={`badge ${parti.durum}`}>{partiDurumEtiketi(parti)}</span>
                    </div>
                    <div>{parti.urunKodu} — {parti.urunAdi}</div>
                    <div className="text-sm text-muted">{(parti.kesilenAdet || parti.toplamAdet || 0).toLocaleString('tr-TR')} adet</div>
                    {!adim && <Notice tone="success">Bu parti tamamlanmış.</Notice>}
                    {adim && !adimYapabilirMi(currentUser, parti) && <Notice tone="neutral">Sıradaki adım ({adim.etiket}) için yetkiniz yok.</Notice>}
                </div>
            ) : (
                <Notice tone="warning" title="Parti bulunamadı">
                    Okunan kod bir partiye ait değil ya da bu parti sizin hesabınızda görünmüyor.
                    <div className="text-xs text-muted" style={{ marginTop: '6px', wordBreak: 'break-all' }}>{okunan.metin}</div>
                </Notice>
            )}
        </Modal>
    );
}
