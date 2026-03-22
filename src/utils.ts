export function parseStremioId(id: string): {
  imdbId: string | null;
  season: string | undefined;
  episode: string | undefined;
} {
  // Stremio sends IDs like:
  // Movie: tt1234567
  // Series: tt1234567:1:5 (season 1, episode 5)
  // Kitsu: kitsu:12345 or kitsu:12345:1:5

  if (id.startsWith('tt')) {
    const parts = id.split(':');
    const imdbId = parts[0].replace(/^tt/, '');
    return {
      imdbId,
      season: parts[1] || undefined,
      episode: parts[2] || undefined,
    };
  }

  // kitsu IDs not supported in this version (would need TMDB lookup)
  return { imdbId: null, season: undefined, episode: undefined };
}

export const LANG_NAMES: Record<string, string> = {
  tur: 'Türkçe',
  eng: 'English',
  ger: 'Deutsch',
  fre: 'Français',
  spa: 'Español',
  ita: 'Italiano',
  por: 'Português',
  rus: 'Русский',
  pol: 'Polski',
  dut: 'Nederlands',
  swe: 'Svenska',
  nor: 'Norsk',
  fin: 'Suomi',
  dan: 'Dansk',
  cze: 'Čeština',
  hun: 'Magyar',
  rum: 'Română',
  bul: 'Български',
  ukr: 'Українська',
  ara: 'العربية',
  chi: '中文',
  jpn: '日本語',
  kor: '한국어',
  gre: 'Ελληνικά',
  hrv: 'Hrvatski',
};
