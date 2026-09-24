// content.js - PW Poll Sniper v5.3.8 (Bug-Fixed Clean & Fast)
// 14 bugs fixed | Color-based detection | No glitch logic | Maximum speed
// No sound | Performance optimized | Safety timeouts added

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
    POLL_DELAY: 260,
    SUBMIT_DELAY: 25,
    HUMAN_DELAY_MIN: 500,
    HUMAN_DELAY_MAX: 1500,
    POLL_INTERVAL: 100,
    PROCESSING_LOCK: 3000,
    ICON_RESET_TIME: 5000, // FIX #1: Was 1800000 (30 min!) → Now 5 seconds
    PANEL_OPEN_TIMEOUT: 3000, // FIX #4: Was 2000 → Now 3 seconds
    PROCESSING_SAFETY_TIMEOUT: 15000, // FIX #3: Force reset isProcessing after 15s
    NOTIFICATION_DURATION: 2500
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
  let lastPollTime = 0;
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
  let useHumanDelay = true;
  let panelOpening = false;

  // UI elements
  let statusPanel = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let dragStartPos = { x: 0, y: 0 };

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
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'pollDetectionInterval', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive'],
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
          useHumanDelay = result.useHumanDelay !== false;
          extensionActive = result.extensionActive === true;
          
          updateUI();
          
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
        }
      );

      createStatusPanel();
      setupKeyboard();
      setupDrag();

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
      dragStartPos = { x: e.clientX, y: e.clientY };
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
        
        lastPollTime = Date.now();
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
  // ANSWER POLL (FIX #3: Safety timeout, FIX #6: pollCount on success)
  // ============================================
  function answerPoll(options) {
    try {
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
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
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
                    
                    showNotification(`✓ #${pollCount} ${totalTime}ms`, '#10b981');

                    addPollResult({
                      poll: pollCount,
                      answer: target,
                      status: 'SUCCESS',
                      click: clickMethod,
                      submit: submitMethod,
                      time: totalTime + 'ms',
                      breakdown: {
                        humanDelay: humanDelay,
                        pollDelay: pollDelay,
                        submitDelay: submitDelay,
                        processingTime: submitClickTime - answerClickTime
                      }
                    });

                    sendToBackground({
                      type: 'POLL_ANSWERED',
                      responseTime: totalTime,
                      pollCount: pollCount
                    });
                    
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
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
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
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
              
              selectedOption = null;
              nextPollAnswer = null;
              saveToStorage('selectedOption', null);
              
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
            selectedOption = null;
            nextPollAnswer = null;
            saveToStorage('selectedOption', null);
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, pollDelay);
      }, humanDelay);
    } catch (e) {
      addError('answerPoll: ' + e.message);
      selectedOption = null;
      nextPollAnswer = null;
      saveToStorage('selectedOption', null);
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

        if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          extensionActive = !extensionActive;
          saveToStorage('extensionActive', extensionActive);
          showNotification(extensionActive ? '▶ ON' : '⏸ OFF', extensionActive ? '#22c55e' : '#ef4444');
          updateUI();
          return;
        }

        if (e.code === 'KeyQ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          waitingForAnswer = true;
          nextPollAnswer = null;
          
          if (waitingForAnswerTimeout) {
            clearTimeout(waitingForAnswerTimeout);
          }
          waitingForAnswerTimeout = setTimeout(() => {
            waitingForAnswer = false;
            waitingForAnswerTimeout = null;
            showNotification('⏱️ Q mode expired', '#ef4444');
            updateUI();
          }, 30000);
          
          showNotification('⏳ A/B/C/D? (30s)', '#fbbf24');
          updateUI();
          return;
        }

        if (e.code === 'Escape') {
          if (waitingForAnswer) {
            e.preventDefault();
            waitingForAnswer = false;
            nextPollAnswer = null;
            
            if (waitingForAnswerTimeout) {
              clearTimeout(waitingForAnswerTimeout);
              waitingForAnswerTimeout = null;
            }
            
            showNotification('❌ Cancel', '#6b7280');
            updateUI();
          }
          return;
        }

        if (['A', 'B', 'C', 'D'].includes(letter) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();

          if (!waitingForAnswer) {
            return;
          }

          nextPollAnswer = letter;
          selectedOption = letter;
          
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
