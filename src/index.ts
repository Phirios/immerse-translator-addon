import {addonBuilder, Manifest, Subtitle, getRouter} from "stremio-addon-sdk";
import {fetchSubtitles} from './getSubs'
import * as fs from "fs";
import path from "node:path";
import axios from "axios";
import express from "express";
import {deepLTranslate} from "./translateToTurkish";
import zlib from "node:zlib";

export const translationDir = path.join(__dirname, '..', 'data', 'translations');
export const subsDir = path.join(__dirname, '..', 'data', 'subs');
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

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ id,type,extra}):Promise<{subtitles:Subtitle[]}> => {
    fs.writeFileSync(path.join(translationDir, 'log.txt'), JSON.stringify({ id, type, extra }));
    console.log("Received request:", { id, type, extra });

    let subtitles: Subtitle[] = [];
    try{
        if (!fs.existsSync(path.join(translationDir, `${id}.srt`))) {
            const subsData = await fetchSubtitles(id)
            const { data } = await axios.get(subsData.url, {
                responseType: 'arraybuffer',
                headers: {
                    'Content-Type': 'application/gzip',
                },
            });
            const buffer = Buffer.from(data, 'binary');
            const unzipped = zlib.unzipSync(buffer);

            if (await deepLTranslate(unzipped, `${id}.srt`))
                subtitles.push({
                    id: subsData.id,
                    url: `https://subs.phirios.com/${id}.srt`,
                    lang: 'Türkçe',
                });
        }else{
            console.log("Returning cached subtitle");
            subtitles.push({
                id: '1337',
                url: `https://subs.phirios.com/${id}.srt`,
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

//TODO learn a way to use .env files in nodejs
