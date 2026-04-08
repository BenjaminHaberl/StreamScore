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

function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    // 1. Knowledge Panel Title
    // Google frequently uses `data-attrid="title"` for knowledge panels
    const kPanelTitles = document.querySelectorAll('[data-attrid="title"] span[role="heading"], [data-attrid="title"]');
    
    kPanelTitles.forEach(el => {
      // Avoid processing the parent if we process the child, or vice versa. 
      // We'll target the innermost element that contains text.
      if (el.children.length === 0 || el.getAttribute('role') === 'heading') {
        processGoogleTitle(el);
      }
    });

    // We can also target other elements if needed, but the knowledge panel is the main goal for a movie search.
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initial run for already loaded elements
observeDOM();
