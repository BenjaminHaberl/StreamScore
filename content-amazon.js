// content-amazon.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(score) {
  const badge = document.createElement('span');
  badge.classList.add('rt-helper-badge', 'amazon-context');

  if (!score) {
    badge.textContent = 'N/A';
    return badge;
  }

  const percentage = parseInt(score.replace('%', ''), 10);
  if (!isNaN(percentage)) {
    if (percentage >= 60) {
      badge.classList.add('rt-fresh');
      badge.innerHTML = `<span class="rt-icon">🍅</span> ${score}`;
    } else {
      badge.classList.add('rt-rotten');
      badge.innerHTML = `<span class="rt-icon">🤢</span> ${score}`;
    }
  } else {
    badge.textContent = score;
  }

  return badge;
}

function processAmazonTitle(element, titleText, injectTarget) {
  if (element.getAttribute(PROCESSED_ATTR)) return;
  element.setAttribute(PROCESSED_ATTR, 'true');

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
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.marginLeft = '12px';
        badge.style.verticalAlign = 'middle';
        
        injectTarget.appendChild(badge);
      }
    }
  );
}

function scanAmazonDOM() {
  console.log("RT Helper: Scanning Amazon DOM...");

  // 1. Prime Video Main Details Page Title
  const detailTitles = document.querySelectorAll('h1[data-automation-id="title"]:not([' + PROCESSED_ATTR + '])');
  detailTitles.forEach(titleElement => {
    const title = titleElement.textContent.trim();
    processAmazonTitle(titleElement, title, titleElement);
  });

  // 2. Mini Details Modal (when hovering over a thumbnail)
  const miniModalTitles = document.querySelectorAll('.tst-mini-details-title:not([' + PROCESSED_ATTR + ']), [data-automation-id="mini-details-title"]:not([' + PROCESSED_ATTR + '])');
  miniModalTitles.forEach(titleElement => {
    const title = titleElement.textContent.trim();
    processAmazonTitle(titleElement, title, titleElement);
  });

  // 3. Fallback for Hero banners
  const heroTitles = document.querySelectorAll('.tst-hero-title:not([' + PROCESSED_ATTR + '])');
  heroTitles.forEach(titleElement => {
     const title = titleElement.textContent.trim();
     processAmazonTitle(titleElement, title, titleElement);
  });
}

function observeAmazonDOM() {
  const observer = new MutationObserver(() => {
    scanAmazonDOM();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

// Initial run
scanAmazonDOM();
observeAmazonDOM();
