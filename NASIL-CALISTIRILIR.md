# BGaming nasil calistirilir?

Bu proje Tauri + React + TypeScript tabanli bir masaustu uygulamasidir.

## Gerekenler

- Node.js
- npm
- Rust ve Cargo
- Windows icin Visual Studio Build Tools / MSVC
- WebView2 Runtime

Bu makinede frontend build calisiyor. Tauri masaustu derlemesi icin Rust/Cargo ve MSVC Build Tools kurulu olmalidir.

## Komutlar

Bagimliliklar:

```bash
npm.cmd install
```

Frontend gelistirme sunucusu:

```bash
npm.cmd run dev
```

Frontend build:

```bash
npm.cmd run build
```

Tauri masaustu uygulamasini gelistirme modunda acmak:

```bash
npm.cmd run tauri -- dev
```

Tauri paket build:

```bash
npm.cmd run tauri -- build
```

## Notlar

- SQLite veritabani Tauri runtime icinde `sqlite:bgaming.db` olarak yuklenir.
- Uygulama acilisinda tablolar ve varsayilan ayarlar hazirlanir.
- Ornek oyunlar sadece veritabani bos ise eklenir.
