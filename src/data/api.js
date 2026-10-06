// Sunucu API ortak ayarları.
// Anahtarlar koda gömülmez; derleme sırasında .env dosyasından okunur (bkz. .env.example).
export const API_URL = import.meta.env.BASE_URL + 'api.php';
// Sunucudaki config.php içindeki $API_KEY ile AYNI olmalı
export const API_KEY = import.meta.env.VITE_API_KEY || '';
// Sunucudaki config.php ($VAPID_PUBLIC) ile AYNI olmalı
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
