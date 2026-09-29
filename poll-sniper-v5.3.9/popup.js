// popup.js - Modern Interface with Extension Toggle

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pollCountEl = document.getElementById('pollCount');
  const optionBtns = document.querySelectorAll('.option-btn');
  const openDashboardBtn = document.getElementById('openDashboard');
  
  // Timing controls
  const pollDetectionIntervalSlider = document.getElementById('pollDetectionInterval');
  const pollDetectionIntervalInput = document.getElementById('pollDetectionIntervalInput');
  
  // Timing controls
  const useHumanDelayCheckbox = document.getElementById('useHumanDelay');
  const humanDelaySettings = document.getElementById('humanDelaySettings');
  const humanDelayMinInput = document.getElementById('humanDelayMin');
  const humanDelayMaxInput = document.getElementById('humanDelayMax');
  const pollDelaySlider = document.getElementById('pollDelay');
  const pollDelayInput = document.getElementById('pollDelayInput');
  const submitDelaySlider = document.getElementById('submitDelay');
  const submitDelayInput = document.getElementById('submitDelayInput');
  const totalTimeDisplay = document.getElementById('totalTime');

  // Load current state
  chrome.storage.local.get([
    'extensionActive', 'selectedOption', 'pollCount',
    'pollDetectionInterval', 'pollDelay', 'submitDelay', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay'
  ], (result) => {
    // Extension toggle
    const isActive = result.extensionActive === true;
    extensionToggle.checked = isActive;
    updateStatus(isActive, result.pollCount || 0);
    
    // Selected option
    if (result.selectedOption) {
      optionBtns.forEach(btn => {
        if (btn.dataset.option === result.selectedOption) {
          btn.classList.add('active');
        }
      });
    }
    
    // Timing settings
    const pollDetectionInterval = result.pollDetectionInterval || 100;
    const pollDelay = result.pollDelay || 260;
    const submitDelay = result.submitDelay || 25;
    const humanDelayMin = result.humanDelayMin || 500;
    const humanDelayMax = result.humanDelayMax || 1500;
    const useHumanDelay = result.useHumanDelay !== false;
    
    pollDetectionIntervalSlider.value = pollDetectionInterval;
    pollDetectionIntervalInput.value = pollDetectionInterval;
    pollDelaySlider.value = pollDelay;
    pollDelayInput.value = pollDelay;
    submitDelaySlider.value = submitDelay;
    submitDelayInput.value = submitDelay;
    humanDelayMinInput.value = humanDelayMin;
    humanDelayMaxInput.value = humanDelayMax;
    useHumanDelayCheckbox.checked = useHumanDelay;
    
    humanDelaySettings.style.display = useHumanDelay ? 'block' : 'none';
    updateTotalTime();
  });

  // Extension toggle handler
  extensionToggle.addEventListener('change', () => {
    const isActive = extensionToggle.checked;
    chrome.storage.local.set({ extensionActive: isActive });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SET_TIMING', 
          extensionActive: isActive 
        }).catch(() => {});
      }
    });
    
    chrome.storage.local.get(['pollCount'], (result) => {
      updateStatus(isActive, result.pollCount || 0);
    });
  });

  // Update status display
  function updateStatus(isActive, count) {
    if (isActive) {
      statusDot.classList.add('active');
      statusText.textContent = 'Active';
      statusText.style.color = '#10b981';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Inactive';
      statusText.style.color = '#ef4444';
    }
    pollCountEl.textContent = count;
  }

  // Option buttons
  optionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const option = btn.dataset.option;
      
      optionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'OPTION_CHANGED', 
            option 
          }).catch(() => {});
        }
      });
    });
  });

  // Dashboard button
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });

  // Timing controls
  function updateTotalTime() {
    const pollDetectionInterval = parseInt(pollDetectionIntervalSlider.value);
    const pollDelay = parseInt(pollDelaySlider.value);
    const submitDelay = parseInt(submitDelaySlider.value);
    const useHumanDelay = useHumanDelayCheckbox.checked;
    
    let total;
    if (useHumanDelay) {
      const humanMin = parseInt(humanDelayMinInput.value) || 500;
      const humanMax = parseInt(humanDelayMaxInput.value) || 1500;
      const avgHuman = (humanMin + humanMax) / 2;
      total = Math.round(pollDetectionInterval + avgHuman + pollDelay + submitDelay);
      totalTimeDisplay.textContent = total + 'ms (avg)';
    } else {
      total = pollDetectionInterval + pollDelay + submitDelay;
      totalTimeDisplay.textContent = total + 'ms';
    }
  }

  function syncTiming(slider, input, key) {
    const value = parseInt(input.value);
    if (value >= parseInt(input.min) && value <= parseInt(input.max)) {
      slider.value = value;
      chrome.storage.local.set({ [key]: value });
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'SET_TIMING', 
            [key]: value 
          }).catch(() => {});
        }
      });
      updateTotalTime();
    }
  }

  // Human delay toggle
  useHumanDelayCheckbox.addEventListener('change', () => {
    const useHumanDelay = useHumanDelayCheckbox.checked;
    humanDelaySettings.style.display = useHumanDelay ? 'block' : 'none';
    chrome.storage.local.set({ useHumanDelay });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SET_TIMING', 
          useHumanDelay 
        }).catch(() => {});
      }
    });
    updateTotalTime();
  });

  // Human delay inputs
  humanDelayMinInput.addEventListener('change', () => {
    const value = parseInt(humanDelayMinInput.value);
    if (value >= 300 && value <= 5000) {
      chrome.storage.local.set({ humanDelayMin: value });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'SET_TIMING', 
            humanDelayMin: value 
          }).catch(() => {});
        }
      });
      updateTotalTime();
    }
  });

  humanDelayMaxInput.addEventListener('change', () => {
    const value = parseInt(humanDelayMaxInput.value);
    if (value >= 300 && value <= 5000) {
      chrome.storage.local.set({ humanDelayMax: value });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'SET_TIMING', 
            humanDelayMax: value 
          }).catch(() => {});
        }
      });
      updateTotalTime();
    }
  });

  // Poll delay
  pollDelaySlider.addEventListener('input', (e) => {
    pollDelayInput.value = e.target.value;
    updateTotalTime();
  });

  pollDelaySlider.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    chrome.storage.local.set({ pollDelay: value });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SET_TIMING', 
          pollDelay: value 
        }).catch(() => {});
      }
    });
  });

  pollDelayInput.addEventListener('change', (e) => {
    syncTiming(pollDelaySlider, e.target, 'pollDelay');
  });

  // Submit delay
  submitDelaySlider.addEventListener('input', (e) => {
    submitDelayInput.value = e.target.value;
    updateTotalTime();
  });

  submitDelaySlider.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    chrome.storage.local.set({ submitDelay: value });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SET_TIMING', 
          submitDelay: value 
        }).catch(() => {});
      }
    });
  });

  submitDelayInput.addEventListener('change', (e) => {
    syncTiming(submitDelaySlider, e.target, 'submitDelay');
  });

  // Poll detection interval
  pollDetectionIntervalSlider.addEventListener('input', (e) => {
    pollDetectionIntervalInput.value = e.target.value;
    updateTotalTime();
  });

  pollDetectionIntervalSlider.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    chrome.storage.local.set({ pollDetectionInterval: value });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SET_TIMING', 
          pollDetectionInterval: value 
        }).catch(() => {});
      }
    });
  });

  pollDetectionIntervalInput.addEventListener('change', (e) => {
    syncTiming(pollDetectionIntervalSlider, e.target, 'pollDetectionInterval');
  });
});
