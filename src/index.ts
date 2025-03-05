import {addonBuilder, Manifest, Subtitle, getRouter} from "stremio-addon-sdk";
import {fetchSubtitles, isCached} from './getSubs'
import * as fs from "fs";
import path from "node:path";
import axios from "axios";
import express from "express";
import {deepLTranslate} from "./translateToTurkish";
import zlib from "node:zlib";
import {SourceLanguageCode} from "deepl-node";
import {translationDir} from "./vars-types";
import {SubtitleConverter} from "./subtitleConverter";


const manifest: Manifest = {
    id: "com.phirios.subs",
    version: "1.0.0",
    name: "My Subtitles Addon",
    description: "An addon that provides subtitles for movies and series",
    catalogs: [],
    resources: ["subtitles"],
    types: ["movie", "series"], // Content types this addon supports
    idPrefixes: ["anilist", "tt", "kitsu"],
};
const URL = 'https://phirios.tail8360f6.ts.net/';

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ id,type,extra}):Promise<{subtitles:Subtitle[]}> => {
    fs.writeFileSync(path.join(translationDir, 'log.txt'), JSON.stringify({ id, type, extra }));
    console.log("Received request:", { id, type, extra });

    let subtitles: Subtitle[] = [];
    try{
        const cached = await isCached(id)
        if (cached == undefined) {
            const subsData = await fetchSubtitles(id)

            const { data } = await axios.get(subsData.url, {
                responseType: 'arraybuffer',
                headers: {
                    'Content-Type': 'application/gzip',
                },
            });
            const buffer = Buffer.from(data, 'binary');
            let clearBuffer = zlib.unzipSync(buffer);
            if(subsData.fileType !== 'srt') {
                const converted = SubtitleConverter.convert(subsData.fileType, clearBuffer.toString());
                clearBuffer = Buffer.from(converted, 'utf-8');
            }
            if(subsData.lang !== 'tr')
                if (!await deepLTranslate(clearBuffer, id+'.srt', subsData.lang as SourceLanguageCode))
                    console.error("Failed to translate subtitle");
            if(subsData.lang === 'tr')
                fs.writeFileSync(path.join(translationDir,id+'.srt'),clearBuffer.toString());
            subtitles.push({
                id: subsData.id,
                url: URL+id+'.srt',
                lang: 'Türkçe',
            });
        }else{
            console.log("Returning cached subtitle");
            subtitles.push({
                id: '1337',
                url: URL+cached,
                lang: 'Türkçe',
            });
        }
    }catch(e){
        console.error(e);
    }
        console.log("Returning subtitles:", subtitles);
        return {subtitles};
});

console.log("Addon started");
const addonInterface = builder.getInterface();

const app = express();
const router = getRouter(addonInterface);
app.use(express.static(translationDir));
app.use('/',router);

app.listen(3535, () => {
    console.log("Addon listening on port 3535");
});