import axios, {AxiosResponse} from "axios";

export default async function handleFetch({url,options,fetchOption,count}:{url:string,options?:any,fetchOption?:'axios'| 'fetch',count ? : number}):Promise<{res:undefined,error: any}|{res:Response | AxiosResponse<any, any>,error:undefined}> {

    try {
        const res = fetchOption === 'axios' ? await axios.get(url, options) : await fetch(url, options)
        if (res.status === 200) {
            return({ res: res, error: undefined })
        }
    } catch {
        if (count && count > 5) {
            return({ res:undefined, error: { message: "Failed to fetch data" } })
        }
        console.log("Retrying fetch")
        const res = await handleFetch({url:url,options: options, count:count ? count + 1 : 1})
        if (res.error) {
            return({ res:undefined, error: { message: "Failed to fetch data" } })
        }
        return res
    }
    return({ res:undefined, error: { message: "Failed to fetch data" } })
}