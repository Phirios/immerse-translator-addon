import { addonBuilder, getRouter } from 'stremio-addon-sdk';
import express from 'express';
import { fetchFromSubtitleService, SubtitleResult } from './subtitleFetcher';
import { translateWithDeepL } from './translator';
import { parseStremioId, LANG_NAMES } from './utils';
import path from 'path';
import fs from 'fs';

const SUBTITLE_SERVICE_URL = process.env.SUBTITLE_SERVICE_URL ?? 'http://localhost:3000';
const ADDON_PORT = parseInt(process.env.PORT ?? '3535');
const CACHE_DIR = process.env.CACHE_DIR ?? path.join(__dirname, '..', 'data', 'cache');

// Ensure cache dir exists
fs.mkdirSync(CACHE_DIR, { recursive: true });

// User config is passed via the addon URL path:
// /<lang>-<deeplKey?>-<fallbackLang?>/manifest.json
// Example: /tur/manifest.json (Turkish, no DeepL)
// Example: /tur-DEEPL_KEY-eng/manifest.json (Turkish, DeepL fallback from English)

const manifest = {
  id: 'com.phirios.subs',
  version: '2.0.0',
  name: 'OpenSubtitles.org Subtitles',
  description: 'Fetches subtitles from OpenSubtitles.org with optional DeepL translation fallback',
  catalogs: [],
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'kitsu'],
  behaviorHints: { configurable: true, configurationRequired: false },
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ id, type, extra, config }) => {
  console.log('Subtitle request:', { id, type });

  const { imdbId, season, episode } = parseStremioId(id);
  if (!imdbId) return { subtitles: [] };

  // Parse config from environment or defaults
  const lang = process.env.SUBTITLE_LANG ?? 'tur';
  const deeplKey = process.env.DEEPL_API_KEY ?? '';
  const fallbackLang = process.env.FALLBACK_LANG ?? 'eng';

  try {
    // 1. Try to find subtitle in preferred language
    let results = await fetchFromSubtitleService(SUBTITLE_SERVICE_URL, {
      imdbid: imdbId,
      lang,
      season,
      episode,
    });

    let subtitles = results.map((sub) => ({
      id: sub.id,
      url: `${SUBTITLE_SERVICE_URL}/download?url=${encodeURIComponent(sub.downloadUrl)}`,
      lang: LANG_NAMES[sub.lang] ?? sub.lang,
    }));

    // 2. If no results and DeepL is configured, fallback: fetch in fallbackLang and translate
    if (subtitles.length === 0 && deeplKey) {
      console.log(`No ${lang} subs found, trying ${fallbackLang} with DeepL fallback`);

      const fallbackResults = await fetchFromSubtitleService(SUBTITLE_SERVICE_URL, {
        imdbid: imdbId,
        lang: fallbackLang,
        season,
        episode,
      });

      if (fallbackResults.length > 0) {
        const best = pickBest(fallbackResults);
        const cacheKey = `${id.replace(/[:/]/g, '_')}_${lang}`;
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.srt`);

        // Check cache first
        if (fs.existsSync(cachePath)) {
          console.log('Returning cached translation');
        } else {
          // Download and translate
          const downloadUrl = `${SUBTITLE_SERVICE_URL}/download?url=${encodeURIComponent(best.downloadUrl)}`;
          const translated = await translateWithDeepL(downloadUrl, deeplKey, fallbackLang, lang);
          if (translated) {
            fs.writeFileSync(cachePath, translated, 'utf-8');
          }
        }

        if (fs.existsSync(cachePath)) {
          subtitles.push({
            id: `translated_${best.id}`,
            url: `http://localhost:${ADDON_PORT}/cache/${cacheKey}.srt`,
            lang: `${LANG_NAMES[lang] ?? lang} (DeepL)`,
          });
        }
      }
    }

    return { subtitles };
  } catch (e) {
    console.error('Subtitle handler error:', e);
    return { subtitles: [] };
  }
});

function pickBest(subs: SubtitleResult[]): SubtitleResult {
  return subs.reduce((best, sub) => (sub.downloadCount > best.downloadCount ? sub : best), subs[0]);
}

const addonInterface = builder.getInterface();
const app = express();

// Serve cached translations
app.use('/cache', express.static(CACHE_DIR));

// Stremio addon routes
app.use('/', getRouter(addonInterface));

app.listen(ADDON_PORT, () => {
  console.log(`Stremio addon listening on port ${ADDON_PORT}`);
  console.log(`Subtitle service: ${SUBTITLE_SERVICE_URL}`);
});
