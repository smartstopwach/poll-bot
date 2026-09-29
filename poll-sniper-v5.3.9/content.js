// content.js - PW Poll Sniper v5.3.9 (Fastest Safe Version)
// Based on proven v5.3.8 | Fastest safe settings | Direct keyboard | No human delay
// Fallback selectors | Accurate timing | SPA navigation support

(function () {
  'use strict';

  // ============================================
  // CONSTANTS — FASTEST SAFE
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
    POLL_DELAY: 50,           // Fastest safe for React event handlers
    SUBMIT_DELAY: 25,         // Fastest safe for React state update
    HUMAN_DELAY_MIN: 500,
    HUMAN_DELAY_MAX: 1500,
    POLL_INTERVAL: 50,        // Fast detection (safe for laptop CPU)
    PROCESSING_LOCK: 3000,
    ICON_RESET_TIME: 5000,
    PANEL_OPEN_TIMEOUT: 3000,
    PROCESSING_SAFETY_TIMEOUT: 15000,
    NOTIFICATION_DURATION: 2500
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
  let extensionActive = true;   // Default ON for laptop
  let lastPollTime = 0;
  let lastAnsweredPollHash = '';
  let pollCount = 0;
  let isProcessing = false;
  let processingSafetyTimer = null;
  let pollIconClickedAt = 0;
  let pollHistory = [];
  let errorLog = [];;
  let activeNotification = null;
  let isCheckRunning = false;
  let pollDelay = PW.POLL_DELAY;
  let submitDelay = PW.SUBMIT_DELAY;
  let pollDetectionInterval = PW.POLL_INTERVAL;
  let humanDelayMin = PW.HUMAN_DELAY_MIN;
  let humanDelayMax = PW.HUMAN_DELAY_MAX;
  let useHumanDelay = false;    // Default OFF for fastest speed
  let panelOpening = false;

  // UI elements
  let statusPanel = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // ============================================
  // STORAGE HELPERS
  // ============================================
  function saveToStorage(key, value) {
    try { chrome.storage.local.set({ [key]: value }); } catch (e) {}
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
    console.error('[PW Sniper v5.3.9] ERROR:', msg);
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
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'pollDetectionInterval', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive'],
        (result) => {
          selectedOption = null;
          nextPollAnswer = null;
          autoSubmit = result.autoSubmit !== false;
          autoOpen = result.autoOpen !== false;
          pollHistory = result.pollHistory || [];
          errorLog = result.errorLog || [];
          pollCount = Math.max(0, parseInt(result.pollCount) || 0);
          pollDelay = (result.pollDelay !== undefined && result.pollDelay !== null) ? Math.max(0, parseInt(result.pollDelay) || PW.POLL_DELAY) : PW.POLL_DELAY;
          submitDelay = (result.submitDelay !== undefined && result.submitDelay !== null) ? Math.max(0, parseInt(result.submitDelay) || PW.SUBMIT_DELAY) : PW.SUBMIT_DELAY;
          pollDetectionInterval = (result.pollDetectionInterval !== undefined && result.pollDetectionInterval !== null) ? Math.max(25, parseInt(result.pollDetectionInterval) || PW.POLL_INTERVAL) : PW.POLL_INTERVAL;
          humanDelayMin = (result.humanDelayMin !== undefined && result.humanDelayMin !== null) ? Math.max(0, parseInt(result.humanDelayMin) || PW.HUMAN_DELAY_MIN) : PW.HUMAN_DELAY_MIN;
          humanDelayMax = (result.humanDelayMax !== undefined && result.humanDelayMax !== null) ? Math.max(humanDelayMin, parseInt(result.humanDelayMax) || PW.HUMAN_DELAY_MAX) : PW.HUMAN_DELAY_MAX;
          useHumanDelay = result.useHumanDelay === true;
          extensionActive = result.extensionActive !== false;
          
          createStatusPanel();
          updateUI();
          
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
        }
      );

      setupKeyboard();
      setupDrag();

      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        handleMessage(msg, sendResponse);
        return true;
      });

      chrome.storage.onChanged.addListener((changes) => {
        if (changes.selectedOption) { selectedOption = changes.selectedOption.newValue; updateUI(); }
        if (changes.autoSubmit !== undefined) autoSubmit = changes.autoSubmit.newValue;
        if (changes.autoOpen !== undefined) autoOpen = changes.autoOpen.newValue;
        if (changes.extensionActive !== undefined) { extensionActive = changes.extensionActive.newValue; updateUI(); }
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

      // SPA navigation support
      let lastURL = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastURL) {
          lastURL = window.location.href;
          panelOpening = false;
          pollIconClickedAt = 0;
          updateUI();
        }
      }, 500);

      // Cleanup on page unload
      window.addEventListener('beforeunload', () => {
        if (checkInterval) clearInterval(checkInterval);
        if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
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
      if (!document.body) { setTimeout(createStatusPanel, 500); return; }

      statusPanel = document.createElement('div');
      statusPanel.id = 'pw-sniper-panel';
      statusPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        border-radius: 10px;
        padding: 8px 14px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: white;
        box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.15);
        min-width: 160px;
        cursor: grab;
        user-select: none;
        opacity: 0.8;
      `;
      document.body.appendChild(statusPanel);
      updateUI();
    } catch (e) {
      setTimeout(createStatusPanel, 1000);
    }
  }

  function updateUI() {
    const isLecturePage = document.querySelector('video, .video-js, .vjs-tech') !== null;
    
    if (statusPanel) {
      statusPanel.style.display = isLecturePage ? 'block' : 'none';
    }
    
    if (!statusPanel || !isLecturePage) return;
    try {
      const dotColor = extensionActive ? '#22c55e' : '#ef4444';
      const answer = selectedOption || '_';
      const answerColor = selectedOption ? '#60a5fa' : '#999';

      statusPanel.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 10px; font-weight: 700; color: ${dotColor};">⚡ POLL SNIPER</span>
          <span style="font-size: 9px; color: ${extensionActive ? '#22c55e' : '#ef4444'};">${extensionActive ? '● ON' : '○ OFF'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; font-size: 16px; color: ${answerColor};">${answer}</span>
          <span style="color: #64748b; font-size: 10px;">Polls: ${pollCount}</span>
        </div>
        <div style="margin-top: 4px; font-size: 9px; color: #475569; text-align: center;">
          [A-D] Answer | [P] Toggle | [Esc] Clear
        </div>
      `;
    } catch (e) {}
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================
  function showNotification(text, color = '#4ade80') {
    if (!statusPanel || statusPanel.style.display === 'none') return;
    try {
      if (activeNotification && activeNotification.parentNode) {
        activeNotification.remove();
        activeNotification = null;
      }

      const notif = document.createElement('div');
      notif.style.cssText = `
        position: absolute; top: -32px; left: 0; right: 0;
        background: ${color}; color: white; padding: 6px 10px;
        border-radius: 6px; font-size: 11px; font-weight: 600;
        text-align: center; opacity: 0; transform: translateY(10px);
        transition: all 0.3s ease; pointer-events: none; white-space: nowrap;
      `;
      notif.textContent = text;
      statusPanel.appendChild(notif);
      activeNotification = notif;

      setTimeout(() => { notif.style.opacity = '1'; notif.style.transform = 'translateY(0)'; }, 10);
      setTimeout(() => {
        notif.style.opacity = '0'; notif.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          if (notif.parentNode) notif.remove();
          if (activeNotification === notif) activeNotification = null;
        }, 300);
      }, PW.NOTIFICATION_DURATION);
    } catch (e) {}
  }

  // ============================================
  // DRAG
  // ============================================
  function setupDrag() {
    if (!statusPanel) return;

    statusPanel.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      isDragging = true;
      const rect = statusPanel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      statusPanel.style.cursor = 'grabbing';
      statusPanel.style.opacity = '0.95';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 180, e.clientX - dragOffset.x));
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
      statusPanel.style.left = x + 'px';
      statusPanel.style.top = y + 'px';
      statusPanel.style.right = 'auto';
    });

    function endDrag() {
      if (isDragging) {
        isDragging = false;
        statusPanel.style.cursor = 'grab';
        statusPanel.style.opacity = '0.8';
      }
    }
    document.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
  }

  // ============================================
  // KEYBOARD — Direct A/B/C/D (no Q mode needed)
  // ============================================
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      try {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

        const letter = e.key.toUpperCase();

        // P = Toggle extension
        if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          extensionActive = !extensionActive;
          saveToStorage('extensionActive', extensionActive);
          showNotification(extensionActive ? '🟢 ON' : '🔴 OFF', extensionActive ? '#22c55e' : '#ef4444');
          updateUI();
          return;
        }

        // H = Hide/show panel
        if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          if (statusPanel) {
            statusPanel.style.display = statusPanel.style.display === 'none' ? 'block' : 'none';
          }
          return;
        }

        // Escape = Clear answer
        if (e.code === 'Escape') {
          e.preventDefault();
          selectedOption = null;
          nextPollAnswer = null;
          saveToStorage('selectedOption', null);
          showNotification('❌ Cleared', '#6b7280');
          updateUI();
          return;
        }

        // A/B/C/D = Select answer directly
        if (['A', 'B', 'C', 'D'].includes(letter) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          selectedOption = letter;
          nextPollAnswer = letter;
          saveToStorage('selectedOption', letter);
          showNotification(`✓ ${letter}`, '#3b82f6');
          updateUI();
        }

        // 1/2/3/4 = Same as A/B/C/D
        if (['1', '2', '3', '4'].includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          const l = map[e.key];
          selectedOption = l;
          nextPollAnswer = l;
          saveToStorage('selectedOption', l);
          showNotification(`✓ ${l}`, '#3b82f6');
          updateUI();
        }
      } catch (e) {}
    });
  }

  // ============================================
  // POLL DETECTION
  // ============================================
  function checkForPoll() {
    if (!extensionActive || isProcessing || isCheckRunning) return;
    isCheckRunning = true;

    try {
      const options = findOptions();

      if (options.length >= 2) {
        pollIconClickedAt = 0;

        if (!isPollActive(options)) { isCheckRunning = false; return; }

        const pollHash = generatePollHash(options);
        if (pollHash === lastAnsweredPollHash) { isCheckRunning = false; return; }

        const hasAnswer = nextPollAnswer || selectedOption;
        if (!hasAnswer) { isCheckRunning = false; return; }

        isProcessing = true;
        
        if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
        processingSafetyTimer = setTimeout(() => {
          if (isProcessing) {
            isProcessing = false;
            addError('isProcessing force-reset after 15s timeout');
            updateUI();
          }
        }, PW.PROCESSING_SAFETY_TIMEOUT);
        
        lastPollTime = Date.now();
        lastAnsweredPollHash = pollHash;

        answerPoll(options);
      } else {
        if (autoOpen && (nextPollAnswer || selectedOption)) {
          tryOpenPoll(options);
        }
      }
    } catch (e) {
      addError('checkForPoll: ' + e.message);
      isProcessing = false;
      if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
    } finally {
      isCheckRunning = false;
    }
  }

  // ============================================
  // FIND OPTIONS (with fallback selectors)
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
    } catch (e) { return []; }
  }

  // ============================================
  // CHECK IF ACTIVE (with disabled/opacity checks)
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
    } catch (e) { return true; }
  }

  // ============================================
  // FIND SUBMIT (with SUBMIT_TEXTS array)
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
    } catch (e) { return null; }
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
  // ANSWER POLL (accurate timing with performance.now)
  // ============================================
  function answerPoll(options) {
    try {
      const target = getCurrentAnswer();
      if (!target) {
        addError(`Poll #${pollCount}: No answer selected`);
        addPollResult({ poll: pollCount, answer: 'NONE', status: 'FAILED', reason: 'No answer', time: '-' });
        showNotification('⚠ No answer', '#f59e0b');
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      const option = options.find(o => o.letter === target);
      if (!option) {
        addError(`Poll #${pollCount}: Option ${target} not found`);
        addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Not found', time: '-' });
        showNotification(`✗ ${target} not found`, '#ef4444');
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }

      showNotification(`⏳ ${target}...`, '#fbbf24');
      updateUI();

      const startTime = performance.now();

      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
      }

      setTimeout(() => {
        setTimeout(() => {
          try {
            showNotification(`🎯 ${target}...`, '#3b82f6');

            let clickMethod = 'DOM';
            const reactClicked = clickViaReact(option.button);
            if (reactClicked) clickMethod = 'React';
            else dispatchClick(option.button);

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
                    let submitMethod = 'DOM';
                    const submitReactClicked = clickViaReact(submitBtn);
                    if (submitReactClicked) submitMethod = 'React';
                    else dispatchClick(submitBtn);

                    const time = Math.round(performance.now() - startTime);
                    pollCount++;
                    saveToStorage('pollCount', pollCount);
                    
                    showNotification(`✓ #${pollCount} ${time}ms`, '#10b981');

                    addPollResult({
                      poll: pollCount, answer: target, status: 'SUCCESS',
                      click: clickMethod, submit: submitMethod, time: time + 'ms'
                    });

                    sendToBackground({ type: 'POLL_ANSWERED', responseTime: time, pollCount });
                    
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
                  } else {
                    addError(`Poll #${pollCount}: Submit not found`);
                    addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'No submit', time: '-' });
                    showNotification(`⚠ No submit`, '#f59e0b');
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
                  }
                } catch (e) {
                  addError(`Poll #${pollCount} submit: ${e.message}`);
                  addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Submit error', time: '-' });
                  showNotification(`✗ Error`, '#ef4444');
                  selectedOption = null;
                  nextPollAnswer = null;
                  saveToStorage('selectedOption', null);
                } finally {
                  isProcessing = false;
                  if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
                  updateUI();
                }
              }, submitDelay);
            } else {
              pollCount++;
              saveToStorage('pollCount', pollCount);
              addPollResult({ poll: pollCount, answer: target, status: 'SELECTED', reason: 'Auto-submit OFF', time: '-' });
              selectedOption = null; nextPollAnswer = null;
              saveToStorage('selectedOption', null);
              isProcessing = false;
              if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
              updateUI();
            }
          } catch (e) {
            addError(`Poll #${pollCount}: ${e.message}`);
            addPollResult({ poll: pollCount, answer: target, status: 'FAILED', reason: 'Answer error', time: '-' });
            showNotification(`✗ Error`, '#ef4444');
            selectedOption = null; nextPollAnswer = null;
            saveToStorage('selectedOption', null);
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, pollDelay);
      }, humanDelay);
    } catch (e) {
      addError('answerPoll: ' + e.message);
      selectedOption = null; nextPollAnswer = null;
      saveToStorage('selectedOption', null);
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
          if (normalizedColor !== '#ffffff' && normalizedColor !== '#fff' && normalizedColor !== 'white') {
            pollDetected = true; break;
          }
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
    } catch (e) {
      addError('tryOpenPoll: ' + e.message);
      panelOpening = false;
    }
  }
  
  function clickPollIcon(el) {
    if (!el) return false;
    try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch(e) {}
    
    const props = getReactProps(el);
    if (props && typeof props.onClick === 'function') {
      try {
        props.onClick({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: new MouseEvent('click'), target: el, currentTarget: el, type: 'click', bubbles: true });
        return true;
      } catch(e) {}
    }
    
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const pp = getReactProps(parent);
      if (pp && typeof pp.onClick === 'function') {
        try { pp.onClick({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: new MouseEvent('click'), target: el, currentTarget: parent, type: 'click', bubbles: true }); return true; } catch(e) {}
      }
      parent = parent.parentElement;
    }
    
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

  // ============================================
  // CLICK HELPERS
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
    } catch (e) { return null; }
  }

  function clickViaReact(element) {
    try {
      const props = getReactProps(element);
      if (props && typeof props.onClick === 'function') {
        props.onClick({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: new MouseEvent('click'), target: element, currentTarget: element, type: 'click', bubbles: true });
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function isVisible(el) {
    try {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = window.getComputedStyle(el);
      if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') return false;
      return true;
    } catch (e) { return false; }
  }

  function sendToBackground(data) {
    try { chrome.runtime.sendMessage(data).catch(() => {}); } catch (e) {}
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
  function handleMessage(msg, sendResponse) {
    try {
      switch (msg.type) {
        case 'OPTION_CHANGED':
          selectedOption = msg.option;
          nextPollAnswer = msg.option;
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
            pollCount, pollDelay, submitDelay, humanDelayMin, humanDelayMax, useHumanDelay
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
          if (sendResponse) sendResponse({ ok: false, reason: 'Unknown' });
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
