# Input System Fix - Testing Guide

## What Was Fixed

### The Problem

When rapidly tapping during dragging, if you tapped quickly and then held down on the last input, the system would sometimes fail to recognize the hold. The tension would start **decaying** instead of building, even though the pointer/finger was held down.

### Root Cause

**Race condition** in timing-based tap detection:

```javascript
// OLD CODE (broken)
handleDragMouseDown() {
  const timeSinceLastTap = now - this.lastTapTime;

  // If this is within 200ms of last tap, ignore it
  if (timeSinceLastTap < 200) {
    return; // BUG: This blocks valid hold inputs!
  }

  this.lastTapTime = now;
  this.isDragging = true;
}
```

**Scenario:**

1. Tap at 0ms → release at 150ms ✓
2. Tap at 200ms → release at 350ms ✓
3. Tap at 400ms → release at 550ms ✓
4. **Hold at 570ms** → `timeSinceLastTap = 20ms` → **BLOCKED!**

The hold at 570ms is only 20ms after the previous tap release, so it gets rejected.

### The Solution

**Timeout-based hold detection** with separated state:

```javascript
// NEW CODE (fixed)
handleDragMouseDown() {
  // Clear any pending timeout
  if (this.holdDetectionTimeout) {
    clearTimeout(this.holdDetectionTimeout);
  }

  // Mark pointer as physically down
  this.isPointerDown = true;
  this.pointerDownTime = now;

  // Schedule hold detection for 100ms in the future
  this.holdDetectionTimeout = setTimeout(() => {
    if (this.isPointerDown) {
      // Still down after 100ms = this is a hold
      this.isHoldingForDrag = true;
      sessionStore.setState({ isDragging: true });
    }
  }, 100);
}
```

**Key Changes:**

- **Separate physical state** (`isPointerDown`) from **logical state** (`isHoldingForDrag`)
- **No timing windows** that block state transitions
- **Timeout-based detection** (100ms) instead of timing comparisons
- Can transition from tapping to holding **instantly**, regardless of timing

## Manual Testing Procedure

### Test 1: Rapid Tap → Hold Transition (PRIMARY BUG FIX)

**Goal:** Verify the original bug is fixed

1. Start fishing session
2. Cast magnet into any quadrant
3. **Rapidly tap** 3-5 times (fast as you can)
4. On the next press, **hold down** instead of tapping
5. **Expected:** Tension should build continuously while holding
6. **How to verify:**
   - Watch the tension bar - should be filling, not emptying
   - Console should show increasing tension values
   - After ~3-4 seconds of holding, tension should approach 80-100%

**If bug still exists:**

- Tension will decrease while holding (bar empties)
- Console shows decreasing tension values
- This means `isDragging` is not being set to `true`

### Test 2: Pure Tapping

**Goal:** Ensure tapping still works correctly

1. Cast magnet
2. Tap screen repeatedly (quick presses, release before 100ms)
3. **Expected:** Each tap adds +10% tension
4. **How to verify:**
   - Console shows: `[TAP] Tension: 20% → 30% (+10%)`
   - Tension jumps up in 10% increments
   - 10 taps should bring you from 0% to 100%

### Test 3: Pure Holding

**Goal:** Ensure holding still works correctly

1. Cast magnet
2. Press and hold in one spot (don't release)
3. **Expected:** Tension builds smoothly from 0% → 100%
4. **How to verify:**
   - Tension bar fills smoothly
   - Takes ~3-5 seconds depending on item weight
   - No sudden drops or stuttering

### Test 4: Mixed Tap + Hold Strategy

**Goal:** Test realistic gameplay pattern

1. Cast magnet
2. Execute this pattern:
   - Tap, tap, tap (3 quick taps = +30% tension)
   - Hold for 2 seconds (builds more tension)
   - Release briefly (tension decays a bit)
   - Tap, tap (2 more taps)
   - Hold to finish
3. **Expected:** Seamless transitions between tapping and holding
4. **How to verify:**
   - No unexpected tension drops during transitions
   - Each tap clearly adds +10%
   - Each hold period shows smooth building

### Test 5: Keyboard (Spacebar) Hold

**Goal:** Ensure keyboard input works

1. Cast magnet
2. Press and hold **Spacebar**
3. **Expected:** Tension builds (same as pointer hold)
4. Release Spacebar
5. **Expected:** Tension decays
6. **How to verify:**
   - Spacebar behaves identically to pointer hold
   - Console shows tension increasing while space held
   - No tapping with spacebar (keyboard is hold-only)

### Test 6: Debug Keyboard Shortcuts

**Goal:** Verify debug commands migrated correctly

1. Press **D** key
2. **Expected:** Debug overlay toggles on/off
3. **How to verify:**
   - Grid overlay, engaged item markers appear/disappear
   - Console shows: "Debug overlay initialized"

4. With debug overlay visible, press **C** key
5. **Expected:** Confirmation dialog appears
6. Click "OK"
7. **Expected:** All engaged items cleared for current location
8. **How to verify:**
   - Console shows: `[DEBUG] Cleared all engaged items for picturesque-river`
   - Markers disappear from debug overlay

### Test 7: Window Blur (Tab-Away)

**Goal:** Ensure state resets when player leaves window

1. Cast magnet and start holding
2. Tension builds to ~50%
3. **Alt+Tab** to another window (or click another tab)
4. Wait 2-3 seconds
5. Return to game
6. **Expected:** Tension has decayed (isDragging was reset)
7. **How to verify:**
   - Tension should be lower than when you left
   - Game doesn't think you're still holding

### Test 8: Multi-touch Prevention

**Goal:** Ensure only one pointer tracked at a time

1. Cast magnet
2. On touch device, tap with two fingers simultaneously
3. Or on mouse, click while pointer is down (simulated)
4. **Expected:** Only first input is processed
5. **How to verify:**
   - Second tap doesn't add +10% tension
   - Console shows only one `[TAP]` message

### Test 9: Edge Case - Release During Timeout Window

**Goal:** Verify tap detection when released at ~90-110ms

1. Cast magnet
2. Press and hold for approximately 90-100ms (close to threshold)
3. Release
4. **Expected:** Should process as tap (+10% tension)
5. Repeat several times with slight variations in timing
6. **How to verify:**
   - Releases before 100ms = tap
   - Releases after 100ms but before timeout fires (~110ms) = tap
   - Only if held past ~120ms should it become hold

## Console Verification

### What to Look For

**Successful Tap:**

```
[TAP] Tension: 20% → 30% (+10%)
```

**Successful Hold (during drag):**

```
[DRAG] T:45% | Speed:1.23m/s | Dist:12.3/20.0m | MagPos:48.2 [45.2-51.2] | Rusty Bike(35kg)
```

(Tension increasing over time)

**Debug Commands:**

```
Debug overlay initialized. Press 'D' to toggle.
[DEBUG] Cleared all engaged items for picturesque-river
```

### Warning Signs

**Bug NOT Fixed:**

```
[DRAG] T:45% | Speed:1.23m/s ...
[DRAG] T:43% | Speed:1.23m/s ...
[DRAG] T:40% | Speed:1.23m/s ...
```

(Tension decreasing while you think you're holding = isDragging is false)

**Timeout Not Cleared:**

```
[TAP] Tension: 50% → 60% (+10%)
<after releasing>
<100ms later: tension suddenly jumps>
```

(Means timeout fired after release - should not happen)

## Performance Verification

### Check for Memory Leaks

1. Play for 5 minutes, cast 20+ times
2. Open browser DevTools → Performance Monitor
3. **Check:** JS Heap Size should not continuously grow
4. **Check:** Number of event listeners should be stable (~10-15)
5. If memory grows continuously:
   - Timeouts might not be clearing
   - Event listeners not being removed

### Check for Lag

1. Rapid-tap 50+ times in one drag session
2. **Expected:** No input lag, immediate response
3. **Check:** Each tap should feel instant (<16ms)
4. If taps feel delayed:
   - Check browser console for errors
   - Check FPS counter (should be 60fps)

## Regression Testing

Ensure existing features still work:

- [ ] Casting to different quadrants
- [ ] Progressive retrieval (fail at 50% distance, item stays there)
- [ ] Slip meter visualization
- [ ] Success/failure notifications
- [ ] Inventory updates on successful catch
- [ ] Timer countdown
- [ ] Resize window (responsiveness)

## Code Review Checklist

For reviewers examining the implementation:

- [x] Timeout is **cleared** in `handleDragMouseUp()`
- [x] Timeout is **cleared** in `resetInputState()`
- [x] Timeout is **cleared** in `destroy()`
- [x] `isPointerDown` and `isHoldingForDrag` are separate properties
- [x] 100ms threshold is used (not 200ms from old code)
- [x] Keyboard sets `isHoldingForDrag` immediately (no timeout for Space)
- [x] Debug commands (D, C) migrated from PixiApp
- [x] No duplicate event listeners (PixiApp no longer has `handleDebugKeyDown`)
- [x] All state is reset on window blur
- [x] Multi-touch prevention still works (`activePointerId`)

## Success Criteria

✅ **Bug is fixed when:**

1. Can rapidly tap 5 times, then hold on 6th input → tension builds
2. No unexpected tension decay during hold
3. Seamless transitions between tapping and holding
4. Console shows `[TAP]` for taps, smooth tension increase for holds
5. All existing gameplay works as before

❌ **Bug still exists if:**

1. Rapid tapping → hold causes tension to decay
2. Console shows decreasing tension while holding
3. Feels "laggy" or inputs are dropped

## Documenting Results

After testing, update this file with:

**Test Date:** [DATE]  
**Tester:** [NAME]  
**Result:** [PASS/FAIL]  
**Notes:**

- Test 1 (Rapid Tap→Hold): [✓/✗]
- Test 2 (Pure Tapping): [✓/✗]
- Test 3 (Pure Holding): [✓/✗]
- Etc.

**Issues Found:**

- [List any bugs or unexpected behavior]

**Recommendations:**

- [Any suggested improvements or follow-up work]
