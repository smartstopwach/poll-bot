// content.js - PW Poll Sniper v5.4.0 (WebSocket Intercept + Proven v5.3.8 Logic)
// WS intercept for 300-400ms faster detection | DOM polling as reliable fallback
// All v5.3.8 logic preserved | Q-mode keyboard | Color-based detection

(function () {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================
  const PW = {
    RECORDED_POLL_ICON: '#record-poll-icon',
    LIVE_POLL_BUTTON: '#vjs-custom-poll-button',
    LIVE_POLL_BUTTON_ALT: '[data-testid="poll-button"]',
    LIVE_POLL_ICON: '#poll-icon',
    POLL_IMAGE: '#poll-image',
    OPTION_SPAN: 'span.line-clamp-1',
    SUBMIT_TEXT: 'Submit Answer',
    RESULT_TEXTS: ['Correct Answer is', 'Not Participated', 'Answered Correctly', 'You did not attempt'],
    POLL_DELAY: 50,        // Fastest safe for React (was 260)
    SUBMIT_DELAY: 25,
    HUMAN_DELAY_MIN: 500,
    HUMAN_DELAY_MAX: 1500,
    POLL_INTERVAL: 50,     // Faster detection (was 100)
    PROCESSING_LOCK: 3000,
    ICON_RESET_TIME: 5000, // FIX #1: Was 1800000 (30 min!) → Now 5 seconds
    PANEL_OPEN_TIMEOUT: 3000, // FIX #4: Was 2000 → Now 3 seconds
    PROCESSING_SAFETY_TIMEOUT: 15000, // FIX #3: Force reset isProcessing after 15s
    NOTIFICATION_DURATION: 2500,
    // Aggressive mode minimums (non-zero, maximum speed)
    AGGRESSIVE_POLL_INTERVAL: 10,
    AGGRESSIVE_POLL_DELAY: 10,
    AGGRESSIVE_SUBMIT_DELAY: 5,
    AGGRESSIVE_WS_WATCHER: 2
  };

  // ============================================
  // STATE
  // ============================================
  let initialized = false;
  let checkInterval = null;
  let selectedOption = null;
  let nextPollAnswer = null;
  let waitingForAnswer = false;
  let waitingForAnswerTimeout = null;
  let autoSubmit = true;
  let autoOpen = true;
  let extensionActive = false;
  let lastAnsweredPollHash = '';
  let pollCount = 0;
  let isProcessing = false;
  let processingSafetyTimer = null; // FIX #3: Safety timeout for isProcessing
  let pollIconClickedAt = 0;
  let pollHistory = [];
  let errorLog = [];
  let activeNotification = null;
  let isCheckRunning = false;
  let pollDelay = PW.POLL_DELAY;
  let submitDelay = PW.SUBMIT_DELAY;
  let pollDetectionInterval = PW.POLL_INTERVAL;
  let humanDelayMin = PW.HUMAN_DELAY_MIN;
  let humanDelayMax = PW.HUMAN_DELAY_MAX;
  let useHumanDelay = false;
  let panelOpening = false;
  let aggressiveMode = false;  // Aggressive mode: minimum delays

  // UI elements
  let statusPanel = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // ============================================
  // STORAGE HELPERS
  // ============================================
  function saveToStorage(key, value) {
    try {
      chrome.storage.local.set({ [key]: value });
    } catch (e) {}
  }

  function savePollHistory() {
    saveToStorage('pollHistory', pollHistory.slice(-50));
  }

  function saveErrorLog() {
    saveToStorage('errorLog', errorLog.slice(-20));
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
    console.error('[PW Sniper] ERROR:', msg);
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

      chrome.storage.local.get(
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'pollDetectionInterval', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive', 'panelOpacity', 'aggressiveMode'],
        (result) => {
          selectedOption = null;
          nextPollAnswer = null;
          autoSubmit = result.autoSubmit !== false;
          autoOpen = result.autoOpen !== false;
          pollHistory = result.pollHistory || [];
          errorLog = result.errorLog || [];
          pollCount = result.pollCount || 0;
          pollDelay = (result.pollDelay !== undefined && result.pollDelay !== null) ? result.pollDelay : PW.POLL_DELAY;
          submitDelay = (result.submitDelay !== undefined && result.submitDelay !== null) ? result.submitDelay : PW.SUBMIT_DELAY;
          pollDetectionInterval = (result.pollDetectionInterval !== undefined && result.pollDetectionInterval !== null) ? result.pollDetectionInterval : PW.POLL_INTERVAL;
          humanDelayMin = (result.humanDelayMin !== undefined && result.humanDelayMin !== null) ? result.humanDelayMin : PW.HUMAN_DELAY_MIN;
          humanDelayMax = (result.humanDelayMax !== undefined && result.humanDelayMax !== null) ? result.humanDelayMax : PW.HUMAN_DELAY_MAX;
          useHumanDelay = result.useHumanDelay === true;  // Default OFF for speed
          extensionActive = result.extensionActive !== false;  // Default ON
          aggressiveMode = result.aggressiveMode === true;  // Default OFF
          
          // Apply panel opacity if saved
          if (result.panelOpacity !== undefined && statusPanel) {
            statusPanel.style.opacity = result.panelOpacity / 100;
          }
          
          updateUI();
          
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
        }
      );

      createStatusPanel();
      setupKeyboard();
      setupDrag();
      setupWebSocketListener();

      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        handleMessage(msg, sendResponse);
        return true;
      });

      chrome.storage.onChanged.addListener((changes) => {
        if (changes.selectedOption) {
          selectedOption = changes.selectedOption.newValue;
          updateUI();
        }
        if (changes.autoSubmit !== undefined) autoSubmit = changes.autoSubmit.newValue;
        if (changes.autoOpen !== undefined) autoOpen = changes.autoOpen.newValue;
        if (changes.extensionActive !== undefined) {
          extensionActive = changes.extensionActive.newValue;
          updateUI();
        }
        if (changes.pollDelay !== undefined) pollDelay = changes.pollDelay.newValue;
        if (changes.submitDelay !== undefined) submitDelay = changes.submitDelay.newValue;
        if (changes.pollDetectionInterval !== undefined) {
          pollDetectionInterval = changes.pollDetectionInterval.newValue;
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
        }
        if (changes.humanDelayMin !== undefined) humanDelayMin = changes.humanDelayMin.newValue;
        if (changes.humanDelayMax !== undefined) humanDelayMax = changes.humanDelayMax.newValue;
        if (changes.useHumanDelay !== undefined) useHumanDelay = changes.useHumanDelay.newValue;
      });
    } catch (e) {
      addError('Init error: ' + e.message);
    }
  }

  // ============================================
  // STATUS PANEL
  // ============================================
  function createStatusPanel() {
    try {
      statusPanel = document.createElement('div');
      statusPanel.id = 'pw-sniper-panel';
      statusPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 8px;
        padding: 8px 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        color: white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.15);
        min-width: 140px;
        transition: opacity 0.3s ease;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        opacity: 0.6;
      `;
      document.body.appendChild(statusPanel);
      updateUI();
    } catch (e) {
      console.error('[PW Sniper] Panel creation error:', e);
    }
  }

  function updateUI() {
    const isLecturePage = document.querySelector('video, .video-js, .vjs-tech') !== null;
    
    if (statusPanel) {
      statusPanel.style.display = (isLecturePage && extensionActive) ? 'block' : 'none';
    }
    
    if (!statusPanel || !isLecturePage || !extensionActive) return;
    try {
      const dotColor = extensionActive ? '#22c55e' : '#ef4444';
      const dotGlow = extensionActive ? '0 0 6px #22c55e' : '0 0 6px #ef4444';
      const mode = waitingForAnswer ? '⏳' : '✓';

      const answer = selectedOption || '_';
      const answerColor = selectedOption ? (nextPollAnswer ? '#fbbf24' : '#60a5fa') : '#999';
      const polls = pollCount > 0 ? `#${pollCount}` : '';

      statusPanel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; box-shadow: ${dotGlow}; flex-shrink: 0;"></span>
          <span style="color: ${waitingForAnswer ? '#fbbf24' : '#4ade80'};">${mode}</span>
          <span style="font-weight: 700; font-size: 14px; color: ${answerColor};">${answer}</span>
          ${polls ? `<span style="color: #999; font-size: 10px; margin-left: auto;">${polls}</span>` : ''}
        </div>
      `;
    } catch (e) {}
  }

  // ============================================
  // NOTIFICATIONS (FIX #7: Check visibility before creating)
  // ============================================
  function showNotification(text, color = '#4ade80') {
    if (!statusPanel) return;
    // FIX #7: Don't create notification if panel is hidden
    if (statusPanel.style.display === 'none') return;
    try {
      if (activeNotification && activeNotification.parentNode) {
        activeNotification.remove();
        activeNotification = null;
      }

      const notif = document.createElement('div');
      notif.style.cssText = `
        position: absolute;
        top: -32px;
        left: 0;
        right: 0;
        background: ${color};
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
        pointer-events: none;
        white-space: nowrap;
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
        notif.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          if (notif.parentNode) notif.remove();
          if (activeNotification === notif) activeNotification = null;
        }, 300);
      }, PW.NOTIFICATION_DURATION);
    } catch (e) {}
  }

  // ============================================
  // DRAG (FIX #8: Added blur/mouseleave handlers)
  // ============================================
  function setupDrag() {
    if (!statusPanel) return;

    statusPanel.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      const rect = statusPanel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      statusPanel.style.transition = 'none';
      statusPanel.style.cursor = 'grabbing';
      statusPanel.style.opacity = '0.95';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const x = Math.max(0, Math.min(window.innerWidth - 160, e.clientX - dragOffset.x));
      const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset.y));

      statusPanel.style.left = x + 'px';
      statusPanel.style.top = y + 'px';
      statusPanel.style.right = 'auto';
      statusPanel.style.bottom = 'auto';
    });

    // FIX #8: Reset drag state on mouseup, blur, or visibilitychange
    function endDrag() {
      if (isDragging) {
        isDragging = false;
        statusPanel.style.transition = 'opacity 0.3s ease';
        statusPanel.style.opacity = '0.6';
        statusPanel.style.cursor = 'grab';
      }
    }

    document.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) endDrag();
    });
  }

  // ============================================
  // WEBSOCKET INTERCEPT LISTENER (v5.4.0)
  // ============================================
  let wsPollTimestamp = 0;
  let wsDetectedAt = 0;  // Wall clock time when WS detected
  let wsPreClickInterval = null;

  function setupWebSocketListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'PW_POLL_WS_DETECTED') return;

      const now = performance.now();
      wsPollTimestamp = now;
      wsDetectedAt = event.data.wsDetectedAt || Date.now();

      // Pre-open poll panel immediately
      if (autoOpen && extensionActive && (nextPollAnswer || selectedOption || waitingForAnswer)) {
        wsPreOpenPoll();
      }

      // Start fast watcher to click answer the instant DOM renders
      if (extensionActive && !isProcessing && (nextPollAnswer || selectedOption)) {
        startWsPreClickWatcher();
      }
    });
  }

  // Try to open poll panel early (before DOM polling finds it)
  function wsPreOpenPoll() {
    if (panelOpening) return;
    try {
      let pollIcon = document.querySelector('#poll-icon');
      if (!pollIcon || !isVisible(pollIcon)) {
        pollIcon = document.querySelector('#record-poll-icon');
        if (!pollIcon || !isVisible(pollIcon)) return;
      }

      const svgPaths = pollIcon.querySelectorAll('svg path');
      if (!svgPaths || svgPaths.length === 0) return;

      let active = false;
      for (const path of svgPaths) {
        const fill = path.getAttribute('fill');
        if (fill) {
          const c = fill.toLowerCase().trim();
          if (c !== '#ffffff' && c !== '#fff' && c !== 'white') { active = true; break; }
        }
      }

      if (active) {
        panelOpening = true;
        const clicked = clickPollIcon(pollIcon);
        if (clicked) {
          pollIconClickedAt = Date.now();
          setTimeout(() => { panelOpening = false; }, PW.PANEL_OPEN_TIMEOUT);
        } else {
          panelOpening = false;
        }
      }
    } catch(e) {
      panelOpening = false;
    }
  }

  // Fast watcher — checks DOM every 5ms for poll options after WS detect
  function startWsPreClickWatcher() {
    if (wsPreClickInterval) clearInterval(wsPreClickInterval);
    let attempts = 0;
    wsPreClickInterval = setInterval(() => {
      attempts++;
      if (attempts > 200 || isProcessing) {
        clearInterval(wsPreClickInterval);
        wsPreClickInterval = null;
        return;
      }
      try {
        const options = findOptions();
        if (options.length >= 2 && isPollActive(options)) {
          clearInterval(wsPreClickInterval);
          wsPreClickInterval = null;

          const pollHash = generatePollHash(options);
          if (pollHash === lastAnsweredPollHash) return;

          const hasAnswer = nextPollAnswer || selectedOption;
          if (!hasAnswer) return;

          isProcessing = true;
          lastAnsweredPollHash = pollHash;

          if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
          processingSafetyTimer = setTimeout(() => {
            if (isProcessing) { isProcessing = false; updateUI(); }
          }, PW.PROCESSING_SAFETY_TIMEOUT);

          // Calculate WS advantage
          const wsAdv = wsPollTimestamp > 0 ? Math.round(performance.now() - wsPollTimestamp) : 0;

          answerPoll(options, wsAdv);
        }
      } catch(e) {}
    }, aggressiveMode ? PW.AGGRESSIVE_WS_WATCHER : 5);
  }

  // ============================================
  // POLL DETECTION (FIX #5: Pass options to tryOpenPoll)
  // ============================================
  function checkForPoll() {
    if (!extensionActive || isProcessing || isCheckRunning) return;
    isCheckRunning = true;

    try {
      const options = findOptions();

      if (options.length >= 2) {
        // POLL FOUND!
        pollIconClickedAt = 0;

        if (!isPollActive(options)) {
          isCheckRunning = false;
          return;
        }

        const pollHash = generatePollHash(options);
        if (pollHash === lastAnsweredPollHash) {
          isCheckRunning = false;
          return;
        }

        const hasAnswer = nextPollAnswer || selectedOption;
        if (!hasAnswer) {
          isCheckRunning = false;
          return;
        }

        // Stop WS watcher since checkForPoll is taking over
        if (wsPreClickInterval) { clearInterval(wsPreClickInterval); wsPreClickInterval = null; }

        isProcessing = true;
        
        // FIX #3: Safety timeout - force reset isProcessing after 15 seconds
        if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
        processingSafetyTimer = setTimeout(() => {
          if (isProcessing) {
            isProcessing = false;
            addError('isProcessing force-reset after 15s timeout');
            updateUI();
          }
        }, PW.PROCESSING_SAFETY_TIMEOUT);
        
        lastAnsweredPollHash = pollHash;

        // FIX #6: Don't increment pollCount here - increment on success
        answerPoll(options);
      } else {
        // FIX #5: Pass options to tryOpenPoll (avoid redundant findOptions call)
        if (autoOpen) {
          tryOpenPoll(options);
        }
      }
    } catch (e) {
      addError('checkForPoll: ' + e.message);
      isProcessing = false;
      if (processingSafetyTimer) {
        clearTimeout(processingSafetyTimer);
        processingSafetyTimer = null;
      }
    } finally {
      isCheckRunning = false;
    }
  }

  // ============================================
  // FIND OPTIONS
  // ============================================
  function findOptions() {
    try {
      const spans = document.querySelectorAll(PW.OPTION_SPAN);
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
            const sibSpan = sib.querySelector('span.line-clamp-1');
            if (sibSpan && /^[A-D]$/.test(sibSpan.textContent.trim().toUpperCase())) {
              pollLike++;
            }
          }
          if (pollLike < 2) continue;
        }

        options.push({ button, letter, span, radio });
      }

      return options;
    } catch (e) {
      return [];
    }
  }

  // ============================================
  // CHECK IF POLL IS ACTIVE (FIX #9: Default to true for safety)
  // ============================================
  function isPollActive(options) {
    try {
      if (options.length === 0) return false;

      const btn = options[0].button;
      const classes = btn.className || '';

      // Known "result shown" class
      if (classes.includes('w-[83%]')) return false;

      const submitBtn = findSubmitButton();
      
      if (classes.includes('w-full')) {
        return !!submitBtn;
      }

      if (submitBtn) return true;

      // Check for result texts in container
      const pollContainer = btn.closest('[role="dialog"], .modal, [class*="poll"]') || btn.parentElement?.parentElement;
      if (pollContainer) {
        const containerText = pollContainer.textContent || '';
        for (const text of PW.RESULT_TEXTS) {
          if (containerText.includes(text)) return false;
        }
      }

      // FIX #9: Default to TRUE (safer - try to answer rather than miss a poll)
      return true;
    } catch (e) {
      return true; // FIX #9: On error, assume active (safer)
    }
  }

  // ============================================
  // FIND SUBMIT
  // ============================================
  function findSubmitButton() {
    try {
      const spans = document.querySelectorAll(PW.OPTION_SPAN);
      for (const span of spans) {
        if (!/^[A-D]$/.test(span.textContent.trim().toUpperCase())) continue;
        
        const container = span.closest('[role="dialog"], .modal, [class*="poll"], form') 
                        || span.closest('div')?.parentElement?.parentElement;
        if (!container) continue;

        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent.trim();
          if (text === PW.SUBMIT_TEXT) return btn;
        }
      }

      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = btn.textContent.trim();
        if (text === PW.SUBMIT_TEXT && isVisible(btn)) return btn;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // POLL HASH (FIX #2: Use Date.now() for uniqueness)
  // ============================================
  function generatePollHash(options) {
    // FIX #2: Use precise timestamp instead of 20-second window
    // This ensures each poll gets a unique hash
    const timeBucket = Math.floor(Date.now() / 3000); // 3-second window
    return `poll_${pollCount}_${timeBucket}`;
  }

  function getCurrentAnswer() {
    if (nextPollAnswer) {
      const answer = nextPollAnswer;
      nextPollAnswer = null;
      return answer;
    }
    return selectedOption ? selectedOption.toUpperCase() : null;
  }

  // ============================================
  // BUG FIX #2: Clear answer state only if user hasn't re-entered Q mode
  // ============================================
  function clearAnswerState() {
    if (!waitingForAnswer) {
      selectedOption = null;
      nextPollAnswer = null;
      saveToStorage('selectedOption', null);
    }
  }

  // ============================================
  // ANSWER POLL (FIX #3: Safety timeout, FIX #6: pollCount on success)
  // ============================================
  function answerPoll(options, wsAdv) {
    try {
      // BUG FIX #1: Clear Q mode timeout so it doesn't fire after poll is answered
      if (waitingForAnswerTimeout) {
        clearTimeout(waitingForAnswerTimeout);
        waitingForAnswerTimeout = null;
      }

      const pollStartTime = Date.now();
      const target = getCurrentAnswer();
      const option = options.find(o => o.letter === target);

      if (!option) {
        addError(`Target option ${target} not found`);
        addPollResult({
          poll: pollCount + 1,
          answer: target,
          status: 'FAILED',
          reason: 'Option not found',
          time: '-'
        });
        clearAnswerState();
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      waitingForAnswer = false;
      showNotification(`⏳ ${target}...`, '#fbbf24');
      updateUI();

      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
      }

      setTimeout(() => {
        setTimeout(() => {
          try {
            const answerClickTime = Date.now();
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

            if (autoSubmit) {
              setTimeout(() => {
                try {
                  const submitBtn = findSubmitButton();
                  if (submitBtn) {
                    const submitClickTime = Date.now();
                    let submitMethod = 'DOM';
                    const submitReactClicked = clickViaReact(submitBtn);
                    if (submitReactClicked) {
                      submitMethod = 'React';
                    } else {
                      dispatchClick(submitBtn);
                    }

                    const totalTime = submitClickTime - pollStartTime;
                    
                    // FIX #6: Increment pollCount ONLY on success
                    pollCount++;
                    saveToStorage('pollCount', pollCount);
                    
                    const wsText = (wsAdv && wsAdv > 0) ? ` (WS+${wsAdv}ms)` : '';
                    showNotification(`✓ #${pollCount} ${totalTime}ms${wsText}`, '#10b981');

                    // Calculate network delay (time from WS detection to answer completion)
                    const networkDelay = wsDetectedAt > 0 ? Date.now() - wsDetectedAt : 0;

                    addPollResult({
                      poll: pollCount,
                      answer: target,
                      status: 'SUCCESS',
                      click: clickMethod,
                      submit: submitMethod,
                      time: totalTime + 'ms',
                      networkDelay: networkDelay > 0 ? networkDelay + 'ms' : '-',
                      breakdown: {
                        humanDelay: humanDelay,
                        pollDelay: pollDelay,
                        submitDelay: submitDelay,
                        processingTime: submitClickTime - answerClickTime,
                        networkDelay: networkDelay
                      }
                    });

                    sendToBackground({
                      type: 'POLL_ANSWERED',
                      responseTime: totalTime,
                      pollCount: pollCount
                    });
                    
                    clearAnswerState();
                  } else {
                    const totalTime = Date.now() - pollStartTime;
                    showNotification(`⚠ No submit btn`, '#f59e0b');
                    addError('Submit button not found');
                    addPollResult({
                      poll: pollCount + 1,
                      answer: target,
                      status: 'FAILED',
                      reason: 'No submit button',
                      time: totalTime + 'ms'
                    });
                    clearAnswerState();
                  }
                } catch (e) {
                  addError('Submit error: ' + e.message);
                  addPollResult({
                    poll: pollCount + 1,
                    answer: target,
                    status: 'FAILED',
                    reason: 'Submit error: ' + e.message,
                    time: '-'
                  });
                  clearAnswerState();
                } finally {
                  isProcessing = false;
                  if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
                  updateUI();
                }
              }, submitDelay);
            } else {
              // FIX #6: Increment pollCount even for SELECTED (user chose not to auto-submit)
              pollCount++;
              saveToStorage('pollCount', pollCount);
              
              addPollResult({
                poll: pollCount,
                answer: target,
                status: 'SELECTED',
                reason: 'Auto-submit disabled',
                time: '-'
              });
              
              clearAnswerState();
              
              isProcessing = false;
              if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
              updateUI();
            }
          } catch (e) {
            addError('Answer error: ' + e.message);
            addPollResult({
              poll: pollCount + 1,
              answer: target,
              status: 'FAILED',
              reason: 'Answer error: ' + e.message,
              time: '-'
            });
            clearAnswerState();
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, pollDelay);
      }, humanDelay);
    } catch (e) {
      addError('answerPoll: ' + e.message);
      clearAnswerState();
      isProcessing = false;
      if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
      updateUI();
    }
  }

  // ============================================
  // TRY OPEN POLL (FIX #1: 5s cooldown, FIX #4: 3s panel timeout, FIX #5: accept options param)
  // ============================================
  function tryOpenPoll(existingOptions) {
    // FIX #5: Use passed options instead of calling findOptions() again
    if (existingOptions && existingOptions.length >= 2) {
      return;
    }
    
    if (panelOpening) {
      return;
    }
    
    const now = Date.now();
    
    // FIX #1: Now only 5 seconds instead of 30 minutes!
    if (pollIconClickedAt > 0 && (now - pollIconClickedAt) < PW.ICON_RESET_TIME) {
      return;
    }

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
          if (normalizedColor !== '#ffffff' && normalizedColor !== 'white') {
            pollDetected = true;
            break;
          }
        }
      }
      
      if (pollDetected) {
        panelOpening = true;
        
        const clicked = clickPollIcon(pollIcon);
        
        if (clicked) {
          pollIconClickedAt = now;
          showNotification('🎯 Poll detected!', '#3b82f6');
          
          // FIX #4: Now 3 seconds instead of 2
          setTimeout(() => {
            panelOpening = false;
          }, PW.PANEL_OPEN_TIMEOUT);
        } else {
          panelOpening = false;
        }
      } else {
        // Icon is white (no poll) - reset cooldown
        pollIconClickedAt = 0;
      }
    } catch (e) {
      addError('tryOpenPoll: ' + e.message);
      panelOpening = false;
    }
  }
  
  // Click poll icon (SINGLE CLICK ONLY)
  function clickPollIcon(el) {
    if (!el) return false;
    
    try {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    } catch(e) {}
    
    // Try React onClick FIRST
    const props = getReactProps(el);
    if (props && typeof props.onClick === 'function') {
      try {
        props.onClick({
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent('click'),
          target: el,
          currentTarget: el,
          type: 'click',
          bubbles: true
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
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: new MouseEvent('click'),
            target: el,
            currentTarget: parent,
            type: 'click',
            bubbles: true
          });
          return true;
        } catch(e) {}
      }
      parent = parent.parentElement;
    }
    
    // FALLBACK: DOM click
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      el.dispatchEvent(new MouseEvent('click', opts));
      return true;
    } catch(e) {}
    
    // LAST RESORT: Native click
    try {
      if (typeof el.click === 'function') {
        el.click();
        return true;
      }
    } catch(e) {}
    
    return false;
  }

  // ============================================
  // CLICK HELPERS (FIX #10: Removed dead smartClick function)
  // ============================================
  function dispatchClick(el) {
    if (!el) return;
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch (e) {}
  }

  function getReactProps(element) {
    try {
      const key = Object.keys(element).find(k => k.startsWith('__reactProps$'));
      return key ? element[key] : null;
    } catch (e) {
      return null;
    }
  }

  function clickViaReact(element) {
    try {
      const props = getReactProps(element);
      if (props && typeof props.onClick === 'function') {
        props.onClick({
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent('click'),
          target: element,
          currentTarget: element,
          type: 'click',
          bubbles: true
        });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function isVisible(el) {
    try {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = window.getComputedStyle(el);
      if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendToBackground(data) {
    try {
      chrome.runtime.sendMessage(data).catch(() => {});
    } catch (e) {}
  }

  // ============================================
  // KEYBOARD
  // ============================================
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      try {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

        const letter = e.key.toUpperCase();

        // P = Toggle extension ON/OFF
        if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          extensionActive = !extensionActive;
          saveToStorage('extensionActive', extensionActive);
          showNotification(extensionActive ? '▶ ON' : '⏸ OFF', extensionActive ? '#22c55e' : '#ef4444');
          updateUI();
          return;
        }

        // Q = Enter answer mode (30s timeout)
        if (e.code === 'KeyQ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          waitingForAnswer = true;
          nextPollAnswer = null;
          
          if (waitingForAnswerTimeout) {
            clearTimeout(waitingForAnswerTimeout);
          }
          waitingForAnswerTimeout = setTimeout(() => {
            waitingForAnswer = false;
            nextPollAnswer = null;
            selectedOption = null;
            saveToStorage('selectedOption', null);
            showNotification('⏱️ Q mode expired', '#ef4444');
            updateUI();
            waitingForAnswerTimeout = null;
          }, 30000);
          
          showNotification('⏳ A/B/C/D? (30s)', '#fbbf24');
          updateUI();
          return;
        }

        // Esc = Cancel Q mode
        if (e.code === 'Escape') {
          if (waitingForAnswer) {
            e.preventDefault();
            waitingForAnswer = false;
            nextPollAnswer = null;
            selectedOption = null;
            saveToStorage('selectedOption', null);
            
            if (waitingForAnswerTimeout) {
              clearTimeout(waitingForAnswerTimeout);
              waitingForAnswerTimeout = null;
            }
            
            showNotification('❌ Cancel', '#6b7280');
            updateUI();
          }
          return;
        }

        // A/B/C/D = Select answer (only in Q mode)
        if (['A', 'B', 'C', 'D'].includes(letter) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();

          if (!waitingForAnswer) {
            return;
          }

          nextPollAnswer = letter;
          selectedOption = letter;
          
          // Clear the 30s timeout — answer is set, keep it until poll comes
          if (waitingForAnswerTimeout) {
            clearTimeout(waitingForAnswerTimeout);
            waitingForAnswerTimeout = null;
          }
          
          showNotification(`→ ${letter} (can change)`, '#3b82f6');
          updateUI();
        }
      } catch (e) {}
    });
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
  function handleMessage(msg, sendResponse) {
    try {
      switch (msg.type) {
        case 'OPTION_CHANGED':
          selectedOption = msg.option;
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;

        case 'GET_HISTORY':
          if (sendResponse) sendResponse({ pollHistory, errorLog, pollCount });
          break;

        case 'CLEAR_HISTORY':
          pollHistory = [];
          errorLog = [];
          pollCount = 0;
          savePollHistory();
          saveErrorLog();
          saveToStorage('pollCount', 0);
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;

        case 'GET_STATUS':
          if (sendResponse) sendResponse({
            active: extensionActive,
            selectedOption,
            nextPollAnswer,
            waitingForAnswer,
            pollCount,
            pollDelay,
            submitDelay,
            humanDelayMin,
            humanDelayMax,
            useHumanDelay
          });
          break;

        case 'SET_TIMING':
          if (msg.pollDelay !== undefined) {
            pollDelay = msg.pollDelay;
            saveToStorage('pollDelay', pollDelay);
          }
          if (msg.submitDelay !== undefined) {
            submitDelay = msg.submitDelay;
            saveToStorage('submitDelay', submitDelay);
          }
          if (msg.pollDetectionInterval !== undefined) {
            pollDetectionInterval = msg.pollDetectionInterval;
            saveToStorage('pollDetectionInterval', pollDetectionInterval);
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          }
          if (msg.humanDelayMin !== undefined) {
            humanDelayMin = msg.humanDelayMin;
            saveToStorage('humanDelayMin', humanDelayMin);
          }
          if (msg.humanDelayMax !== undefined) {
            humanDelayMax = msg.humanDelayMax;
            saveToStorage('humanDelayMax', humanDelayMax);
          }
          if (msg.useHumanDelay !== undefined) {
            useHumanDelay = msg.useHumanDelay;
            saveToStorage('useHumanDelay', useHumanDelay);
          }
          if (sendResponse) sendResponse({ ok: true });
          break;

        case 'SET_OPACITY':
          if (msg.panelOpacity !== undefined) {
            const opacity = msg.panelOpacity / 100;
            const panel = document.getElementById('pw-sniper-panel');
            if (panel) panel.style.opacity = opacity;
            saveToStorage('panelOpacity', msg.panelOpacity);
          }
          if (sendResponse) sendResponse({ ok: true });
          break;

        case 'SET_AGGRESSIVE':
          aggressiveMode = msg.aggressive === true;
          saveToStorage('aggressiveMode', aggressiveMode);
          if (aggressiveMode) {
            // Set all timings to minimum (non-zero)
            pollDetectionInterval = PW.AGGRESSIVE_POLL_INTERVAL;
            pollDelay = PW.AGGRESSIVE_POLL_DELAY;
            submitDelay = PW.AGGRESSIVE_SUBMIT_DELAY;
            useHumanDelay = false;
            saveToStorage('pollDetectionInterval', pollDetectionInterval);
            saveToStorage('pollDelay', pollDelay);
            saveToStorage('submitDelay', submitDelay);
            saveToStorage('useHumanDelay', false);
            // Restart check interval with new speed
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
            showNotification('🔥 Aggressive ON', '#ef4444');
          } else {
            // Restore safe defaults
            pollDetectionInterval = PW.POLL_INTERVAL;
            pollDelay = PW.POLL_DELAY;
            submitDelay = PW.SUBMIT_DELAY;
            saveToStorage('pollDetectionInterval', pollDetectionInterval);
            saveToStorage('pollDelay', pollDelay);
            saveToStorage('submitDelay', submitDelay);
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
            showNotification('🛡️ Normal Mode', '#10b981');
          }
          updateUI();
          if (sendResponse) sendResponse({ ok: true });
          break;

        default:
          if (sendResponse) sendResponse({ ok: false, reason: 'Unknown message type' });
      }
    } catch (e) {
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
