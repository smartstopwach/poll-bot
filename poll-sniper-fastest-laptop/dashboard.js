// dashboard.js - PW Poll Sniper Laptop Dashboard v1.0.0 (WS Intercept)

document.addEventListener('DOMContentLoaded', () => {
  // Load all settings
  loadSettings();
  
  // Setup event listeners
  setupEventListeners();
});

function loadSettings() {
  chrome.storage.local.get(
    [
      'extensionActive',
      'selectedOption',
      'pollDelay',
      'submitDelay',
      'pollDetectionInterval',
      'fabOpacity',
      'autoSubmit',
      'autoOpen',
      'useHumanDelay',
      'pollCount',
      'pollHistory',
      'errorLog'
    ],
    (result) => {
      // Extension toggle
      document.getElementById('extensionToggle').checked = result.extensionActive !== false;
      
      // Answer buttons
      const selectedOption = result.selectedOption;
      document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('active');
        // FIX #1 & #4: Handle "None" button (data-option="") when selectedOption is null
        if (!selectedOption && btn.dataset.option === '') {
          btn.classList.add('active');
        } else if (selectedOption && btn.dataset.option === selectedOption) {
          btn.classList.add('active');
        }
      });
      
      // Poll delay - FIX #2: Default matches content.js (50ms)
      const pollDelay = result.pollDelay !== undefined ? result.pollDelay : 50;
      document.querySelectorAll('#pollDelayGrid .speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value) === pollDelay);
      });
      
      // Submit delay
      const submitDelay = result.submitDelay !== undefined ? result.submitDelay : 25;
      document.querySelectorAll('#submitDelayGrid .speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value) === submitDelay);
      });
      
      // Poll detection speed
      const detectionSpeed = result.pollDetectionInterval !== undefined ? result.pollDetectionInterval : 100;
      document.querySelectorAll('#detectionSpeedGrid .speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value) === detectionSpeed);
      });
      
      // FAB opacity
      const fabOpacity = result.fabOpacity !== undefined ? result.fabOpacity : 1;
      document.querySelectorAll('#opacityGrid .speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.value) === fabOpacity);
      });
      
      // Toggles
      document.getElementById('autoSubmitToggle').checked = result.autoSubmit !== false;
      document.getElementById('autoOpenToggle').checked = result.autoOpen !== false;
      document.getElementById('humanDelayToggle').checked = result.useHumanDelay === true;
      
      // Stats
      const pollCount = result.pollCount || 0;
      const pollHistory = result.pollHistory || [];
      const successCount = pollHistory.filter(p => p.status === 'SUCCESS').length;
      
      document.getElementById('statPolls').textContent = pollCount;
      document.getElementById('statSuccess').textContent = successCount;
      
      // Calculate average time
      const successPolls = pollHistory.filter(p => p.status === 'SUCCESS' && p.time);
      if (successPolls.length > 0) {
        const totalTime = successPolls.reduce((sum, p) => {
          const time = parseInt(p.time);
          return sum + (isNaN(time) ? 0 : time);
        }, 0);
        const avgTime = Math.round(totalTime / successPolls.length);
        document.getElementById('statAvgTime').textContent = avgTime + 'ms';
      } else {
        document.getElementById('statAvgTime').textContent = '-';
      }
      
      // Render history
      renderHistory(pollHistory);
      
      // Render errors
      renderErrors(result.errorLog || []);
    }
  );
}

function setupEventListeners() {
  // Extension toggle
  document.getElementById('extensionToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ extensionActive: e.target.checked });
  });
  
  // Answer buttons
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const option = btn.dataset.option || null;
      chrome.storage.local.set({ selectedOption: option });
      
      // Update UI - always highlight the clicked button
      document.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Poll delay buttons
  document.querySelectorAll('#pollDelayGrid .speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.value);
      chrome.storage.local.set({ pollDelay: value });
      
      // Update UI
      document.querySelectorAll('#pollDelayGrid .speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Submit delay buttons
  document.querySelectorAll('#submitDelayGrid .speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.value);
      chrome.storage.local.set({ submitDelay: value });
      
      // Update UI
      document.querySelectorAll('#submitDelayGrid .speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Poll detection speed buttons
  document.querySelectorAll('#detectionSpeedGrid .speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.value);
      chrome.storage.local.set({ pollDetectionInterval: value });
      
      // Update UI
      document.querySelectorAll('#detectionSpeedGrid .speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // FAB opacity buttons
  document.querySelectorAll('#opacityGrid .speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseFloat(btn.dataset.value);
      chrome.storage.local.set({ fabOpacity: value });
      
      // Update UI
      document.querySelectorAll('#opacityGrid .speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Settings toggles
  document.getElementById('autoSubmitToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ autoSubmit: e.target.checked });
  });
  
  document.getElementById('autoOpenToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ autoOpen: e.target.checked });
  });
  
  document.getElementById('humanDelayToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ useHumanDelay: e.target.checked });
  });
  
  // Clear history - FIX #5: Custom confirm instead of native confirm() (broken in Kiwi)
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    const btn = document.getElementById('clearHistoryBtn');
    
    // First click: show confirmation state
    if (!btn.dataset.confirming) {
      btn.dataset.confirming = 'true';
      btn.textContent = '⚠️ Tap again to confirm';
      btn.style.background = 'rgba(239, 68, 68, 0.4)';
      
      // Reset after 3 seconds if not confirmed
      setTimeout(() => {
        if (btn.dataset.confirming) {
          btn.dataset.confirming = '';
          btn.textContent = '🗑️ Clear All History';
          btn.style.background = 'rgba(239, 68, 68, 0.15)';
        }
      }, 3000);
      return;
    }
    
    // Second click: actually clear
    btn.dataset.confirming = '';
    btn.textContent = '🗑️ Clear All History';
    btn.style.background = 'rgba(239, 68, 68, 0.15)';
    
    chrome.storage.local.set({
      pollHistory: [],
      errorLog: [],
      pollCount: 0,
      selectedOption: null
    });
    
    // Update UI
    document.getElementById('statPolls').textContent = '0';
    document.getElementById('statSuccess').textContent = '0';
    document.getElementById('statAvgTime').textContent = '-';
    document.getElementById('historyList').innerHTML = '<div class="empty-state">No polls yet</div>';
    document.getElementById('errorList').innerHTML = '<div class="empty-state">No errors</div>';
    document.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('active'));
    // Highlight "None" button (if exists)
    const noneBtn = document.querySelector('.answer-btn[data-option=""]');
    if (noneBtn) noneBtn.classList.add('active');
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.extensionActive) {
      document.getElementById('extensionToggle').checked = changes.extensionActive.newValue !== false;
    }
    if (changes.pollHistory) {
      const history = changes.pollHistory.newValue || [];
      renderHistory(history);
      // FIX #3: Only update stats, don't reload everything
      const successCount = history.filter(p => p.status === 'SUCCESS').length;
      document.getElementById('statSuccess').textContent = successCount;
      
      const successPolls = history.filter(p => p.status === 'SUCCESS' && p.time);
      if (successPolls.length > 0) {
        const totalTime = successPolls.reduce((sum, p) => {
          const time = parseInt(p.time);
          return sum + (isNaN(time) ? 0 : time);
        }, 0);
        document.getElementById('statAvgTime').textContent = Math.round(totalTime / successPolls.length) + 'ms';
      }
    }
    if (changes.pollCount) {
      document.getElementById('statPolls').textContent = changes.pollCount.newValue || 0;
    }
    if (changes.errorLog) {
      renderErrors(changes.errorLog.newValue || []);
    }
    if (changes.selectedOption) {
      const option = changes.selectedOption.newValue;
      document.querySelectorAll('.answer-btn').forEach(btn => {
        // FIX #4: Handle null selectedOption with "None" button
        if (!option && btn.dataset.option === '') {
          btn.classList.add('active');
        } else if (option && btn.dataset.option === option) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  });
}

function renderHistory(history) {
  const container = document.getElementById('historyList');
  
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">No polls yet</div>';
    return;
  }
  
  // Show last 20 polls (newest first)
  const recent = history.slice(-20).reverse();
  
  container.innerHTML = recent.map(poll => {
    const statusClass = poll.status === 'SUCCESS' ? 'status-success' : 
                        poll.status === 'FAILED' ? 'status-failed' : 'status-selected';
    
    return `
      <div class="history-item">
        <div>
          <div style="font-weight:600;">Poll #${poll.poll || '?'} - ${poll.answer || '?'} ${poll.ws && poll.ws !== '-' ? '<span style="color:#fbbf24;font-size:10px;">⚡WS ' + poll.ws + '</span>' : ''}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            ${poll.time || '-'} ${poll.click ? `(${poll.click})` : ''}
          </div>
        </div>
        <span class="history-status ${statusClass}">${poll.status}</span>
      </div>
    `;
  }).join('');
}

function renderErrors(errors) {
  const container = document.getElementById('errorList');
  
  if (!errors || errors.length === 0) {
    container.innerHTML = '<div class="empty-state">No errors</div>';
    return;
  }
  
  // Show last 10 errors (newest first)
  const recent = errors.slice(-10).reverse();
  
  container.innerHTML = recent.map(err => `
    <div class="error-item">
      <div>${err.msg || err}</div>
      <div class="error-time">${err.timestamp || ''}</div>
    </div>
  `).join('');
}
