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

// Proxy subtitle downloads from subtitle-service
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

// Configure page
app.get('/configure', (req, res) => {
  const langOptionsHtml = LANG_OPTIONS.map((opt) => {
    const code = opt.split(' - ')[0];
    const selected = code === 'tur' ? 'selected' : '';
    return `<option value="${opt}" ${selected}>${opt}</option>`;
  }).join('\n');

  const fallbackOptionsHtml = LANG_OPTIONS.map((opt) => {
    const code = opt.split(' - ')[0];
    const selected = code === 'eng' ? 'selected' : '';
    return `<option value="${opt}" ${selected}>${opt}</option>`;
  }).join('\n');

  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenSubtitles.org Subtitles - Configure</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0a0a2e; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
  .container { background: #1a1a4e; border-radius: 12px; padding: 32px; max-width: 420px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  h1 { font-size: 1.3em; margin: 0 0 24px; text-align: center; }
  label { display: block; margin: 16px 0 6px; font-size: 0.9em; color: #aab; }
  select, input[type=text] { width: 100%; padding: 10px; border: 1px solid #333; border-radius: 6px; background: #0d0d2b; color: #fff; font-size: 0.95em; box-sizing: border-box; }
  .deepl-fields { display: none; }
  .deepl-fields.visible { display: block; }
  button { width: 100%; padding: 12px; margin-top: 24px; background: #7b5bf5; color: #fff; border: none; border-radius: 6px; font-size: 1em; cursor: pointer; font-weight: 600; }
  button:hover { background: #6a4be0; }
  .manifest-url { margin-top: 16px; padding: 10px; background: #0d0d2b; border: 1px solid #333; border-radius: 6px; word-break: break-all; font-size: 0.8em; color: #8af; display: none; cursor: pointer; }
  .manifest-url.visible { display: block; }
  .copied { color: #5f5; }
</style>
</head><body>
<div class="container">
  <h1>OpenSubtitles.org Subtitles</h1>
  <label>Subtitle Language</label>
  <select id="lang">${langOptionsHtml}</select>

  <label>DeepL Translation Fallback</label>
  <select id="deepl_enabled" onchange="toggleDeepL()">
    <option value="disabled">Disabled</option>
    <option value="enabled">Enabled</option>
  </select>

  <div id="deepl-fields" class="deepl-fields">
    <label>DeepL API Key</label>
    <input type="text" id="deepl_api_key" placeholder="Enter your DeepL API key">

    <label>Fallback Language</label>
    <select id="fallback_lang">${fallbackOptionsHtml}</select>
  </div>

  <button onclick="install()">Install</button>
  <div id="manifest-url" class="manifest-url" onclick="copyUrl()"></div>
  <p id="hint" style="display:none;margin-top:8px;font-size:0.75em;color:#889;text-align:center;">Click the URL above to copy, then paste in Stremio's addon search bar</p>
</div>
<script>
function toggleDeepL() {
  document.getElementById('deepl-fields').classList.toggle('visible', document.getElementById('deepl_enabled').value === 'enabled');
}
function getManifestUrl() {
  var config = encodeURIComponent(JSON.stringify({
    lang: document.getElementById('lang').value,
    deepl_enabled: document.getElementById('deepl_enabled').value,
    deepl_api_key: document.getElementById('deepl_api_key').value || '',
    fallback_lang: document.getElementById('fallback_lang').value,
  }));
  return window.location.origin + '/' + config + '/manifest.json';
}
function install() {
  var manifestUrl = getManifestUrl();
  var el = document.getElementById('manifest-url');
  el.textContent = manifestUrl;
  el.classList.add('visible');
  document.getElementById('hint').style.display = 'block';
  window.location.href = 'https://app.strem.io/#/addons?addon=' + encodeURIComponent(manifestUrl);
}
function copyUrl() {
  var el = document.getElementById('manifest-url');
  navigator.clipboard.writeText(el.textContent).then(function() {
    el.classList.add('copied');
    el.textContent = 'Copied! Paste this URL in Stremio addon search bar.';
    setTimeout(function() {
      el.classList.remove('copied');
      el.textContent = getManifestUrl();
    }, 2000);
  });
}
</script>
</body></html>`);
});

// Serve cached translations
app.use('/cache', express.static(CACHE_DIR));

// SDK router (handles /:config?/manifest.json and resource routes)
app.use(getRouter(addonInterface));

app.get('/', (_, res) => {
  res.redirect('/configure');
});

app.listen(ADDON_PORT, () => {
  console.log(`Stremio addon listening on port ${ADDON_PORT}`);
  console.log(`Subtitle service: ${SUBTITLE_SERVICE_URL}`);
  console.log(`Addon URL: ${ADDON_URL}`);
});
