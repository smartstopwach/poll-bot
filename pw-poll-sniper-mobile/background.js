// background.js - Service worker for PW Poll Sniper

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      selectedOption: 'A',
      autoSubmit: true,
      autoOpen: true,
      soundAlert: true,
      debugMode: true,
      pollsAnswered: 0,
      totalResponseTime: 0
    });

    console.log('[PW Poll Sniper] Extension installed successfully!');
    console.log('[PW Poll Sniper] Debug mode is ENABLED by default to help find PW poll selectors');
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POLL_ANSWERED') {
    chrome.storage.local.get(['pollsAnswered', 'totalResponseTime'], (result) => {
      const pollsAnswered = (result.pollsAnswered || 0) + 1;
      const totalResponseTime = (result.totalResponseTime || 0) + message.responseTime;

      chrome.storage.local.set({
        pollsAnswered,
        totalResponseTime
      });

      console.log(`[PW Poll Sniper] Poll #${pollsAnswered} answered in ${message.responseTime}ms`);
    });
  }

  if (sender.tab) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might not be open
    });
  }
});

// Badge text to show active status
chrome.action.setBadgeText({ text: '⚡' });
chrome.action.setBadgeBackgroundColor({ color: '#7c4dff' });
