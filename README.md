# ⚡ PW Poll Sniper - Smart Chrome Extension

A **smart** Chrome extension that auto-answers Physics Wallah (PW) lecture polls in **milliseconds** using AI-powered detection.

---

## 🧠 Smart Features

### **Zero Configuration Required!**

The extension uses advanced auto-discovery to find poll elements:

- ✅ **Auto-Discovery** - Automatically detects poll elements using multiple strategies
- ✅ **Machine Learning** - Remembers successful selectors for instant future detection
- ✅ **Pattern Recognition** - Identifies A/B/C/D buttons, button groups, poll containers
- ✅ **Visibility Detection** - Watches for elements that suddenly appear on screen
- ✅ **Fallback Strategies** - If one method fails, tries 5+ alternative approaches
- ✅ **Self-Healing** - Adapts if PW changes their website structure

---

## 🎯 How It Works

1. **Before the lecture** — Open the extension popup and pre-select your answer (A, B, C, or D)
2. **During the lecture** — The extension watches the page using 3 detection strategies simultaneously
3. **When teacher launches a poll** — Extension auto-detects it using smart heuristics
4. **⚡ Instant action** — Clicks poll icon → selects your preset answer → clicks Submit
5. **All in milliseconds** — Fastest answer in the class!

---

## 📦 Installation

1. Download and extract `pw-poll-sniper.zip`
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the extracted `pw-poll-sniper` folder
6. Done! The ⚡ icon appears in your toolbar

---

## 🎮 Usage

### Basic Usage (No Setup Needed!)

1. Click the extension icon
2. Select your answer (A, B, C, or D)
3. Go to your PW live class
4. Wait for a poll to appear
5. Extension auto-answers instantly! ⚡

### Advanced Features

| Setting | Description |
|---------|-------------|
| **Pre-select Answer** | Click A, B, C, or D before the poll starts |
| **Auto-Submit** | Automatically click Submit after selecting the answer |
| **Auto-Open Poll Icon** | Auto-click the poll icon when it turns blue |
| **Sound Alert** | Play a sound when a poll is answered |
| **🔍 Debug Mode** | Enable verbose logging to console |

### Keyboard Shortcuts

- **Ctrl+Shift+P** — Trigger a smart scan to find poll elements (while on PW page)

### Smart Scan Button

Click "🔍 Smart Scan Page" in the popup to manually trigger detection and see what the extension finds. Check the browser console (F12) for detailed output.

### Clear Learned Selectors

If the extension learned wrong selectors, click "🗑️ Clear Learned Selectors" to reset and let it re-learn.

---

## 🧠 How Smart Detection Works

### Detection Strategies (in order):

1. **Learned Selectors** - Uses previously successful selectors (fastest)
2. **Letter Element Detection** - Finds elements with just "A", "B", "C", "D" text
3. **Button Group Analysis** - Identifies groups of 2-6 buttons that might be options
4. **Container Pattern Matching** - Looks for poll/quiz/question containers
5. **Submit Button Heuristics** - Finds submit buttons near options or with submit-like text
6. **Poll Icon Detection** - Identifies the blue/active poll icon
7. **Visibility Observation** - Watches for elements that suddenly become visible
8. **Fuzzy Text Matching** - Matches options even with extra text (e.g., "A. Option text")

### Learning System

When the extension successfully answers a poll:
- It saves the CSS selectors that worked
- Next time, it tries those selectors first (instant detection)
- If they fail, it falls back to auto-discovery
- Selectors persist across browser sessions

---

## 📊 Stats Tracking

The extension tracks:
- Number of polls answered
- Average response time (in milliseconds)
- Current detection method (Learned / Scanning)

---

## 🔧 Technical Details

- **Manifest V3** Chrome extension
- **3 Detection Strategies:**
  - MutationObserver for DOM changes
  - Periodic smart checks (300ms intervals)
  - IntersectionObserver for visibility changes
- **Smart Learning** - Stores successful selectors in chrome.storage
- **Heuristic Analysis** - Multiple pattern recognition algorithms
- **Simulated Clicks** - Realistic mouse event sequence
- **Works on** - `pw.live` and all PW subdomains
- **Lightweight** - No external dependencies, pure JavaScript

---

## 📁 File Structure

```
pw-poll-sniper/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.css          # Popup styles (dark theme)
├── popup.js           # Popup logic + content script communication
├── content.js         # Smart detection engine (auto-learn, multi-strategy)
├── content.css        # Visual feedback styles
├── background.js      # Service worker (stats tracking)
└── icons/
    ├── icon16.png     # Toolbar icon (small)
    ├── icon48.png     # Extension management page
    └── icon128.png    # Chrome Web Store / install
```

---

## 🐛 Troubleshooting

### Extension doesn't detect polls

1. Enable Debug Mode in the popup
2. Press F12 → Console tab
3. Click "🔍 Smart Scan Page" or press Ctrl+Shift+P
4. Check console output for what the extension found
5. If it found elements but didn't click, the selector learning might have failed
6. Click "🗑️ Clear Learned Selectors" to reset

### Wrong option gets clicked

- The extension tries multiple matching strategies
- If position-based matching is wrong, try changing your pre-selected answer
- Check console logs to see which matching strategy was used

### Submit button not found

- The extension searches near the poll options first
- Then searches the entire page for submit-like buttons
- If still not found, disable Auto-Submit and click manually
- The extension will learn from your manual click

### Extension worked once but not anymore

- PW might have changed their HTML structure
- Click "🗑️ Clear Learned Selectors" to force re-learning
- The extension will auto-discover the new structure

---

## 🎓 Advanced: Understanding the Smart Detection

### Console Output

When Debug Mode is enabled, you'll see:

```
[PW Poll Sniper 🧠] Smart watching started with 3 strategies
[PW Poll Sniper 🧠] Running smart auto-discovery...
[PW Poll Sniper 🧠] Found 4 letter elements
[PW Poll Sniper 🧠] 🎯 Poll discovered via auto-discovery!
[PW Poll Sniper 🧠] 💾 Learned selectors saved for next time
[PW Poll Sniper 🧠] ⚡ Clicking option A
[PW Poll Sniper 🧠] ✅ Auto-submitting
[PW Poll Sniper] 🎉 Poll answered in 47ms!
```

### Learned Selectors Structure

The extension saves selectors like:
```javascript
{
  pollOptions: [
    { selector: "button.option-a", text: "A" },
    { selector: "button.option-b", text: "B" },
    ...
  ],
  submitButton: "button.submit-btn",
  pollIcon: "div.poll-icon"
}
```

---

## ⚠️ Disclaimer

This extension is for **educational purposes only**. Use responsibly. The extension uses smart heuristics to interact with PW's website and adapts to changes automatically.

---

## 🚀 Why "Smart"?

Unlike basic extensions that require manual selector configuration, this extension:

1. **Auto-discovers** poll elements without any setup
2. **Learns** from successful interactions
3. **Adapts** to website changes automatically
4. **Uses multiple strategies** for robust detection
5. **Self-heals** when selectors become invalid
6. **Requires zero technical knowledge** from the user

Just install, select your answer, and let the AI handle the rest! 🧠⚡
