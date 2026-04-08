// content-amazon.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(score) {
  const badge = document.createElement('rt-badge');
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
  if (!titleText) return;
  
  // Clean up Amazon titles if they have extra text like "Watch " or " - Season 1"
  let cleanTitle = titleText.replace(/^Watch\s+/i, '').replace(/\s+-\s+Season\s+\d+/i, '').trim();

  if (element.getAttribute(PROCESSED_ATTR) === cleanTitle) return;
  element.setAttribute(PROCESSED_ATTR, cleanTitle);

  chrome.runtime.sendMessage(
    { action: 'getMovieScore', title: cleanTitle },
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
        
        const oldBadge = injectTarget.nextElementSibling;
        if (oldBadge && oldBadge.classList.contains('rt-helper-badge')) {
           oldBadge.remove();
        }

        injectTarget.insertAdjacentElement('afterend', badge);
      }
    }
  );
}

function extractTextOrImageAlt(el) {
  if (!el) return null;
  if (el.tagName === 'IMG') return el.getAttribute('alt');
  
  let text = el.textContent.trim();
  if (text.length > 1) return text;

  const img = el.querySelector('img');
  if (img && img.getAttribute('alt')) return img.getAttribute('alt').trim();

  return el.getAttribute('aria-label') || null;
}

function scanAmazonDOM() {
  console.log("RT Helper: Scanning Amazon DOM...");

  // Broad selectors for main detail page, including logo images
  const detailTitles = document.querySelectorAll(
    'h1, [data-automation-id="title"], [data-testid="title"], .DVWebNode-detail-atf-wrapper h1, img.av-fallback-logo, .av-detail-title, [class*="titleLogo"] img, img[data-automation-id="title-logo"]'
  );
  
  detailTitles.forEach(titleElement => {
    const title = extractTextOrImageAlt(titleElement);
    if (title && title.length > 1) {
      // Find a safe parent to append next to if it's an image
      const injectTarget = titleElement.tagName === 'IMG' ? titleElement.parentElement : titleElement;
      processAmazonTitle(titleElement, title, injectTarget);
    }
  });

  // Modal / Hover selectors
  const miniModalTitles = document.querySelectorAll(
    '.tst-mini-details-title, [data-automation-id="mini-details-title"], .tst-title, .tst-title-text, a[data-testid="title-link"], .tst-hover-title'
  );
  
  miniModalTitles.forEach(titleElement => {
    const title = extractTextOrImageAlt(titleElement);
    if (title && title.length > 1) {
      processAmazonTitle(titleElement, title, titleElement);
    }
  });
  const heroTitles = document.querySelectorAll('.tst-hero-title');
  heroTitles.forEach(titleElement => {
     const title = extractTextOrImageAlt(titleElement);
     if (title && title.length > 1) {
       processAmazonTitle(titleElement, title, titleElement);
     }
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
