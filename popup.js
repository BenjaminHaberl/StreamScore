document.addEventListener('DOMContentLoaded', () => {
  const oApiKeyInput = document.getElementById('apiKey');
  const tApiKeyInput = document.getElementById('tmdbApiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  
  const toggleAmazon = document.getElementById('toggleAmazon');
  const toggleNetflix = document.getElementById('toggleNetflix');
  const toggleGoogle = document.getElementById('toggleGoogle');

  // Load existing configuration (Keys and Toggles)
  chrome.storage.local.get(['omdbApiKey', 'tmdbApiKey', 'enableAmazon', 'enableNetflix', 'enableGoogle'], (result) => {
    if (result.omdbApiKey) oApiKeyInput.value = result.omdbApiKey;
    if (result.tmdbApiKey) tApiKeyInput.value = result.tmdbApiKey;
    
    // Default to true if undefined
    toggleAmazon.checked = result.enableAmazon !== false;
    toggleNetflix.checked = result.enableNetflix !== false;
    toggleGoogle.checked = result.enableGoogle !== false;
  });

  // Auto-save toggle states immediately upon click
  const saveToggles = () => {
     chrome.storage.local.set({
        enableAmazon: toggleAmazon.checked,
        enableNetflix: toggleNetflix.checked,
        enableGoogle: toggleGoogle.checked
     });
  };

  toggleAmazon.addEventListener('change', saveToggles);
  toggleNetflix.addEventListener('change', saveToggles);
  toggleGoogle.addEventListener('change', saveToggles);

  // Save new keys

  saveBtn.addEventListener('click', () => {
    const oKey = oApiKeyInput.value.trim();
    const tKey = tApiKeyInput.value.trim();
    
    if (!oKey) {
      statusEl.textContent = 'Please enter a valid OMDb key.';
      statusEl.style.color = '#d32f2f';
      return;
    }

    chrome.storage.local.set({ omdbApiKey: oKey, tmdbApiKey: tKey }, () => {
      // Clear out the apiLockout AND selectively blow away the entire movie cache so that 
      // corrupted rate-limited "N/A" titles from earlier can be fetched safely again!
      chrome.storage.local.get(null, (items) => {
          const keysToRemove = Object.keys(items).filter(k => k.startsWith('movie_v2_') || k === 'apiLockout');
          chrome.storage.local.remove(keysToRemove);
      });
      
      statusEl.textContent = 'Keys saved successfully!';
      statusEl.style.color = '#388e3c';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3000);
    });
  });
});
