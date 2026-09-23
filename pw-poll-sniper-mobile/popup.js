// popup.js - PW Poll Sniper Mobile v5.3.6

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const extensionToggle = document.getElementById('extensionToggle');
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const pollCount = document.getElementById('pollCount');
  const successCount = document.getElementById('successCount');
  const avgTime = document.getElementById('avgTime');
  const autoSubmit = document.getElementById('autoSubmit');
  const autoOpen = document.getElementById('autoOpen');
  const humanDelay = document.getElementById('humanDelay');
  const answerBtns = document.querySelectorAll('.answer-btn');

  // Load current state
  chrome.storage.local.get(
    ['extensionActive', 'pollCount', 'pollHistory', 'autoSubmit', 'autoOpen', 'useHumanDelay', 'selectedOption'],
    (result) => {
      // Extension toggle
      extensionToggle.checked = result.extensionActive === true;
      updateStatus(result.extensionActive === true);

      // Stats
      pollCount.textContent = result.pollCount || 0;
      
      const history = result.pollHistory || [];
      const successPolls = history.filter(p => p.status === 'SUCCESS').length;
      successCount.textContent = successPolls;

      // Calculate average time
      const times = history
        .filter(p => p.status === 'SUCCESS' && p.time)
        .map(p => parseInt(p.time));
      
      if (times.length > 0) {
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        avgTime.textContent = avg + 'ms';
      } else {
        avgTime.textContent = '0ms';
      }

      // Settings
      autoSubmit.checked = result.autoSubmit !== false;
      autoOpen.checked = result.autoOpen !== false;
      humanDelay.checked = result.useHumanDelay !== false;

      // Selected answer
      if (result.selectedOption) {
        answerBtns.forEach(btn => {
          if (btn.dataset.option === result.selectedOption) {
            btn.classList.add('selected');
          }
        });
      }
    }
  );

  // Extension toggle handler
  extensionToggle.addEventListener('change', () => {
    const active = extensionToggle.checked;
    chrome.storage.local.set({ extensionActive: active });
    updateStatus(active);

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EXTENSION_TOGGLED',
          active: active
        }).catch(() => {});
      }
    });
  });

  // Update status display
  function updateStatus(active) {
    if (active) {
      statusBar.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusBar.classList.remove('active');
      statusText.textContent = 'Inactive';
    }
  }

  // Answer button handlers
  answerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const option = btn.dataset.option;
      
      // Update UI
      answerBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Save to storage
      chrome.storage.local.set({ selectedOption: option });

      // Send message to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'OPTION_CHANGED',
            option: option
          }).catch(() => {});
        }
      });
    });
  });

  // Settings handlers
  autoSubmit.addEventListener('change', () => {
    chrome.storage.local.set({ autoSubmit: autoSubmit.checked });
  });

  autoOpen.addEventListener('change', () => {
    chrome.storage.local.set({ autoOpen: autoOpen.checked });
  });

  humanDelay.addEventListener('change', () => {
    chrome.storage.local.set({ useHumanDelay: humanDelay.checked });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.extensionActive) {
      extensionToggle.checked = changes.extensionActive.newValue;
      updateStatus(changes.extensionActive.newValue);
    }
    if (changes.pollCount) {
      pollCount.textContent = changes.pollCount.newValue;
    }
    if (changes.selectedOption) {
      answerBtns.forEach(btn => {
        if (btn.dataset.option === changes.selectedOption.newValue) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      });
    }
  });
});
