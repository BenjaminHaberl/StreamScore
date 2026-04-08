document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Load existing key
  chrome.storage.local.get(['omdbApiKey'], (result) => {
    if (result.omdbApiKey) {
      apiKeyInput.value = result.omdbApiKey;
    }
  });

  // Save new key
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      statusEl.textContent = 'Please enter a valid key.';
      statusEl.style.color = '#d32f2f';
      return;
    }

    chrome.storage.local.set({ omdbApiKey: key }, () => {
      statusEl.textContent = 'Key saved successfully!';
      statusEl.style.color = '#388e3c';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3000);
    });
  });
});
