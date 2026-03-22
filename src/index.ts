import { addonBuilder, getRouter } from 'stremio-addon-sdk';
import express from 'express';
import { fetchFromSubtitleService, SubtitleResult } from './subtitleFetcher';
import { translateWithDeepL } from './translator';
import { parseStremioId, LANG_NAMES, LANG_OPTIONS } from './utils';
import path from 'path';
import fs from 'fs';

const SUBTITLE_SERVICE_URL = process.env.SUBTITLE_SERVICE_URL ?? 'http://localhost:3000';
const ADDON_PORT = parseInt(process.env.PORT ?? '3535');
const ADDON_URL = process.env.ADDON_URL ?? `http://localhost:${ADDON_PORT}`;
const CACHE_DIR = process.env.CACHE_DIR ?? path.join(__dirname, '..', 'data', 'cache');

fs.mkdirSync(CACHE_DIR, { recursive: true });

const manifest = {
  id: 'com.phirios.subs',
  version: '2.0.0',
  name: 'OpenSubtitles.org Subtitles',
  description: 'Fetches subtitles from OpenSubtitles.org with optional DeepL translation fallback',
  catalogs: [],
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'kitsu'],
  behaviorHints: { configurable: true, configurationRequired: true },
  config: [
    {
      key: 'lang',
      type: 'select',
      title: 'Subtitle Language',
      options: LANG_OPTIONS,
      default: 'tur',
    },
    {
      key: 'deepl_enabled',
      type: 'select',
      title: 'DeepL Translation Fallback',
      options: ['disabled', 'enabled'],
      default: 'disabled',
    },
    {
      key: 'deepl_api_key',
      type: 'text',
      title: 'DeepL API Key (required if DeepL enabled)',
      default: '',
    },
    {
      key: 'fallback_lang',
      type: 'select',
      title: 'Fallback Language (for DeepL translation)',
      options: LANG_OPTIONS,
      default: 'eng',
    },
  ],
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ id, type, config }) => {
  console.log('Subtitle request:', { id, type, config });

  const { imdbId, season, episode } = parseStremioId(id);
  if (!imdbId) return { subtitles: [] };

  const lang = (config?.lang ?? 'tur').split(' - ')[0];
  const deeplEnabled = config?.deepl_enabled === 'enabled';
  const deeplKey = config?.deepl_api_key ?? '';
  const fallbackLang = (config?.fallback_lang ?? 'eng').split(' - ')[0];

  try {
    // 1. Search subtitles in preferred language
    let results = await fetchFromSubtitleService(SUBTITLE_SERVICE_URL, {
      imdbid: imdbId,
      lang,
      season,
      episode,
    });

    let subtitles = results.map((sub) => ({
      id: sub.id,
      url: `${ADDON_URL}/download?url=${encodeURIComponent(sub.downloadUrl)}`,
      lang: LANG_NAMES[sub.lang] ?? sub.lang,
    }));

    // 2. If no results and DeepL is enabled, fetch fallback language and translate
    if (subtitles.length === 0 && deeplEnabled && deeplKey) {
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

        if (fs.existsSync(cachePath)) {
          console.log('Returning cached translation');
        } else {
          const downloadUrl = `${SUBTITLE_SERVICE_URL}/download?url=${encodeURIComponent(best.downloadUrl)}`;
          const translated = await translateWithDeepL(downloadUrl, deeplKey, fallbackLang, lang);
          if (translated) {
            fs.writeFileSync(cachePath, translated, 'utf-8');
          }
        }

        if (fs.existsSync(cachePath)) {
          subtitles.push({
            id: `translated_${best.id}`,
            url: `${ADDON_URL}/cache/${cacheKey}.srt`,
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

// Proxy subtitle downloads from subtitle-service (so Stremio can access via HTTPS)
app.get('/download', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send('url required');

  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${SUBTITLE_SERVICE_URL}/download?url=${encodeURIComponent(url)}`, {
      timeout: 15000,
    });
    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.send(response.data);
  } catch (e) {
    console.error('Download proxy error:', e);
    res.status(503).send('download failed');
  }
});

// Serve cached translations
app.use('/cache', express.static(CACHE_DIR));

// Stremio addon routes
app.use('/', getRouter(addonInterface));

app.listen(ADDON_PORT, () => {
  console.log(`Stremio addon listening on port ${ADDON_PORT}`);
  console.log(`Subtitle service: ${SUBTITLE_SERVICE_URL}`);
  console.log(`Addon URL: ${ADDON_URL}`);
});
