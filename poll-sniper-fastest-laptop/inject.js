// inject.js — Runs in MAIN world to intercept WebSocket messages
// PW Poll Sniper Laptop v1.0.0 — WebSocket Intercept for 300-400ms faster detection
// ULTRA FAST: Optimized for minimum latency
(function() {
  'use strict';
  
  // ============================================
  // WEBSOCKET INTERCEPT — ULTRA FAST
  // ============================================
  const OriginalWebSocket = window.WebSocket;
  
  // Pre-compiled regex for fast poll detection
  // More specific to avoid false positives from chat/notifications
  const POLL_REGEX = /"(?:type|event|action)"\s*:\s*"(?:poll|quiz|startPoll|pollStarted|pollCreated|newPoll|livePoll|mcq_question|poll_question)"/i;
  // Fallback quick check for raw poll indicators in structured data
  const POLL_QUICK_REGEX = /poll[_-]?(?:start|create|new|live|question)|quiz[_-]?(?:start|create|new)|mcq/i;
  
  function interceptMessage(data) {
    // Fast path: string data
    if (typeof data === 'string') {
      // Quick regex check before expensive operations
      if (POLL_REGEX.test(data) || POLL_QUICK_REGEX.test(data)) {
        // Notify content script immediately
        window.postMessage({ 
          type: 'PW_POLL_WS_DETECTED', 
          data: data,
          timestamp: performance.now()
        }, '*');
      }
      return;
    }
    
    // ArrayBuffer/Blob — skip for now (PW uses string messages)
  }
  
  // Override WebSocket constructor
  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    
    // Check if this is PW's socket (central-socket.penpencil.co or similar)
    if (url && (url.includes('penpencil') || url.includes('pw.live') || url.includes('physicswallah'))) {
      console.log('[PW Sniper WS] Socket intercepted:', url);
      
      // Add event listener for messages (fires alongside onmessage)
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
