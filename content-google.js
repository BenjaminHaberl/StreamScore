// content-google.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(score) {
  const badge = document.createElement('span');
  badge.classList.add('rt-helper-badge');

  if (!score) {
    badge.textContent = 'N/A';
    return badge;
  }

  // Parse the percentage to determine the color
  const percentage = parseInt(score.replace('%', ''), 10);
  
  if (!isNaN(percentage)) {
    if (percentage >= 60) {
      badge.classList.add('rt-fresh');
      badge.innerHTML = `<span class="rt-icon">🍅</span> ${score}`;
    } else {
      badge.classList.add('rt-rotten');
      badge.innerHTML = `<span class="rt-icon">🤢</span> ${score}`; // Placeholder splat
    }
  } else {
    badge.textContent = score;
  }

  return badge;
}

function processGoogleTitle(titleElement) {
  if (titleElement.getAttribute(PROCESSED_ATTR)) {
    return;
  }
  
  titleElement.setAttribute(PROCESSED_ATTR, 'true');

  const titleText = titleElement.textContent.trim();
  if (!titleText) return;

  chrome.runtime.sendMessage(
    { action: 'getMovieScore', title: titleText },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("RT Helper extension error:", chrome.runtime.lastError);
        return;
      }

      if (response && response.rtScore) {
        const badge = createBadge(response.rtScore);
        
        // Find a good place to inject. For Google knowledge panel, appending it to the title works well.
        titleElement.appendChild(badge);
      }
    }
  );
}

function scanGoogleDOM() {
  console.log("RT Helper: Scanning Google DOM...");
  
  // 1. Knowledge Panel Title
  const kPanelTitles = document.querySelectorAll('[data-attrid="title"] span[role="heading"], [data-attrid="title"]');
  kPanelTitles.forEach(el => {
    if (el.children.length === 0 || el.getAttribute('role') === 'heading') {
      console.log("RT Helper: Found Knowledge Panel title:", el.textContent.trim());
      processGoogleTitle(el);
    }
  });

  // 2. Standard Search Results (h3 usually holds the title)
  const standardResults = document.querySelectorAll('h3:not([' + PROCESSED_ATTR + '])');
  standardResults.forEach(el => {
    // Check if the h3 has text and is likely a search result
    if (el.textContent.trim().length > 0) {
       console.log("RT Helper: Found Standard Search title:", el.textContent.trim());
       processGoogleTitle(el);
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
