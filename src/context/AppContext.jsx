import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as db from '../data/db';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [loading, setLoading] = useState(true);
    const [firmalar, setFirmalar] = useState([]);
    const [urunler, setUrunler] = useState([]);
    const [partiler, setPartiler] = useState([]);
    const [cariHareketler, setCariHareketler] = useState([]);
    const [isAkisi, setIsAkisi] = useState([]);
    const [bildirimler, setBildirimler] = useState([]);
    const [stoklar, setStoklar] = useState([]);
    const [irsaliyeler, setIrsaliyeler] = useState([]);
    const [kullanicilar, setKullanicilar] = useState([]);
    const [islemGunlugu, setIslemGunlugu] = useState([]);
    const [kumasStoklar, setKumasStoklar] = useState([]);
    const [kumasTurleri, setKumasTurleri] = useState([]);
    const [tema, setTemaState] = useState('light');
    const [currentUser, setCurrentUserState] = useState(null);

    // Aktif kullanıcıyı hem state'e hem db katmanına (işlem günlüğü için) bildir
    const setCurrentUser = useCallback((user) => {
        db.setAktifKullanici(user);
        setCurrentUserState(user);
    }, []);

    const refresh = useCallback(() => {
        setFirmalar(db.getFirmalar());
        setUrunler(db.getUrunler());
        setPartiler(db.getPartiler());
        setCariHareketler(db.getCariHareketler());
        setIsAkisi(db.getIsAkisi());
        setBildirimler(db.getBildirimler());
        setStoklar(db.getStoklar());
        setIrsaliyeler(db.getIrsaliyeler());
        setKullanicilar(db.getKullanicilar());
        setIslemGunlugu(db.getIslemGunlugu());
        setKumasStoklar(db.getKumasStoklar());
        setKumasTurleri(db.getKumasTurleri());
        setTemaState(db.getTema());
    }, []);

    useEffect(() => {
        const init = async () => {
            await db.initDB();
            refresh();
            // Kayıtlı oturum varsa kullanıcıyı geri yükle
            const sessionUserId = db.loadSession();
            if (sessionUserId) {
                const user = db.getKullanicilar().find(k => k.id === sessionUserId && k.aktif !== false);
                if (user) setCurrentUser(user);
                else db.clearSession();
            }
            setLoading(false);
        };
        init();
    }, [refresh]);

    // Dark mode effect
    useEffect(() => {
        if (!loading) {
            document.documentElement.setAttribute('data-theme', tema);
        }
    }, [tema, loading]);

    // OTOMATİK TAZELEME: uygulama öne gelince + açıkken her 60 sn'de bir
    // sunucudan güncel veri çekilir. Böylece başka cihazda/kişide yapılan
    // değişiklikler sayfa yenilemeden görünür.
    useEffect(() => {
        if (loading) return;
        let busy = false;
        const tazele = async () => {
            if (busy || document.visibilityState !== 'visible') return;
            busy = true;
            const ok = await db.refetchFromServer();
            if (ok) refresh();
            busy = false;
        };
        const onVisible = () => { if (document.visibilityState === 'visible') tazele(); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        const timer = setInterval(tazele, 60000);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
            clearInterval(timer);
        };
    }, [loading, refresh]);

    // Auth operations
    const login = useCallback((kimlik, sifre) => {
        const result = db.verifyLogin(kimlik, sifre);
        if (result.ok) {
            db.saveSession(result.user.id);
            setCurrentUser(result.user);
            refresh();
        }
        return result;
    }, [refresh]);

    const logout = useCallback(() => {
        db.clearSession();
        setCurrentUser(null);
    }, []);

    // İlk kurulum: hiç kullanıcı yokken yönetici hesabı oluştur
    const ilkKurulum = useCallback((ad, email, sifre) => {
        const user = db.addKullanici({
            ad, email, telefon: '',
            rol: 'admin',
            yetkiler: ['anasayfa', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi', 'firmalar', 'cari_hesaplar', 'irsaliyeler', 'raporlar', 'kullanicilar', 'ayarlar'],
            aktif: true,
            sifre,
        });
        db.saveSession(user.id);
        setCurrentUser(user);
        refresh();
        return user;
    }, [refresh]);

    // Firma operations
    const firmaEkle = useCallback((firma) => { db.addFirma(firma); refresh(); }, [refresh]);
    const firmaGuncelle = useCallback((id, updates) => { db.updateFirma(id, updates); refresh(); }, [refresh]);
    const firmaSil = useCallback((id) => { const r = db.deleteFirma(id); refresh(); return r; }, [refresh]);

    // Ürün operations
    const urunEkle = useCallback((urun) => { db.addUrun(urun); refresh(); }, [refresh]);
    const urunGuncelle = useCallback((id, updates) => { db.updateUrun(id, updates); refresh(); }, [refresh]);
    const urunSil = useCallback((id) => { db.deleteUrun(id); refresh(); }, [refresh]);

    // Parti operations
    const partiEkle = useCallback((parti) => { const p = db.addParti(parti); refresh(); return p; }, [refresh]);
    const partiGuncelle = useCallback((id, updates) => { db.updateParti(id, updates); refresh(); }, [refresh]);
    const partiSil = useCallback((id) => { db.deleteParti(id); refresh(); }, [refresh]);
    const firmaAta = useCallback((partiId, atama) => { db.ataFirma(partiId, atama); refresh(); }, [refresh]);
    const atamaComplete = useCallback((partiId, atamaId, cikanAdet) => { db.tamamlaAtama(partiId, atamaId, cikanAdet); refresh(); }, [refresh]);
    const partiIlerlet = useCallback((partiId, cikanAdet) => { db.ilerletPartiDurum(partiId, cikanAdet); refresh(); }, [refresh]);
    const partiArsivle = useCallback((id, arsivde) => { db.setPartiArsiv(id, arsivde); refresh(); }, [refresh]);

    // Cari operations
    const cariHareketEkle = useCallback((hareket) => { db.addCariHareket(hareket); refresh(); }, [refresh]);
    const cariHareketSil = useCallback((id) => { db.deleteCariHareket(id); refresh(); }, [refresh]);

    // Bildirim operations
    const bildirimOkundu = useCallback((id) => { db.markBildirimOkundu(id); refresh(); }, [refresh]);
    const tumBildirimlerOkundu = useCallback(() => { db.markAllBildirimlerOkundu(); refresh(); }, [refresh]);

    // Kumaş stok operations
    const kumasTuruEkle = useCallback((ad, birim) => { const t = db.addKumasTuru(ad, birim); refresh(); return t; }, [refresh]);
    const kumasTuruSil = useCallback((id) => { db.deleteKumasTuru(id); refresh(); }, [refresh]);
    const kumasStokEkle = useCallback((kayit) => { const k = db.addKumasStok(kayit); refresh(); return k; }, [refresh]);
    const kumasStokGuncelle = useCallback((id, updates) => { db.updateKumasStok(id, updates); refresh(); }, [refresh]);
    const kumasStokSil = useCallback((id) => { db.deleteKumasStok(id); refresh(); }, [refresh]);

    // Stok operations
    const stokEkle = useCallback((stok) => { db.addStok(stok); refresh(); }, [refresh]);
    const stokGuncelle = useCallback((id, updates) => { db.updateStok(id, updates); refresh(); }, [refresh]);
    const stokSil = useCallback((id) => { db.deleteStok(id); refresh(); }, [refresh]);
    const stokHareketiEkle = useCallback((hareket) => { db.addStokHareketi(hareket); refresh(); }, [refresh]);

    // Irsaliye operations
    const irsaliyeEkle = useCallback((irsaliye) => { const i = db.addIrsaliye(irsaliye); refresh(); return i; }, [refresh]);
    const irsaliyeGuncelle = useCallback((id, updates) => { db.updateIrsaliye(id, updates); refresh(); }, [refresh]);
    const irsaliyeSil = useCallback((id) => { db.deleteIrsaliye(id); refresh(); }, [refresh]);
    const irsaliyeOnayla = useCallback((id) => { db.onaylaIrsaliye(id); refresh(); }, [refresh]);
    const irsaliyeTeslimEt = useCallback((id) => { db.teslimEtIrsaliye(id); refresh(); }, [refresh]);
    const irsaliyeIptal = useCallback((id) => { db.iptalIrsaliye(id); refresh(); }, [refresh]);

    // Kullanıcı operations
    const kullaniciEkle = useCallback((kullanici) => { db.addKullanici(kullanici); refresh(); }, [refresh]);
    const kullaniciGuncelle = useCallback((id, updates) => {
        const updated = db.updateKullanici(id, updates);
        // Aktif oturumdaki kullanıcı güncellendiyse state'i tazele
        if (updated && currentUser && currentUser.id === id) setCurrentUser(updated);
        refresh();
    }, [refresh, currentUser]);
    const kullaniciSil = useCallback((id) => {
        if (currentUser && currentUser.id === id) {
            alert('Oturumu açık olan kullanıcıyı silemezsiniz.');
            return;
        }
        db.deleteKullanici(id);
        refresh();
    }, [refresh, currentUser]);

    // Tema toggle
    const toggleTema = useCallback(() => {
        const yeniTema = tema === 'light' ? 'dark' : 'light';
        db.setTema(yeniTema);
        setTemaState(yeniTema);
    }, [tema]);

    const value = {
        firmalar, urunler, partiler, cariHareketler, isAkisi, bildirimler, stoklar, irsaliyeler, kullanicilar, islemGunlugu, kumasStoklar, kumasTurleri, tema,
        kumasStokEkle, kumasStokGuncelle, kumasStokSil, kumasTuruEkle, kumasTuruSil,
        currentUser, login, logout, ilkKurulum,
        fasoncuTeslimBildir: (partiId, cikanAdet, notu) => { db.fasoncuTeslimBildir(partiId, cikanAdet, notu); refresh(); },
        yedekIndir: db.exportBackup,
        yedekYukle: async (jsonText) => { const n = await db.importBackup(jsonText); refresh(); return n; },
        refresh,
        firmaEkle, firmaGuncelle, firmaSil,
        urunEkle, urunGuncelle, urunSil,
        partiEkle, partiGuncelle, partiSil,
        firmaAta, atamaComplete, partiIlerlet, partiArsivle,
        cariHareketEkle, cariHareketSil,
        setHareketlerHesaplandi: (...args) => { db.setHareketlerHesaplandi(...args); refresh(); },
        getFirmaBakiye: db.getFirmaBakiye,
        getFirmaPerformans: db.getFirmaPerformans,
        getVadesiGelenFirmalar: db.getVadesiGelenFirmalar,
        bildirimOkundu, tumBildirimlerOkundu,
        stokEkle, stokGuncelle, stokSil, stokHareketiEkle,
        getStokHareketleri: db.getStokHareketleri,
        irsaliyeEkle, irsaliyeGuncelle, irsaliyeSil, irsaliyeOnayla, irsaliyeTeslimEt, irsaliyeIptal,
        getIrsaliyelerByParti: db.getIrsaliyelerByParti,
        getIrsaliyelerByFirma: db.getIrsaliyelerByFirma,
        kullaniciEkle, kullaniciGuncelle, kullaniciSil,
        toggleTema,
        exportToCSV: db.exportToCSV,
    };
    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Sistem Başlatılıyor</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Veriler güvenli dosyadan yükleniyor...</p>
                </div>
            </div>
        );
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
}
