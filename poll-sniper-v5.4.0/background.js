// background.js - v5.3.8 Service Worker (FIX #13: Badge persists, FIX #14: Version updated)

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

// FIX #13: Don't reset badge on navigation - keep poll count visible
// Only reset badge when extension is first installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});
