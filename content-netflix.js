// content-netflix.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(score) {
  const badge = document.createElement('span');
  badge.classList.add('rt-helper-badge', 'netflix-context');

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

function processNetflixTitle(element, titleText, injectTarget) {
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
        // Netflix specific styling to ensure it's visible over dark backgrounds
        badge.style.zIndex = '9999';
        badge.style.position = 'relative';
        badge.style.marginLeft = '12px';
        badge.style.fontSize = '1.2rem';
        
        injectTarget.appendChild(badge);
      }
    }
  );
}

function scanNetflixDOM() {
  // 1. Preview Modal Logo (the large image in the modal when you click a movie)
  const modalLogos = document.querySelectorAll('.previewModal--player-titleTreatment-logo:not([' + PROCESSED_ATTR + '])');
  modalLogos.forEach(logo => {
    const title = logo.getAttribute('alt');
    // Inject the badge into the parent container so it sits next to the logo
    const parent = logo.closest('.previewModal--player-titleTreatment-left') || logo.parentNode;
    processNetflixTitle(logo, title, parent);
  });

  // 2. Jawbone Title (the expanded inline row details)
  const jawboneLogos = document.querySelectorAll('.jawBoneContainer .logo:not([' + PROCESSED_ATTR + '])');
  jawboneLogos.forEach(logo => {
    const title = logo.getAttribute('alt');
    const parent = logo.parentNode;
    processNetflixTitle(logo, title, parent);
  });

  // 3. Fallback for text titles (e.g., standard h1 if image logo isn't present)
  const textTitles = document.querySelectorAll('h1.title-title:not([' + PROCESSED_ATTR + ']), .about-header h1:not([' + PROCESSED_ATTR + '])');
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
scanNetflixDOM();
observeNetflixDOM();
