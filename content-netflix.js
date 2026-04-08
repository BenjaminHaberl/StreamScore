// content-netflix.js

const PROCESSED_ATTR = 'data-rt-processed';

function createBadge(score) {
  const badge = document.createElement('rt-badge');
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

      if (response && response.rtScore) {
        const badge = createBadge(response.rtScore);
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
scanNetflixDOM();
observeNetflixDOM();
