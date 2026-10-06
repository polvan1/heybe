@echo off
echo =========================================
echo  MY HIS ERP - KURULUM VE BASLATMA (LOCAL)
echo =========================================
echo.
echo Gerekli dosyalar kontrol ediliyor...
cd /d "%~dp0"

where php >nul 2>nul
IF ERRORLEVEL 1 (
    echo.
    echo HATA: PHP bulunamadi. https://windows.php.net/download adresinden PHP 8 indirip
    echo PATH ortam degiskenine ekleyin (php.ini icinde extension=pdo_sqlite acik olmali^).
    pause
    exit /b 1
)

IF NOT EXIST "node_modules\" (
    echo.
    echo lk kurulum yapiliyor, paketler indiriliyor...
    echo Bu islem internet hiziniza bagli olarak 1-2 dakika surebilir.
    echo Lutfen bekleyin...
    call pnpm install
    echo Kurulum tamamlandi!
)

echo.
echo Sunucu baslatiliyor... Bu pencereyi KAPATMAYIN.
echo.
call pnpm run dev
pause
