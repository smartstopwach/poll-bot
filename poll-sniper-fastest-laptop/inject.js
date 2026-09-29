// inject.js — Runs in MAIN world to intercept WebSocket messages
// PW Poll Sniper Laptop v1.0.0 — WebSocket Intercept for 300-400ms faster detection
(function() {
  'use strict';
  
  // ============================================
  // WEBSOCKET INTERCEPT
  // ============================================
  const OriginalWebSocket = window.WebSocket;
  const originalSend = OriginalWebSocket.prototype.send;
  
  // Track WebSocket connections related to PW polls
  let pollSocket = null;
  
  function interceptMessage(data) {
    try {
      // Parse the message (could be string or ArrayBuffer)
      let parsed = null;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch(e) {
          // Not JSON, check for poll-related keywords
          if (data.includes('poll') || data.includes('quiz') || data.includes('question')) {
            window.postMessage({ 
              type: 'PW_POLL_WS_RAW', 
              data: data 
            }, '*');
          }
          return;
        }
      }
      
      if (!parsed) return;
      
      // Check if this message contains poll data
      // PW uses various event names for polls
      const pollIndicators = [
        'poll', 'quiz', 'question', 'mcq', 'answer',
        'pollStarted', 'pollCreated', 'newPoll', 'livePoll',
        'startPoll', 'POLL', 'Quiz'
      ];
      
      const dataStr = JSON.stringify(parsed).toLowerCase();
      const isPollRelated = pollIndicators.some(ind => dataStr.includes(ind.toLowerCase()));
      
      if (isPollRelated) {
        // Send poll data to content script
        window.postMessage({ 
          type: 'PW_POLL_WS_DETECTED', 
          data: parsed,
          timestamp: performance.now()
        }, '*');
        
        console.log('[PW Sniper WS] Poll data intercepted:', parsed);
      }
    } catch(e) {
      // Silent fail
    }
  }
  
  // Override WebSocket constructor
  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    
    // Check if this is PW's socket (central-socket.penpencil.co or similar)
    if (url && (url.includes('penpencil') || url.includes('pw.live') || url.includes('physicswallah'))) {
      pollSocket = ws;
      console.log('[PW Sniper WS] Socket intercepted:', url);
      
      // Override onmessage
      const originalOnMessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage') || 
                                Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');
      
      // Add event listener for messages
      ws.addEventListener('message', function(event) {
        interceptMessage(event.data);
      });
      
      // Also intercept send (for debugging)
      const origWsSend = ws.send.bind(ws);
      ws.send = function(data) {
        try {
          if (typeof data === 'string' && (data.includes('poll') || data.includes('answer'))) {
            window.postMessage({ 
              type: 'PW_POLL_WS_SEND', 
              data: data 
            }, '*');
          }
        } catch(e) {}
        return origWsSend(data);
      };
    }
    
    return ws;
  };
  
  // Copy static properties
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  
  // ============================================
  // ALSO INTERCEPT FETCH/XHR for poll API calls
  // ============================================
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    
    return originalFetch.apply(this, args).then(response => {
      // Check if this is a poll-related API call
      if (url && (url.includes('poll') || url.includes('quiz') || url.includes('question'))) {
        try {
          // Clone response to read body without consuming it
          const clone = response.clone();
          clone.json().then(data => {
            window.postMessage({ 
              type: 'PW_POLL_FETCH_DETECTED', 
              url: url,
              data: data,
              timestamp: performance.now()
            }, '*');
          }).catch(() => {});
        } catch(e) {}
      }
      return response;
    });
  };
  
  // Intercept XHR too
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._pwUrl = url;
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    const self = this;
    const url = this._pwUrl || '';
    
    if (url && (url.includes('poll') || url.includes('quiz'))) {
      this.addEventListener('load', function() {
        try {
          const response = JSON.parse(self.responseText);
          window.postMessage({ 
            type: 'PW_POLL_XHR_DETECTED', 
            url: url,
            data: response,
            timestamp: performance.now()
          }, '*');
        } catch(e) {}
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };
  
  console.log('[PW Sniper WS] WebSocket/Fetch/XHR interceptors installed');
})();
