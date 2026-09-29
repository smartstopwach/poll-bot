// inject.js — MAIN world — WebSocket intercept for early poll detection
// Runs BEFORE page scripts. Intercepts PW's WebSocket messages.
// Sends poll alerts to content.js via window.postMessage.
(function() {
  'use strict';
  
  const OriginalWebSocket = window.WebSocket;
  
  // Poll detection patterns
  const POLL_REGEX = /"(?:type|event|action)"\s*:\s*"(?:poll|quiz|startPoll|pollStarted|pollCreated|newPoll|livePoll|mcq_question|poll_question)"/i;
  const POLL_QUICK_REGEX = /poll[_-]?(?:start|create|new|live|question)|quiz[_-]?(?:start|create|new)|mcq/i;
  
  function checkAndNotify(data) {
    if (typeof data !== 'string') return;
    if (POLL_REGEX.test(data) || POLL_QUICK_REGEX.test(data)) {
      window.postMessage({
        type: 'PW_POLL_WS_DETECTED',
        timestamp: performance.now()
      }, '*');
    }
  }
  
  // Override WebSocket constructor
  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    
    if (url && (url.includes('penpencil') || url.includes('pw.live') || url.includes('physicswallah'))) {
      ws.addEventListener('message', function(event) {
        checkAndNotify(event.data);
      });
    }
    
    return ws;
  };
  
  // Copy static properties
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  
  // Also intercept fetch for poll API calls
  const originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    
    return originalFetch.apply(this, args).then(function(response) {
      if (url && (url.includes('poll') || url.includes('quiz'))) {
        try {
          var clone = response.clone();
          clone.text().then(function(text) {
            if (POLL_QUICK_REGEX.test(text)) {
              window.postMessage({
                type: 'PW_POLL_WS_DETECTED',
                timestamp: performance.now()
              }, '*');
            }
          }).catch(function() {});
        } catch(e) {}
      }
      return response;
    });
  };
})();
