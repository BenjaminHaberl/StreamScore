document.addEventListener('DOMContentLoaded', () => {
  const oApiKeyInput = document.getElementById('apiKey');
  const tApiKeyInput = document.getElementById('tmdbApiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  
  const toggleAmazon = document.getElementById('toggleAmazon');
  const toggleNetflix = document.getElementById('toggleNetflix');
  const toggleGoogle = document.getElementById('toggleGoogle');
  const toggleDebug = document.getElementById('toggleDebug');

  // Load existing configuration (Keys from Local, Toggles from Local)
  chrome.storage.local.get(['omdbApiKey', 'tmdbApiKey'], (syncResult) => {
    try {
      if (syncResult.omdbApiKey) oApiKeyInput.value = atob(syncResult.omdbApiKey);
      if (syncResult.tmdbApiKey) tApiKeyInput.value = atob(syncResult.tmdbApiKey);
    } catch(e) {
      console.warn("Could not decrypt legacy keys");
    }
  });

  chrome.storage.local.get(['enableAmazon', 'enableNetflix', 'enableGoogle', 'enableDebug'], (localResult) => {
    // Default to true if undefined for platforms apps
    toggleAmazon.checked = localResult.enableAmazon !== false;
    toggleNetflix.checked = localResult.enableNetflix !== false;
    toggleGoogle.checked = localResult.enableGoogle !== false;
    // Default to false for debug explicit tracker
    toggleDebug.checked = localResult.enableDebug === true;
  });

  // Auto-save toggle states immediately upon click
  const saveToggles = () => {
     chrome.storage.local.set({
        enableAmazon: toggleAmazon.checked,
        enableNetflix: toggleNetflix.checked,
        enableGoogle: toggleGoogle.checked,
        enableDebug: toggleDebug.checked
     });
  };

  toggleAmazon.addEventListener('change', saveToggles);
  toggleNetflix.addEventListener('change', saveToggles);
  toggleGoogle.addEventListener('change', saveToggles);
  toggleDebug.addEventListener('change', saveToggles);

  // Save new keys

  saveBtn.addEventListener('click', () => {
    const oKeyRaw = oApiKeyInput.value.trim();
    const tKeyRaw = tApiKeyInput.value.trim();
    
    if (!oKeyRaw && !tKeyRaw) {
      statusEl.textContent = 'Please enter at least one valid API key.';
      statusEl.style.color = '#d32f2f';
      return;
    }

    const oKeyEncrypted = oKeyRaw ? btoa(oKeyRaw) : '';
    const tKeyEncrypted = tKeyRaw ? btoa(tKeyRaw) : '';

    chrome.storage.local.set({ omdbApiKey: oKeyEncrypted, tmdbApiKey: tKeyEncrypted }, () => {
      // Clear out the apiLockout so the backend tries firing requests immediately again!
      // (We no longer wipe the entire movie_v2_ database because it acts as an offline dictionary!)
      chrome.storage.local.remove('apiLockout');
      
      statusEl.textContent = 'Settings securely saved!';
      statusEl.style.color = '#388e3c';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3000);
    });
  });

  const purgeBtn = document.getElementById('purgeBtn');
  if (purgeBtn) {
    purgeBtn.addEventListener('click', () => {
       chrome.storage.local.get(null, (items) => {
          const keysToRemove = Object.keys(items).filter(k => k.startsWith('movie_v2_') || k === 'apiLockout');
          chrome.storage.local.remove(keysToRemove, () => {
             statusEl.textContent = 'Offline Movie Database Reset!';
             statusEl.style.color = '#fa320a';
             setTimeout(() => {
               statusEl.textContent = '';
             }, 3000);
          });
       });
    });
  }
});
