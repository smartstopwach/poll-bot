// content.js - PW Poll Sniper v5.0.0 (Sound Removed + Deep Bug Fix)
// No sound | Fixed double-unlock | Fixed hash | Fixed direct answer path | Performance optimized

(function () {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================
  const PW = {
    RECORDED_POLL_ICON: '#record-poll-icon',
    LIVE_POLL_BUTTON: '#vjs-custom-poll-button',
    LIVE_POLL_BUTTON_ALT: '[data-testid="poll-button"]',
    LIVE_POLL_ICON: '#poll-icon', // FIXED: ID selector, not class!
    POLL_IMAGE: '#poll-image',
    OPTION_SPAN: 'span.line-clamp-1',
    SUBMIT_TEXT: 'Submit Answer',
    RESULT_TEXTS: ['Correct Answer is', 'Not Participated', 'Answered Correctly', 'You did not attempt'],
    POLL_DELAY: 260, // Optimized for 350-400ms total time
    SUBMIT_DELAY: 25, // Optimized for 350-400ms total time
    HUMAN_DELAY_MIN: 500, // Minimum human-like delay (0.5 seconds)
    HUMAN_DELAY_MAX: 1500, // Maximum human-like delay (1.5 seconds)
    POLL_INTERVAL: 100, // Fast detection (0.1 sec)
    PROCESSING_LOCK: 3000,
    ICON_RESET_TIME: 1800000, // 30 minutes (30 * 60 * 1000)
    NOTIFICATION_DURATION: 2500
  };

  // ============================================
  // STATE
  // ============================================
  let initialized = false; // Prevent multiple initialization
  let checkInterval = null; // Store interval ID for cleanup
  let selectedOption = null; // No default answer
  let nextPollAnswer = null;
  let waitingForAnswer = false;
  let waitingForAnswerTimeout = null; // 30-second timeout for Q mode
  let autoSubmit = true;
  let autoOpen = true;
  let extensionActive = false; // Default OFF - user must enable manually
  let lastPollTime = 0;
  let lastAnsweredPollHash = '';
  let pollCount = 0;
  let isProcessing = false;
  let pollIconClickedAt = 0;
  let pollHistory = [];
  let errorLog = [];
  let activeNotification = null;
  let isCheckRunning = false;
  let pollDelay = PW.POLL_DELAY; // Configurable delay before answering
  let submitDelay = PW.SUBMIT_DELAY; // Configurable delay before submit
  let pollDetectionInterval = PW.POLL_INTERVAL; // Configurable poll detection interval
  let humanDelayMin = PW.HUMAN_DELAY_MIN; // Minimum human-like delay
  let humanDelayMax = PW.HUMAN_DELAY_MAX; // Maximum human-like delay
  let useHumanDelay = true; // Use human-like delay to avoid detection
  let panelOpening = false; // Prevent double-clicking poll icon

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
    // Prevent multiple initialization
    if (initialized) return;
    initialized = true;
    
    try {
      const existing = document.getElementById('pw-sniper-panel');
      if (existing) existing.remove();

      // Load settings from storage FIRST, then start polling
      chrome.storage.local.get(
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'pollDetectionInterval', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive'],
        (result) => {
          selectedOption = null; // Always start blank - NO DEFAULT
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
          
          console.log('[PW Sniper] Settings loaded, extensionActive:', extensionActive);
          updateUI();
          
          // NOW start polling (after storage is loaded)
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          console.log('[PW Sniper] Polling started with interval:', pollDetectionInterval, 'ms');
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
          // Restart polling with new interval
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          console.log('[PW Sniper] Polling interval updated to:', pollDetectionInterval, 'ms');
        }
        if (changes.humanDelayMin !== undefined) humanDelayMin = changes.humanDelayMin.newValue;
        if (changes.humanDelayMax !== undefined) humanDelayMax = changes.humanDelayMax.newValue;
        if (changes.useHumanDelay !== undefined) useHumanDelay = changes.useHumanDelay.newValue;
      });

      console.log('[PW Sniper] Initialized, waiting for storage...');
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
    // Check if we're on a lecture page (has video player)
    const isLecturePage = document.querySelector('video, .video-js, .vjs-tech') !== null;
    
    // Show panel only if: lecture page AND extension is active
    if (statusPanel) {
      statusPanel.style.display = (isLecturePage && extensionActive) ? 'block' : 'none';
    }
    
    if (!statusPanel || !isLecturePage || !extensionActive) return;
    try {
      const dotColor = extensionActive ? '#22c55e' : '#ef4444';
      const dotGlow = extensionActive ? '0 0 6px #22c55e' : '0 0 6px #ef4444';
      const mode = waitingForAnswer ? '⏳' : '✓';

      // Show "_" if no answer selected
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
  // NOTIFICATIONS
  // ============================================
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
  // DRAG
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

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        statusPanel.style.transition = 'opacity 0.3s ease';
        statusPanel.style.opacity = '0.6';
        statusPanel.style.cursor = 'grab';
      }
    });
  }

  // ============================================
  // POLL DETECTION (tryOpenPoll BACK - open/close cycle with instant answer!)
  // ============================================
  function checkForPoll() {
    if (!extensionActive || isProcessing || isCheckRunning) return;
    isCheckRunning = true;

    try {
      const options = findOptions();

      if (options.length >= 2) {
        // POLL FOUND! Reset cooldown immediately
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

        // Check if user has selected an answer
        const hasAnswer = nextPollAnswer || selectedOption;
        if (!hasAnswer) {
          // No answer selected - user sees "_" in panel, they know to select manually
          // DON'T set lastAnsweredPollHash - user might select answer later
          isCheckRunning = false;
          return;
        }

        isProcessing = true;
        lastPollTime = Date.now();
        lastAnsweredPollHash = pollHash;
        pollCount++;
        saveToStorage('pollCount', pollCount);

        answerPoll(options);
      } else {
        // No poll options - try to open poll panel (open/close cycle)
        if (autoOpen) {
          tryOpenPoll();
        }
      }
    } catch (e) {
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
  // CHECK IF POLL IS ACTIVE
  // ============================================
  function isPollActive(options) {
    try {
      if (options.length === 0) return false;

      const btn = options[0].button;
      const classes = btn.className || '';

      if (classes.includes('w-[83%]')) return false;

      const submitBtn = findSubmitButton();
      
      if (classes.includes('w-full')) {
        return !!submitBtn;
      }

      if (submitBtn) return true;

      const pollContainer = btn.closest('[role="dialog"], .modal, [class*="poll"]') || btn.parentElement?.parentElement;
      if (pollContainer) {
        const containerText = pollContainer.textContent || '';
        for (const text of PW.RESULT_TEXTS) {
          if (containerText.includes(text)) return false;
        }
      }

      return false;
    } catch (e) {
      return false;
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
  // POLL HASH (Fixed: use button parent info)
  // ============================================
  function generatePollHash(options) {
    const letters = options.map(o => o.letter).join('');
    // Use parent element's class or id for uniqueness
    const parentInfo = options[0]?.button?.parentElement?.className?.substring(0, 20) || 'unknown';
    // Use 20-second window
    return `${letters}_${parentInfo}_${Math.floor(Date.now() / 20000)}`;
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
  // ANSWER POLL (Fixed: no double-unlock)
  // ============================================
  function answerPoll(options) {
    try {
      const pollStartTime = Date.now(); // Track total time from poll detection
      const target = getCurrentAnswer();
      const option = options.find(o => o.letter === target);

      if (!option) {
        addError(`Poll #${pollCount}: Target option ${target} not found`);
        addPollResult({
          poll: pollCount,
          answer: target,
          status: 'FAILED',
          reason: 'Option not found',
          time: '-'
        });
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        isProcessing = false;
        updateUI();
        return;
      }

      waitingForAnswer = false;
      showNotification(`⏳ ${target}...`, '#fbbf24');
      updateUI();

      // Calculate human-like delay if enabled
      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
        console.log(`[PW Sniper] Human delay: ${humanDelay}ms`);
      }

      // Wait human delay first, then poll delay
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

                    // Calculate ACTUAL total time from poll detection to submit click
                    const totalTime = submitClickTime - pollStartTime;
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
                    
                    // Reset answer to blank after successful poll
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
                  } else {
                    const totalTime = Date.now() - pollStartTime;
                    showNotification(`⚠ #${pollCount} No submit`, '#f59e0b');
                    addError(`Poll #${pollCount}: Submit button not found`);
                    addPollResult({
                      poll: pollCount,
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
                  addError(`Poll #${pollCount} submit: ${e.message}`);
                  addPollResult({
                    poll: pollCount,
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
                  updateUI();
                }
              }, submitDelay);
            } else {
              addPollResult({
                poll: pollCount,
                answer: target,
                status: 'SELECTED',
                reason: 'Auto-submit disabled',
                time: '-'
              });
              
              // Reset answer to blank even if auto-submit disabled
              selectedOption = null;
              nextPollAnswer = null;
              saveToStorage('selectedOption', null);
              
              isProcessing = false;
              updateUI();
            }
          } catch (e) {
            addError(`Poll #${pollCount} answer: ${e.message}`);
            addPollResult({
              poll: pollCount,
              answer: target,
              status: 'FAILED',
              reason: 'Answer error: ' + e.message,
              time: '-'
            });
            selectedOption = null;
            nextPollAnswer = null;
            saveToStorage('selectedOption', null);
            isProcessing = false;
            updateUI();
          }
        }, pollDelay);
      }, humanDelay);
    } catch (e) {
      addError(`Poll #${pollCount}: ${e.message}`);
      selectedOption = null;
      nextPollAnswer = null;
      saveToStorage('selectedOption', null);
      isProcessing = false;
      updateUI();
    }
  }

  // ============================================
  // TRY OPEN POLL (Color-based detection - blue = poll active!)
  // ============================================
  function tryOpenPoll() {
    // FIRST: Check if panel is already open (has poll options visible)
    const existingOptions = findOptions();
    if (existingOptions.length >= 2) {
      console.log('[PW Sniper] Panel already open, skipping click');
      return;
    }
    
    // SECOND: Check if we're in the middle of opening the panel
    if (panelOpening) {
      console.log('[PW Sniper] Panel is opening, waiting...');
      return;
    }
    
    const now = Date.now();
    
    // Check cooldown (but reset if icon is white again)
    if (pollIconClickedAt > 0 && (now - pollIconClickedAt) < PW.ICON_RESET_TIME) {
      return;
    }

    try {
      // Find poll icon (check both live and recorded lecture icons)
      let pollIcon = document.querySelector('#poll-icon');
      if (!pollIcon || !isVisible(pollIcon)) {
        // Try recorded lecture poll icon
        pollIcon = document.querySelector('#record-poll-icon');
        if (!pollIcon || !isVisible(pollIcon)) return;
      }

      // Check SVG path fill color (check all paths, case-insensitive)
      const svgPaths = pollIcon.querySelectorAll('svg path');
      if (!svgPaths || svgPaths.length === 0) return;

      let pollDetected = false;
      for (const path of svgPaths) {
        const fillColor = path.getAttribute('fill');
        if (fillColor) {
          const normalizedColor = fillColor.toLowerCase().trim();
          // If NOT white (means blue/colored = POLL ARRIVED!)
          if (normalizedColor !== '#ffffff' && normalizedColor !== 'white') {
            pollDetected = true;
            console.log('[PW Sniper] 🎯 POLL DETECTED! Icon color:', fillColor);
            break;
          }
        }
      }
      
      if (pollDetected) {
        // Set flag to prevent re-clicking while panel opens
        panelOpening = true;
        
        // Click ONCE only!
        console.log('[PW Sniper] Clicking poll icon (ONCE)...');
        const clicked = clickPollIcon(pollIcon);
        
        if (clicked) {
          pollIconClickedAt = now;
          showNotification('🎯 Poll detected!', '#3b82f6');
          
          // Reset flag after 2 seconds (panel should be open by then)
          setTimeout(() => {
            panelOpening = false;
            console.log('[PW Sniper] Panel opening flag reset');
          }, 2000);
        } else {
          // Click failed, reset flag immediately
          panelOpening = false;
          console.log('[PW Sniper] Click failed, flag reset');
        }
      } else {
        // Icon is white (no poll) - reset cooldown for next check
        pollIconClickedAt = 0;
      }
    } catch (e) {
      addError('tryOpenPoll: ' + e.message);
      panelOpening = false; // Reset flag on error
    }
  }
  
  // Click poll icon (SINGLE CLICK ONLY - no double-click!)
  function clickPollIcon(el) {
    if (!el) return false;
    
    try {
      // Scroll into view
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    } catch(e) {}
    
    // Try React onClick FIRST (most reliable)
    const props = getReactProps(el);
    if (props && typeof props.onClick === 'function') {
      console.log('[PW Sniper] Using React onClick');
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
        return true; // SUCCESS - only one click!
      } catch(e) {
        console.log('[PW Sniper] React onClick failed:', e.message);
      }
    }
    
    // Try parent React handlers
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const parentProps = getReactProps(parent);
      if (parentProps && typeof parentProps.onClick === 'function') {
        console.log('[PW Sniper] Using parent React onClick');
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
          return true; // SUCCESS - only one click!
        } catch(e) {
          console.log('[PW Sniper] Parent React onClick failed:', e.message);
        }
      }
      parent = parent.parentElement;
    }
    
    // FALLBACK: Single DOM click (NOT multiple clicks!)
    console.log('[PW Sniper] Using DOM click (fallback)');
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      el.dispatchEvent(new MouseEvent('click', opts));
      return true; // SUCCESS - only one click!
    } catch(e) {
      console.log('[PW Sniper] DOM click failed:', e.message);
    }
    
    // LAST RESORT: Native click
    try {
      if (typeof el.click === 'function') {
        console.log('[PW Sniper] Using native click (last resort)');
        el.click();
        return true; // SUCCESS - only one click!
      }
    } catch(e) {
      console.log('[PW Sniper] Native click failed:', e.message);
    }
    
    return false; // All methods failed
  }
  
  // Smart click helper (React + DOM + native)
  function smartClick(el) {
    if (!el) return false;
    
    try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch(e) {}
    
    // Try React onClick
    if (clickViaReact(el)) return true;
    
    // Try parent React handlers
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      if (clickViaReact(parent)) return true;
      parent = parent.parentElement;
    }
    
    // DOM click (fallback)
    dispatchClick(el);
    
    // Native click (last resort)
    try { 
      if (typeof el.click === 'function') {
        el.click();
        return true;
      }
    } catch(e) {}
    
    // If we got here, DOM click was attempted
    return true;
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
  // KEYBOARD (Fixed: direct answer increments pollCount)
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
          
          // Set 30-second timeout
          if (waitingForAnswerTimeout) {
            clearTimeout(waitingForAnswerTimeout);
          }
          waitingForAnswerTimeout = setTimeout(() => {
            waitingForAnswer = false;
            waitingForAnswerTimeout = null;
            showNotification('⏱️ Q mode expired', '#ef4444');
            updateUI();
          }, 30000); // 30 seconds
          
          showNotification('⏳ A/B/C/D? (30s)', '#fbbf24');
          updateUI();
          return;
        }

        if (e.code === 'Escape') {
          if (waitingForAnswer) {
            e.preventDefault();
            waitingForAnswer = false;
            nextPollAnswer = null;
            
            // Clear the 30-second timeout
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

          // STRICT RULE: Only accept answer if Q was pressed (waitingForAnswer = true)
          if (!waitingForAnswer) {
            // Ignore A/B/C/D if Q was not pressed
            return;
          }

          // Q mode active - allow multiple presses, LAST one wins
          nextPollAnswer = letter;
          selectedOption = letter; // Update overlay display
          // DON'T cancel Q mode - let user change their mind
          // DON'T answer immediately - let checkForPoll handle it
          
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
            // Restart polling with new interval
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkForPoll, pollDetectionInterval);
            console.log('[PW Sniper] Polling interval updated to:', pollDetectionInterval, 'ms');
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
