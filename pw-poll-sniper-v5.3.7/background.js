// background.js - v4.9.0 Service Worker (Fixed message handling)

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.type === 'POLL_ANSWERED') {
      const count = msg.pollCount || 0;
      // Update badge with poll count
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    }
  } catch (e) {
    console.error('[PW Sniper BG] Error:', e);
  }
});

// Reset badge when navigating to PW site
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('pw.live')) {
    chrome.action.setBadgeText({ text: '' });
  }
});
