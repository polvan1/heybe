import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const SAYFA_BOYUTU = 50;

// İşlem Günlüğü: kim, ne zaman, ne yaptı (silme/ekleme/onay vb.)
export default function IslemGunlugu() {
    const { islemGunlugu } = useApp();
    const [search, setSearch] = useState('');
    const [sayfa, setSayfa] = useState(1);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return islemGunlugu
            .filter(k => {
                if (!q) return true;
                return (k.kullaniciAd || '').toLowerCase().includes(q) ||
                       (k.islem || '').toLowerCase().includes(q) ||
                       (k.detay || '').toLowerCase().includes(q);
            })
            // Sunucudan gelen sıraya güvenme: her zaman EN YENİ İŞLEM EN ÜSTTE
            .sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    }, [islemGunlugu, search]);

    const toplamSayfa = Math.max(1, Math.ceil(filtered.length / SAYFA_BOYUTU));
    const aktifSayfa = Math.min(sayfa, toplamSayfa);
    const gosterilen = filtered.slice((aktifSayfa - 1) * SAYFA_BOYUTU, aktifSayfa * SAYFA_BOYUTU);

    const sayfaDegistir = (yeni) => {
        setSayfa(Math.min(Math.max(1, yeni), toplamSayfa));
        // Sayfa değişince listenin başına dön
        document.querySelector('.main-content')?.scrollTo({ top: 0 });
    };

    const islemRengi = (islem) => {
        if (/silindi|iptal/i.test(islem)) return 'var(--accent-danger)';
        if (/eklendi|oluşturuldu/i.test(islem)) return 'var(--color-success)';
        return 'var(--accent-primary)';
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ScrollText size={22} /> İşlem Günlüğü
                </h1>
            </div>

            <div className="search-bar" style={{ marginBottom: '12px' }}>
                <Search size={18} className="search-icon" />
                <input type="text" placeholder="Kullanıcı, işlem veya detay ara..." value={search} onChange={e => { setSearch(e.target.value); setSayfa(1); }} />
            </div>

            <div className="card">
                {gosterilen.length === 0 ? (
                    <div className="p-8 text-center text-muted">Kayıt bulunamadı.</div>
                ) : (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ whiteSpace: 'nowrap' }}>Tarih</th>
                                    <th>Kullanıcı</th>
                                    <th>İşlem</th>
                                    <th>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gosterilen.map(k => (
                                    <tr key={k.id}>
                                        <td className="text-xs" style={{ whiteSpace: 'nowrap' }}>
                                            {new Date(k.tarih).toLocaleDateString('tr-TR')}
                                            <div className="text-muted">{new Date(k.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="text-sm font-semibold" style={{ whiteSpace: 'nowrap' }}>{k.kullaniciAd}</td>
                                        <td>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: islemRengi(k.islem) }}>
                                                {k.islem}
                                            </span>
                                        </td>
                                        <td className="text-sm">{k.detay}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Sayfalama: binlerce kayıtta en aşağı inmeden gezinme */}
                {filtered.length > SAYFA_BOYUTU && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => sayfaDegistir(aktifSayfa - 1)} disabled={aktifSayfa <= 1}>
                            <ChevronLeft size={15} /> Önceki
                        </button>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Sayfa {aktifSayfa} / {toplamSayfa}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => sayfaDegistir(aktifSayfa + 1)} disabled={aktifSayfa >= toplamSayfa}>
                            Sonraki <ChevronRight size={15} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
