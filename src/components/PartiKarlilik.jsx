import { TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useKurlar, paraBicim } from '../data/kur';
import { partiMaliyeti, maliyetTanimliMi } from '../utils/maliyet';

// Parti kârlılığı: model maliyet kartına göre planlanan vs gerçekleşen maliyet, gelir ve kâr
export default function PartiKarlilik({ parti }) {
    const { urunler, cariHareketler, kumasStoklar, maliyetAyar } = useApp();
    const { kurlar } = useKurlar();
    const urun = urunler.find(u => u.id === parti.urunId);
    if (!urun || !maliyetTanimliMi(urun)) {
        return (
            <div className="card mb-4">
                <div className="card-header"><h3 className="card-title"><TrendingUp size={16} /> Kârlılık</h3></div>
                <div className="text-sm text-muted">Bu modelin maliyet kartı yok. Ürünler → <strong>Maliyet kartı</strong> ile kumaş, aksesuar ve satış fiyatını girin; parti kârlılığı burada hesaplanır.</div>
            </div>
        );
    }
    const h = partiMaliyeti(parti, { urun, cariHareketler, kumasStoklar, kurlar, ayar: maliyetAyar });
    const sinif = h.karMarji === null ? '' : h.karMarji < 0 ? 'zarar' : h.karMarji < h.model.hedefKarMarji ? 'dusuk' : 'iyi';
    const satir = (ad, deger, not) => (
        <div className="maliyet-ozet-satir"><span>{ad}{not && <small> · {not}</small>}</span><span>{paraBicim(deger)}</span></div>
    );
    return (
        <div className="card mb-4">
            <div className="card-header">
                <h3 className="card-title"><TrendingUp size={16} /> Kârlılık</h3>
                <span className="text-xs text-muted">{h.adet.toLocaleString('tr-TR')} adet üzerinden</span>
            </div>
            <div className="maliyet-ozet">
                {satir('Kumaş', h.kumas, h.kumasTahmini ? 'maliyet kartından tahmin' : 'partiye bağlı alımlar')}
                {satir('Aksesuar ve diğer', h.digerMalzeme)}
                {satir('Fason işçilik', h.fason, h.fasonTahmini ? 'tahmini (borç henüz yazılmadı)' : 'cari borçları')}
                {satir(`Genel gider (%${h.model.genelGiderOrani})`, h.genelGider)}
                <div className="maliyet-ozet-satir toplam"><span>Gerçekleşen maliyet</span><span>{paraBicim(h.gerceklesen)} <small>({paraBicim(h.birimGerceklesen)}/adet)</small></span></div>
                <div className="maliyet-ozet-satir"><span>Planlanan ({(parti.toplamAdet || 0).toLocaleString('tr-TR')} adet × {paraBicim(h.model.birimMaliyet)})</span><span>{paraBicim(h.planlanan)}</span></div>
                {h.gelir !== null ? (
                    <>
                        <div className="maliyet-ozet-satir"><span>Gelir</span><span>{paraBicim(h.gelir)}</span></div>
                        <div className={`maliyet-ozet-satir kar ${sinif}`}><span>Kâr</span><span>{paraBicim(h.kar)} · %{h.karMarji.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</span></div>
                    </>
                ) : <div className="text-xs text-muted">Kâr hesabı için maliyet kartına satış fiyatı girin.</div>}
            </div>
        </div>
    );
}
