import path from "node:path";
import * as fs from "node:fs";
import FormData from "form-data";
import * as deepl from "deepl-node"
import {subsDir, translationDir} from "./index";
import {SourceLanguageCode} from "deepl-node";
import {configDotenv} from "dotenv";

configDotenv({path: path.join(__dirname, '..', '.env')});
const DEEPL_API_KEY = process.env.DEEPL_API_KEY||'';

export async function deepLTranslate(buffer: Buffer, fileName:string, language?: SourceLanguageCode) {
    const translatedFilePath = path.join(translationDir, fileName);
    const translator = new deepl.Translator(DEEPL_API_KEY);
    const res = await translator.translateDocument(buffer, translatedFilePath, language?language:'en', 'tr',{filename:fileName});
    return res.done();
}

