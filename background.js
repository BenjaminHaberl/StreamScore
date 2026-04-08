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

  if (cached && (Date.now() - cached.timestamp < 365 * 24 * 60 * 60 * 1000)) { // 365 days cache
    return cached.data;
  }

  // 2. Fetch Keys securely from local storage and decrypt them
  const { omdbApiKeyRaw, tmdbApiKeyRaw } = await new Promise((resolve) => {
    chrome.storage.local.get(['omdbApiKey', 'tmdbApiKey'], (res) => {
       resolve({ omdbApiKeyRaw: res.omdbApiKey, tmdbApiKeyRaw: res.tmdbApiKey });
    });
  });
  
  const { apiLockout } = await new Promise((resolve) => {
    chrome.storage.local.get(['apiLockout'], resolve);
  });

  let omdbApiKey = '';
  let tmdbApiKey = '';
  try {
     if (omdbApiKeyRaw) omdbApiKey = atob(omdbApiKeyRaw);
     if (tmdbApiKeyRaw) tmdbApiKey = atob(tmdbApiKeyRaw);
  } catch(e) { console.warn("Failed to decrypt keys"); }

  if (!omdbApiKey && !tmdbApiKey) {
    throw new Error("API keys are missing. Please set them in the extension popup.");
  }

  async function fetchFromTMDb() {
      if (!tmdbApiKey) return null;
      console.log("Using TMDb Fallback for:", title);
      const tmdbUrl = new URL('https://api.themoviedb.org/3/search/multi');
      tmdbUrl.searchParams.append('api_key', tmdbApiKey);
      tmdbUrl.searchParams.append('query', title);
      if (year) tmdbUrl.searchParams.append('year', year);

      const tmdbRes = await fetch(tmdbUrl.toString());
      const tmdbData = await tmdbRes.json();
      
      if (tmdbData.results && tmdbData.results.length > 0) {
          const bestMatch = tmdbData.results.find(r => r.media_type === 'movie' || r.media_type === 'tv') || tmdbData.results[0];
          if (bestMatch.vote_average && bestMatch.vote_count > 0) {
              let tmdbScoreStr = bestMatch.vote_average.toFixed(1);
              const tmdbResultData = { rtScore: null, imdbScore: null, tmdbScore: tmdbScoreStr };
              chrome.storage.local.set({ [cacheKey]: { data: tmdbResultData, timestamp: Date.now() } });
              return tmdbResultData;
          }
      }
      return null;
  }

  // If the API limit/key was broken recently, bypass OMDb directly to TMDb
  if (apiLockout && Date.now() < apiLockout) {
    if (tmdbApiKey) {
       const res = await fetchFromTMDb();
       if (res) return res;
       const notFoundData = { rtScore: null, imdbScore: null, tmdbScore: null, error: "Not found" };
       chrome.storage.local.set({ [cacheKey]: { data: notFoundData, timestamp: Date.now() } });
       return notFoundData;
    }
    throw new Error("OMDb API Rate Limit reached! Wait a while.");
  }

  const checkApiLimitException = (responseData) => {
      if (responseData && responseData.Response === "False" && responseData.Error) {
          if (responseData.Error.toLowerCase().includes("limit") || responseData.Error.toLowerCase().includes("api key")) {
              chrome.storage.local.set({ apiLockout: Date.now() + 60 * 60 * 1000 });
              throw new Error("OMDb API Error: " + responseData.Error);
          }
      }
  };

  let data;
  if (!omdbApiKey) {
     const res = await fetchFromTMDb();
     if (res) return res;
     const notFoundData = { rtScore: null, imdbScore: null, tmdbScore: null, error: "Not found" };
     chrome.storage.local.set({ [cacheKey]: { data: notFoundData, timestamp: Date.now() } });
     return notFoundData;
  }

  try {
      // Phase 1: Exact Match lookup
      const exactUrl = new URL('https://www.omdbapi.com/');
      exactUrl.searchParams.append('apikey', omdbApiKey);
      exactUrl.searchParams.append('t', title);
      if (year) exactUrl.searchParams.append('y', year);

      let response = await fetch(exactUrl.toString());
      data = await response.json();
      checkApiLimitException(data);

      console.log("OMDb API exact search for", title, ":", data);

      // Phase 2: Fuzzy Search Fallback if exact title is Not Found 
      if (data.Response === "False") {
        console.log("Exact match failed, attempting fuzzy search fallback...");
        const searchUrl = new URL('https://www.omdbapi.com/');
        searchUrl.searchParams.append('apikey', omdbApiKey);
        searchUrl.searchParams.append('s', title);
        if (year) searchUrl.searchParams.append('y', year);
        
        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();
        checkApiLimitException(searchData);
        
        // Phase 3: Fetch full details using the best fuzzy match ID
        if (searchData.Response === "True" && searchData.Search && searchData.Search.length > 0) {
           for (let i = 0; i < Math.min(3, searchData.Search.length); i++) {
               const match = searchData.Search[i];
               if (match.Type !== "movie" && match.Type !== "series") continue;

               console.log(`Evaluating fuzzy match ${i+1}:`, match.Title);
               
               const idUrl = new URL('https://www.omdbapi.com/');
               idUrl.searchParams.append('apikey', omdbApiKey);
               idUrl.searchParams.append('i', match.imdbID);
               const idResponse = await fetch(idUrl.toString());
               const potentialData = await idResponse.json();
               checkApiLimitException(potentialData);
               
               let potentialRT = null;
               if (potentialData.Ratings) {
                 const rtRating = potentialData.Ratings.find(r => r.Source === "Rotten Tomatoes");
                 if (rtRating) potentialRT = rtRating.Value;
               }
               let potentialIMDB = potentialData.imdbRating && potentialData.imdbRating !== "N/A" ? potentialData.imdbRating : null;
               
               if (potentialRT || potentialIMDB) {
                   data = potentialData;
                   console.log("Fuzzy search locked onto blockbuster match:", data.Title);
                   break; 
               }
           }
        }
      }
  } catch (apiError) {
      if (tmdbApiKey) {
         console.warn("OMDb structurally failed. Instantly dropping to TMDb Fallback!", apiError.message);
         const res = await fetchFromTMDb();
         if (res) return res;
      } else {
         throw apiError;
      }
  }

  if (data && data.Response === "False") {
    checkApiLimitException(data);
    const notFoundData = { rtScore: null, imdbScore: null, error: data.Error || "Not found" };
    chrome.storage.local.set({ [cacheKey]: { data: notFoundData, timestamp: Date.now() } });
    return notFoundData;
  }

  // Find RT score & IMDb score
  let rtScore = null;
  if (data && data.Ratings) {
    const rtRating = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
    if (rtRating) {
      rtScore = rtRating.Value; // e.g. "87%"
    }
  }
  
  let imdbScore = data && data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;

  const resultData = { rtScore, imdbScore };
  
  // 4. Save to Cache
  chrome.storage.local.set({
    [cacheKey]: { data: resultData, timestamp: Date.now() }
  });

  return resultData;
}
