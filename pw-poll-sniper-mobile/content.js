// content.js - PW Poll Sniper Mobile v5.4.6 (Touch-Friendly for Kiwi Browser)
// ALL CRITICAL BUGS FIXED | Battery optimization | Memory leak fixes | Position validation | Touch ID fix

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
  let selectedOption = null; // No default answer
  let nextPollAnswer = null;
  let autoSubmit = true;
  let autoOpen = true;
  let extensionActive = true; // Default ON for mobile - always active
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
  let pollDetectionInterval = PW.POLL_INTERVAL; // FIX #1: Configurable detection interval
  let panelOpening = false; // Prevent double-clicking poll icon
  let isExpanded = false; // Track if overlay is expanded
  let expandTimeout = null; // Auto-collapse timeout (17 seconds)
  let collapseTimeout = null; // FIX #9: Store 300ms collapse timeout
  let processingSafetyTimer = null; // FIX #3: Safety timeout for isProcessing
  let fabPosition = null; // FIX #15: Store FAB position
  let fabWasDragged = false; // FIX #17: Moved to top with other state variables
  let touchIdCounter = 0; // FIX #36: Use counter instead of Date.now() for touch IDs

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
    // FIX #18: Trim in-memory array too (prevent unbounded growth)
    pollHistory = pollHistory.slice(-50);
    saveToStorage('pollHistory', pollHistory);
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
        ['autoSubmit', 'autoOpen', 'pollHistory', 'errorLog', 'pollCount', 'pollDelay', 'submitDelay', 'humanDelayMin', 'humanDelayMax', 'useHumanDelay', 'extensionActive', 'pollDetectionInterval', 'fabPosition'],
        (result) => {
          selectedOption = null; // Always start blank - NO DEFAULT
          nextPollAnswer = null;
          autoSubmit = result.autoSubmit !== false;
          autoOpen = result.autoOpen !== false;
          pollHistory = result.pollHistory || [];
          errorLog = result.errorLog || [];
          pollCount = result.pollCount || 0;
          // FIX #35: Validate all storage values to prevent corrupted data
          pollDelay = (result.pollDelay !== undefined && result.pollDelay !== null) ? Math.max(0, parseInt(result.pollDelay) || PW.POLL_DELAY) : PW.POLL_DELAY;
          submitDelay = (result.submitDelay !== undefined && result.submitDelay !== null) ? Math.max(0, parseInt(result.submitDelay) || PW.SUBMIT_DELAY) : PW.SUBMIT_DELAY;
          humanDelayMin = (result.humanDelayMin !== undefined && result.humanDelayMin !== null) ? Math.max(0, parseInt(result.humanDelayMin) || PW.HUMAN_DELAY_MIN) : PW.HUMAN_DELAY_MIN;
          humanDelayMax = (result.humanDelayMax !== undefined && result.humanDelayMax !== null) ? Math.max(humanDelayMin, parseInt(result.humanDelayMax) || PW.HUMAN_DELAY_MAX) : PW.HUMAN_DELAY_MAX;
          pollCount = Math.max(0, parseInt(result.pollCount) || 0); // FIX #35: Validate pollCount
          useHumanDelay = result.useHumanDelay !== false;
          extensionActive = result.extensionActive !== false; // Default to true if not set
          // FIX #35: Validate pollDetectionInterval (minimum 50ms to prevent CPU overload)
          pollDetectionInterval = (result.pollDetectionInterval !== undefined && result.pollDetectionInterval !== null) ? Math.max(50, parseInt(result.pollDetectionInterval) || PW.POLL_INTERVAL) : PW.POLL_INTERVAL;
          fabPosition = result.fabPosition || null; // FIX #15: Load FAB position
          
          updateUI();
          
          // FIX #1: Use pollDetectionInterval variable instead of constant
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
          
          // FIX #19-20: Clean up all timers on page unload to prevent memory leaks
          window.addEventListener('beforeunload', () => {
            if (checkInterval) clearInterval(checkInterval);
            if (expandTimeout) clearTimeout(expandTimeout);
            if (collapseTimeout) clearTimeout(collapseTimeout);
            if (processingSafetyTimer) clearTimeout(processingSafetyTimer);
            if (resizeTimer) clearTimeout(resizeTimer);
          });
          
          // FIX #23: Re-validate FAB position on orientation/resize changes
          let resizeTimer = null;
          window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              if (statusPanel && fabPosition) {
                const maxLeft = window.innerWidth - 70;
                const maxTop = window.innerHeight - 70;
                const left = parseInt(fabPosition.left) || 0;
                const top = parseInt(fabPosition.top) || 0;
                const newLeft = Math.max(0, Math.min(maxLeft, left));
                const newTop = Math.max(0, Math.min(maxTop, top));
                statusPanel.style.left = newLeft + 'px';
                statusPanel.style.top = newTop + 'px';
              }
            }, 200);
          });
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
          // FIX #31-32: Clear polling interval when disabled to save battery
          if (!extensionActive) {
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
          } else {
            // Re-enable polling when extension is activated
            if (!checkInterval) {
              checkInterval = setInterval(checkForPoll, pollDetectionInterval);
            }
          }
          updateUI();
        }
        if (changes.pollDelay !== undefined) pollDelay = changes.pollDelay.newValue;
        if (changes.submitDelay !== undefined) submitDelay = changes.submitDelay.newValue;
        if (changes.humanDelayMin !== undefined) humanDelayMin = changes.humanDelayMin.newValue;
        if (changes.humanDelayMax !== undefined) humanDelayMax = changes.humanDelayMax.newValue;
        if (changes.useHumanDelay !== undefined) useHumanDelay = changes.useHumanDelay.newValue;
        // FIX #2: Add pollDetectionInterval listener
        if (changes.pollDetectionInterval !== undefined) {
          pollDetectionInterval = changes.pollDetectionInterval.newValue;
          if (checkInterval) clearInterval(checkInterval);
          checkInterval = setInterval(checkForPoll, pollDetectionInterval);
        }
      });

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
    
    // FIX #16: Check if statusPanel exists before accessing it
    if (statusPanel) {
      statusPanel.style.display = (isLecturePage && extensionActive) ? 'block' : 'none';
    }
    
    if (!statusPanel || !isLecturePage || !extensionActive) return;
    
    try {
      const answer = selectedOption || '_';
      
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
            // FIX #9: Store collapse timeout to prevent memory leak
            if (collapseTimeout) clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
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
            if (collapseTimeout) clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
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
            if (collapseTimeout) clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
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
            if (collapseTimeout) clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
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
            if (collapseTimeout) clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
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
            // FIX #8: Don't expand if user just dragged
            if (fabWasDragged) {
              fabWasDragged = false;
              return;
            }
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
          
          // FIX #15: Apply saved FAB position
          if (fabPosition) {
            // FIX #22: Validate position is within current viewport bounds
            const maxLeft = window.innerWidth - 70;
            const maxTop = window.innerHeight - 70;
            const left = parseInt(fabPosition.left) || 0;
            const top = parseInt(fabPosition.top) || 0;
            
            statusPanel.style.left = Math.max(0, Math.min(maxLeft, left)) + 'px';
            statusPanel.style.top = Math.max(0, Math.min(maxTop, top)) + 'px';
            statusPanel.style.right = 'auto';
            statusPanel.style.bottom = 'auto';
          }
        }
      }
    } catch (e) {
      console.error('[PW Sniper Mobile] updateUI error:', e);
    }
  }

  // ============================================
  // NOTIFICATION SYSTEM (FIX #12)
  // ============================================
  let activeNotification = null;
  
  function showNotification(text, color = '#4ade80') {
    if (!statusPanel || statusPanel.style.display === 'none') return;
    
    try {
      // Remove existing notification
      if (activeNotification && activeNotification.parentNode) {
        activeNotification.remove();
        activeNotification = null;
      }
      
      const notif = document.createElement('div');
      notif.style.cssText = `
        position: absolute;
        top: -40px;
        left: 0;
        right: 0;
        background: ${color};
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        opacity: 0;
        transform: translateY(10px);
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
        notif.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          if (notif.parentNode) notif.remove();
          if (activeNotification === notif) activeNotification = null;
        }, 300);
      }, PW.NOTIFICATION_DURATION);
    } catch (e) {}
  }

  function handleLetterPress(letter) {
    selectedOption = letter;
    nextPollAnswer = letter;
    saveToStorage('selectedOption', letter);
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
      fabWasDragged = false; // Reset drag flag
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
        fabWasDragged = true; // Mark as dragged
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
        // FIX #15: Save FAB position to storage
        fabPosition = {
          left: statusPanel.style.left,
          top: statusPanel.style.top
        };
        saveToStorage('fabPosition', fabPosition);
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
        
        // FIX #3: Safety timeout - force reset isProcessing after 15 seconds
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
        // No poll options - try to open poll panel
        // FIX #5: Pass options to tryOpenPoll (avoid redundant findOptions call)
        if (autoOpen) {
          tryOpenPoll(options);
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

  function generatePollHash(options) {
    // FIX #5: Use pollCount + 1 and timestamp for unique hash (no collision)
    const timeBucket = Math.floor(Date.now() / 3000); // 3-second window
    return `poll_${pollCount + 1}_${timeBucket}`;
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
  // ANSWER POLL (FIX #14: Keep answer on failure for retry)
  // ============================================
  function answerPoll(options) {
    try {
      const target = getCurrentAnswer();
      
      // NEW BUG FIX: Check if target is null
      if (!target) {
        addError(`Poll #${pollCount}: No answer selected`);
        addPollResult({
          poll: pollCount,
          answer: 'NONE',
          status: 'FAILED',
          reason: 'No answer selected',
          time: '-'
        });
        showNotification('⚠ No answer selected', '#f59e0b'); // FIX #12: Add notification
        isProcessing = false;
        if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
        updateUI();
        return;
      }
      
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
        showNotification(`✗ Option ${target} not found`, '#ef4444'); // FIX #12: Add notification
        selectedOption = null;
        nextPollAnswer = null;
        saveToStorage('selectedOption', null);
        isProcessing = false;
        updateUI();
        return;
      }

      updateUI();
      showNotification(`⏳ ${target}...`, '#fbbf24'); // FIX #12: Add notification

      // Calculate human-like delay if enabled
      let humanDelay = 0;
      if (useHumanDelay) {
        humanDelay = Math.floor(Math.random() * (humanDelayMax - humanDelayMin + 1)) + humanDelayMin;
      }

      // Wait human delay first, then poll delay
      setTimeout(() => {
        setTimeout(() => {
          try {
            const startTime = performance.now();
            showNotification(`🎯 ${target}...`, '#3b82f6'); // FIX #12: Add notification

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

                    // FIX #6: Increment pollCount ONLY on success
                    pollCount++;
                    saveToStorage('pollCount', pollCount);

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
                    
                    showNotification(`✓ #${pollCount} ${time}ms`, '#10b981'); // FIX #12: Add notification
                    
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
                    showNotification(`⚠ #${pollCount} No submit`, '#f59e0b'); // FIX #12: Add notification
                    // FIX #14: Keep selectedOption for retry (don't reset to null)
                    nextPollAnswer = null;
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
                  showNotification(`✗ #${pollCount} Error`, '#ef4444'); // FIX #12: Add notification
                  // FIX #14: Keep selectedOption for retry (don't reset to null)
                  nextPollAnswer = null;
                } finally {
                  isProcessing = false;
                  if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
                  updateUI();
                }
              }, submitDelay);
            } else {
              // FIX #6: Increment pollCount for SELECTED status
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
            addError(`Poll #${pollCount} answer: ${e.message}`);
            addPollResult({
              poll: pollCount,
              answer: target,
              status: 'FAILED',
              reason: 'Answer error: ' + e.message,
              time: '-'
            });
            showNotification(`✗ #${pollCount} Error`, '#ef4444'); // FIX #12: Add notification
            // FIX #14: Keep selectedOption for retry (don't reset to null)
            nextPollAnswer = null;
            isProcessing = false;
            if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
            updateUI();
          }
        }, pollDelay);
      }, humanDelay);
    } catch (e) {
      addError(`Poll #${pollCount}: ${e.message}`);
      showNotification(`✗ Error`, '#ef4444'); // FIX #12: Add notification
      // FIX #14: Keep selectedOption for retry (don't reset to null)
      nextPollAnswer = null;
      isProcessing = false;
      if (processingSafetyTimer) { clearTimeout(processingSafetyTimer); processingSafetyTimer = null; }
      updateUI();
    }
  }

  // ============================================
  // TRY OPEN POLL (FIX #5: Accept options param to avoid redundant findOptions call)
  // ============================================
  function tryOpenPoll(existingOptions) {
    // FIX #5: Use passed options instead of calling findOptions() again
    if (existingOptions && existingOptions.length >= 2) {
      return;
    }
    
    // SECOND: Check if we're in the middle of opening the panel
    if (panelOpening) {
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
          }
        } catch(e) {}
      }
      
      if (pollDetected) {
        // Set flag to prevent re-clicking while panel opens
        panelOpening = true;
        
        // Click ONCE only!
        const clicked = clickPollIcon(pollIcon);
        
        if (clicked) {
          pollIconClickedAt = now;
          
          // FIX #3: Use PW.PANEL_OPEN_TIMEOUT instead of hardcoded 2000
          setTimeout(() => {
            panelOpening = false;
          }, PW.PANEL_OPEN_TIMEOUT);
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
  
  // Click poll icon (SINGLE CLICK ONLY - mobile optimized)
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
      } catch(e) {
      }
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
        } catch(e) {
        }
      }
      parent = parent.parentElement;
    }
    
    // MOBILE OPTIMIZED: Dispatch touch events first (for Kiwi Browser)
    try {
      const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
      
      // FIX #10: Wrap Touch constructor in try-catch for older browsers
      try {
        const touch = new Touch({ identifier: ++touchIdCounter, target: el, clientX: el.getBoundingClientRect().left + 10, clientY: el.getBoundingClientRect().top + 10 });
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
    }
    
    // LAST RESORT: Native click
    try {
      if (typeof el.click === 'function') {
        el.click();
        return true;
      }
    } catch(e) {
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
          identifier: ++touchIdCounter, 
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
          selectedOption = null; // FIX #11: Reset selectedOption
          nextPollAnswer = null; // FIX #11: Reset nextPollAnswer
          savePollHistory();
          saveErrorLog();
          saveToStorage('pollCount', 0);
          saveToStorage('selectedOption', null); // FIX #11: Save reset
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
            pollDelay = Math.max(0, parseInt(msg.pollDelay) || PW.POLL_DELAY);
            saveToStorage('pollDelay', pollDelay);
          }
          if (msg.submitDelay !== undefined) {
            submitDelay = Math.max(0, parseInt(msg.submitDelay) || PW.SUBMIT_DELAY);
            saveToStorage('submitDelay', submitDelay);
          }
          if (msg.humanDelayMin !== undefined) {
            // FIX #27: Validate humanDelayMin is non-negative
            humanDelayMin = Math.max(0, parseInt(msg.humanDelayMin) || PW.HUMAN_DELAY_MIN);
            saveToStorage('humanDelayMin', humanDelayMin);
          }
          if (msg.humanDelayMax !== undefined) {
            // FIX #27: Validate humanDelayMax >= humanDelayMin
            humanDelayMax = Math.max(humanDelayMin, parseInt(msg.humanDelayMax) || PW.HUMAN_DELAY_MAX);
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
