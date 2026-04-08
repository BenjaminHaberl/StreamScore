// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMovieScore") {
    handleMovieScoreRequest(request.title, request.year)
      .then(data => sendResponse(data))
      .catch(error => {
        console.error("Error fetching movie score:", error);
        sendResponse({ error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true; 
  }
});

async function handleMovieScoreRequest(title, year) {
  const cacheKey = `movie_${title.toLowerCase()}_${year || ''}`;
  
  // 1. Check Cache
  const cached = await new Promise((resolve) => {
    chrome.storage.local.get([cacheKey], (result) => {
      resolve(result[cacheKey]);
    });
  });

  if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) { // 7 days cache
    return cached.data;
  }

  // 2. Fetch API Key
  const { omdbApiKey } = await new Promise((resolve) => {
    chrome.storage.local.get(['omdbApiKey'], resolve);
  });

  if (!omdbApiKey) {
    throw new Error("OMDb API key is missing. Please set it in the extension popup.");
  }

  // 3. Fetch from OMDb
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.append('apikey', omdbApiKey);
  url.searchParams.append('t', title);
  if (year) {
    url.searchParams.append('y', year);
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.Response === "False") {
    // Cache the not-found to prevent hammering the API for bad titles
    const notFoundData = { rtScore: null, error: "Not found" };
    chrome.storage.local.set({
      [cacheKey]: { data: notFoundData, timestamp: Date.now() }
    });
    return notFoundData;
  }

  // Find RT score
  let rtScore = null;
  if (data.Ratings) {
    const rtRating = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
    if (rtRating) {
      rtScore = rtRating.Value; // e.g. "87%"
    }
  }

  const resultData = { rtScore: rtScore };
  
  // 4. Save to Cache
  chrome.storage.local.set({
    [cacheKey]: { data: resultData, timestamp: Date.now() }
  });

  return resultData;
}
