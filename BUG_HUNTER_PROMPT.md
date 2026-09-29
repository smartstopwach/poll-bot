# 🔍 ULTIMATE BUG HUNTER PROMPT
## Ek baar me hazaro bugs find karne ka systematic method

---

## 📋 PROMPT (Copy-Paste karo):

```
SYSTEMATIC BUG HUNT — COMPLETE AUDIT REQUIRED

Tumhe is code ka COMPLETE systematic audit karna hai. Line-by-line read karo aur 
har possible bug find karo — ek baar me, kitna bhi time lage.

═══════════════════════════════════════════════════
PHASE 1: STATE VARIABLE AUDIT
═══════════════════════════════════════════════════

Har state variable ke liye ye trace karo:
- Kaun SET karta hai? (har jagah list karo)
- Kaun READ karta hai? (har jagah list karo)  
- Kaun RESET karta hai? (har jagah list karo)
- Kya koi path hai jahan SET hota hai but RESET nahi?
- Kya koi variable unused hai (set but never read)?

Format me output do:
```
Variable: [name]
  SET by: [function1:line, function2:line, ...]
  READ by: [function1:line, function2:line, ...]
  RESET by: [function1:line, function2:line, ...]
  ⚠️ Issues: [koi gap ya problem]
```

═══════════════════════════════════════════════════
PHASE 2: TIMER LIFECYCLE AUDIT
═══════════════════════════════════════════════════

Har timer (setTimeout/setInterval) ke liye:
- Kahan CREATE hota hai? (exact line)
- Kahan CLEAR hota hai? (exact line)
- Kya koi path hai jahan create hota hai but clear nahi?
- Agar timer fire kare after state change, kya hoga?
- Kya timer ka ID track hota hai ya anonymous hai?

Format:
```
Timer: [description]
  Created: [function:line]
  Cleared: [function1:line, function2:line, ...]
  Tracked: [yes/no — variable name]
  ⚠️ Risk: [stale fire risk, memory leak, etc.]
```

═══════════════════════════════════════════════════
PHASE 3: FUNCTION EXIT PATH AUDIT
═══════════════════════════════════════════════════

Har function ke liye, HAR POSSIBLE exit path trace karo:
- Normal return
- Early return (guard clauses)
- Exception/catch paths
- Timeout callback paths
- Async completion paths

Har exit path pe check karo:
- Kya state properly reset hota hai?
- Kya timers clear hote hain?
- Kya flags (isProcessing, etc.) reset hote hain?
- Kya retry loop possible hai? (hash not set, answer not cleared)

Format:
```
Function: [name]
  Path 1: [condition] → [what happens] → [cleanup: ✅/❌]
  Path 2: [condition] → [what happens] → [cleanup: ✅/❌]
  Path 3: catch → [what happens] → [cleanup: ✅/❌]
  ⚠️ Missing cleanup: [list]
```

═══════════════════════════════════════════════════
PHASE 4: RACE CONDITION AUDIT
═══════════════════════════════════════════════════

Har pair of concurrent operations check karo:
- Kya do timers/intervals same state modify kar sakte hain?
- Kya ek function doosre ko interrupt kar sakta hai?
- Kya guard variables (isProcessing, isCheckRunning) properly protect karte hain?
- Kya koi scenario hai jahan guard bypass ho jaye?

Scenarios to check:
1. WS watcher + checkForPoll same poll detect karein
2. User keyboard shortcut press kare during poll processing
3. Extension toggle OFF during processing
4. SPA navigation during processing
5. Multiple rapid polls (same session)
6. Poll retract (disappear) during processing

═══════════════════════════════════════════════════
PHASE 5: MEMORY LEAK AUDIT
═══════════════════════════════════════════════════

Check karo:
- Event listeners: kahan add hote hain, kahan remove hote hain?
- Kya listeners accumulate hote hain (same listener added multiple times)?
- Timers: kya sab properly cleared hote hain?
- DOM references: kya stale references hold hote hain?
- Arrays: kya unbounded growth possible hai?

═══════════════════════════════════════════════════
PHASE 6: EDGE CASE AUDIT
═══════════════════════════════════════════════════

Ye scenarios trace karo:
1. Function call with null/undefined arguments
2. DOM element removed between find and click
3. Network request fails/rejects
4. Storage get/set fails
5. Multiple rapid function calls (debounce needed?)
6. State change during async operation
7. Page unload during processing
8. Extension reload without page refresh
9. Browser back/forward during processing
10. Empty arrays/null objects passed to functions

═══════════════════════════════════════════════════
PHASE 7: ERROR RECOVERY AUDIT
═══════════════════════════════════════════════════

Har catch block check karo:
- Kya error properly logged hota hai?
- Kya state properly reset hota hai?
- Kya retry loop possible hai? (hash not set = retry)
- Kya user ko proper feedback milta hai?
- Kya error cascade possible hai? (one error triggers another)

═══════════════════════════════════════════════════
PHASE 8: CROSS-FUNCTION INTERACTION AUDIT
═══════════════════════════════════════════════════

Har function pair check karo jo same state modify karte hain:
- Kya function A ka output function B ke liye safe hai?
- Kya function A function B ko call karta hai with valid state?
- Kya circular dependencies hain?
- Kya function call order matters? (A before B vs B before A)

═══════════════════════════════════════════════════
PHASE 9: SECURITY AUDIT
═══════════════════════════════════════════════════

Check karo:
- postMessage: kya source verify hota hai?
- DOM queries: kya user input sanitize hota hai?
- Storage: kya sensitive data expose hota hai?
- Network: kya credentials leak ho sakte hain?
- Code injection: kya eval() ya innerHTML unsafe hai?

═══════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════

Final output me do:

## 🐛 BUGS FOUND (Total: X)

### Critical Bugs (🔴)
1. **[Bug Title]**
   - Location: [file:line]
   - Issue: [what's wrong]
   - Impact: [what happens]
   - Fix: [exact code change]

### Moderate Bugs (🟡)
...

### Low Bugs (⚪)
...

## ✅ VERIFIED CLEAN

- [List of all paths checked and verified clean]

## 📊 AUDIT SUMMARY

- State variables traced: X
- Timers tracked: X
- Functions audited: X
- Exit paths checked: X
- Race conditions checked: X
- Edge cases checked: X

═══════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════

1. HAR LINE READ KARO — skip mat karo
2. HAR PATH TRACE KARO — assume mat karo
3. CROSS-REFERENCE KARO — ek jagah ka fix doosri jagah break toh nahi kar raha?
4. BE PARANOID — har jagah bug dhundo
5. FIX BHI VERIFY KARO — fix ne naya bug toh nahi introduce kiya?
6. TIME LIMIT NAHI HAI — jitna time lage lo, but COMPLETE karo
7. KITNE BHI BUGS HO — 10 ho ya 1000, sab find karo
```

---

## 💡 HOW TO USE:

1. **Code file kholo** (content.js, inject.js, etc.)
2. **Upar wala prompt copy karo**
3. **AI ko do** with the code
4. **Wait karo** — systematic audit me time lagta hai
5. **Saare bugs ek baar me mil jayenge**

---

## 🎯 WHY THIS WORKS:

| Old Method | New Method |
|------------|------------|
| Line-by-line reading | Systematic checklist |
| Jo dikha wo fix kiya | Har path trace kiya |
| Fix ne naye bugs create kiye | Cross-reference verify kiya |
| 5-6 rounds lage | **1 round me complete** |
| ~5 bugs per round | **All bugs at once** |

---

## ⚡ PRO TIPS:

1. **Multiple files?** Har file ke liye alag audit karo, phir cross-file interactions check karo
2. **Large codebase?** Functions ko groups me divide karo, har group ka audit karo
3. **Complex state machine?** State transition diagram banao, har transition verify karo
4. **Async code?** Promise chain / callback chain trace karo, har step pe state check karo
5. **Event-driven?** Event flow diagram banao, har event handler verify karo

---

## 📝 EXAMPLE OUTPUT (Expected):

```
## 🐛 BUGS FOUND (Total: 47)

### Critical Bugs (🔴) — 12
1. **answerPoll catch doesn't reset selectedOption**
   - Location: content.js:1173
   - Issue: Outer catch only resets nextPollAnswer, not selectedOption
   - Impact: checkForPoll retries same poll endlessly (retry loop)
   - Fix: Add `selectedOption = null; saveToStorage('selectedOption', null);`

2. **SPA navigation doesn't clear pollAnswerTimer3**
   - Location: content.js:425
   - Issue: Timer fires on new page, could click wrong button
   - Impact: Wrong button click on different page
   - Fix: Add `if (pollAnswerTimer3) { clearTimeout(pollAnswerTimer3); pollAnswerTimer3 = null; }`

...

### Moderate Bugs (🟡) — 23
...

### Low Bugs (⚪) — 12
...

## ✅ VERIFIED CLEAN
- checkForPoll: all 8 exit paths verified
- answerPoll: all 7 failure paths verified
- answerPollUltraFast: all 6 failure paths verified
- wsPreClickWatcher: all 4 paths verified
- ...

## 📊 AUDIT SUMMARY
- State variables traced: 37
- Timers tracked: 11
- Functions audited: 24
- Exit paths checked: 89
- Race conditions checked: 6 scenarios
- Edge cases checked: 10 scenarios
```

---

**Ye prompt use karo — ek baar me saare bugs mil jayenge!** 🎯