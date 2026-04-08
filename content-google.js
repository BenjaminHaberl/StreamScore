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
  const titleText = titleElement.textContent.trim();
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

      if (response && response.rtScore) {
        console.log("RT Helper: Creating badge for score", response.rtScore);
        const badge = createBadge(response.rtScore);
        
        // Remove old badge if it exists from recycling
        const oldBadge = titleElement.nextElementSibling;
        if (oldBadge && oldBadge.classList.contains('rt-helper-badge')) {
           oldBadge.remove();
        }
        
        titleElement.insertAdjacentElement('afterend', badge);
      } else {
        console.warn("RT Helper: Valid response but no score found", response);
      }
    }
  );
}

function scanGoogleDOM() {
  console.log("RT Helper: Scanning Google DOM...");
  
  // 1. Knowledge Panel Title
  const kPanelTitles = document.querySelectorAll(`[data-attrid="title"] span[role="heading"], [data-attrid="title"]`);
  kPanelTitles.forEach(el => {
    if (el.children.length === 0 || el.getAttribute('role') === 'heading') {
      processGoogleTitle(el);
    }
  });

  // 2. Standard Search Results (h3 usually holds the title)
  const standardResults = document.querySelectorAll('h3');
  standardResults.forEach(el => {
    // Check if the h3 has text and is likely a search result
    if (el.textContent.trim().length > 0) {
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
