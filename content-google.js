// content-google.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(scores) {
  if (!scores || (!scores.rtScore && !scores.imdbScore && !scores.tmdbScore)) {
    // For Google searches, we silently skip rendering N/A or Err 
    // since the vast majority of query results are not actually movies!
    return null;
  }

  // Use a custom HTML tag to completely immune the badge from Google's global span CSS selectors
  const badge = document.createElement('rt-badge');
  badge.classList.add('rt-helper-badge', 'google-context');

  if (scores.rtScore) {
    const percentage = parseInt(scores.rtScore.replace('%', ''), 10);
    if (!isNaN(percentage)) {
      if (percentage >= 60) {
        badge.classList.add('rt-fresh');
        badge.innerHTML = `<span class="rt-icon">🍅</span> ${scores.rtScore}`;
      } else {
        badge.classList.add('rt-rotten');
        badge.innerHTML = `<span class="rt-icon">🤢</span> ${scores.rtScore}`;
      }
    } else {
      badge.textContent = scores.rtScore;
    }
  } else if (scores.imdbScore) {
    badge.classList.add('rt-imdb');
    badge.innerHTML = `<span class="rt-icon">⭐</span> ${scores.imdbScore}`;
  } else if (scores.tmdbScore) {
    badge.classList.add('rt-tmdb');
    badge.innerHTML = `<span class="rt-icon">📊</span> ${scores.tmdbScore}`;
  }

  return badge;
}

function processGoogleTitle(titleElement, providedTitleText) {
  const titleText = providedTitleText || titleElement.textContent.trim();
  if (!titleText) return;

  // Prevent repeated background fetches if Google reuses the DOM node without changing the text
  if (titleElement.getAttribute(PROCESSED_ATTR) === titleText) {
    return;
  }
  titleElement.setAttribute(PROCESSED_ATTR, titleText);

  console.log("RT Helper: Sending message to background for:", titleText);

  chrome.runtime.sendMessage(
    { action: 'getMovieScore', title: titleText },
    (response) => {
      console.log("RT Helper: Background response received:", response);

      if (chrome.runtime.lastError) {
        console.error("RT Helper extension error:", chrome.runtime.lastError.message || chrome.runtime.lastError);
        return;
      }

      if (response) {
        const badge = createBadge(response);
        if (badge) {
          badge.style.display = 'inline-flex';
          titleElement.appendChild(badge);
        }
      } else {
        console.warn("RT Helper: Valid response but no score found", response);
      }
    }
  );
}

function scanGoogleDOM() {
  const searchResults = document.querySelectorAll('h3');

  searchResults.forEach((titleElement) => {
    // Avoid infinite loops by stripping out any text from our own injected badges!
    let titleText = "";
    titleElement.childNodes.forEach(child => {
       if (child.nodeName && child.nodeName.toLowerCase() !== 'rt-badge') {
           titleText += child.textContent;
       }
    });
    
    // Clean up junk from common Google Search results
    let title = titleText.replace(/\s*-\s*(Wikipedia|IMDb|YouTube|Google Search|Rotten Tomatoes)/ig, '').trim();
    if (title && title.length > 0) {
      processGoogleTitle(titleElement, title);
    }
  });

  // Google constantly A/B tests its Knowledge Panel structure (often switching between h2 and div)
  const knowledgePanels = document.querySelectorAll('h2[data-attrid="title"], div[data-attrid="title"]');
  knowledgePanels.forEach(panel => {
      let titleText = "";
      panel.childNodes.forEach(child => {
         if (child.nodeName && child.nodeName.toLowerCase() !== 'rt-badge') {
             titleText += child.textContent;
         }
      });
      const title = titleText.trim();
      if (title && title.length > 0) {
         processGoogleTitle(panel, title);
      }
  });
}

function observeDOM() {
  const observer = new MutationObserver(() => {
    scanGoogleDOM();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initial run for already loaded elements
scanGoogleDOM();
observeDOM();
