# Stremio Subtitle Addon

OpenSubtitles.org'dan altyazı çeken ve opsiyonel olarak DeepL ile çeviri yapan bir Stremio addon'u.

![Stremio](https://img.shields.io/badge/Stremio-5B4BB5?logo=stremio&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![DeepL](https://img.shields.io/badge/DeepL-0F2B46?logo=deepl&logoColor=white)

## Özellikler

- **OpenSubtitles.org** üzerinden altyazı arama ve indirme
- **25 dil** desteği (Türkçe, İngilizce, Almanca, Japonca vb.)
- **DeepL çeviri fallback** — istediğin dilde altyazı yoksa başka dilden çevirip sunar
- **Çeviri önbelleği** — aynı bölüm tekrar istendiğinde çeviriyi cache'den sunar
- **Yapılandırma sayfası** — dil seçimi ve DeepL ayarları için web arayüzü
- **Film ve dizi** desteği (IMDB ID)

## Nasıl Çalışır

1. Stremio bir film/dizi oynatırken addon'a altyazı isteği gönderir
2. Addon, [opensubtitles-api](https://github.com/Phirios/opensubtitles-api) mikroservisinden altyazı arar
3. Seçilen dilde altyazı bulunursa doğrudan sunar
4. Bulunamazsa ve DeepL etkinse, fallback dilinde altyazı bulup DeepL ile çevirir
5. Çeviriler önbelleğe alınır

## Kurulum

### Stremio'ya Ekleme

1. [Yapılandırma sayfasını](https://stremio-addon.phirios.com/configure) aç
2. Altyazı dilini seç
3. (Opsiyonel) DeepL çevirisini etkinleştir ve API anahtarını gir
4. **Install** butonuna tıkla

### Self-Host

```bash
git clone https://github.com/Phirios/stremio-subtitle-addon.git
cd stremio-subtitle-addon
npm install
npm run build
npm start
```

### Docker

```bash
docker build -t stremio-subtitle-addon .
docker run -p 3535:3535 \
  -e SUBTITLE_SERVICE_URL=http://your-subtitle-service:3000 \
  -e ADDON_URL=https://your-addon-url.com \
  stremio-subtitle-addon
```

### Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `PORT` | `3535` | Addon sunucu portu |
| `SUBTITLE_SERVICE_URL` | `http://localhost:3000` | [opensubtitles-api](https://github.com/Phirios/opensubtitles-api) adresi |
| `ADDON_URL` | `http://localhost:3535` | Addon'un dışarıdan erişilebilir URL'si |
| `CACHE_DIR` | `./data/cache` | Çeviri önbellek dizini |

## Mimari

```
Stremio → [Stremio Subtitle Addon] → [opensubtitles-api] → OpenSubtitles.org
                    ↓
              DeepL API (opsiyonel)
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express + Stremio Addon SDK
- **Dil:** TypeScript
- **Altyazı:** OpenSubtitles.org (via opensubtitles-api)
- **Çeviri:** DeepL API

## Lisans

MIT
