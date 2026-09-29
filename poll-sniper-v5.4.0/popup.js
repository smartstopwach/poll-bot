// popup.js - Modern Interface with Extension Toggle

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pollCountEl = document.getElementById('pollCount');
  const optionBtns = document.querySelectorAll('.opt-btn');
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
  const aggressiveToggle = document.getElementById('aggressiveToggle');

  // Load current state
  chrome.storage.local.get([
    'extensionActive', 'selectedOption', 'pollCount',
    'pollDetectionInterval', 'pollDelay', 'submitDelay', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'aggressiveMode'
  ], (result) => {
    // Extension toggle
    const isActive = result.extensionActive !== false;  // Default ON
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
    const pollDetectionInterval = result.pollDetectionInterval || 50;  // Default 50ms
    const pollDelay = result.pollDelay || 50;  // Default 50ms
    const submitDelay = result.submitDelay || 25;
    const humanDelayMin = result.humanDelayMin || 500;
    const humanDelayMax = result.humanDelayMax || 1500;
    const useHumanDelay = result.useHumanDelay === true;  // Default OFF
    
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
    
    // Aggressive mode
    if (aggressiveToggle) {
      aggressiveToggle.checked = result.aggressiveMode === true;
    }
    
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

  // Option buttons - Direct click, no Q mode needed
  optionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const option = btn.dataset.option;
      
      optionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Save to storage so content.js picks it up
      chrome.storage.local.set({ selectedOption: option });
      
      // Also send message to content.js (find PW tab)
      chrome.tabs.query({ url: ['*://*.pw.live/*', '*://pw.live/*'] }, (tabs) => {
        if (tabs && tabs.length > 0) {
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

  // Aggressive mode toggle
  if (aggressiveToggle) {
    aggressiveToggle.addEventListener('change', () => {
      const aggressive = aggressiveToggle.checked;
      chrome.storage.local.set({ aggressiveMode: aggressive });
      
      chrome.tabs.query({ url: ['*://*.pw.live/*', '*://pw.live/*'] }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'SET_AGGRESSIVE', 
            aggressive 
          }).catch(() => {});
        }
      });
      
      // Update total time display
      if (aggressive) {
        totalTimeDisplay.textContent = '~25ms';
      } else {
        updateTotalTime();
      }
    });
  }

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

  // ==========================================
  // ADVANCED SECTION
  // ==========================================
  const debugModeToggle = document.getElementById('debugModeToggle');
  const clearDebugLogsBtn = document.getElementById('clearDebugLogs');
  const debugLogCountEl = document.getElementById('debugLogCount');
  const resetStatsBtn = document.getElementById('resetStats');
  const perfSuccessRate = document.getElementById('perfSuccessRate');
  const perfAvgTime = document.getElementById('perfAvgTime');
  const perfPollsPerMin = document.getElementById('perfPollsPerMin');
  const perfWarnings = document.getElementById('perfWarnings');
  const themeBtns = document.querySelectorAll('.theme-btn');

  // Send message to PW tab helper
  function sendToPWTab(msg) {
    chrome.tabs.query({ url: ['*://*.pw.live/*', '*://pw.live/*'] }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }

  // Load advanced settings
  chrome.storage.local.get(['debugMode', 'theme', 'performanceMetrics'], (result) => {
    if (debugModeToggle) debugModeToggle.checked = result.debugMode === true;
    
    // Highlight active theme button
    const currentTheme = result.theme || 'dark';
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
    
    // Load performance metrics
    loadPerformanceStats();
  });

  // Load performance stats from PW tab
  function loadPerformanceStats() {
    sendToPWTab({ type: 'GET_PERFORMANCE' });
    // Also try to get from storage directly
    chrome.storage.local.get(['performanceMetrics'], (result) => {
      const m = result.performanceMetrics;
      if (m) {
        if (perfSuccessRate) perfSuccessRate.textContent = m.pollsAnswered > 0 ? m.successRate + '%' : '-';
        if (perfAvgTime) perfAvgTime.textContent = m.successCount > 0 ? m.avgResponseTime + 'ms' : '-';
        if (perfPollsPerMin) perfPollsPerMin.textContent = m.pollsInLastMinute || 0;
        
        // Check warnings
        const warnings = [];
        if (m.successRate < 80 && m.pollsAnswered > 5) warnings.push('Low success rate');
        if (m.avgResponseTime > 500 && m.successCount > 3) warnings.push('Slow responses');
        if (m.pollsInLastMinute > 20) warnings.push('High frequency');
        
        if (perfWarnings) {
          if (warnings.length > 0) {
            perfWarnings.style.display = 'block';
            perfWarnings.textContent = '⚠ ' + warnings.join(', ');
          } else {
            perfWarnings.style.display = 'none';
          }
        }
      }
    });
  }

  // Debug mode toggle
  if (debugModeToggle) {
    debugModeToggle.addEventListener('change', () => {
      const debugMode = debugModeToggle.checked;
      chrome.storage.local.set({ debugMode });
      sendToPWTab({ type: 'SET_DEBUG_MODE', debugMode });
    });
  }

  // Clear debug logs
  if (clearDebugLogsBtn) {
    clearDebugLogsBtn.addEventListener('click', () => {
      chrome.storage.local.set({ debugLogs: [], wsMessageLog: [] });
      sendToPWTab({ type: 'CLEAR_DEBUG_LOGS' });
      if (debugLogCountEl) debugLogCountEl.textContent = '(0 logs)';
    });
  }

  // Reset performance stats
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      sendToPWTab({ type: 'RESET_PERFORMANCE' });
      chrome.storage.local.set({ performanceMetrics: null });
      loadPerformanceStats();
    });
  }

  // Theme buttons
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      chrome.storage.local.set({ theme });
      sendToPWTab({ type: 'SET_THEME', theme });
      
      // Highlight active
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Refresh performance stats every 5 seconds when popup is open
  setInterval(loadPerformanceStats, 5000);

  // Update debug log count from storage
  chrome.storage.local.get(['debugLogs'], (result) => {
    const count = (result.debugLogs || []).length;
    if (debugLogCountEl) debugLogCountEl.textContent = `(${count} logs)`;
  });
});
