import path from "node:path";
import * as deepl from "deepl-node"
import {SourceLanguageCode} from "deepl-node";
import {translationDir} from "./vars-types";
const DEEPL_API_KEY = process.env.DEEPL_API_KEY||'';

export async function deepLTranslate(data: Buffer|string, fileName:string, language?: SourceLanguageCode) {
    if(language)
        console.warn(`translateToTurkish language "${language}"`);
    const translatedFilePath = path.join(translationDir, fileName);

    const translator = new deepl.Translator(DEEPL_API_KEY);
    const res = await translator.translateDocument(data, translatedFilePath, language?language:'en', 'tr',{filename:fileName});
    return res.done();
}