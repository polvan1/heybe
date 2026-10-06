// Silme işlemleri için güvenlik onayı — yanlışlıkla dokunmayı önler.
// Doğru şifre girilmeden hiçbir kritik kayıt silinemez.
const SILME_SIFRESI = 'his38';

export function silmeOnayi(mesaj) {
    if (import.meta.env.VITE_DEMO === '1') return true; // demoda şifre sorulmaz
    const girilen = prompt(`${mesaj}\n\nSilmek için güvenlik şifresini girin:`);
    if (girilen === null) return false; // vazgeçti
    if (girilen !== SILME_SIFRESI) {
        alert('Şifre hatalı — silme işlemi iptal edildi.');
        return false;
    }
    return true;
}
