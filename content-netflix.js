// content-netflix.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(scores) {
  const badge = document.createElement('rt-badge');
  badge.classList.add('rt-helper-badge', 'netflix-context');

  if (!scores || (!scores.rtScore && !scores.imdbScore && !scores.tmdbScore)) {
    let errorText = 'N/A';
    if (scores && scores.error) {
       const errLower = scores.error.toLowerCase();
       if (errLower.includes('not found')) {
          errorText = 'N/A';
       } else if (errLower.includes('limit')) {
          errorText = 'Limit';
       } else if (errLower.includes('api key')) {
          errorText = 'API Key';
       } else {
          errorText = 'Err';
       }
    }
    badge.textContent = errorText;
    badge.style.background = 'rgba(100, 100, 100, 0.8)';
    return badge;
  }

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

function processNetflixTitle(element, titleText, injectTarget) {
  if (!titleText) return;

  if (element.getAttribute(PROCESSED_ATTR) === titleText) return;
  element.setAttribute(PROCESSED_ATTR, titleText);

  chrome.runtime.sendMessage(
    { action: 'getMovieScore', title: titleText },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("RT Helper extension error:", chrome.runtime.lastError);
        return;
      }

      if (response) {
        // Create custom badge element
        const badge = createBadge(response);
        if (!badge) return; // Safely abort if the API returned null (e.g. rate limit error)

        badge.style.zIndex = '9999';
        badge.style.position = 'relative';
        badge.style.marginLeft = '12px';
        badge.style.fontSize = '1.2rem';
        
        const oldBadge = injectTarget.nextElementSibling;
        if (oldBadge && oldBadge.classList.contains('rt-helper-badge')) {
           oldBadge.remove();
        }

        injectTarget.insertAdjacentElement('afterend', badge);
      }
    }
  );
}

function scanNetflixDOM() {
  console.log("RT Helper: Scanning Netflix DOM...");

  const modalLogos = document.querySelectorAll('.previewModal--player-titleTreatment-logo');
  modalLogos.forEach(logo => {
    const title = logo.getAttribute('alt');
    const parent = logo.closest('.previewModal--player-titleTreatment-left') || logo.parentNode;
    processNetflixTitle(logo, title, parent);
  });

  const jawboneLogos = document.querySelectorAll('.jawBoneContainer .logo');
  jawboneLogos.forEach(logo => {
    const title = logo.getAttribute('alt');
    const parent = logo.parentNode;
    processNetflixTitle(logo, title, parent);
  });

  const textTitles = document.querySelectorAll('h1.title-title, .about-header h1');
  textTitles.forEach(titleElement => {
    const title = titleElement.textContent.trim();
    processNetflixTitle(titleElement, title, titleElement);
  });
}

function observeNetflixDOM() {
  const observer = new MutationObserver(() => {
    scanNetflixDOM();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

// Initial run
chrome.storage.local.get(['enableNetflix'], (result) => {
   if (result.enableNetflix !== false) {
       scanNetflixDOM();
       observeNetflixDOM();
   } else {
       console.log("RT Helper: Netflix integration disabled by user.");
   }
});
