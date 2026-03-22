import axios from 'axios';

export interface SubtitleResult {
  id: string;
  fileName: string;
  lang: string;
  format: string;
  downloadUrl: string;
  downloadCount: number;
  score: number;
  hearingImpaired: boolean;
  movieName: string;
  movieYear: string;
  season?: string;
  episode?: string;
  imdbId: string;
}

interface SearchParams {
  imdbid: string;
  lang?: string;
  season?: string;
  episode?: string;
}

export async function fetchFromSubtitleService(
  serviceUrl: string,
  params: SearchParams,
): Promise<SubtitleResult[]> {
  const queryParams = new URLSearchParams();
  queryParams.set('imdbid', params.imdbid);
  if (params.lang) queryParams.set('lang', params.lang);
  if (params.season) queryParams.set('season', params.season);
  if (params.episode) queryParams.set('episode', params.episode);

  const res = await axios.get(`${serviceUrl}/search?${queryParams.toString()}`, {
    timeout: 15000,
  });

  return res.data;
}
