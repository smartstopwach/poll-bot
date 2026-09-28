// background.js - v5.4.9 Service Worker (FIX #8: Badge persists, FIX #9: Version updated, Dashboard opener)

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.type === 'POLL_ANSWERED') {
      const count = msg.pollCount || 0;
      // Update badge with poll count
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    }
    
    // Dashboard opener - opens dashboard in new tab
    if (msg.type === 'OPEN_DASHBOARD') {
      const dashboardURL = chrome.runtime.getURL('dashboard.html');
      chrome.tabs.create({ url: dashboardURL });
    }
  } catch (e) {
    console.error('[PW Sniper Mobile BG] Error:', e);
  }
});

// FIX #8: Don't reset badge on navigation - keep poll count visible
// Only reset badge when extension is first installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});
