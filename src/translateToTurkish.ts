import path from "node:path";
import * as fs from "node:fs";
import FormData from "form-data";
import * as deepl from "deepl-node"
import {subsDir, translationDir} from "./index";
import {SourceLanguageCode} from "deepl-node";
const DEEPL_API_KEY = 'ea8b2937-e978-40ea-89f9-09cff8789923:fx';

export async function deepLTranslate(buffer: Buffer, fileName:string, language?: SourceLanguageCode) {
    const translatedFilePath = path.join(translationDir, fileName);

    const translator = new deepl.Translator(DEEPL_API_KEY);
    const res = await translator.translateDocument(buffer, translatedFilePath, language?language:'en', 'tr',{filename:fileName});
    return res.done();
}