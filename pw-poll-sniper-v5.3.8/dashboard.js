// dashboard.js - Advanced Dashboard with Real-time Updates

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const autoSubmitCheck = document.getElementById('autoSubmit');
  const autoOpenCheck = document.getElementById('autoOpen');
  const useHumanDelayCheck = document.getElementById('useHumanDelay');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const clearErrorsBtn = document.getElementById('clearErrors');
  const statusBadge = document.getElementById('statusBadge');
  const historyFilter = document.getElementById('historyFilter');
  
  let currentFilter = 'all';

  // Load initial data
  loadData();
  loadSettings();

  // Auto-refresh every 2 seconds
  setInterval(loadData, 2000);

  // Load settings
  function loadSettings() {
    chrome.storage.local.get([
      'extensionActive', 'autoSubmit', 'autoOpen', 'useHumanDelay'
    ], (result) => {
      extensionToggle.checked = result.extensionActive === true;
      autoSubmitCheck.checked = result.autoSubmit !== false;
      autoOpenCheck.checked = result.autoOpen !== false;
      useHumanDelayCheck.checked = result.useHumanDelay !== false;
      
      updateStatusBadge(result.extensionActive === true);
    });
  }

  // Update status badge
  function updateStatusBadge(isActive) {
    if (isActive) {
      statusBadge.classList.add('active');
      statusBadge.querySelector('.status-text').textContent = 'Active';
    } else {
      statusBadge.classList.remove('active');
      statusBadge.querySelector('.status-text').textContent = 'Inactive';
    }
  }

  // Find PW tab and send message
  function sendToPWTab(msg) {
    chrome.tabs.query({ url: ['*://*.pw.live/*', '*://pw.live/*'] }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }

  // Extension toggle
  extensionToggle.addEventListener('change', () => {
    const isActive = extensionToggle.checked;
    chrome.storage.local.set({ extensionActive: isActive });
    sendToPWTab({ type: 'SET_TIMING', extensionActive: isActive });
    updateStatusBadge(isActive);
  });

  // Auto submit toggle
  autoSubmitCheck.addEventListener('change', () => {
    chrome.storage.local.set({ autoSubmit: autoSubmitCheck.checked });
  });

  // Auto open toggle
  autoOpenCheck.addEventListener('change', () => {
    chrome.storage.local.set({ autoOpen: autoOpenCheck.checked });
  });

  // Human delay toggle
  useHumanDelayCheck.addEventListener('change', () => {
    const useHumanDelay = useHumanDelayCheck.checked;
    chrome.storage.local.set({ useHumanDelay });
    sendToPWTab({ type: 'SET_TIMING', useHumanDelay });
  });

  // History filter
  historyFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    loadData();
  });

  // Clear history
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all poll history?')) {
      chrome.storage.local.set({ pollHistory: [], pollCount: 0 });
      sendToPWTab({ type: 'CLEAR_HISTORY' });
      loadData();
    }
  });

  // Clear errors
  clearErrorsBtn.addEventListener('click', () => {
    if (confirm('Clear all error logs?')) {
      chrome.storage.local.set({ errorLog: [] });
      sendToPWTab({ type: 'CLEAR_HISTORY' });
      loadData();
    }
  });

  // Load all data
  function loadData() {
    chrome.storage.local.get(['pollHistory', 'errorLog', 'pollCount'], (result) => {
      const history = result.pollHistory || [];
      const errors = result.errorLog || [];
      const count = result.pollCount || 0;

      // Update stats
      updateStats(history);

      // Render tables
      renderHistory(history);
      renderErrors(errors);
    });
  }

  // Update statistics
  function updateStats(history) {
    const total = history.length;
    const success = history.filter(h => h.status === 'SUCCESS').length;
    const failed = history.filter(h => h.status === 'FAILED').length;

    // Calculate average time
    const times = history
      .filter(h => h.status === 'SUCCESS' && h.time)
      .map(h => {
        const num = parseInt(String(h.time).replace('ms', ''));
        return isNaN(num) ? 0 : num;
      })
      .filter(t => t > 0);

    const avgTime = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

    document.getElementById('totalPolls').textContent = total;
    document.getElementById('successPolls').textContent = success;
    document.getElementById('failedPolls').textContent = failed;
    document.getElementById('avgTime').textContent = avgTime > 0 ? avgTime + 'ms' : '0ms';
  }

  // Render history table
  function renderHistory(history) {
    const tbody = document.getElementById('historyTable');
    if (!tbody) return;

    // Apply filter
    let filtered = history;
    if (currentFilter !== 'all') {
      filtered = history.filter(h => h.status === currentFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No polls found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.slice().reverse().map(item => {
      const statusClass = item.status === 'SUCCESS' ? 'success' : 'failed';
      const statusIcon = item.status === 'SUCCESS' ? '✓' : '✗';
      const method = item.status === 'SUCCESS'
        ? `${item.click || '-'}/${item.submit || '-'}`
        : (item.reason || 'Unknown');

      return `
        <tr>
          <td><span class="status-badge-table ${statusClass}">${statusIcon} ${item.status}</span></td>
          <td><strong>#${item.poll}</strong></td>
          <td><strong>${item.answer}</strong></td>
          <td>${item.time || '-'}</td>
          <td>${method}</td>
          <td>${item.timestamp || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // Render errors table
  function renderErrors(errors) {
    const tbody = document.getElementById('errorTable');
    if (!tbody) return;

    if (errors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">No errors 🎉</td></tr>';
      return;
    }

    tbody.innerHTML = errors.slice().reverse().map(item => {
      return `
        <tr>
          <td><span class="status-badge-table failed">⚠ ERROR</span></td>
          <td>${escapeHtml(item.msg)}</td>
          <td>${item.timestamp || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
