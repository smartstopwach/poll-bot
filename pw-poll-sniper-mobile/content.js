// content.js - PW Poll Sniper Mobile v5.4.4 (Touch-Friendly for Kiwi Browser)
// STABLE: All bugs fixed | Works on LIVE + RECORDED | Race condition fix | First poll fix | Mobile touch optimized

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
    ICON_RESET_TIME: 1800000,
    NOTIFICATION_DURATION: 2500
  };

  // ============================================
  // STATE
  // ============================================
  let initialized = false;
  let checkInterval = null;
  let selectedOption = null; // No default answer
  let nextPollAnswer = null;
  let autoSubmit = true;
  let autoOpen = true;
  let extensionActive = false; // Default OFF - user must enable
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
  let useHumanDelay = true;
  let panelOpening = false; // Prevent double-clicking poll icon
  let isExpanded = false; // Track if overlay is expanded
  let expandTimeout = null; // Auto-collapse timeout (17 seconds)

  // UI elements
  let statusPanel = null;

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
    console.error('[PW Sniper Mobile] ERROR:', msg);
  }

  // ============================================
  // INIT (Race condition fix: setInterval inside storage callback)
  // ============================================
  function init() {
    if (initialized) return;
    initialized = true;
    
    try {
      const existing = document.getElementById('pw-sniper-panel');
      if (existing) existing.remove();

      // Load settings from storage FIRST, then start polling
      chrome.storage.local.get(
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive'],
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
          humanDelayMin = (result.humanDelayMin !== undefined && result.humanDelayMin !== null) ? result.humanDelayMin : PW.HUMAN_DELAY_MIN;
          humanDelayMax = (result.humanDelayMax !== undefined && result.humanDelayMax !== null) ? result.humanDelayMax : PW.HUMAN_DELAY_MAX;
          useHumanDelay = result.useHumanDelay !== false;
          extensionActive = result.extensionActive === true;
          
          console.log('[PW Sniper Mobile] Settings loaded, extensionActive:', extensionActive);
          updateUI();
          
          // NOW start polling (after storage is loaded)
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, PW.POLL_INTERVAL);
          console.log('[PW Sniper Mobile] Polling started');
        }
      );

      createStatusPanel();

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
        if (changes.humanDelayMin !== undefined) humanDelayMin = changes.humanDelayMin.newValue;
        if (changes.humanDelayMax !== undefined) humanDelayMax = changes.humanDelayMax.newValue;
        if (changes.useHumanDelay !== undefined) useHumanDelay = changes.useHumanDelay.newValue;
      });

      console.log('[PW Sniper Mobile] Initialized, waiting for storage...');
    } catch (e) {
      addError('Init error: ' + e.message);
    }
  }

  // ============================================
  // MOBILE STATUS PANEL WITH TOUCH BUTTONS
  // ============================================
  function createStatusPanel() {
    try {
      statusPanel = document.createElement('div');
      statusPanel.id = 'pw-sniper-panel';
      statusPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      `;
      document.body.appendChild(statusPanel);
      updateUI();
    } catch (e) {
      console.error('[PW Sniper Mobile] Panel creation error:', e);
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
      const answer = selectedOption || '_';
      const pollCountDisplay = pollCount > 0 ? pollCount : '';
      
      // Green circle color
      let mainColor = '#10b981'; // Green (active)
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      
      if (isExpanded) {
        // Expanded view - just buttons (minimal for mobile)
        statusPanel.innerHTML = `
          <div style="
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            padding: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 30px ${glowColor};
            border: 2px solid ${mainColor};
          ">
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
              <button id="pw-btn-a" style="padding: 12px 6px; background: ${selectedOption === 'A' ? '#3b82f6' : 'rgba(255,255,255,0.15)'}; border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;">A</button>
              <button id="pw-btn-b" style="padding: 12px 6px; background: ${selectedOption === 'B' ? '#3b82f6' : 'rgba(255,255,255,0.15)'}; border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;">B</button>
              <button id="pw-btn-c" style="padding: 12px 6px; background: ${selectedOption === 'C' ? '#3b82f6' : 'rgba(255,255,255,0.15)'}; border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;">C</button>
              <button id="pw-btn-d" style="padding: 12px 6px; background: ${selectedOption === 'D' ? '#3b82f6' : 'rgba(255,255,255,0.15)'}; border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;">D</button>
              <button id="pw-btn-blank" style="padding: 12px 6px; background: ${!selectedOption ? '#6b7280' : 'rgba(255,255,255,0.15)'}; border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;">_</button>
            </div>
          </div>
        `;
        
        // Add event listeners
        const btnA = document.getElementById('pw-btn-a');
        const btnB = document.getElementById('pw-btn-b');
        const btnC = document.getElementById('pw-btn-c');
        const btnD = document.getElementById('pw-btn-d');
        const btnBlank = document.getElementById('pw-btn-blank');
        
        if (btnA) {
          btnA.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLetterPress('A');
            if (expandTimeout) {
              clearTimeout(expandTimeout);
              expandTimeout = null;
            }
            setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 300);
          });
        }
        
        if (btnB) {
          btnB.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLetterPress('B');
            if (expandTimeout) {
              clearTimeout(expandTimeout);
              expandTimeout = null;
            }
            setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 300);
          });
        }
        
        if (btnC) {
          btnC.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLetterPress('C');
            if (expandTimeout) {
              clearTimeout(expandTimeout);
              expandTimeout = null;
            }
            setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 300);
          });
        }
        
        if (btnD) {
          btnD.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLetterPress('D');
            if (expandTimeout) {
              clearTimeout(expandTimeout);
              expandTimeout = null;
            }
            setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 300);
          });
        }
        
        if (btnBlank) {
          btnBlank.addEventListener('click', (e) => {
            e.stopPropagation();
            // Reset to blank
            selectedOption = null;
            nextPollAnswer = null;
            saveToStorage('selectedOption', null);
            if (expandTimeout) {
              clearTimeout(expandTimeout);
              expandTimeout = null;
            }
            setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 300);
          });
        }
        
      } else {
        // Collapsed view - minimal green circle with answer in blue
        statusPanel.innerHTML = `
          <div id="pw-fab" style="
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${mainColor} 0%, ${mainColor}dd 100%);
            box-shadow: 0 4px 16px ${glowColor}, 0 0 24px ${glowColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.3);
          ">
            <span style="font-size: 20px; font-weight: 700; color: #3b82f6; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${answer}</span>
            <span style="position: absolute; top: 2px; right: 2px; width: 10px; height: 10px; border-radius: 50%; background: rgba(34, 197, 94, 0.6); box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);"></span>
          </div>
        `;
        
        // Add click listener to expand
        const fab = document.getElementById('pw-fab');
        if (fab) {
          fab.addEventListener('click', (e) => {
            e.stopPropagation();
            isExpanded = true;
            updateUI();
            
            // Set 17-second auto-collapse timeout
            if (expandTimeout) clearTimeout(expandTimeout);
            expandTimeout = setTimeout(() => {
              isExpanded = false;
              updateUI();
            }, 17000);
          });
          
          // Add drag functionality
          setupFABDrag(fab);
        }
      }
    } catch (e) {
      console.error('[PW Sniper Mobile] updateUI error:', e);
    }
  }

  function handleLetterPress(letter) {
    selectedOption = letter;
    nextPollAnswer = letter;
    saveToStorage('selectedOption', letter);
    updateUI();
  }

  function handlePToggle() {
    extensionActive = !extensionActive;
    saveToStorage('extensionActive', extensionActive);
    updateUI();
  }

  // ============================================
  // TOUCH DRAG FUNCTIONALITY FOR FAB
  // ============================================
  function setupFABDrag(fab) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    fab.addEventListener('touchstart', (e) => {
      isDragging = false;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = statusPanel.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
    });
    
    fab.addEventListener('touchmove', (e) => {
      if (!startX || !startY) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      
      // Only start dragging if moved more than 10px
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isDragging = true;
        e.preventDefault();
        
        const newX = Math.max(0, Math.min(window.innerWidth - 56, initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 56, initialY + deltaY));
        
        statusPanel.style.left = newX + 'px';
        statusPanel.style.top = newY + 'px';
        statusPanel.style.right = 'auto';
        statusPanel.style.bottom = 'auto';
      }
    });
    
    fab.addEventListener('touchend', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
      isDragging = false;
      startX = null;
      startY = null;
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
        // No poll options - try to open poll panel
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
  // CHECK IF ACTIVE
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

  function generatePollHash(options) {
    const letters = options.map(o => o.letter).join('');
    const parentInfo = options[0]?.button?.parentElement?.className?.substring(0, 20) || 'unknown';
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
  // ANSWER POLL
  // ============================================
  function answerPoll(options) {
    try {
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

      updateUI();

      // Calculate human-like delay if enabled
      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
        console.log(`[PW Sniper Mobile] Human delay: ${humanDelay}ms`);
      }

      // Wait human delay first, then poll delay
      setTimeout(() => {
        setTimeout(() => {
          try {
            const startTime = performance.now();

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
                    let submitMethod = 'DOM';
                    const submitReactClicked = clickViaReact(submitBtn);
                    if (submitReactClicked) {
                      submitMethod = 'React';
                    } else {
                      dispatchClick(submitBtn);
                    }

                    const time = Math.round(performance.now() - startTime + pollDelay + humanDelay);

                    addPollResult({
                      poll: pollCount,
                      answer: target,
                      status: 'SUCCESS',
                      click: clickMethod,
                      submit: submitMethod,
                      time: time + 'ms'
                    });

                    sendToBackground({
                      type: 'POLL_ANSWERED',
                      responseTime: time,
                      pollCount: pollCount
                    });
                    
                    // Reset answer to blank after successful poll
                    selectedOption = null;
                    nextPollAnswer = null;
                    saveToStorage('selectedOption', null);
                  } else {
                    const time = Math.round(performance.now() - startTime + pollDelay + humanDelay);
                    addError(`Poll #${pollCount}: Submit button not found`);
                    addPollResult({
                      poll: pollCount,
                      answer: target,
                      status: 'FAILED',
                      reason: 'No submit button',
                      time: time + 'ms'
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
  // TRY OPEN POLL (First poll bug fix: single click only!)
  // ============================================
  function tryOpenPoll() {
    // FIRST: Check if panel is already open
    const existingOptions = findOptions();
    if (existingOptions.length >= 2) {
      console.log('[PW Sniper Mobile] Panel already open, skipping click');
      return;
    }
    
    // SECOND: Check if we're in the middle of opening the panel
    if (panelOpening) {
      console.log('[PW Sniper Mobile] Panel is opening, waiting...');
      return;
    }
    
    const now = Date.now();
    
    // Check cooldown
    if (pollIconClickedAt > 0 && (now - pollIconClickedAt) < PW.ICON_RESET_TIME) {
      return;
    }

    try {
      // Find poll icon (check both live and recorded lecture icons)
      let pollIcon = document.querySelector('#poll-icon');
      if (!pollIcon || !isVisible(pollIcon)) {
        pollIcon = document.querySelector('#record-poll-icon');
        if (!pollIcon || !isVisible(pollIcon)) return;
      }

      // Check SVG path fill color
      const svgPaths = pollIcon.querySelectorAll('svg path');
      if (!svgPaths || svgPaths.length === 0) return;

      let pollDetected = false;
      for (const path of svgPaths) {
        const fillColor = path.getAttribute('fill');
        if (fillColor) {
          const normalizedColor = fillColor.toLowerCase().trim();
          // Check if color is NOT white (poll is active)
          // Handles: #ffffff, #fff, white, rgb(255,255,255), var(--primary), etc.
          const isWhite = normalizedColor === '#ffffff' || 
                         normalizedColor === '#fff' || 
                         normalizedColor === 'white' ||
                         normalizedColor === 'rgb(255, 255, 255)' ||
                         normalizedColor === 'rgb(255,255,255)';
          
          if (!isWhite) {
            pollDetected = true;
            console.log('[PW Sniper Mobile] 🎯 POLL DETECTED! Icon color:', fillColor);
            break;
          }
        }
      }
      
      // Also check computed style as fallback
      if (!pollDetected && svgPaths.length > 0) {
        try {
          const computedFill = window.getComputedStyle(svgPaths[0]).fill;
          if (computedFill && !computedFill.includes('255, 255, 255') && computedFill !== 'white') {
            pollDetected = true;
            console.log('[PW Sniper Mobile] 🎯 POLL DETECTED via computed style! Fill:', computedFill);
          }
        } catch(e) {}
      }
      
      if (pollDetected) {
        // Set flag to prevent re-clicking while panel opens
        panelOpening = true;
        
        // Click ONCE only!
        console.log('[PW Sniper Mobile] Clicking poll icon (ONCE)...');
        const clicked = clickPollIcon(pollIcon);
        
        if (clicked) {
          pollIconClickedAt = now;
          
          // Reset flag after 2 seconds
          setTimeout(() => {
            panelOpening = false;
            console.log('[PW Sniper Mobile] Panel opening flag reset');
          }, 2000);
        } else {
          panelOpening = false;
          console.log('[PW Sniper Mobile] Click failed, flag reset');
        }
      } else {
        pollIconClickedAt = 0;
      }
    } catch (e) {
      addError('tryOpenPoll: ' + e.message);
      panelOpening = false;
    }
  }
  
  // Click poll icon (SINGLE CLICK ONLY - mobile optimized)
  function clickPollIcon(el) {
    if (!el) return false;
    
    try {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    } catch(e) {}
    
    // Try React onClick FIRST
    const props = getReactProps(el);
    if (props && typeof props.onClick === 'function') {
      console.log('[PW Sniper Mobile] Using React onClick');
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
      } catch(e) {
        console.log('[PW Sniper Mobile] React onClick failed:', e.message);
      }
    }
    
    // Try parent React handlers
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const parentProps = getReactProps(parent);
      if (parentProps && typeof parentProps.onClick === 'function') {
        console.log('[PW Sniper Mobile] Using parent React onClick');
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
        } catch(e) {
          console.log('[PW Sniper Mobile] Parent React onClick failed:', e.message);
        }
      }
      parent = parent.parentElement;
    }
    
    // MOBILE OPTIMIZED: Dispatch touch events first (for Kiwi Browser)
    console.log('[PW Sniper Mobile] Using touch + click events (mobile optimized)');
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      
      // Simulate touch events (mobile)
      try {
        const touch = new Touch({ identifier: Date.now(), target: el, clientX: el.getBoundingClientRect().left + 10, clientY: el.getBoundingClientRect().top + 10 });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch] }));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [touch] }));
      } catch(te) {
        // Touch events not supported, continue with mouse events
      }
      
      // Mouse events (fallback)
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      return true;
    } catch(e) {
      console.log('[PW Sniper Mobile] Touch+click failed:', e.message);
    }
    
    // LAST RESORT: Native click
    try {
      if (typeof el.click === 'function') {
        console.log('[PW Sniper Mobile] Using native click (last resort)');
        el.click();
        return true;
      }
    } catch(e) {
      console.log('[PW Sniper Mobile] Native click failed:', e.message);
    }
    
    return false;
  }

  // ============================================
  // CLICK HELPERS (Mobile Optimized)
  // ============================================
  function dispatchClick(el) {
    if (!el) return;
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      
      // Touch events first (mobile)
      try {
        const rect = el.getBoundingClientRect();
        const touch = new Touch({ 
          identifier: Date.now(), 
          target: el, 
          clientX: rect.left + rect.width / 2, 
          clientY: rect.top + rect.height / 2 
        });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch] }));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [touch] }));
      } catch(te) {}
      
      // Mouse events
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      
      // Native click as final fallback
      if (typeof el.click === 'function') {
        el.click();
      }
    } catch (e) {
      console.error('[PW Sniper Mobile] dispatchClick error:', e.message);
    }
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
