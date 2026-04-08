// background.js

// Emergency clear of the cache to wipe out 'Not found' from previous bugs
chrome.storage.local.clear(() => console.log("Cache cleared!"));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  if (request.action === "getMovieScore") {
    handleMovieScoreRequest(request.title, request.year)
      .then(data => {
         console.log("Background sending response data:", data);
         sendResponse(data);
      })
      .catch(error => {
        console.error("Error fetching movie score:", error);
        sendResponse({ error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true; 
  }
});

async function handleMovieScoreRequest(title, year) {
  // Use v2 to wipe out previous 'Not Found' bugs from the v1 cache schema
  const cacheKey = `movie_v2_${title.toLowerCase()}_${year || ''}`;
  
  // 1. Check Cache
  const cached = await new Promise((resolve) => {
    chrome.storage.local.get([cacheKey], (result) => {
      resolve(result[cacheKey]);
    });
  });

  if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) { // 7 days cache
    return cached.data;
  }

  // 2. Fetch API Key and Check for Lockout
  const { omdbApiKey, apiLockout } = await new Promise((resolve) => {
    chrome.storage.local.get(['omdbApiKey', 'apiLockout'], resolve);
  });

  if (!omdbApiKey) {
    throw new Error("OMDb API key is missing. Please set it in the extension popup.");
  }

  // If the API limit was reached, stop sending network requests to OMDb for 1 hour
  if (apiLockout && Date.now() < apiLockout) {
    throw new Error("OMDb API Rate Limit reached! Wait a while.");
  }

  // Phase 1: Exact Match lookup
  const exactUrl = new URL('https://www.omdbapi.com/');
  exactUrl.searchParams.append('apikey', omdbApiKey);
  exactUrl.searchParams.append('t', title);
  if (year) exactUrl.searchParams.append('y', year);

  let response = await fetch(exactUrl.toString());
  let data = await response.json();

  console.log("OMDb API exact search for", title, ":", data);

  // Phase 2: Fuzzy Search Fallback if exact title is Not Found 
  // (We skip this if the error is due to rate limits or API key limitations)
  if (data.Response === "False" && (!data.Error || (!data.Error.includes("API key") && !data.Error.includes("limit")))) {
    console.log("Exact match failed, attempting fuzzy search fallback...");
    const searchUrl = new URL('https://www.omdbapi.com/');
    searchUrl.searchParams.append('apikey', omdbApiKey);
    searchUrl.searchParams.append('s', title);
    if (year) searchUrl.searchParams.append('y', year);
    
    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();
    
    // Phase 3: Fetch full details using the best fuzzy match ID
    if (searchData.Response === "True" && searchData.Search && searchData.Search.length > 0) {
       for (let i = 0; i < Math.min(3, searchData.Search.length); i++) {
           const match = searchData.Search[i];
           // Ignore video games and podcast episodes
           if (match.Type !== "movie" && match.Type !== "series") continue;

           console.log(`Evaluating fuzzy match ${i+1}:`, match.Title);
           
           const idUrl = new URL('https://www.omdbapi.com/');
           idUrl.searchParams.append('apikey', omdbApiKey);
           idUrl.searchParams.append('i', match.imdbID);
           const idResponse = await fetch(idUrl.toString());
           const potentialData = await idResponse.json();
           
           let potentialRT = null;
           if (potentialData.Ratings) {
             const rtRating = potentialData.Ratings.find(r => r.Source === "Rotten Tomatoes");
             if (rtRating) potentialRT = rtRating.Value;
           }
           let potentialIMDB = potentialData.imdbRating && potentialData.imdbRating !== "N/A" ? potentialData.imdbRating : null;
           
           // If we found a result that actually HAS a rating, it's the blockbuster! Break early.
           if (potentialRT || potentialIMDB) {
               data = potentialData;
               console.log("Fuzzy search locked onto blockbuster match:", data.Title);
               break; 
           }
       }
    }
  }

  if (data.Response === "False") {
    if (data.Error && (data.Error.includes("API key") || data.Error.includes("limit"))) {
       // Burn the lockout timer for 1 hour so we don't spam OMDb
       chrome.storage.local.set({ apiLockout: Date.now() + 60 * 60 * 1000 });
       throw new Error("OMDb API error: " + data.Error);
    }
    const notFoundData = { rtScore: null, imdbScore: null, error: data.Error || "Not found" };
    chrome.storage.local.set({ [cacheKey]: { data: notFoundData, timestamp: Date.now() } });
    return notFoundData;
  }

  // Find RT score & IMDb score
  let rtScore = null;
  if (data.Ratings) {
    const rtRating = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
    if (rtRating) {
      rtScore = rtRating.Value; // e.g. "87%"
    }
  }
  
  let imdbScore = data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;

  const resultData = { rtScore, imdbScore };
  
  // 4. Save to Cache
  chrome.storage.local.set({ [cacheKey]: { data: resultData, timestamp: Date.now() } });

  return resultData;
}
