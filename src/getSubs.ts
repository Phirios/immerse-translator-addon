import axios, {AxiosResponse} from "axios";
import handleFetch from "./handleFetch";
import {configDotenv} from "dotenv";
import path from "node:path";


configDotenv({path: path.join(__dirname, '..', '.env')});

const apiKey = process.env.TMDB_API_KEY;

export const fetchSubtitles = async (id:string,language?:string):Promise<{id:string,url:string,lang:string}> => {
    let openSubsJson;

    if(id.startsWith('tt')) {
        id = id.replace('tt', '');
        const [code, seasonEp, episode] = id.split(':');
        openSubsJson = await getSubtitlesFromOpensubs({imdbid: code});

        if(seasonEp !== undefined) {
            if (episode !== undefined) {
                openSubsJson = openSubsJson.filter((sub: any) => sub.SeriesSeason === seasonEp && sub.SeriesEpisode === episode)
            } else {
                openSubsJson = openSubsJson.filter((sub: any) => sub.SeriesSeason === '1' && sub.SeriesEpisode === seasonEp)
            }
        }

        let sub = getBestSub(openSubsJson);
        console.log(sub)
        return {
            id: sub.IDSubtitle,
            url: sub.SubDownloadLink,
            lang: sub.ISO639,
        }
    }
    if(id.startsWith('kitsu')) {
        id = id.replace('kitsu:', '');

        const [code, seasonEp, episode] = id.split(':');
        let kitsuInfo = await getAnimeInfoFromKitsu(code);
        let openSubsJson = await getSubtitlesFromOpensubs({query:kitsuInfo.title});
        const imdbUnique = new Set<string>
        openSubsJson.forEach((sub:any) => {
            if(imdbUnique.has(sub.SeriesIMDBParent))
                return;
            imdbUnique.add(sub.SeriesIMDBParent);
        })
        for (const imdbId of imdbUnique) {
            let TMDBName = await getNameFromTMDB(imdbId)
            if(TMDBName === kitsuInfo.title_jp){
                openSubsJson = openSubsJson.filter((sub:any) => sub.SeriesIMDBParent === imdbId);
            }
        }
        if(id.includes(':')){
            openSubsJson = openSubsJson.filter((sub:any) => {
                    if(episode !== undefined) {
                        return sub.SeriesSeason === seasonEp && sub.SeriesEpisode === episode
                    }else{
                        return sub.SeriesSeason === '1' && sub.SeriesEpisode === seasonEp
                    }
                }
            )
        }
        let sub = getBestSub(openSubsJson);

        return {
            id: sub.IDSubtitle,
            url: sub.SubDownloadLink,
            lang: sub.ISO639,
        }
    }
    return {
        id: '',
        url: '',
        lang: '',
    }
};

async function getNameFromTMDB(imdbid:string){
    let resFetch = await handleFetch({
        url:`https://api.themoviedb.org/3/find/tt${imdbid}?external_source=imdb_id`,
        options:{
        headers: {
            Authorization: `Bearer ${apiKey}`,
            accept: 'application/json',
        }},
        fetchOption:'axios'})
    if(resFetch.error){
        console.error(resFetch.error)
        return;
    }
    let res = resFetch.res as AxiosResponse<any, any>
    let data = await res.data;
    return data.tv_results.length > 0?data.tv_results[0].original_name:data.movie_results.length?data.movie_results[0].original_title:'';
}

async function getSubtitlesFromOpensubs({imdbid,query,language}:{imdbid?:string,query?:string,language?:string}){
    let baseUrl = 'https://rest.opensubtitles.org/search/';
    const options = {
        headers: {
            'User-Agent': 'TemporaryUserAgent',
        },
    }

    if(imdbid){
            baseUrl += `imdbid-${imdbid}/sublanguageid-${language?language:'eng'}`;
    }
    if(query){
        baseUrl += `query-${encodeURIComponent(query.toLocaleLowerCase())}/sublanguageid-${language?language:'eng'}`;
    }
    let resFetch = await handleFetch({url:baseUrl,options:options,fetchOption:'axios'})
    if(resFetch.error){
        console.error(resFetch.error)
        return;
    }
    let res = resFetch.res as AxiosResponse<any, any>
    return await res.data;
}

async function getAnimeInfoFromKitsu(kitsuId:string):Promise<{ title: string, title_jp: string, start: string }>{
    console.log(kitsuId === '48239')
        let resFetch = await handleFetch({url:`https://kitsu.app/api/edge/anime/${kitsuId}`,fetchOption:'fetch'})
        if(resFetch.error){
            console.error(resFetch.error)
            return{
                title: '',
                title_jp: '',
                start: '',
            }
        }
    let res = resFetch.res as Response;
    if(!res.ok){
        throw new Error(`Failed to fetch anime info: ${res.statusText}`)
    }

    let kitsuData = await res.json();
    return {
        title: kitsuData.data.attributes.titles.en,
        title_jp: kitsuData.data.attributes.titles.ja_jp,
        start: kitsuData.data.attributes.startDate,
    }
}

function getBestSub(subs:any){
    if (!subs) {
        console.log('No subtitles found');
        return [];
    }
    console.log('Subtitles found:', subs.length);
    return subs.reduce((prev:any, current:any) => (current.Score > (prev?.Score ?? -Infinity) ? current : prev), null);
}

fetchSubtitles('tt14230458').then(console.log)