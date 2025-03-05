

export default async function fetchHolySubs(){
    const res = await fetch('https://holysubs.org/anime/frieren-beyond-journeys-end/__data.json?x-sveltekit-invalidated=01')
    const data = await res.json()
    console.log(JSON.stringify(data, null, 2))
}
fetchHolySubs()