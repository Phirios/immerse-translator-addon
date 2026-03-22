import axios from 'axios';
import * as deepl from 'deepl-node';
import { SourceLanguageCode, TargetLanguageCode } from 'deepl-node';

// Map 3-letter opensubtitles codes to DeepL language codes
const TO_DEEPL_SOURCE: Record<string, SourceLanguageCode> = {
  eng: 'en', tur: 'tr', ger: 'de', fre: 'fr', spa: 'es',
  ita: 'it', por: 'pt', rus: 'ru', pol: 'pl', dut: 'nl',
  swe: 'sv', nor: 'nb', fin: 'fi', dan: 'da', cze: 'cs',
  hun: 'hu', rum: 'ro', bul: 'bg', ukr: 'uk', ara: 'ar',
  chi: 'zh', jpn: 'ja', kor: 'ko', gre: 'el',
};

const TO_DEEPL_TARGET: Record<string, TargetLanguageCode> = {
  eng: 'en-US', tur: 'tr', ger: 'de', fre: 'fr', spa: 'es',
  ita: 'it', por: 'pt-PT', rus: 'ru', pol: 'pl', dut: 'nl',
  swe: 'sv', nor: 'nb', fin: 'fi', dan: 'da', cze: 'cs',
  hun: 'hu', rum: 'ro', bul: 'bg', ukr: 'uk', ara: 'ar',
  chi: 'zh-HANS', jpn: 'ja', kor: 'ko', gre: 'el',
};

export async function translateWithDeepL(
  subtitleUrl: string,
  apiKey: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  try {
    // Download the subtitle content
    const res = await axios.get(subtitleUrl, { timeout: 15000 });
    const content = res.data as string;

    const source = TO_DEEPL_SOURCE[sourceLang];
    const target = TO_DEEPL_TARGET[targetLang];

    if (!target) {
      console.error(`No DeepL target mapping for: ${targetLang}`);
      return null;
    }

    const translator = new deepl.Translator(apiKey);

    // Split SRT into blocks, translate text portions only
    const blocks = content.split(/\n\n+/);
    const translatedBlocks: string[] = [];

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) {
        translatedBlocks.push(block);
        continue;
      }

      // lines[0] = sequence number, lines[1] = timecodes, rest = text
      const textLines = lines.slice(2).join('\n');
      if (!textLines.trim()) {
        translatedBlocks.push(block);
        continue;
      }

      const result = await translator.translateText(textLines, source ?? null, target);
      translatedBlocks.push([lines[0], lines[1], result.text].join('\n'));
    }

    return translatedBlocks.join('\n\n');
  } catch (e) {
    console.error('DeepL translation error:', e);
    return null;
  }
}
