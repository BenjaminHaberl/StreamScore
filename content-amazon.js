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

function scanAmazonDOM() {
  console.log("RT Helper: Scanning Amazon DOM...");

  const detailTitles = document.querySelectorAll('h1[data-automation-id="title"]');
  detailTitles.forEach(titleElement => {
    const title = titleElement.textContent.trim();
    processAmazonTitle(titleElement, title, titleElement);
  });

  const miniModalTitles = document.querySelectorAll('.tst-mini-details-title, [data-automation-id="mini-details-title"]');
  miniModalTitles.forEach(titleElement => {
    const title = titleElement.textContent.trim();
    processAmazonTitle(titleElement, title, titleElement);
  });

  const heroTitles = document.querySelectorAll('.tst-hero-title');
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
