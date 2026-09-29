// content.js — PW Poll Sniper Laptop v1.0.0 (WebSocket Intercept + Keyboard Shortcuts)
// FASTEST possible: WebSocket intercept → pre-click ready → instant answer when DOM renders

(function() {
  'use strict';

  // ============================================
  // CONSTANTS — ULTRA FAST (LAPTOP OPTIMIZED)
  // ============================================
  const PW = {
    RECORDED_POLL_ICON: '#record-poll-icon',
    LIVE_POLL_BUTTON: '#vjs-custom-poll-button',
    LIVE_POLL_BUTTON_ALT: '[data-testid="poll-button"]',
    LIVE_POLL_ICON: '#poll-icon',
    POLL_IMAGE: '#poll-image',
    OPTION_SPAN: 'span.line-clamp-1',
    OPTION_SPAN_FALLBACK: 'span[class*="line-clamp"], span[class*="truncate"], span[class*="overflow-hidden"]',
    SUBMIT_TEXT: 'Submit Answer',
    SUBMIT_TEXTS: ['Submit Answer', 'Submit', 'SUBMIT', 'Submit answer'],
    RESULT_TEXTS: ['Correct Answer is', 'Not Participated', 'Answered Correctly', 'You did not attempt', 'Wrong Answer', 'Incorrect'],
    POLL_DELAY: 10,         // ULTRA FAST: 10ms (minimum safe for React)
    SUBMIT_DELAY: 5,        // ULTRA FAST: 5ms (minimum safe for React state)
    HUMAN_DELAY_MIN: 500,
    HUMAN_DELAY_MAX: 1500,
    POLL_INTERVAL: 10,      // MAXIMUM FAST: 10ms detection (laptop CPU can handle)
    PROCESSING_LOCK: 3000,
    ICON_RESET_TIME: 5000,
    PANEL_OPEN_TIMEOUT: 2000,  // Faster timeout
    PROCESSING_SAFETY_TIMEOUT: 15000,
    NOTIFICATION_DURATION: 2500,
    WS_ADVANTAGE_DISPLAY: 5000
  };

  // ============================================
  // STATE
  // ============================================
  let initialized = false;
  let checkInterval = null;
  let selectedOption = null;
  let nextPollAnswer = null;
  let autoSubmit = true;
  let autoOpen = true;
  let extensionActive = true;
  let lastPollTime = 0;
  let lastAnsweredPollHash = '';
  let pollCount = 0;
  let isProcessing = false;
  let pollIconClickedAt = 0;
  let pollHistory = [];
  let errorLog = [];
  let isCheckRunning = false;
  let pollDelay = PW.POLL_DELAY;
  let submitDelay = PW.SUBMIT_DELAY;
  let humanDelayMin = PW.HUMAN_DELAY_MIN;
  let humanDelayMax = PW.HUMAN_DELAY_MAX;
  let useHumanDelay = false;
  let pollDetectionInterval = PW.POLL_INTERVAL;
  let panelOpening = false;
  let isPanelVisible = true;
  let processingSafetyTimer = null;
  let panelPosition = null;
  let pollAnswerTimer1 = null;
  let pollAnswerTimer2 = null;
  let pollAnswerTimer3 = null;

  // ============================================
  // WEBSOCKET INTERCEPT STATE
  // ============================================
  let wsPollDetected = false;       // WebSocket detected poll before DOM
  let wsPollTimestamp = 0;          // When WS detected the poll
  let wsPollData = null;            // Raw poll data from WS
  let wsAdvantageMs = 0;            // How many ms WS was ahead of DOM
  let lastWsPollTime = 0;           // Debounce WS detections
  let wsPreClickInterval = null;    // Ultra-fast watcher after WS detect
  let wsPreClickStartTime = 0;      // When pre-click watcher started

  // UI elements
  let statusPanel = null;
  let dragListenersAttached = false;  // FIX: Prevent memory leak — only attach drag listeners once

  // ============================================
  // STORAGE HELPERS
  // ============================================
  function saveToStorage(key, value) {
    try { chrome.storage.local.set({ [key]: value }); } catch(e) {}
  }

  function savePollHistory() {
    pollHistory = pollHistory.slice(-50);
    saveToStorage('pollHistory', pollHistory);
  }

  function saveErrorLog() {
    errorLog = errorLog.slice(-20);
    saveToStorage('errorLog', errorLog);
  }

  function addPollResult(data) {
    pollHistory.push({
      ...data,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    });
    savePollHistory();
  }

  function addError(msg) {
    errorLog.push({
      msg,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    });
    saveErrorLog();
    console.error('[PW Sniper Laptop] ERROR:', msg);
  }

  // ============================================
  // WEBSOCKET MESSAGE HANDLER
  // ============================================
  function handleWebSocketMessage(event) {
    // FIX: Only process messages from our own window (not iframes or other origins)
    if (event.source !== window) return;
    if (!event.data || typeof event.data !== 'object') return;

    const msg = event.data;

    if (msg.type === 'PW_POLL_WS_DETECTED' || msg.type === 'PW_POLL_FETCH_DETECTED' || msg.type === 'PW_POLL_XHR_DETECTED') {
      const now = performance.now();
      
      // Debounce: ignore if same poll detected within 2 seconds
      if (now - lastWsPollTime < 2000) return;
      lastWsPollTime = now;

      wsPollDetected = true;
      wsPollTimestamp = now;
      wsPollData = msg.data;

      console.log('[PW Sniper] 🔥 WebSocket poll detected BEFORE DOM!', msg.data);

      // Pre-open the poll panel if autoOpen is enabled
      if (autoOpen && (nextPollAnswer || selectedOption)) {
        // Try to click poll icon immediately — panel will be ready when DOM renders
        setTimeout(() => {
          tryOpenPollImmediate();
        }, 10);
        
        // ULTRA FAST: Start pre-click watcher — clicks answer the instant DOM renders
        // FIX: Don't start watcher if already processing a poll
        if (!isProcessing) {
          startWsPreClickWatcher();
        }
      }

      // Clear WS flag after 10 seconds (in case DOM never renders)
      setTimeout(() => {
        wsPollDetected = false;
        wsPollData = null;
      }, 10000);
    }

    if (msg.type === 'PW_POLL_WS_SEND') {
      console.log('[PW Sniper] WS Send intercepted:', msg.data);
    }
  }

  // Try to open poll panel immediately (called from WS intercept)
  function tryOpenPollImmediate() {
    if (!extensionActive) return; // FIX: Don't act if extension is OFF
    if (panelOpening) return;
    
    try {
      let pollIcon = document.querySelector('#poll-icon');
      if (!pollIcon || !isVisible(pollIcon)) {
        pollIcon = document.querySelector('#record-poll-icon');
        if (!pollIcon || !isVisible(pollIcon)) return;
      }

      // Check SVG fill color
      const svgPaths = pollIcon.querySelectorAll('svg path');
      if (!svgPaths || svgPaths.length === 0) return;

      let pollDetected = false;
      for (const path of svgPaths) {
        const fillColor = path.getAttribute('fill');
        if (fillColor) {
          const normalizedColor = fillColor.toLowerCase().trim();
          const isWhite = normalizedColor === '#ffffff' || normalizedColor === '#fff' || normalizedColor === 'white' || normalizedColor.includes('255, 255, 255') || normalizedColor.includes('255,255,255');
          if (!isWhite) { pollDetected = true; break; }
        }
      }

      if (pollDetected) {
        panelOpening = true;
        const clicked = clickPollIcon(pollIcon);
        if (clicked) {
          pollIconClickedAt = Date.now();
          console.log('[PW Sniper] ⚡ Poll icon pre-clicked via WebSocket!');
          setTimeout(() => { panelOpening = false; }, PW.PANEL_OPEN_TIMEOUT);
        } else {
          panelOpening = false;
        }
      }
    } catch(e) {
      panelOpening = false;
    }
  }

  // ULTRA FAST: Pre-click watcher — runs at 2ms after WS detects poll
  // Clicks the answer the INSTANT DOM renders the options
  function startWsPreClickWatcher() {
    if (wsPreClickInterval) clearInterval(wsPreClickInterval);
    wsPreClickStartTime = performance.now();
    
    const answer = getCurrentAnswer();
    if (!answer) return; // No answer selected, skip pre-click
    
    let attempts = 0;
    wsPreClickInterval = setInterval(() => {
      attempts++;
      
      // Stop after 500 attempts (500 * 2ms = 1 second) or if already processing
      if (attempts > 500 || isProcessing) {
        clearInterval(wsPreClickInterval);
        wsPreClickInterval = null;
        return;
      }
      
      try {
        const options = findOptions();
        if (options.length >= 2 && isPollActive(options)) {
          // OPTIONS FOUND! Click IMMEDIATELY — no delays!
          clearInterval(wsPreClickInterval);
          wsPreClickInterval = null;
          
          const pollHash = generatePollHash(options);
          if (pollHash === lastAnsweredPollHash) return;
          
          // Calculate WS advantage
          if (wsPollTimestamp > 0) {
            wsAdvantageMs = Math.round(performance.now() - wsPollTimestamp);
            wsPollDetected = false;
            setTimeout(() => { wsAdvantageMs = 0; updateUI(); }, PW.WS_ADVANTAGE_DISPLAY);
          }
          
          // Trigger answerPoll with ULTRA FAST mode
          isProcessing = true;
          lastPollTime = Date.now();
          
          if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
          processingSafetyTimer = setTimeout(() => {
            if (isProcessing) {
              isProcessing = false;
              addError('isProcessing force-reset after 15s timeout');
              updateUI();
            }
          }, PW.PROCESSING_SAFETY_TIMEOUT);
          
          answerPollUltraFast(options);
        }
      } catch(e) {}
    }, 2); // 2ms — MAXIMUM FAST (safe: only runs for 1 second max)
  }

  // ULTRA FAST answer — skips pollDelay, goes straight to click + submit
  function answerPollUltraFast(options) {
    // FIX: Stop the WS watcher since we're handling this poll now
    if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
    
    try {
      const target = getCurrentAnswer();
      if (!target) {
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      const option = options.find(o => o.letter === target);
      if (!option) {
        addError(`Poll #${pollCount}: WS Pre-click - option ${target} not found`);
        // FIX: Reset answer to prevent retry loop
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        // FIX: Set hash to prevent checkForPoll retry
        lastAnsweredPollHash = generatePollHash(options);
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      const startTime = performance.now();
      showNotification(`⚡ WS Pre-click: ${target}`, '#fbbf24');

      // FIX: Verify button still exists in DOM before clicking
      if (!option.button || !document.body.contains(option.button)) {
        addError(`Poll #${pollCount}: WS button not in DOM`);
        addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Button gone (WS)', time: '-', ws: '-' });
        showNotification(`✗ Button gone`, '#ef4444');
        // FIX: Set hash to prevent retry loop
        lastAnsweredPollHash = generatePollHash(options);
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      // CLICK IMMEDIATELY — no poll delay!
      let clickMethod = 'DOM';
      const reactClicked = clickViaReact(option.button);
      if (reactClicked) clickMethod = 'React';
      else dispatchClick(option.button);

      if (option.radio) {
        option.radio.checked = true;
        option.radio.dispatchEvent(new Event('change', { bubbles: true }));
        option.radio.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Submit after minimal delay (5ms)
      if (autoSubmit) {
        if (pollAnswerTimer3) clearTimeout(pollAnswerTimer3);
        pollAnswerTimer3 = setTimeout(() => {
          pollAnswerTimer3 = null;
          try {
            const submitBtn = findSubmitButton();
            if (submitBtn) {
              let submitMethod = 'DOM';
              const submitReactClicked = clickViaReact(submitBtn);
              if (submitReactClicked) submitMethod = 'React';
              else dispatchClick(submitBtn);

              const time = Math.round(performance.now() - startTime);
              pollCount++;
              saveToStorage('pollCount', pollCount);

              const wsInfo = wsAdvantageMs > 0 ? `${wsAdvantageMs}ms` : '-';
              addPollResult({
                poll: pollCount, answer: target, status: 'SUCCESS',
                click: clickMethod + '+WS', submit: submitMethod,
                time: time + 'ms', ws: wsInfo
              });

              sendToBackground({ type: 'POLL_ANSWERED', responseTime: time, pollCount });
              showNotification(`⚡ #${pollCount} ${time}ms (WS +${wsAdvantageMs}ms)`, '#10b981');
              
              lastAnsweredPollHash = generatePollHash(options);
              selectedOption = null;
              nextPollAnswer = null;
              saveToStorage('selectedOption', null);
            } else {
              addError(`Poll #${pollCount} WS: Submit not found`);
              addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'No submit (WS)', time: '-', ws: '-' });
              showNotification(`⚠ No submit`, '#f59e0b');
              nextPollAnswer = null;
              // FIX: Set hash to prevent checkForPoll retry loop
              lastAnsweredPollHash = generatePollHash(options);
            }
          } catch(e) {
            addError(`Poll #${pollCount} WS submit: ${e.message}`);
            nextPollAnswer = null;
            // FIX: Set hash to prevent retry loop on exception
            lastAnsweredPollHash = generatePollHash(options);
          } finally {
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, submitDelay); // 5ms submit delay
      } else {
        pollCount++;
        saveToStorage('pollCount', pollCount);
        addPollResult({ poll: pollCount, answer: target, status: 'SELECTED', reason: 'WS Pre-click', time: '-', ws: '-' });
        selectedOption = null; nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
      }
    } catch(e) {
      addError(`Poll #${pollCount} WS: ${e.message}`);
      isProcessing = false;
      if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
      updateUI();
    }
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    if (initialized) return;
    initialized = true;

    try {
      const existing = document.getElementById('pw-sniper-panel');
      if (existing) existing.remove();

      // Listen for WebSocket messages from inject.js (MAIN world)
      window.addEventListener('message', handleWebSocketMessage);

      chrome.storage.local.get(
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive', 'pollDetectionInterval', 'panelPosition'],
        (result) => {
          selectedOption = null;
          nextPollAnswer = null;
          autoSubmit = result.autoSubmit !== false;
          autoOpen = result.autoOpen !== false;
          pollHistory = result.pollHistory || [];
          errorLog = result.errorLog || [];
          pollDelay = (result.pollDelay !== undefined && result.pollDelay !== null) ? Math.max(0, parseInt(result.pollDelay) || PW.POLL_DELAY) : PW.POLL_DELAY;
          submitDelay = (result.submitDelay !== undefined && result.submitDelay !== null) ? Math.max(0, parseInt(result.submitDelay) || PW.SUBMIT_DELAY) : PW.SUBMIT_DELAY;
          humanDelayMin = (result.humanDelayMin !== undefined && result.humanDelayMin !== null) ? Math.max(0, parseInt(result.humanDelayMin) || PW.HUMAN_DELAY_MIN) : PW.HUMAN_DELAY_MIN;
          humanDelayMax = (result.humanDelayMax !== undefined && result.humanDelayMax !== null) ? Math.max(humanDelayMin, parseInt(result.humanDelayMax) || PW.HUMAN_DELAY_MAX) : PW.HUMAN_DELAY_MAX;
          pollCount = Math.max(0, parseInt(result.pollCount) || 0);
          useHumanDelay = result.useHumanDelay === true;
          extensionActive = result.extensionActive !== false;
          pollDetectionInterval = (result.pollDetectionInterval !== undefined && result.pollDetectionInterval !== null) ? Math.max(5, parseInt(result.pollDetectionInterval) || PW.POLL_INTERVAL) : PW.POLL_INTERVAL;
          panelPosition = result.panelPosition || null;

          createStatusPanel();
          setupKeyboardShortcuts();

          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);

          window.addEventListener('beforeunload', () => {
            if (checkInterval) clearInterval(checkInterval);
            if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
            if (pollAnswerTimer1) clearTimeout(pollAnswerTimer1);
            if (pollAnswerTimer2) clearTimeout(pollAnswerTimer2);
            if (pollAnswerTimer3) clearTimeout(pollAnswerTimer3);
            if (wsPreClickInterval) clearInterval(wsPreClickInterval);
            if (urlChangeCheck) clearInterval(urlChangeCheck);
            window.removeEventListener('message', handleWebSocketMessage);
          });

          let lastURL = window.location.href;
          const urlChangeCheck = setInterval(() => {
            if (window.location.href !== lastURL) {
              lastURL = window.location.href;
              panelOpening = false;
              pollIconClickedAt = 0;
              wsPollDetected = false;
              // FIX: Stop WS watcher on SPA navigation
              if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
              // FIX: Clear pending answer timers to prevent stale clicks on new page
              if (pollAnswerTimer1) { clearTimeout(pollAnswerTimer1); pollAnswerTimer1 = null; }
              if (pollAnswerTimer2) { clearTimeout(pollAnswerTimer2); pollAnswerTimer2 = null; }
              if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }
              isProcessing = false;
              if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
              updateUI();
            }
          }, 500);

          window.addEventListener('popstate', () => {
            panelOpening = false;
            pollIconClickedAt = 0;
            wsPollDetected = false;
            if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
            // FIX: Clear pending answer timers on back/forward navigation
            if (pollAnswerTimer1) { clearTimeout(pollAnswerTimer1); pollAnswerTimer1 = null; }
            if (pollAnswerTimer2) { clearTimeout(pollAnswerTimer2); pollAnswerTimer2 = null; }
            if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            setTimeout(updateUI, 100);
          });
        }
      );

      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        handleMessage(msg, sendResponse);
        return true;
      });

      chrome.storage.onChanged.addListener((changes) => {
        if (changes.selectedOption) { selectedOption = changes.selectedOption.newValue; updateUI(); }
        if (changes.autoSubmit !== undefined) autoSubmit = changes.autoSubmit.newValue;
        if (changes.autoOpen !== undefined) autoOpen = changes.autoOpen.newValue;
        if (changes.extensionActive !== undefined) {
          extensionActive = changes.extensionActive.newValue;
          if (!extensionActive) {
            if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
            // FIX: Stop ALL timers when extension disabled
            if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
            if (pollAnswerTimer1) { clearTimeout(pollAnswerTimer1); pollAnswerTimer1 = null; }
            if (pollAnswerTimer2) { clearTimeout(pollAnswerTimer2); pollAnswerTimer2 = null; }
            if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
          } else if (!checkInterval) {
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          }
          updateUI();
        }
        if (changes.pollDelay !== undefined) pollDelay = changes.pollDelay.newValue;
        if (changes.submitDelay !== undefined) submitDelay = changes.submitDelay.newValue;
        if (changes.humanDelayMin !== undefined) humanDelayMin = changes.humanDelayMin.newValue;
        if (changes.humanDelayMax !== undefined) humanDelayMax = changes.humanDelayMax.newValue;
        if (changes.useHumanDelay !== undefined) useHumanDelay = changes.useHumanDelay.newValue;
        if (changes.pollDetectionInterval !== undefined) {
          pollDetectionInterval = changes.pollDetectionInterval.newValue;
          if (extensionActive) {
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          }
        }
      });

    } catch(e) {
      addError('Init error: ' + e.message);
    }
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      switch(e.key.toLowerCase()) {
        case 'a': case 'b': case 'c': case 'd':
          e.preventDefault();
          const letter = e.key.toUpperCase();
          handleLetterPress(letter);
          break;
        case 'p':
          e.preventDefault();
          extensionActive = !extensionActive;
          saveToStorage('extensionActive', extensionActive);
          if (!extensionActive) {
            if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
            // FIX: Stop all timers when toggled OFF via keyboard
            if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
            if (pollAnswerTimer1) { clearTimeout(pollAnswerTimer1); pollAnswerTimer1 = null; }
            if (pollAnswerTimer2) { clearTimeout(pollAnswerTimer2); pollAnswerTimer2 = null; }
            if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
          } else if (!checkInterval) {
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          }
          updateUI();
          showNotification(extensionActive ? '🟢 Extension ON' : '🔴 Extension OFF', extensionActive ? '#10b981' : '#ef4444');
          break;
        case 'h':
          e.preventDefault();
          isPanelVisible = !isPanelVisible;
          if (statusPanel) statusPanel.style.display = isPanelVisible ? 'block' : 'none';
          break;
        case '1': case '2': case '3': case '4':
          e.preventDefault();
          const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          handleLetterPress(map[e.key]);
          break;
        case 'escape':
          selectedOption = null;
          nextPollAnswer = null;
          saveToStorage('selectedOption', null);
          updateUI();
          break;
      }
    });
  }

  // ============================================
  // DESKTOP STATUS PANEL
  // ============================================
  function createStatusPanel() {
    try {
      if (!document.body) {
        setTimeout(createStatusPanel, 500);
        return;
      }

      const existing = document.getElementById('pw-sniper-panel');
      if (existing) existing.remove();

      statusPanel = document.createElement('div');
      statusPanel.id = 'pw-sniper-panel';
      statusPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        user-select: none;
      `;
      document.body.appendChild(statusPanel);
      updateUI();
    } catch(e) {
      setTimeout(createStatusPanel, 1000);
    }
  }

  function updateUI() {
    if (!statusPanel) return;

    try {
      const answer = selectedOption || '_';
      const mainColor = extensionActive ? '#10b981' : '#ef4444';
      const wsIndicator = wsPollDetected ? '<span style="color: #fbbf24; font-size: 10px;">⚡WS</span>' : '';

      statusPanel.innerHTML = `
        <div id="pw-desktop-panel" style="
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          border: 1px solid ${mainColor};
          min-width: 180px;
          cursor: move;
        ">
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: ${mainColor};">⚡ POLL SNIPER</span>
            <span style="font-size: 10px; color: ${extensionActive ? '#10b981' : '#ef4444'};">${extensionActive ? '● ON' : '○ OFF'}</span>
          </div>

          <!-- Answer Buttons -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 8px;">
            <button id="pw-btn-a" style="padding: 8px 4px; background: ${selectedOption === 'A' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; font-weight: 700; font-size: 13px; cursor: pointer;">A</button>
            <button id="pw-btn-b" style="padding: 8px 4px; background: ${selectedOption === 'B' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; font-weight: 700; font-size: 13px; cursor: pointer;">B</button>
            <button id="pw-btn-c" style="padding: 8px 4px; background: ${selectedOption === 'C' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; font-weight: 700; font-size: 13px; cursor: pointer;">C</button>
            <button id="pw-btn-d" style="padding: 8px 4px; background: ${selectedOption === 'D' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; font-weight: 700; font-size: 13px; cursor: pointer;">D</button>
            <button id="pw-btn-blank" style="padding: 8px 4px; background: ${!selectedOption ? '#6b7280' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; font-weight: 700; font-size: 13px; cursor: pointer;">_</button>
          </div>

          <!-- Status -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
            <span>Polls: ${pollCount} ${wsIndicator}</span>
            <span>${selectedOption ? 'Ans: ' + selectedOption : 'No answer'}</span>
          </div>

          <!-- WS Advantage Display -->
          ${wsAdvantageMs > 0 ? `
          <div style="margin-top: 6px; padding: 4px 6px; background: rgba(251,191,36,0.15); border-radius: 4px; text-align: center;">
            <span style="font-size: 10px; color: #fbbf24;">⚡ WS Advantage: ${wsAdvantageMs}ms</span>
          </div>
          ` : ''}

          <!-- Keyboard Shortcuts -->
          <div style="margin-top: 6px; font-size: 9px; color: #475569; text-align: center;">
            [A-D] Answer | [P] Toggle | [H] Hide | [Esc] Clear
          </div>
        </div>
      `;

      // Add click handlers
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const btn = document.getElementById(`pw-btn-${letter.toLowerCase()}`);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLetterPress(letter);
          });
        }
      });

      const btnBlank = document.getElementById('pw-btn-blank');
      if (btnBlank) {
        btnBlank.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedOption = null;
          nextPollAnswer = null;
          saveToStorage('selectedOption', null);
          updateUI();
        });
      }

      // Make panel draggable
      setupDrag();

      // Apply saved position
      if (panelPosition) {
        const maxLeft = window.innerWidth - 200;
        const maxTop = window.innerHeight - 200;
        const left = Math.max(0, Math.min(maxLeft, parseInt(panelPosition.left) || 0));
        const top = Math.max(0, Math.min(maxTop, parseInt(panelPosition.top) || 0));
        statusPanel.style.left = left + 'px';
        statusPanel.style.top = top + 'px';
        statusPanel.style.right = 'auto';
      }
    } catch(e) {
      console.error('[PW Sniper Laptop] updateUI error:', e);
    }
  }

  // ============================================
  // DRAG HANDLER (Mouse-based for desktop)
  // ============================================
  function setupDrag() {
    const panel = document.getElementById('pw-desktop-panel');
    if (!panel) return;

    // FIX: Only attach document-level listeners once (prevent memory leak)
    if (dragListenersAttached) return;
    dragListenersAttached = true;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Panel mousedown — delegated via statusPanel (persists across updateUI calls)
    statusPanel.addEventListener('mousedown', (e) => {
      const panel = document.getElementById('pw-desktop-panel');
      if (!panel) return;
      if (e.target.tagName === 'BUTTON') return;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = statusPanel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
      if (startX === undefined) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
        const newX = Math.max(0, Math.min(window.innerWidth - 200, initialLeft + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - 200, initialTop + dy));
        statusPanel.style.left = newX + 'px';
        statusPanel.style.top = newY + 'px';
        statusPanel.style.right = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        panelPosition = { left: statusPanel.style.left, top: statusPanel.style.top };
        saveToStorage('panelPosition', panelPosition);
      }
      startX = undefined;
      startY = undefined;
    });
  }

  // ============================================
  // NOTIFICATION
  // ============================================
  let activeNotification = null;

  function showNotification(text, color = '#4ade80') {
    if (!statusPanel) return;

    try {
      if (activeNotification && activeNotification.parentNode) {
        activeNotification.remove();
        activeNotification = null;
      }

      const notif = document.createElement('div');
      notif.style.cssText = `
        position: absolute;
        top: -36px;
        left: 0;
        right: 0;
        background: ${color};
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.3s ease;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      notif.textContent = text;
      statusPanel.appendChild(notif);
      activeNotification = notif;

      setTimeout(() => {
        notif.style.opacity = '1';
        notif.style.transform = 'translateY(0)';
      }, 10);

      setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(-8px)';
        setTimeout(() => {
          if (notif.parentNode) notif.remove();
          if (activeNotification === notif) activeNotification = null;
        }, 300);
      }, PW.NOTIFICATION_DURATION);
    } catch(e) {}
  }

  function handleLetterPress(letter) {
    selectedOption = letter;
    nextPollAnswer = letter;
    saveToStorage('selectedOption', letter);
    updateUI();
    showNotification(`✓ Answer: ${letter}`, '#3b82f6');
  }

  // ============================================
  // POLL DETECTION
  // ============================================
  function checkForPoll() {
    const hasVideo = document.querySelector('video, .video-js, .vjs-tech') !== null;
    const isLectureURL = /\/(batch|study|subject|lecture|class)\//i.test(window.location.href);
    const isLecturePage = hasVideo || isLectureURL;

    if (statusPanel) {
      statusPanel.style.display = (isLecturePage && isPanelVisible) ? 'block' : 'none';
    }

    if (!extensionActive || isProcessing || isCheckRunning) return;
    isCheckRunning = true;

    try {
      const options = findOptions();

      if (options.length >= 2) {
        pollIconClickedAt = 0;

        // Calculate WS advantage if applicable
        if (wsPollDetected && wsPollTimestamp > 0) {
          wsAdvantageMs = Math.round(performance.now() - wsPollTimestamp);
          wsPollDetected = false; // Consumed
          updateUI();
          // Clear WS advantage display after 5 seconds
          setTimeout(() => { wsAdvantageMs = 0; updateUI(); }, PW.WS_ADVANTAGE_DISPLAY);
        }

        if (!isPollActive(options)) { isCheckRunning = false; return; }

        const pollHash = generatePollHash(options);
        if (pollHash === lastAnsweredPollHash) { isCheckRunning = false; return; }

        const hasAnswer = nextPollAnswer || selectedOption;
        if (!hasAnswer) { isCheckRunning = false; return; }

        // FIX: Stop WS watcher ONLY when we're actually going to process (not on early returns)
        if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }

        isProcessing = true;
        lastPollTime = Date.now();

        if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
        processingSafetyTimer = setTimeout(() => {
          if (isProcessing) {
            isProcessing = false;
            addError('isProcessing force-reset after 15s timeout');
            updateUI();
          }
        }, PW.PROCESSING_SAFETY_TIMEOUT);

        answerPoll(options);
      } else {
        if (autoOpen && (nextPollAnswer || selectedOption)) {
          tryOpenPoll(options);
        }
      }
    } catch(e) {
      addError('checkForPoll: ' + e.message);
      isProcessing = false;
    } finally {
      isCheckRunning = false;
    }
  }

  // ============================================
  // FIND OPTIONS
  // ============================================
  function findOptions() {
    try {
      let spans = document.querySelectorAll(PW.OPTION_SPAN);
      if (spans.length === 0) spans = document.querySelectorAll(PW.OPTION_SPAN_FALLBACK);
      const options = [];

      for (const span of spans) {
        const letter = span.textContent.trim().toUpperCase();
        if (!/^[A-D]$/.test(letter)) continue;

        const button = span.closest('button');
        if (!button) continue;

        const radio = button.querySelector('input[type="radio"]');
        const hasModal = button.closest('[role="dialog"], .modal, [class*="poll"], [class*="quiz"]');

        if (!radio && !hasModal) {
          const parent = button.parentElement;
          if (!parent) continue;
          const siblingButtons = parent.querySelectorAll('button');
          if (siblingButtons.length < 2) continue;
          let pollLike = 0;
          for (const sib of siblingButtons) {
            const sibSpan = sib.querySelector(PW.OPTION_SPAN) || sib.querySelector(PW.OPTION_SPAN_FALLBACK);
            if (sibSpan && /^[A-D]$/.test(sibSpan.textContent.trim().toUpperCase())) pollLike++;
          }
          if (pollLike < 2) continue;
        }

        options.push({ button, letter, span, radio });
      }

      return options;
    } catch(e) { return []; }
  }

  // ============================================
  // CHECK IF ACTIVE
  // ============================================
  function isPollActive(options) {
    try {
      if (options.length === 0) return false;
      const btn = options[0].button;
      const classes = btn.className || '';

      if (classes.includes('w-[83%]')) return false;
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

      const btnStyle = window.getComputedStyle(btn);
      if (parseFloat(btnStyle.opacity) < 0.5) return false;

      const submitBtn = findSubmitButton();
      if (classes.includes('w-full')) return !!submitBtn;
      if (submitBtn) return true;

      const pollContainer = btn.closest('[role="dialog"], .modal, [class*="poll"]') || btn.parentElement?.parentElement;
      if (pollContainer) {
        const containerText = pollContainer.textContent || '';
        for (const text of PW.RESULT_TEXTS) {
          if (containerText.includes(text)) return false;
        }
      }

      return true;
    } catch(e) { return true; }
  }

  // ============================================
  // FIND SUBMIT
  // ============================================
  function findSubmitButton() {
    try {
      let spans = document.querySelectorAll(PW.OPTION_SPAN);
      if (spans.length === 0) spans = document.querySelectorAll(PW.OPTION_SPAN_FALLBACK);
      for (const span of spans) {
        if (!/^[A-D]$/.test(span.textContent.trim().toUpperCase())) continue;
        const container = span.closest('[role="dialog"], .modal, [class*="poll"], form')
                        || span.closest('div')?.parentElement?.parentElement;
        if (!container) continue;
        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent.trim();
          if (PW.SUBMIT_TEXTS.includes(text)) return btn;
        }
      }
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = btn.textContent.trim();
        if (PW.SUBMIT_TEXTS.includes(text) && isVisible(btn)) return btn;
      }
      return null;
    } catch(e) { return null; }
  }

  function generatePollHash(options) {
    const letters = options.map(o => o.letter).sort().join('');
    const timeBucket = Math.floor(Date.now() / 5000);
    return `poll_${letters}_${timeBucket}`;
  }

  function getCurrentAnswer() {
    if (nextPollAnswer) return nextPollAnswer;
    return selectedOption ? selectedOption.toUpperCase() : null;
  }

  // ============================================
  // ANSWER POLL
  // ============================================
  function answerPoll(options) {
    try {
      const target = getCurrentAnswer();
      if (!target) {
        addError(`Poll #${pollCount}: No answer selected`);
        addPollResult({ poll: pollCount, answer: 'NONE', status: 'FAILED', reason: 'No answer selected', time: '-', ws: wsAdvantageMs > 0 ? wsAdvantageMs + 'ms' : '-' });
        showNotification('⚠ No answer selected', '#f59e0b');
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      const option = options.find(o => o.letter === target);
      if (!option) {
        addError(`Poll #${pollCount}: Target option ${target} not found`);
        addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Option not found', time: '-', ws: '-' });
        showNotification(`✗ Option ${target} not found`, '#ef4444');
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      updateUI();
      showNotification(`⏳ ${target}...`, '#fbbf24');

      const startTime = performance.now();

      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
      }

      // ULTRA FAST: Single execution with minimal delays
      const executeAnswer = () => {
        // Poll delay (10ms default)
        if (pollAnswerTimer2) clearTimeout(pollAnswerTimer2);
        pollAnswerTimer2 = setTimeout(() => {
          pollAnswerTimer2 = null;
          try {
            // FIX: Verify button still exists in DOM after delay
            if (!option.button || !document.body.contains(option.button)) {
              addError(`Poll #${pollCount}: Button removed from DOM during delay`);
              addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Button gone', time: '-', ws: '-' });
              showNotification(`✗ Button gone`, '#ef4444');
              nextPollAnswer = null;
              // FIX: Set hash to prevent retry loop
              lastAnsweredPollHash = generatePollHash(options);
              isProcessing = false;
              if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
              updateUI();
              return;
            }

            showNotification(`🎯 ${target}...`, '#3b82f6');

            let clickMethod = 'DOM';
            const reactClicked = clickViaReact(option.button);
            if (reactClicked) {
              clickMethod = 'React';
            } else {
              dispatchClick(option.button);
            }

            if (option.radio) {
              option.radio.checked = true;
              option.radio.dispatchEvent(new Event('change', { bubbles: true }));
              option.radio.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const isNowSelected = option.button.classList.contains('bg-blue') ||
                                  option.button.getAttribute('aria-checked') === 'true' ||
                                  (option.radio && option.radio.checked) ||
                                  option.button.querySelector('input[type="radio"]:checked');
            if (!isNowSelected) {
              dispatchClick(option.button);
              if (option.radio) {
                option.radio.checked = true;
                option.radio.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }

            if (autoSubmit) {
              if (pollAnswerTimer3) clearTimeout(pollAnswerTimer3);
              pollAnswerTimer3 = setTimeout(() => {
                pollAnswerTimer3 = null;
                try {
                  const submitBtn = findSubmitButton();
                  if (submitBtn) {
                    let submitMethod = 'DOM';
                    const submitReactClicked = clickViaReact(submitBtn);
                    if (submitReactClicked) {
                      submitMethod = 'React';
                    } else {
                      dispatchClick(submitBtn);
                    }

                    const time = Math.round(performance.now() - startTime);

                    pollCount++;
                    saveToStorage('pollCount', pollCount);

                    const wsInfo = wsAdvantageMs > 0 ? `${wsAdvantageMs}ms` : '-';

                    addPollResult({
                      poll: pollCount,
                      answer: target,
                      status: 'SUCCESS',
                      click: clickMethod,
                      submit: submitMethod,
                      time: time + 'ms',
                      ws: wsInfo
                    });

                    sendToBackground({
                      type: 'POLL_ANSWERED',
                      responseTime: time,
                      pollCount: pollCount
                    });

                    const wsText = wsAdvantageMs > 0 ? ` (WS +${wsAdvantageMs}ms)` : '';
                    showNotification(`✓ #${pollCount} ${time}ms${wsText}`, '#10b981');

                    lastAnsweredPollHash = generatePollHash(options);
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
                  } else {
                    const time = Math.round(performance.now() - startTime);
                    addError(`Poll #${pollCount}: Submit button not found`);
                    addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'No submit button', time: time + 'ms', ws: '-' });
                    showNotification(`⚠ #${pollCount} No submit`, '#f59e0b');
                    nextPollAnswer = null;
                    // FIX: Set hash to prevent checkForPoll retry loop
                    lastAnsweredPollHash = generatePollHash(options);
                  }
                } catch(e) {
                  addError(`Poll #${pollCount} submit: ${e.message}`);
                  addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Submit error: ' + e.message, time: '-', ws: '-' });
                  showNotification(`✗ #${pollCount} Error`, '#ef4444');
                  nextPollAnswer = null;
                  // FIX: Set hash to prevent retry loop on exception
                  lastAnsweredPollHash = generatePollHash(options);
                } finally {
                  isProcessing = false;
                  if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
                  updateUI();
                }
              }, submitDelay);
            } else {
              pollCount++;
              saveToStorage('pollCount', pollCount);
              addPollResult({ poll: pollCount, answer: target, status: 'SELECTED', reason: 'Auto-submit disabled', time: '-', ws: '-' });
              selectedOption = null;
              nextPollAnswer = null;
              saveToStorage('selectedOption', null);
              isProcessing = false;
              if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
              updateUI();
            }
          } catch(e) {
            addError(`Poll #${pollCount} answer: ${e.message}`);
            addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Answer error: ' + e.message, time: '-', ws: '-' });
            showNotification(`✗ #${pollCount} Error`, '#ef4444');
            nextPollAnswer = null;
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, pollDelay);
      };

      // Execute: with human delay if enabled, else immediately
      if (humanDelay > 0) {
        if (pollAnswerTimer1) clearTimeout(pollAnswerTimer1);
        pollAnswerTimer1 = setTimeout(() => { pollAnswerTimer1 = null; executeAnswer(); }, humanDelay);
      } else {
        executeAnswer();
      }
    } catch(e) {
      addError(`Poll #${pollCount}: ${e.message}`);
      showNotification('✗ Error', '#ef4444');
      nextPollAnswer = null;
      isProcessing = false;
      if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
      updateUI();
    }
  }

  // ============================================
  // TRY OPEN POLL
  // ============================================
  function tryOpenPoll(existingOptions) {
    if (existingOptions && existingOptions.length >= 2) return;
    if (panelOpening) return;

    const now = Date.now();
    if (pollIconClickedAt > 0 && (now - pollIconClickedAt) < PW.ICON_RESET_TIME) return;

    try {
      let pollIcon = document.querySelector('#poll-icon');
      if (!pollIcon || !isVisible(pollIcon)) {
        pollIcon = document.querySelector('#record-poll-icon');
        if (!pollIcon || !isVisible(pollIcon)) return;
      }

      const svgPaths = pollIcon.querySelectorAll('svg path');
      if (!svgPaths || svgPaths.length === 0) return;

      let pollDetected = false;
      for (const path of svgPaths) {
        const fillColor = path.getAttribute('fill');
        if (fillColor) {
          const normalizedColor = fillColor.toLowerCase().trim();
          const isWhite = normalizedColor === '#ffffff' || normalizedColor === '#fff' || normalizedColor === 'white' || normalizedColor.includes('255, 255, 255') || normalizedColor.includes('255,255,255');
          if (!isWhite) { pollDetected = true; break; }
        }
      }

      if (!pollDetected && svgPaths.length > 0) {
        try {
          const computedFill = window.getComputedStyle(svgPaths[0]).fill;
          if (computedFill && !computedFill.includes('255, 255, 255') && computedFill !== 'white') pollDetected = true;
        } catch(e) {}
      }

      if (pollDetected) {
        panelOpening = true;
        const clicked = clickPollIcon(pollIcon);
        if (clicked) {
          pollIconClickedAt = now;
          setTimeout(() => { panelOpening = false; }, PW.PANEL_OPEN_TIMEOUT);
        } else {
          panelOpening = false;
        }
      } else {
        pollIconClickedAt = 0;
      }
    } catch(e) {
      addError('tryOpenPoll: ' + e.message);
      panelOpening = false;
    }
  }

  // ============================================
  // CLICK HELPERS (Desktop optimized — no touch events)
  // ============================================
  function clickPollIcon(el) {
    if (!el) return false;

    try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch(e) {}

    // Try React onClick FIRST
    const props = getReactProps(el);
    if (props && typeof props.onClick === 'function') {
      try {
        props.onClick({
          preventDefault: () => {}, stopPropagation: () => {},
          nativeEvent: new MouseEvent('click'), target: el, currentTarget: el,
          type: 'click', bubbles: true
        });
        return true;
      } catch(e) {}
    }

    // Try parent React handlers
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const parentProps = getReactProps(parent);
      if (parentProps && typeof parentProps.onClick === 'function') {
        try {
          parentProps.onClick({
            preventDefault: () => {}, stopPropagation: () => {},
            nativeEvent: new MouseEvent('click'), target: el, currentTarget: parent,
            type: 'click', bubbles: true
          });
          return true;
        } catch(e) {}
      }
      parent = parent.parentElement;
    }

    // Desktop mouse events
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      return true;
    } catch(e) {}

    try { if (typeof el.click === 'function') { el.click(); return true; } } catch(e) {}
    return false;
  }

  function dispatchClick(el) {
    if (!el) return;
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      // NOTE: Do NOT call el.click() here — dispatched events already trigger the click
      // Calling el.click() would cause double-click (double submission risk)
    } catch(e) {}
  }

  function getReactProps(element) {
    try {
      const key = Object.keys(element).find(k => k.startsWith('__reactProps$'));
      return key ? element[key] : null;
    } catch(e) { return null; }
  }

  function clickViaReact(element) {
    try {
      const props = getReactProps(element);
      if (props && typeof props.onClick === 'function') {
        props.onClick({
          preventDefault: () => {}, stopPropagation: () => {},
          nativeEvent: new MouseEvent('click'), target: element, currentTarget: element,
          type: 'click', bubbles: true
        });
        return true;
      }
      return false;
    } catch(e) { return false; }
  }

  function isVisible(el) {
    try {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = window.getComputedStyle(el);
      if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') return false;
      return true;
    } catch(e) { return false; }
  }

  function sendToBackground(data) {
    try { chrome.runtime.sendMessage(data).catch(() => {}); } catch(e) {}
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
  function handleMessage(msg, sendResponse) {
    try {
      switch(msg.type) {
        case 'OPTION_CHANGED':
          selectedOption = msg.option;
          nextPollAnswer = msg.option;
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;
        case 'EXTENSION_TOGGLED':
          extensionActive = !!msg.active;
          saveToStorage('extensionActive', extensionActive);
          if (!extensionActive) {
            if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
            // FIX: Stop all timers when toggled OFF via dashboard
            if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }
            if (pollAnswerTimer1) { clearTimeout(pollAnswerTimer1); pollAnswerTimer1 = null; }
            if (pollAnswerTimer2) { clearTimeout(pollAnswerTimer2); pollAnswerTimer2 = null; }
            if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
          } else if (!checkInterval) {
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          }
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;
        case 'GET_HISTORY':
          if (sendResponse) sendResponse({ pollHistory, errorLog, pollCount });
          break;
        case 'CLEAR_HISTORY':
          pollHistory = []; errorLog = []; pollCount = 0;
          selectedOption = null; nextPollAnswer = null;
          savePollHistory(); saveErrorLog();
          saveToStorage('pollCount', 0); saveToStorage('selectedOption', null);
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;
        case 'GET_STATUS':
          if (sendResponse) sendResponse({
            active: extensionActive, selectedOption, nextPollAnswer,
            pollCount, pollDelay, submitDelay, humanDelayMin, humanDelayMax,
            useHumanDelay, wsDetected: wsPollDetected, wsAdvantage: wsAdvantageMs
          });
          break;
        case 'SET_TIMING':
          if (msg.pollDelay !== undefined) { pollDelay = Math.max(0, parseInt(msg.pollDelay) || PW.POLL_DELAY); saveToStorage('pollDelay', pollDelay); }
          if (msg.submitDelay !== undefined) { submitDelay = Math.max(0, parseInt(msg.submitDelay) || PW.SUBMIT_DELAY); saveToStorage('submitDelay', submitDelay); }
          if (msg.humanDelayMin !== undefined) { humanDelayMin = Math.max(0, parseInt(msg.humanDelayMin) || PW.HUMAN_DELAY_MIN); saveToStorage('humanDelayMin', humanDelayMin); }
          if (msg.humanDelayMax !== undefined) { humanDelayMax = Math.max(humanDelayMin, parseInt(msg.humanDelayMax) || PW.HUMAN_DELAY_MAX); saveToStorage('humanDelayMax', humanDelayMax); }
          if (msg.useHumanDelay !== undefined) { useHumanDelay = msg.useHumanDelay; saveToStorage('useHumanDelay', useHumanDelay); }
          if (sendResponse) sendResponse({ ok: true });
          break;
        default:
          if (sendResponse) sendResponse({ ok: false, reason: 'Unknown message type' });
      }
    } catch(e) {
      if (sendResponse) sendResponse({ ok: false, reason: e.message });
    }
  }

  // ============================================
  // START
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
