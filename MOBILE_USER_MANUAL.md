# 📱 PW Poll Sniper Mobile - User Manual
## Complete Guide for Android (Kiwi Browser)

---

## 📋 Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [How to Use](#how-to-use)
4. [Touch Controls](#touch-controls)
5. [Popup Menu](#popup-menu)
6. [Settings](#settings)
7. [Tips & Tricks](#tips--tricks)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## 📲 Installation

### Step 1: Install Kiwi Browser
- Download **Kiwi Browser** from Google Play Store
- Kiwi Browser supports Chrome extensions (normal Chrome doesn't)

### Step 2: Download Extension
- Download `pw-poll-sniper-mobile.zip` file
- Extract the zip file to a folder on your phone
- Remember the folder location

### Step 3: Install Extension
1. Open **Kiwi Browser**
2. Tap **⋮** (3 dots menu) → **Extensions**
3. Enable **Developer mode** (toggle at top right)
4. Tap **"+ (from .zip/.crx/.user.js)"**
5. Select the extracted folder: `pw-poll-sniper-mobile`
6. Extension installed! ✅

### Step 4: Verify Installation
- You should see "PW Poll Sniper Mobile" in extensions list
- Extension icon (⚡) appears in browser toolbar
- Default status: **OFF** (you need to enable it)

---

## 🚀 Getting Started

### First Time Setup

1. **Open PW Website**
   - Go to `https://www.pw.live` in Kiwi Browser
   - Login to your account
   - Open any lecture (live or recorded)

2. **Enable Extension**
   - You'll see a small overlay panel at bottom-right
   - **Tap P button** on overlay OR
   - Tap extension icon (⚡) → Toggle ON in popup
   - Green dot = Extension is ON ✅

3. **Select Answer**
   - **Tap Q button** on overlay (enters answer mode)
   - **Tap A/B/C/D** to select your answer
   - Overlay shows your selected answer

4. **Wait for Poll**
   - When poll appears, extension auto-detects it
   - Poll panel opens automatically
   - Your pre-selected answer gets clicked
   - Submit button clicked automatically
   - Poll answered! ✅

---

## 🎮 How to Use

### Method 1: Using Overlay Touch Buttons (Recommended)

**Overlay Panel** appears at bottom-right of screen with 4 buttons:

```
┌─────────────────┐
│ 🟢 ✓ A    #5    │  ← Status bar (drag from here)
├─────────────────┤
│ [Q] [A] [B] [P] │  ← Touch buttons
└─────────────────┘
```

**Steps:**
1. **Tap P** → Extension ON (green dot appears)
2. **Tap Q** → Enter answer mode (yellow indicator)
3. **Tap A/B/C/D** → Select your answer
4. **Wait** → Poll auto-answers when it appears

**Example:**
```
You want to answer "B" for next poll:

1. Tap P (if extension OFF)
2. Tap Q (enters Q mode)
3. Tap B (selects answer B)
4. Wait for poll...
5. Poll appears → Auto-answers B ✅
```

---

### Method 2: Using Popup Menu

1. **Tap extension icon** (⚡) in browser toolbar
2. **Toggle ON** the main switch at top
3. **Tap A/B/C/D buttons** to pre-select answer
4. Close popup
5. Wait for poll → Auto-answers ✅

---

### Method 3: Keyboard Shortcuts (If Using Physical Keyboard)

If you have a Bluetooth keyboard connected:

- **P** → Toggle extension ON/OFF
- **Q** → Enter answer mode (30 seconds)
- **A/B/C/D** → Select answer
- **Escape** → Cancel Q mode

---

## 🎯 Touch Controls

### Overlay Buttons Explained

#### **Q Button** (Yellow when active)
- **Function:** Enter answer selection mode
- **When to use:** Before poll appears
- **Timeout:** 30 seconds (auto-expires)
- **Indicator:** Yellow background when active

**Usage:**
```
Tap Q → Overlay shows "⏳ A/B/C/D? (30s)"
       → You have 30 seconds to select answer
       → Tap A/B/C/D button
       → Answer selected ✅
```

---

#### **A/B/C/D Buttons** (Blue when selected)
- **Function:** Select answer for next poll
- **When to use:** After tapping Q button
- **Indicator:** Blue background when selected
- **Can change:** Yes, tap different button to change

**Usage:**
```
After tapping Q:
  Tap A → Answer = A (blue highlight)
  Tap B → Answer = B (changes to B)
  Tap C → Answer = C (changes to C)
  Tap D → Answer = D (changes to D)
```

**Multiple Presses:**
- You can tap A/B/C/D multiple times
- Last tap wins
- Example: Tap A → Tap B → Tap C = Answer is C

---

#### **P Button** (Green when ON)
- **Function:** Toggle extension ON/OFF
- **When to use:** Enable/disable extension
- **Indicator:** Green when ON, gray when OFF
- **Effect:** Stops all poll detection when OFF

**Usage:**
```
Tap P → Extension ON (green dot, starts detecting polls)
Tap P → Extension OFF (gray dot, stops detecting)
```

---

### Dragging the Overlay

**To move overlay panel:**
1. **Long press** on the status bar (top part with 🟢 ✓ A)
2. **Drag** to new location
3. **Release** to drop

**Tips:**
- Drag to corner to keep it out of way
- Drag near poll icon for quick access
- Position stays saved

---

## 📊 Popup Menu

### Opening Popup

1. Tap **extension icon** (⚡) in browser toolbar
2. Popup menu opens

### Popup Sections

#### **1. Header (Top)**
```
┌──────────────────────────┐
│ ⚡ PW Poll Sniper    [ON]│  ← Main toggle
│    Mobile v5.3.6         │
├──────────────────────────┤
│ 🟢 Active                │  ← Status indicator
└──────────────────────────┘
```

**Main Toggle:**
- Toggle ON/OFF extension
- Same as P button on overlay

**Status Indicator:**
- 🟢 Green = Extension active
- 🔴 Red = Extension inactive

---

#### **2. Stats Section**
```
┌────────┬────────┬────────┐
│   12   │   10   │ 847ms  │
│ Polls  │Success │Avg Time│
└────────┴────────┴────────┘
```

**Shows:**
- **Polls:** Total polls detected
- **Success:** Successfully answered polls
- **Avg Time:** Average response time

---

#### **3. Quick Answer Section**
```
┌──────────────────────────┐
│ 🎯 Quick Answer          │
│ [A] [B] [C] [D]          │  ← Tap to select
│ Tap to pre-select answer │
└──────────────────────────┘
```

**Usage:**
- Tap A/B/C/D to select answer
- Selected button turns blue
- Same as overlay A/B/C/D buttons

---

#### **4. Settings Section (Collapsible)**
```
┌──────────────────────────┐
│ ⚙️ Settings           ▶  │  ← Tap to expand
└──────────────────────────┘
```

**Tap to expand and see:**

**Auto Submit** (Default: ON)
- ON: Automatically clicks submit button
- OFF: Only selects answer, you submit manually

**Auto Open Poll** (Default: ON)
- ON: Automatically clicks poll icon when poll detected
- OFF: You need to click poll icon manually

**Human-like Delay** (Default: ON)
- ON: Adds random 500-1500ms delay (looks natural)
- OFF: Instant answer (suspicious)

---

#### **5. Touch Controls Section (Collapsible)**
```
┌──────────────────────────┐
│ ⌨️ Touch Controls     ▶  │  ← Tap to expand
└──────────────────────────┘
```

**Shows:**
- P → Toggle ON/OFF
- Q → Enter answer mode (30s)
- A/B → Select answer

---

#### **6. Help Section (Collapsible)**
```
┌──────────────────────────┐
│ ❓ How to Use         ▶  │  ← Tap to expand
└──────────────────────────┘
```

**Shows:**
- Step-by-step guide
- Usage instructions

---

## ⚙️ Settings

### Accessing Settings

**Method 1: Via Popup**
1. Tap extension icon (⚡)
2. Tap "⚙️ Settings" section
3. Toggle settings ON/OFF

**Method 2: Via Overlay**
- Overlay doesn't have settings
- Use popup menu for settings

### Settings Explained

#### **Auto Submit**
**What it does:**
- Automatically clicks "Submit Answer" button after selecting answer

**When to use:**
- ✅ ON (Recommended): Fully automatic
- ❌ OFF: If you want to review before submitting

**Example:**
```
Auto Submit ON:
  Poll appears → Answer selected → Submit clicked → Done ✅

Auto Submit OFF:
  Poll appears → Answer selected → YOU click submit manually
```

---

#### **Auto Open Poll**
**What it does:**
- Automatically clicks poll icon when poll is detected
- Opens the poll panel

**When to use:**
- ✅ ON (Recommended): Fully automatic
- ❌ OFF: If you want to see poll before opening

**Example:**
```
Auto Open ON:
  Poll icon turns blue → Auto-clicks → Panel opens → Answer selected

Auto Open OFF:
  Poll icon turns blue → YOU click icon → Panel opens → Answer selected
```

---

#### **Human-like Delay**
**What it does:**
- Adds random delay (500-1500ms) before answering
- Makes extension look more human-like

**When to use:**
- ✅ ON (Recommended): Avoids detection, looks natural
- ❌ OFF: Instant answer (may look suspicious)

**Example:**
```
Human Delay ON:
  Poll appears → Wait 500-1500ms (random) → Answer selected
  Looks like human thinking time

Human Delay OFF:
  Poll appears → Instant answer (0ms)
  Looks like bot/automation
```

---

## 💡 Tips & Tricks

### Tip 1: Pre-Select Answer Early
**Best Practice:**
- Select answer BEFORE poll appears
- Tap Q → Tap A/B/C/D → Wait
- When poll appears, instant answer ✅

**Why:**
- Faster response time
- Less chance of missing poll

---

### Tip 2: Use Q Mode for Live Polls
**For Live Lectures:**
1. Teacher asks question
2. You know the answer
3. Tap Q → Tap answer (A/B/C/D)
4. Wait for poll to appear
5. Auto-answers instantly ✅

**Why:**
- You have time to think
- Answer ready before poll opens

---

### Tip 3: Change Answer if Needed
**Changed your mind?**
- Tap Q again
- Tap different answer (A/B/C/D)
- New answer selected ✅

**Example:**
```
First: Tap Q → Tap A (selected A)
Then:  Tap Q → Tap B (changed to B)
Result: Answer = B ✅
```

---

### Tip 4: Drag Overlay Strategically
**Best Positions:**
- **Bottom-right:** Default, doesn't block video
- **Top-right:** Near poll icon for quick access
- **Bottom-left:** If you're left-handed

**How:**
- Long press status bar
- Drag to new position
- Release

---

### Tip 5: Check Stats Regularly
**Monitor Performance:**
- Open popup menu
- Check "Success" count
- Check "Avg Time"

**Good Stats:**
- Success rate: >90%
- Avg time: <1500ms (with human delay)
- Avg time: <500ms (without human delay)

---

### Tip 6: Use Human Delay for Safety
**Why Human Delay is Important:**
- Instant answers look suspicious
- PW might detect automation
- Random delay looks like human thinking

**Recommended:**
- Keep Human Delay ON
- 500-1500ms is natural thinking time
- Avoids detection ✅

---

### Tip 7: Test Before Important Lectures
**Test Run:**
1. Open a recorded lecture
2. Enable extension
3. Select answer (Q + A/B/C/D)
4. Wait for poll
5. Verify it works ✅

**Why:**
- Ensures extension is working
- You understand the flow
- No surprises during live lecture

---

### Tip 8: Keep Extension OFF When Not Needed
**Why:**
- Saves battery
- Reduces background processing
- Only enable during lectures with polls

**How:**
- Tap P button to turn OFF
- Or toggle OFF in popup
- Turn ON only when needed

---

## 🔧 Troubleshooting

### Problem 1: Extension Not Detecting Polls

**Symptoms:**
- Poll appears but extension doesn't respond
- No "Poll detected" notification

**Solutions:**

**Check 1: Extension is ON**
- Overlay shows green dot (🟢)
- If red dot, tap P button to enable

**Check 2: Answer Selected**
- Overlay shows A/B/C/D (not "_")
- If "_", tap Q → Tap A/B/C/D

**Check 3: Auto Open is ON**
- Open popup → Settings
- "Auto Open Poll" should be ON

**Check 4: Poll Icon Visible**
- Poll icon should be visible on screen
- If hidden, scroll to make it visible

**Check 5: Page Fully Loaded**
- Wait 10-20 seconds after page loads
- Extension needs time to initialize

**Still not working?**
- Refresh page (pull down to refresh)
- Re-enable extension (P → P)
- Check console logs (F12 → Console)

---

### Problem 2: First Poll Not Working

**Symptoms:**
- First poll fails
- Second poll onwards works fine

**This is FIXED in v5.3.6!**

**If still happening:**
- Update to v5.3.6 (latest version)
- Reinstall extension
- Clear browser cache

---

### Problem 3: Overlay Not Visible

**Symptoms:**
- Can't see overlay panel
- No touch buttons visible

**Solutions:**

**Check 1: Extension is ON**
- Open popup menu
- Toggle extension ON
- Overlay should appear

**Check 2: On Lecture Page**
- Overlay only shows on lecture pages
- Must have video player on page
- Go to pw.live → Open lecture

**Check 3: Not Hidden**
- Overlay might be dragged off-screen
- Refresh page to reset position
- Or reinstall extension

**Check 4: Z-index Issue**
- Some elements might cover overlay
- Try dragging overlay to different position
- Or zoom out page

---

### Problem 4: Answer Not Getting Selected

**Symptoms:**
- Poll opens but answer not clicked
- Wrong answer selected

**Solutions:**

**Check 1: Correct Answer Selected**
- Overlay shows correct letter (A/B/C/D)
- If wrong, tap Q → Tap correct answer

**Check 2: Auto Submit is ON**
- Open popup → Settings
- "Auto Submit" should be ON
- If OFF, answer selected but not submitted

**Check 3: Poll is Active**
- Poll should be unanswered
- If already answered, extension won't click
- Check for "Correct Answer is" text

**Check 4: React Click Working**
- Extension tries React click first
- Falls back to DOM click
- Check console for errors

---

### Problem 5: Extension Slow/Laggy

**Symptoms:**
- Slow response time
- Delayed poll detection
- Browser feels slow

**Solutions:**

**Solution 1: Enable Human Delay**
- Open popup → Settings
- Turn ON "Human-like Delay"
- Adds natural delay, reduces load

**Solution 2: Close Other Tabs**
- Close unnecessary tabs
- Frees up memory
- Improves performance

**Solution 3: Clear Cache**
- Kiwi Browser → Settings → Privacy
- Clear browsing data → Cached images
- Restart browser

**Solution 4: Disable Other Extensions**
- Too many extensions slow down browser
- Disable unused extensions
- Keep only PW Poll Sniper

---

### Problem 6: Popup Not Opening

**Symptoms:**
- Tap extension icon but popup doesn't open
- Popup opens but blank

**Solutions:**

**Solution 1: Refresh Page**
- Pull down to refresh
- Try opening popup again

**Solution 2: Reinstall Extension**
- Remove extension
- Reinstall from zip
- Restart browser

**Solution 3: Check Storage**
- Extension uses chrome.storage
- If storage full, popup might fail
- Clear browser data

---

### Problem 7: Touch Buttons Not Responding

**Symptoms:**
- Tap Q/A/B/P but nothing happens
- Buttons visible but not working

**Solutions:**

**Solution 1: Check Extension Status**
- Extension must be ON (green dot)
- If OFF, tap P button first

**Solution 2: Tap Precisely**
- Tap center of button
- Don't tap edges
- Use finger, not stylus

**Solution 3: Wait for Page Load**
- Wait 10-20 seconds after page loads
- Extension needs time to initialize
- Then try buttons

**Solution 4: Refresh Overlay**
- Drag overlay to new position
- Or refresh page
- Overlay reinitializes

---

## ❓ FAQ

### Q1: Does it work on LIVE lectures?
**A:** Yes! Works on both LIVE and RECORDED lectures. Extension detects poll icon color change (white → blue) and auto-opens poll panel.

---

### Q2: Is it safe to use?
**A:** Yes, with Human-like Delay ON:
- Adds random 500-1500ms delay
- Looks like human thinking time
- Avoids detection
- Recommended to keep ON

---

### Q3: Will PW detect this extension?
**A:** Unlikely if you:
- Keep Human Delay ON
- Don't answer too many polls too fast
- Use normal browsing patterns
- Don't share your account

---

### Q4: Can I use it on multiple devices?
**A:** Yes! Install on:
- Phone (Kiwi Browser)
- Tablet (Kiwi Browser)
- Each device needs separate installation

---

### Q5: Does it work on other browsers?
**A:** Mobile:
- ✅ Kiwi Browser (Android) - Works
- ❌ Chrome Mobile - No extension support
- ❌ Firefox Mobile - No extension support
- ❌ Safari iOS - No extension support

Desktop:
- ✅ Chrome - Use desktop version
- ✅ Edge - Use desktop version
- ✅ Brave - Use desktop version

---

### Q6: What if poll has more than 4 options?
**A:** Extension supports A/B/C/D only (4 options). If poll has E/F/G/H, you need to answer manually. Most PW polls have 4 options.

---

### Q7: Can I answer polls manually?
**A:** Yes! Two ways:

**Method 1: Auto Open OFF**
- Settings → Auto Open Poll → OFF
- Poll icon turns blue
- YOU click poll icon
- Panel opens
- YOU select answer manually

**Method 2: No Answer Selected**
- Don't tap Q or A/B/C/D
- Poll opens automatically (if Auto Open ON)
- YOU select answer manually
- Submit manually (if Auto Submit OFF)

---

### Q8: What's the fastest response time?
**A:** With Human Delay OFF:
- Response time: 300-500ms
- Very fast, looks suspicious

With Human Delay ON (Recommended):
- Response time: 800-2000ms
- Natural, looks human
- Safe to use

---

### Q9: Can I see poll history?
**A:** Yes! Open popup menu:
- Stats section shows total polls
- Success count
- Average response time
- Last 50 polls saved

---

### Q10: What if I select wrong answer?
**A:** Change it!
- Tap Q again
- Tap correct answer (A/B/C/D)
- New answer selected
- Old answer replaced

---

### Q11: Does it drain battery?
**A:** Minimal impact:
- Extension only active when enabled
- Polling every 100ms (low CPU)
- Turn OFF when not needed (P button)
- Saves battery

---

### Q12: Can I customize delays?
**A:** Currently fixed:
- Human delay: 500-1500ms (random)
- Poll delay: 260ms
- Submit delay: 25ms

Future versions may add customization.

---

### Q13: What if poll doesn't appear?
**A:** Extension keeps checking:
- Polls every 100ms
- Waits for poll icon to turn blue
- If no poll, does nothing
- No battery drain

---

### Q14: Can I use it during exams?
**A:** ⚠️ Not recommended:
- Exams may have proctoring
- Risk of getting caught
- Use only for practice polls
- Don't use in graded assessments

---

### Q15: How to uninstall?
**A:**
1. Kiwi Browser → ⋮ → Extensions
2. Find "PW Poll Sniper Mobile"
3. Tap "Remove"
4. Confirm removal
5. Extension uninstalled ✅

---

## 🎯 Quick Reference Card

### Basic Usage
```
1. Enable: Tap P (green dot)
2. Select: Tap Q → Tap A/B/C/D
3. Wait: Poll auto-answers
```

### Touch Buttons
```
[Q] = Enter answer mode (30s)
[A] = Select answer A
[B] = Select answer B
[P] = Toggle ON/OFF
```

### Status Indicators
```
🟢 = Extension ON
🔴 = Extension OFF
⏳ = Q mode active (waiting for answer)
✓ = Ready (answer selected)
_ = No answer selected
```

### Settings (Recommended)
```
✅ Auto Submit: ON
✅ Auto Open Poll: ON
✅ Human-like Delay: ON
```

---

## 📞 Support

**Issues or Questions?**
- Check troubleshooting section
- Read FAQ section
- Check console logs (F12 → Console)
- Reinstall extension if needed

**Version Info:**
- Current version: 5.3.6
- Last updated: 2026-09-21
- Status: Bug-free, production-ready

---

## 🎉 You're All Set!

**Quick Start Checklist:**
- ✅ Kiwi Browser installed
- ✅ Extension installed
- ✅ Extension enabled (P button)
- ✅ Answer selected (Q + A/B/C/D)
- ✅ Settings configured (Auto Submit ON, Human Delay ON)
- ✅ Ready to answer polls!

**Next Steps:**
1. Open a PW lecture
2. Enable extension
3. Select answer
4. Wait for poll
5. Enjoy auto-answering! 🚀

---

**Happy Polling! 📱⚡**
