// Firma türleri ve aktif/pasif yardımcıları — tüm sayfalar firma türünü buradan okur.
import { Scissors, Palette, Factory, Package, Layers } from 'lucide-react';

export const FIRMA_TIPLERI = [
    { value: 'kesimhane', label: 'Kesimhane', kisa: 'Kesimhane', ikon: Scissors, rozet: 'kesimde', uretim: true },
    { value: 'baskici', label: 'Baskıcı', kisa: 'Baskıcı', ikon: Palette, rozet: 'baskida', uretim: true },
    { value: 'atolye', label: 'Atölye (Dikimhane)', kisa: 'Dikimhane', ikon: Factory, rozet: 'dikimde', uretim: true },
    { value: 'utupaketci', label: 'Ütü/Paketçi', kisa: 'Ütü/Paketçi', ikon: Package, rozet: 'utupakette', uretim: true },
    { value: 'kumasci', label: 'Kumaş Tedarikçisi', kisa: 'Kumaşçı', ikon: Layers, rozet: 'firma-kumasci', uretim: false },
];

const TIP_HARITASI = Object.fromEntries(FIRMA_TIPLERI.map(t => [t.value, t]));

export const firmaTipi = (tip) => TIP_HARITASI[tip] || null;
export const firmaRozetSinifi = (tip) => TIP_HARITASI[tip]?.rozet || 'beklemede';

// aktif alanı olmayan eski kayıtlar aktif sayılır
export const firmaAktifMi = (firma) => firma?.aktif !== false;

// Seçim listeleri için: pasif firmalar gizlenir, ancak kayıtta zaten seçili olan
// firma (pasif olsa bile) listede kalır ki mevcut kayıt bozulmasın.
export function secilebilirFirmalar(firmalar, { tip, seciliId } = {}) {
    const tipler = tip == null ? null : (Array.isArray(tip) ? tip : [tip]);
    return (firmalar || []).filter(f =>
        (!tipler || tipler.includes(f.tip)) &&
        (firmaAktifMi(f) || (seciliId && f.id === seciliId)));
}

// Seçim listesinde gösterilecek ad
export const firmaSecenekAdi = (firma) => `${firma.ad}${firmaAktifMi(firma) ? '' : ' (pasif)'}`;
