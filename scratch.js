const fetch = require('node-fetch');

async function searchWikimedia(query) {
    try {
        const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&piprop=original&origin=*`);
        const data = await res.json();
        if (!data.query || !data.query.pages) return null;
        const pages = data.query.pages;
        for (const pageId in pages) {
            if (pages[pageId].original && pages[pageId].original.source) {
                return pages[pageId].original.source;
            }
        }
        return null;
    } catch(e) {
        return null; 
    }
}

async function test() {
    console.log("Diabetes:", await searchWikimedia("Diabetes"));
    console.log("Diabetes treatment:", await searchWikimedia("Diabetes treatment"));
    console.log("Diabetes diet:", await searchWikimedia("Diabetes diet"));
}
test();
