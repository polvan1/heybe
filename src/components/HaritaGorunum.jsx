// Leaflet tabanlı harita.
// mod='sokak': OpenStreetMap sokak haritası (internet gerekir)
// mod='sade' : uygulamayla gelen İstanbul ilçe sınırları (internetsiz/demoda da çalışır)
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ilceVerisi from '../data/istanbulIlceler.json';

const ISTANBUL = [41.03, 28.95];

// Firma tipine göre nokta rengi (CSS'teki --harita-* değişkenleriyle aynı sırada)
export const TIP_SINIF = {
    kesimhane: 'harita-nokta--kesim',
    atolye: 'harita-nokta--atolye',
    utupaketci: 'harita-nokta--utu',
    baskici: 'harita-nokta--baski',
};

// Kullanıcının girdiği metinler (firma adı vb.) HTML olarak değil, düz metin olarak gösterilir
function metin(s) {
    const el = document.createElement('span');
    el.textContent = s ?? '';
    return el;
}

function ilceKatmani() {
    const grup = L.layerGroup();
    for (const ilce of ilceVerisi.ilceler) {
        const halkalar = ilce.poligonlar.map(h => h.map(([lng, lat]) => [lat, lng]));
        L.polygon(halkalar, { className: 'harita-ilce', weight: 1, interactive: false }).addTo(grup);
        L.marker(ilce.merkez, {
            interactive: false,
            icon: L.divIcon({ className: 'harita-ilce-ad', html: `<span>${ilce.ad}</span>`, iconSize: null }),
        }).addTo(grup);
    }
    return grup;
}

export default function HaritaGorunum({
    mod = 'sade', noktalar = [], merkez = null, rota = null, seciliId = null,
    secimModu = false, onHaritaTikla, onNoktaTikla, odakAnahtari,
}) {
    const kapRef = useRef(null);
    const haritaRef = useRef(null);
    const katmanRef = useRef({});
    const geriCagriRef = useRef({});
    geriCagriRef.current = { onHaritaTikla, onNoktaTikla };

    // Haritayı bir kez oluştur
    useEffect(() => {
        const harita = L.map(kapRef.current, { center: ISTANBUL, zoom: 11, zoomControl: true, attributionControl: true });
        harita.attributionControl.setPrefix(false);
        harita.on('click', (e) => geriCagriRef.current.onHaritaTikla?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
        // İlçe adları sadece yakınlaştırınca görünsün
        const yakinlik = () => kapRef.current?.classList.toggle('harita--yakin', harita.getZoom() >= 12);
        harita.on('zoomend', yakinlik);
        yakinlik();
        katmanRef.current.noktalar = L.layerGroup().addTo(harita);
        katmanRef.current.rota = L.layerGroup().addTo(harita);
        haritaRef.current = harita;
        // Kapsayıcı boyutu sonradan değişirse (sekme/ekran dönmesi) haritayı yeniden ölç
        const gozlemci = new ResizeObserver(() => harita.invalidateSize());
        gozlemci.observe(kapRef.current);
        return () => { gozlemci.disconnect(); harita.remove(); haritaRef.current = null; };
    }, []);

    // Altlık: sokak haritası ya da sade ilçe haritası
    useEffect(() => {
        const harita = haritaRef.current;
        const k = katmanRef.current;
        if (k.altlik) harita.removeLayer(k.altlik);
        k.altlik = mod === 'sokak'
            ? L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıcıları',
            })
            : ilceKatmani();
        k.altlik.addTo(harita);
        if (mod === 'sade') harita.attributionControl.addAttribution('İlçe sınırları: geoBoundaries / © OpenStreetMap (ODbL)');
        else harita.attributionControl.removeAttribution('İlçe sınırları: geoBoundaries / © OpenStreetMap (ODbL)');
        kapRef.current.classList.toggle('harita--sade', mod === 'sade');
    }, [mod]);

    // Firma noktaları ve merkez
    useEffect(() => {
        const grup = katmanRef.current.noktalar;
        grup.clearLayers();
        for (const n of noktalar) {
            const secili = n.id === seciliId;
            const m = L.circleMarker([n.lat, n.lng], {
                radius: secili ? 11 : 8,
                weight: secili ? 3 : 2,
                className: `harita-nokta ${TIP_SINIF[n.tip] || ''} ${secili ? 'harita-nokta--secili' : ''}`,
            });
            m.bindTooltip(metin(n.etiket), { direction: 'top', offset: [0, -8], className: 'harita-ipucu', permanent: secili });
            m.on('click', (e) => { L.DomEvent.stopPropagation(e); geriCagriRef.current.onNoktaTikla?.(n.id); });
            m.addTo(grup);
        }
        if (merkez) {
            L.marker([merkez.lat, merkez.lng], {
                icon: L.divIcon({ className: 'harita-merkez', html: '<span>M</span>', iconSize: [26, 26] }),
                zIndexOffset: 500,
            }).bindTooltip(metin(merkez.ad || 'Merkez'), { direction: 'top', offset: [0, -12], className: 'harita-ipucu' }).addTo(grup);
        }
    }, [noktalar, merkez, seciliId]);

    // Rota çizgisi ve numaralı duraklar
    useEffect(() => {
        const grup = katmanRef.current.rota;
        grup.clearLayers();
        if (!rota || rota.length < 2) return;
        const cizgi = rota.map(d => [d.konum.lat, d.konum.lng]);
        L.polyline(cizgi, { className: 'harita-rota', weight: 4 }).addTo(grup);
        rota.forEach((d, i) => {
            if (d.tip !== 'durak') return;
            L.marker([d.konum.lat, d.konum.lng], {
                icon: L.divIcon({ className: 'harita-durak', html: `<span>${i}</span>`, iconSize: [24, 24] }),
                zIndexOffset: 1000,
            }).addTo(grup);
        });
    }, [rota]);

    // Görünür alanı içeriğe göre ayarla
    useEffect(() => {
        const harita = haritaRef.current;
        const pts = rota?.length ? rota.map(d => [d.konum.lat, d.konum.lng]) : noktalar.map(n => [n.lat, n.lng]);
        if (merkez && !rota?.length) pts.push([merkez.lat, merkez.lng]);
        if (pts.length >= 2) harita.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 14 });
        else if (pts.length === 1) harita.setView(pts[0], 14);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [odakAnahtari]);

    useEffect(() => {
        kapRef.current.classList.toggle('harita--secim', !!secimModu);
    }, [secimModu]);

    return <div ref={kapRef} className="harita-kap" role="application" aria-label="Üretim yerleri haritası" />;
}
