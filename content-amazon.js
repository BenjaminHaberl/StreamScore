// content-amazon.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(scores) {
  const badge = document.createElement('rt-badge');
  badge.classList.add('rt-helper-badge', 'amazon-context');

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

function processAmazonTitle(element, titleText, injectTarget, isCard = false) {
  if (!titleText) return;
  
  let cleanTitle = titleText
    .replace(/^(Watch |Ansehen )/i, '') // Remove prefix
    .replace(/[-,\s\(]*(Season|Staffel|Part|Teil)\s*\d+[\)]*/i, '') // Rip off Seasons, Staffels, Parts (e.g., "- Season 9", ", Staffel 9")
    .replace(/\[.*?\]/g, '') // Strip anything in square brackets like [dt./OV]
    .replace(/\((OV|OmU|dt.*?|4K UHD|UHD|4K)\)/ig, '') // Strip common Amazon German bracket tags
    .replace(/\s{2,}/g, ' ') // Clean up double spaces caused by replacements
    .trim();

  if (element.getAttribute(PROCESSED_ATTR) === cleanTitle) return;
  element.setAttribute(PROCESSED_ATTR, cleanTitle);
  
  // Aggressively deduplicate inline badges in the same visual area
  if (!isCard) {
     let curr = injectTarget;
     let foundExisting = false;
     for (let i = 0; i < 4; i++) {
        if (!curr) break;
        if (curr.querySelector('rt-badge.rt-helper-badge')) {
           foundExisting = true;
           break;
        }
        curr = curr.parentElement;
     }
     if (foundExisting) return;
  }

  chrome.runtime.sendMessage(
    { action: 'getMovieScore', title: cleanTitle },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("RT Helper extension error:", chrome.runtime.lastError);
        return;
      }

      if (response) {
        const badge = createBadge(response);
        if (!badge) return; // Safely abort without crashing if the API was rate limited
        
        if (isCard) {
          badge.style.position = 'absolute';
          badge.style.top = '6px';
          badge.style.right = '6px';
          badge.style.zIndex = '99';
          badge.style.margin = '0';
        } else {
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.marginLeft = '12px';
          badge.style.verticalAlign = 'middle';
          badge.style.position = 'relative';
          // Prevent flex containers from horribly stretching the badge into a giant block!
          badge.style.alignSelf = 'flex-start';
          badge.style.justifySelf = 'flex-start';
          badge.style.flexShrink = '0';
          badge.style.width = 'max-content';
          badge.style.maxWidth = 'max-content';
        }
        
        const oldBadge = isCard ? injectTarget.querySelector('rt-badge.rt-helper-badge') : injectTarget.nextElementSibling;
        if (oldBadge && oldBadge.classList.contains('rt-helper-badge')) {
           oldBadge.remove();
        }

        if (isCard) {
          injectTarget.appendChild(badge);
        } else {
          injectTarget.insertAdjacentElement('afterend', badge);
        }
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
      processAmazonTitle(titleElement, title, injectTarget, false);
    }
  });

  // Movie Thumbnail Cards (Home page grids, carousels)
  const movieCards = document.querySelectorAll('article[data-testid="card"]');
  movieCards.forEach(card => {
    let title = card.getAttribute('data-card-title');
    if (!title) {
        const btn = card.querySelector('button[aria-label]');
        if (btn) title = btn.getAttribute('aria-label');
    }
    if (!title) {
        const img = card.querySelector('img[alt]');
        if (img) title = img.getAttribute('alt');
    }
    if (!title) {
        const link = card.querySelector('a.detailLink-zyfcZQ, a[tabindex="-1"], a');
        if (link && link.textContent) title = link.textContent.trim();
    }
    
    if (title && title.length > 1) {
      // Inject inside the packshot wrapper so it scales and moves naturally with Hover animations!
      const packshot = card.querySelector('[data-testid="packshot"]') || card.querySelector('section') || card;
      // Ensure the packshot container is positioned so absolute positioning anchors to it
      if (getComputedStyle(packshot).position === 'static') {
         packshot.style.position = 'relative';
      }
      processAmazonTitle(card, title, packshot, true);
    }
  });

  // Modal / Hover selectors
  const miniModalTitles = document.querySelectorAll(
    '.tst-mini-details-title, [data-automation-id="mini-details-title"], .tst-title, .tst-title-text, a[data-testid="title-link"], .tst-hover-title'
  );
  
  miniModalTitles.forEach(titleElement => {
    const title = extractTextOrImageAlt(titleElement);
    if (title && title.length > 1) {
       processAmazonTitle(titleElement, title, titleElement, false);
    }
  });

  const heroTitles = document.querySelectorAll('.tst-hero-title');
  heroTitles.forEach(titleElement => {
     const title = extractTextOrImageAlt(titleElement);
     if (title && title.length > 1) {
       processAmazonTitle(titleElement, title, titleElement, false);
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
