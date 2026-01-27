# Technical Architecture - Input System

## Overview

The input system is centrally managed through the `InputManager` class, providing a unified interface for all game inputs (pointer, touch, keyboard) across different game phases (idle, casting, dragging, lift).

**Key Design Principles:**

- **Single Source of Truth**: All input handling flows through InputManager
- **Clear State Separation**: Physical input state vs logical game state
- **Robust Tap/Hold Detection**: Timeout-based system prevents race conditions
- **Multi-touch Prevention**: Track active pointer to ignore simultaneous inputs
- **Graceful Degradation**: Window blur and pointer cancel events handled

## Input State Management

### State Properties

```javascript
// Physical input state
this.isPointerDown = false; // True when pointer/key physically held
this.pointerDownTime = 0; // Timestamp when input started
this.activePointerId = null; // Which pointer is active (multi-touch prevention)

// Logical game state
this.isHoldingForDrag = false; // True when input qualifies as "hold for drag"
this.lastTapReleaseTime = 0; // For tap history/debugging
this.holdDetectionTimeout = null; // Pending timeout for hold detection
this.isCasting = false; // Prevent duplicate casts
```

### Why Separate Physical from Logical State?

**Problem Solved:**
Previously, rapid tapping followed by a hold would fail to register the hold because timing checks interfered with state transitions. The system would think "this input is too close to the last tap, ignore it."

**Solution:**

- `isPointerDown`: Tracks the actual hardware state (finger/mouse is down)
- `isHoldingForDrag`: Tracks whether this input counts as "holding for drag" in game logic
- These can be different! Pointer can be down without being a "hold" during the 100ms detection window

## Tap vs Hold Detection

### Timeout-Based Detection (100ms threshold)

```javascript
handleDragMouseDown() {
  const now = performance.now();

  // Clear any pending detection from previous input
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

### Release Detection

```javascript
handleDragMouseUp() {
  const now = performance.now();
  const pressDuration = now - this.pointerDownTime;

  // Clear the pending timeout (might not have fired yet)
  if (this.holdDetectionTimeout) {
    clearTimeout(this.holdDetectionTimeout);
  }

  this.isPointerDown = false;

  // Was this a tap? (released before 100ms OR never became a hold)
  if (pressDuration < 100 || !this.isHoldingForDrag) {
    // Process as tap: +10% tension boost
    processTap();
  }

  // Always clear hold state on release
  this.isHoldingForDrag = false;
  sessionStore.setState({ isDragging: false });
}
```

### Why 100ms Threshold?

- **Responsive Feel**: 100ms is imperceptible to players (6 frames at 60fps)
- **Reliable Distinction**: Taps are typically 50-80ms, holds are 200ms+
- **Prevents Race Conditions**: No timing windows that block state transitions
- **Seamless Tap→Hold**: Can tap 3 times then immediately hold without issues

**Old System (200ms timing window):**

```
Tap 1: Down 0ms → Up 150ms ✓ (tap registered)
Tap 2: Down 180ms → Up 330ms ✓ (tap registered)
Tap 3: Down 350ms → Up 500ms ✓ (tap registered)
Hold: Down 520ms → [BLOCKED! timeSinceLastTap = 20ms < 200ms]
```

**New System (100ms timeout):**

```
Tap 1: Down 0ms → Up 150ms ✓ (tap: released before timeout)
Tap 2: Down 180ms → Up 330ms ✓ (tap: released before timeout)
Tap 3: Down 350ms → Up 500ms ✓ (tap: released before timeout)
Hold: Down 520ms → [timeout fires at 620ms] ✓ (hold registered)
```

## Input Channels

### 1. Pointer Events (Touch/Mouse)

**Setup:**

```javascript
this.app.stage.eventMode = "static";
this.app.stage.hitArea = this.app.screen;

this.app.stage.on("pointerdown", this.handlePointerDown);
this.app.stage.on("pointerup", this.handlePointerUp);
this.app.stage.on("pointerupoutside", this.handlePointerUpOutside);
this.app.stage.on("pointercancel", this.handlePointerCancel);
```

**Flow:**

1. `pointerdown` → Check game phase → Route to casting or dragging
2. `pointerup` → Check if tap or hold ended → Process accordingly
3. `pointerupoutside` → Treated same as `pointerup` (drag continues even if pointer leaves canvas)
4. `pointercancel` → Force reset all input state (browser interrupted)

**Multi-touch Prevention:**

```javascript
handlePointerDown(event) {
  // Ignore if we're already tracking a different pointer
  if (this.activePointerId !== null &&
      this.activePointerId !== event.pointerId) {
    return;
  }

  this.activePointerId = event.pointerId;
  // ... handle input
}
```

### 2. Keyboard Events

**Setup:**

```javascript
window.addEventListener("keydown", this.handleKeyDown);
window.addEventListener("keyup", this.handleKeyUp);
window.addEventListener("blur", this.handleWindowBlur);
```

**Keyboard Mapping:**

| Key     | Phase               | Action                                         |
| ------- | ------------------- | ---------------------------------------------- |
| `Space` | Dragging            | Hold to drag (no tap detection - instant hold) |
| `D`     | Any                 | Toggle debug overlay                           |
| `C`     | Any (debug visible) | Clear engaged items                            |
| `M`     | Idle                | Cycle cast input mode                          |

**Why No Tap Detection for Keyboard?**

Spacebar is only used for holding during drag, never for tapping. Tapping for tension boost is pointer-only (allows rapid tapping with thumbs on mobile).

```javascript
handleKeyDown(event) {
  if (event.code === "Space") {
    if (!this.isPointerDown) {
      // Keyboard = immediate hold (no 100ms timeout)
      this.isPointerDown = true;
      this.isHoldingForDrag = true;
      sessionStore.setState({ isDragging: true });
    }
  }
}
```

### 3. Window Blur Event

**Purpose:** Reset all input state when player switches tabs/windows

```javascript
handleWindowBlur() {
  // Clear timeout
  if (this.holdDetectionTimeout) {
    clearTimeout(this.holdDetectionTimeout);
  }

  // Reset state
  this.isPointerDown = false;
  this.isHoldingForDrag = false;
  this.activePointerId = null;
  sessionStore.setState({ isDragging: false });
}
```

**Why This Matters:**

- Prevents "stuck drag" if player alt-tabs while holding
- Prevents tension from building when game isn't focused
- Clears pointer tracking (player might click elsewhere and come back)

## Game Phase Input Routing

### Idle Phase

**Allowed Inputs:**

- Pointer down on quadrant → Start cast sequence (Click Mode)
- Pointer down → Begin multi-click sequence (Direction + Power, Donut)
- Debug shortcuts (D, C)

**Blocked Inputs:**

- Pointer down during cast animation
- Pointer down while notification showing
- Pointer down on shore area (y < 80)
- Pointer down on inaccessible quadrant

```javascript
handlePointerDown(event) {
  const gamePhase = gameStore.getState().gamePhase;

  if (gamePhase === "idle") {
    if (gameStore.getState().lastCompletedCast) return;
    if (this.isCasting) return;

    const castMode = sessionStore.getState().castInputMode;
    if (castMode === "direction_power") return handleCastAimClick();
    if (castMode === "donut") return handleDonutAimClick(x, y);

    const quadrant = getCastQuadrantIfAccessible(x, y);
    if (!quadrant) return;

    this.isCasting = true;
    this.onCast(x, y, quadrant);
  }
}
```

## Cast Input Mode Handling

**Mode Cycling:**  
`M` cycles `click → direction_power → donut → click`

**Direction + Power Mode:**  
Click sequence: start angle oscillation → lock angle / start power → lock power and cast.

**Donut Mode:**  
Click 1 sets target on water surface and shows min/max rings.  
Click 2 starts oscillating accuracy radius.  
Click 3 locks radius, randomizes final landing point within the donut, and casts.

### Dragging Phase

**Allowed Inputs:**

- Pointer down → Start tap/hold detection
- Pointer up → Process tap or end hold
- Space down → Start hold (keyboard)
- Space up → End hold (keyboard)
- Debug shortcuts (D, C)

**State Sync:**

```javascript
// Input state → Session state
sessionStore.isDragging = inputManager.isHoldingForDrag;

// Drag mechanics reads from session state
function updateDragState() {
  const isDragging = sessionStore.getState().isDragging;

  if (isDragging) {
    tension += buildRate * deltaTime; // Holding = tension builds
  } else {
    tension -= decayRate * deltaTime; // Not holding = tension decays
  }
}
```

## Performance Characteristics

### Timeout vs Polling

**Old Approach (Timing Windows):**

```javascript
// Check timing on every event
const timeSinceLastTap = now - lastTapTime;
if (timeSinceLastTap < 200) {
  return; // Block input based on timing
}
```

- No timer overhead ✓
- Race conditions with rapid input ✗
- Can block valid transitions ✗

**New Approach (Timeout-Based):**

```javascript
// Schedule future check
this.holdDetectionTimeout = setTimeout(() => {
  if (this.isPointerDown) {
    this.isHoldingForDrag = true;
  }
}, 100);
```

- One setTimeout per input (~0.001ms overhead) ✓
- No race conditions ✓
- Seamless rapid input → hold ✓
- Must clear timeout on release/blur ✓

**Performance Impact:** Negligible

- Timeouts only created during dragging phase
- Typical session: 10-20 taps/holds per drag = 10-20 timeouts
- Each timeout: <1μs to create, auto-garbage collected
- Alternative (polling every frame at 60fps) would be far more expensive

### Memory Safety

**Cleanup on Phase Transitions:**

```javascript
// Game phase changes from dragging → idle
gameStore.setState({ gamePhase: "idle" });

// Input manager resets state
resetInputState() {
  if (this.holdDetectionTimeout) {
    clearTimeout(this.holdDetectionTimeout); // Prevent memory leak
  }
  this.isPointerDown = false;
  this.isHoldingForDrag = false;
}
```

**Cleanup on Destroy:**

```javascript
destroy() {
  // Clear timeout
  if (this.holdDetectionTimeout) {
    clearTimeout(this.holdDetectionTimeout);
  }

  // Remove all event listeners
  this.app.stage.off("pointerdown", ...);
  window.removeEventListener("keydown", ...);

  // Clear references
  this.app = null;
  this.gameStore = null;
  // ...
}
```

## Edge Cases Handled

### 1. Rapid Tap → Hold Transition

**Before Fix:**

```
Tap, tap, tap, [hold] → Hold ignored (timing window blocks it)
```

**After Fix:**

```
Tap (0ms-80ms), tap (200ms-280ms), tap (400ms-480ms),
hold (600ms-) → Hold detected at 700ms ✓
```

### 2. Window Blur During Hold

**Scenario:** Player is holding, alt-tabs away

**Handling:**

```javascript
window.blur event → resetInputState()
→ isHoldingForDrag = false
→ isDragging = false in store
→ Tension starts decaying
```

**Result:** Fair - player loses progress if they leave, but doesn't break game state

### 3. Pointer Cancel (Browser Interruption)

**Scenario:** Browser takes over pointer (e.g., long-press context menu on mobile)

**Handling:**

```javascript
pointercancel event → resetInputState()
→ Clear all pending timeouts
→ Reset pointer tracking
```

**Result:** Game doesn't get stuck in "holding" state

### 4. Multi-touch Attempt

**Scenario:** Player tries to use two fingers simultaneously

**Handling:**

```javascript
// First finger down
activePointerId = event.pointerId (e.g., 123)

// Second finger down
if (activePointerId !== null && activePointerId !== event.pointerId) {
  return; // Ignore second finger
}
```

**Result:** Only one input at a time (prevents confusion/exploits)

### 5. Timeout Fires After Release

**Scenario:** Player taps (80ms), releases, but timeout scheduled for 100ms fires later

**Handling:**

```javascript
// On release (80ms)
clearTimeout(this.holdDetectionTimeout); // Cancel the pending timeout

// Timeout never fires ✓
```

**Result:** No false "hold" detection after tap

## Future Considerations

### Mobile Gestures

Currently not implemented, but architecture supports:

- Swipe to cast direction
- Pinch to zoom
- Long-press for context actions

**Implementation Path:**
Add gesture handlers to InputManager that translate to existing input model:

```javascript
handleSwipe(direction) {
  // Convert swipe → quadrant selection
  const quadrant = swipeDirectionToQuadrant(direction);
  this.onCast(x, y, quadrant);
}
```

### Accessibility

- Keyboard-only play supported (Space for drag)
- Could add: Arrow keys for quadrant selection, Enter for cast
- Screen reader support (announce tension levels, item reveals)

**Implementation Path:**

```javascript
handleKeyDown(event) {
  if (gamePhase === "idle") {
    if (event.key === "ArrowUp") highlightQuadrant(selectedQuadrant - 3);
    if (event.key === "Enter") castToQuadrant(selectedQuadrant);
  }
}
```

### Gamepad Support

Architecture supports adding gamepad via similar pattern:

```javascript
setupGamepadInput() {
  window.addEventListener("gamepadconnected", ...);
  // Map buttons to existing input model
  // A button → tap
  // Hold A → hold for drag
}
```

## Testing Input System

### Manual Test Cases

**Test 1: Rapid Tapping**

1. Cast magnet
2. Tap screen 5+ times rapidly (150ms between taps)
3. Expected: Each tap adds +10% tension
4. Verify: Console shows "[TAP] Tension: X% → Y% (+10%)"

**Test 2: Tap → Hold Transition**

1. Cast magnet
2. Tap 3 times quickly
3. On 4th press, hold down
4. Expected: Tension should build continuously (not decay)
5. Verify: Tension increases from ~30% → 100% over ~3-4 seconds

**Test 3: Window Blur**

1. Cast magnet, start holding
2. Alt+Tab to another window
3. Expected: isDragging becomes false, tension decays
4. Verify: Return to game, tension should have dropped

**Test 4: Multi-touch Prevention**

1. Cast magnet
2. Try to tap with two fingers simultaneously
3. Expected: Only first finger registers
4. Verify: Second tap ignored (no double tension boost)

**Test 5: Keyboard Hold**

1. Cast magnet
2. Press and hold Space
3. Expected: Tension builds same as pointer hold
4. Release Space → tension decays
5. Verify: Space key causes same behavior as pointer

### Automated Test Scenarios

```javascript
describe("InputManager", () => {
  it("should detect tap when released before 100ms", () => {
    inputManager.handleDragMouseDown();
    setTimeout(() => {
      inputManager.handleDragMouseUp();
      expect(sessionStore.getState().dragState.tension).toBe(10); // +10% tap
    }, 80);
  });

  it("should detect hold when held past 100ms", () => {
    inputManager.handleDragMouseDown();
    setTimeout(() => {
      expect(sessionStore.getState().isDragging).toBe(true);
    }, 150);
  });

  it("should handle rapid tap → hold transition", () => {
    // Tap 1
    inputManager.handleDragMouseDown();
    setTimeout(() => inputManager.handleDragMouseUp(), 80);

    // Tap 2
    setTimeout(() => inputManager.handleDragMouseDown(), 200);
    setTimeout(() => inputManager.handleDragMouseUp(), 280);

    // Hold
    setTimeout(() => {
      inputManager.handleDragMouseDown();
      setTimeout(() => {
        expect(sessionStore.getState().isDragging).toBe(true);
      }, 150);
    }, 400);
  });
});
```

## Related Documentation

- [Game Mechanics - Horizontal Drag Phase](Game%20Mechanics%20-%20Horizontal%20Drag%20Phase.md) - Tension mechanics
- [Technical Architecture](Technical%20Architecture.md) - Overall system design
- `src/game/input/inputManager.js` - Implementation
- `src/game/sequences/dragSequence.js` - How drag mechanics consume input state
