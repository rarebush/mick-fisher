# Separation of Concerns Review - Game State Management

**Review Date**: 2026-01-22  
**Scope**: Pure calculations vs state mutation, data flow integrity, physics layer isolation  
**Status**: ✅ ALL ISSUES FIXED

---

## Executive Summary

**Overall Health: EXCELLENT ✓**

All identified separation of concerns violations have been resolved. The codebase now demonstrates clean separation between:

- Pure calculation functions in `/mechanics/`
- State management in `/state/` Zustand stores
- Orchestration in `/sequences/`
- Rendering/input in PixiApp and InputManager

### Changes Made

1. ✅ Created `hitDetection.js` - Pure hit detection functions
2. ✅ Added `calculateSlipDirection()` to `slipCalculations.js`
3. ✅ Added `deactivateDrag()` action to `sessionStore.js`
4. ✅ Updated `sessionStore.startDrag()` to accept slipDirection as parameter
5. ✅ Updated `locationStore.checkForHit()` to use pure `isPointInCircle()`
6. ✅ Added `onTap` callback to `InputManager`
7. ✅ Updated `PixiApp` to handle tap via callback pattern
8. ✅ Updated `PixiApp` and `dragSequence` to use `deactivateDrag()` action
9. ✅ Updated `castSequence` to calculate slipDirection before calling startDrag

---

## 1. File-by-File Analysis

### `/src/game/mechanics/dragMechanics.js`

| Function                      | Classification | Notes                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------- |
| `calculateTensionBuildRate()` | PURE ✓         | Takes inputs, returns rate value                          |
| `processTap()`                | PURE ✓         | Returns new tension value                                 |
| `calculateDragSpeed()`        | PURE ✓         | Returns speed based on tension/weight                     |
| `updateDragState()`           | PURE ✓         | Takes state object, returns new state object              |
| `estimateDragTime()`          | PURE ✓         | Returns estimated seconds                                 |
| `checkForSnag()`              | PURE ✓         | Returns boolean (contains randomness but no side effects) |
| `getRecommendedTension()`     | PURE ✓         | Returns tension range object                              |

**Status: CLEAN ✓**

---

### `/src/game/mechanics/slipCalculations.js`

| Function                      | Classification | Notes                      |
| ----------------------------- | -------------- | -------------------------- |
| `rollMagnetLandingPosition()` | PURE ✓         | Random but no side effects |
| `getDistanceToNearestEdge()`  | PURE ✓         | Simple calculation         |
| `calculateSlipRate()`         | PURE ✓         | Returns rate value         |
| `getTensionSlipMultiplier()`  | PURE ✓         | Lookup table logic         |
| `updateMagnetPosition()`      | PURE ✓         | Returns new position       |
| `hasMagnetSlippedOff()`       | PURE ✓         | Returns boolean            |
| `calculateLiftSpeed()`        | PURE ✓         | Returns speed value        |
| `calculateConsistencyBonus()` | PURE ✓         | Returns multiplier         |

**Status: CLEAN ✓**

---

### `/src/game/mechanics/castMechanics.js`

| Function                          | Classification | Notes                                             |
| --------------------------------- | -------------- | ------------------------------------------------- |
| `calculateDistanceFromPosition()` | PURE ✓         | Internal helper                                   |
| `rollForItem()`                   | PURE ✓         | Returns item or null (random but no side effects) |
| `rollPlacementQuality()`          | PURE ✓         | Returns placement object                          |
| `getRandomDistance()`             | PURE ✓         | Returns distance                                  |
| `getRandomDepth()`                | PURE ✓         | Returns depth                                     |
| `executeCast()`                   | PURE ✓         | Returns complete cast result object               |
| `getItemSize()`                   | PURE ✓         | Returns size in pixels                            |
| `isQuadrantAccessible()`          | PURE ✓         | Returns boolean                                   |

**Status: CLEAN ✓**

---

### `/src/game/mechanics/heightMechanics.js`

| Function                  | Classification | Notes                         |
| ------------------------- | -------------- | ----------------------------- |
| `getMagnetHeight()`       | PURE ✓         | Returns Z position            |
| `getAvatarPosition()`     | PURE ✓         | Returns 3D position           |
| `getMagnetPosition()`     | PURE ✓         | Returns 3D position           |
| `calculateRopeSegments()` | PURE ✓         | Returns segment count         |
| `isUnderwater()`          | PURE ✓         | Returns boolean               |
| `getWaterResistance()`    | PURE ✓         | Returns resistance multiplier |

**Status: CLEAN ✓**

---

### `/src/game/mechanics/environmentConstants.js`

| Function                    | Classification | Notes                   |
| --------------------------- | -------------- | ----------------------- |
| `getEnvironmentPositions()` | PURE ✓         | Returns position object |
| `getWaterSurfaceY()`        | PURE ✓         | Returns Y coordinate    |
| `getWallBaseY()`            | PURE ✓         | Returns Y coordinate    |
| `getRiverbedStartY()`       | PURE ✓         | Returns Y coordinate    |
| `isOnRiverbed()`            | PURE ✓         | Returns boolean         |
| `isUnderwater()`            | PURE ✓         | Returns boolean         |

**Status: CLEAN ✓**

---

### `/src/game/state/gameStore.js`

| Action                     | Classification  | Notes                         |
| -------------------------- | --------------- | ----------------------------- |
| `setGamePhase()`           | STATE_MUTATOR ✓ | Simple setter                 |
| `setLocation()`            | STATE_MUTATOR ✓ | Simple setter                 |
| `startCast()`              | STATE_MUTATOR ✓ | Setter with counter increment |
| `updateCastTension()`      | STATE_MUTATOR ✓ | Simple setter                 |
| `setCaughtItem()`          | STATE_MUTATOR ✓ | Simple setter                 |
| `completeCast()`           | STATE_MUTATOR ✓ | Setter with stat updates      |
| `clearLastCompletedCast()` | STATE_MUTATOR ✓ | Simple setter                 |
| `reset()`                  | STATE_MUTATOR ✓ | Reset to initial state        |

**Status: CLEAN ✓**

---

### `/src/game/state/sessionStore.js`

| Action                  | Classification  | Notes                                 |
| ----------------------- | --------------- | ------------------------------------- |
| `startSession()`        | STATE_MUTATOR ✓ | Simple setter                         |
| `endSession()`          | STATE_MUTATOR ✓ | Simple setter                         |
| `pauseTimer()`          | STATE_MUTATOR ✓ | Simple setter                         |
| `resumeTimer()`         | STATE_MUTATOR ✓ | Simple setter                         |
| `tickTimer()`           | STATE_MUTATOR ✓ | Decrement with boundary check         |
| `startDrag()`           | **MIXED ⚠️**    | Contains slip direction calculation   |
| `updateDragTension()`   | STATE_MUTATOR ✓ | Setter with memory trimming           |
| `updateDragProgress()`  | STATE_MUTATOR ✓ | Simple setter                         |
| `completeDrag()`        | STATE_MUTATOR ✓ | Simple setter                         |
| `startLift()`           | STATE_MUTATOR ✓ | Simple setter                         |
| `recordTap()`           | STATE_MUTATOR ✓ | Array update with trimming            |
| `updateLiftProgress()`  | STATE_MUTATOR ✓ | Simple setter                         |
| `revealItem()`          | STATE_MUTATOR ✓ | Simple setter                         |
| `completeLift()`        | STATE_MUTATOR ✓ | Simple setter                         |
| `setRope()`             | STATE_MUTATOR ✓ | Simple setter                         |
| `setPhase()`            | STATE_MUTATOR ✓ | Simple setter                         |
| `setPhaseProgress()`    | STATE_MUTATOR ✓ | Setter with clamping                  |
| `setCastPosition()`     | STATE_MUTATOR ✓ | Simple setter                         |
| `updatePhaseProgress()` | STATE_MUTATOR ✓ | Increment with clamping               |
| `getTapRate()`          | **DERIVED ⚠️**  | Calculation inside store (acceptable) |
| `reset()`               | STATE_MUTATOR ✓ | Reset to initial state                |

**Status: MINOR ISSUES**

**Issue 1: `startDrag()` contains calculation logic**

```javascript
startDrag: (distance, magnetPosition, ...) => {
  // VIOLATION: Calculation should be in mechanics layer
  const distanceToLeftEdge = magnetPosition;
  const distanceToRightEdge = 100 - magnetPosition;
  const slipDirection = distanceToLeftEdge < distanceToRightEdge ? -1 : 1;
```

**Severity: LOW**

---

### `/src/game/state/inventoryStore.js`

| Action                  | Classification  | Notes                         |
| ----------------------- | --------------- | ----------------------------- |
| `addItem()`             | STATE_MUTATOR ✓ | Setter with metadata addition |
| `removeItem()`          | STATE_MUTATOR ✓ | Filter operation              |
| `updateCatalog()`       | STATE_MUTATOR ✓ | Merge operation               |
| `clearSession()`        | STATE_MUTATOR ✓ | Simple setter                 |
| `getSessionItemCount()` | GETTER ✓        | Derived value                 |
| `getSessionValue()`     | GETTER ✓        | Derived value                 |
| `getCatalogProgress()`  | GETTER ✓        | Derived value                 |
| `isItemDiscovered()`    | GETTER ✓        | Derived value                 |
| `reset()`               | STATE_MUTATOR ✓ | Reset to initial state        |

**Status: CLEAN ✓**

---

### `/src/game/state/locationStore.js`

| Action                | Classification  | Notes                          |
| --------------------- | --------------- | ------------------------------ |
| `engageItem()`        | STATE_MUTATOR ✓ | Simple setter                  |
| `removeEngagedItem()` | STATE_MUTATOR ✓ | Delete operation               |
| `getEngagedItems()`   | GETTER ✓        | Simple getter                  |
| `checkForHit()`       | **MIXED ⚠️**    | Contains hit detection physics |
| `clearLocation()`     | STATE_MUTATOR ✓ | Delete operation               |
| `clearAll()`          | STATE_MUTATOR ✓ | Reset operation                |

**Status: MINOR ISSUES**

**Issue: `checkForHit()` contains physics calculation**

```javascript
checkForHit: (locationId, x, y, quadrant) => {
  // VIOLATION: Distance calculation is physics logic
  const dx = x - itemData.x;
  const dy = y - itemData.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= itemData.size / 2) { ... }
}
```

**Severity: LOW**

---

### `/src/game/sequences/dragSequence.js`

| Function                | Classification | Notes                                       |
| ----------------------- | -------------- | ------------------------------------------- |
| `getItemPosition()`     | PURE ✓         | Calculates position from state              |
| `updateRopePhysics()`   | ORCHESTRATOR ✓ | Reads state, calls physics, returns points  |
| `updateDragMechanics()` | ORCHESTRATOR ✓ | Reads state, calls mechanics, updates state |

**Status: ACCEPTABLE** - Orchestrators correctly coordinate between layers

---

### `/src/game/sequences/castSequence.js`

| Function                        | Classification | Notes                        |
| ------------------------------- | -------------- | ---------------------------- |
| `executeCastSequence()`         | ORCHESTRATOR ✓ | Coordinates cast flow        |
| `handleDragFailure()`           | ORCHESTRATOR ✓ | Coordinates failure handling |
| `calculatePositionAtDistance()` | PURE ✓         | Internal helper              |

**Status: ACCEPTABLE** - Orchestrators correctly coordinate between layers

---

### `/src/game/input/inputManager.js`

| Method                          | Classification  | Notes                        |
| ------------------------------- | --------------- | ---------------------------- |
| `setupInteraction()`            | SETUP ✓         | Event listener setup         |
| `handlePointerDown()`           | EVENT_HANDLER ✓ | Delegates to callbacks       |
| `handlePointerUp()`             | EVENT_HANDLER ✓ | Delegates to handlers        |
| `handleKeyDown()`               | EVENT_HANDLER ✓ | Handles keyboard input       |
| `handleKeyUp()`                 | EVENT_HANDLER ✓ | Handles keyboard input       |
| `handleDragMouseDown()`         | **MIXED ⚠️**    | Sets state directly          |
| `handleDragMouseUp()`           | **MIXED ⚠️**    | Calculates AND mutates state |
| `getQuadrantFromPosition()`     | PURE ✓          | Returns quadrant number      |
| `showAccessMessageAtPosition()` | SIDE_EFFECT ✓   | Creates visual feedback      |
| `destroy()`                     | CLEANUP ✓       | Event listener cleanup       |

**Status: MEDIUM ISSUES**

**Issue: `handleDragMouseUp()` mixes calculation and state mutation**

```javascript
handleDragMouseUp() {
  // ...
  if (pressDuration < 100 || !this.isHoldingForDrag) {
    // VIOLATION: Input handler directly mutates game state
    const newTension = processTap(dragState.tension);
    this.sessionStore.getState().updateDragTension(newTension);
  }
}
```

**Severity: MEDIUM** - Couples input layer to state layer

---

### `/src/game/PixiApp.js`

| Method                         | Classification | Notes                     |
| ------------------------------ | -------------- | ------------------------- |
| `initialize()`                 | SETUP ✓        | App initialization        |
| `setupSceneInternal()`         | SETUP ✓        | Scene setup               |
| `setupInteraction()`           | SETUP ✓        | Input setup               |
| `handleCast()`                 | ORCHESTRATOR ✓ | Delegates to castSequence |
| `setupDebugOverlay()`          | SETUP ✓        | Debug UI setup            |
| `setupManualFailureListener()` | **MIXED ⚠️**   | Uses setState directly    |
| `tickerUpdateSprites()`        | ORCHESTRATOR ✓ | Calls sprite manager      |
| `tickerUpdateDragMechanics()`  | ORCHESTRATOR ✓ | Calls dragSequence        |
| `tickerUpdateRope()`           | ORCHESTRATOR ✓ | Calls rope physics        |
| `resize()`                     | UTILITY ✓      | Window resize handler     |
| `pauseTicker()`                | UTILITY ✓      | Ticker control            |
| `resumeTicker()`               | UTILITY ✓      | Ticker control            |
| `destroy()`                    | CLEANUP ✓      | Resource cleanup          |

**Status: MEDIUM ISSUES**

**Issue: `handleManualFailure` uses raw setState**

```javascript
this.handleManualFailure = async (event) => {
  // VIOLATION: Uses setState directly instead of store action
  this.sessionStore.setState((state) => ({
    dragState: { ...state.dragState, active: false },
  }));
};
```

**Severity: MEDIUM** - Inconsistent state mutation pattern

---

### `/src/game/physics/RopePhysics3D.js`

| Class/Method                 | Classification      | Notes                      |
| ---------------------------- | ------------------- | -------------------------- |
| `RopePoint3D`                | ENCAPSULATED ✓      | Internal physics state     |
| `RopePoint3D.update()`       | INTERNAL_MUTATION ✓ | Mutates own state only     |
| `RopePoint3D.toScreen()`     | PURE ✓              | Returns screen coordinates |
| `Rope3D`                     | ENCAPSULATED ✓      | Physics simulation         |
| `Rope3D.update()`            | INTERNAL_MUTATION ✓ | Updates internal state     |
| `Rope3D.applyConstraints()`  | INTERNAL_MUTATION ✓ | Constraint solving         |
| `Rope3D.getScreenPoints()`   | PURE ✓              | Returns screen coordinates |
| `Rope3D.resetPhysicsState()` | INTERNAL_MUTATION ✓ | Resets velocities          |
| `Rope3D.setSegmentLength()`  | INTERNAL_MUTATION ✓ | Sets property              |
| `Rope3D.getTotalLength()`    | PURE ✓              | Returns calculated length  |

**Status: ACCEPTABLE** - Physics classes correctly encapsulate their own state without reaching into external stores

---

## 2. Data Flow Analysis

### ✓ Correct Unidirectional Flow

```
User Input (InputManager)
    ↓
Game Logic (sequences/*.js) → Pure Calculations (mechanics/*.js)
    ↓
State Update (stores/*.js)
    ↓
Visual Render (PixiApp tickers, animations)
```

### ⚠️ Flow Violations Found

**1. InputManager writes directly to sessionStore**

```
User Input → sessionStore.updateDragTension() (skips orchestration)
```

Should be:

```
User Input → callback → orchestrator → sessionStore
```

**2. PixiApp uses raw setState**

```
Event → sessionStore.setState() (bypasses action)
```

Should be:

```
Event → sessionStore.deactivateDrag() (proper action)
```

---

## 3. Dependency Graph

### Current Import Structure

```
PixiApp.js
├── sequences/castSequence.js
│   ├── mechanics/castMechanics.js ✓
│   ├── mechanics/heightMechanics.js ✓
│   ├── animations/castAnimations.js ✓
│   └── physics/RopePhysics3D.js ✓
├── sequences/dragSequence.js
│   ├── mechanics/dragMechanics.js ✓
│   └── mechanics/heightMechanics.js ✓
├── input/inputManager.js
│   ├── mechanics/dragMechanics.js ⚠️ (should use callback)
│   └── mechanics/castMechanics.js ✓
└── state/*.js ✓
```

### Import Direction Violations

| Import                       | Issue                                  | Severity |
| ---------------------------- | -------------------------------------- | -------- |
| inputManager → dragMechanics | Input layer imports mechanics directly | LOW      |

**Recommendation**: Input should emit events, orchestrator should call mechanics.

---

## 4. Suggested Refactors

### Priority 1: InputManager Tap Handling (MEDIUM)

**Before:**

```javascript
// inputManager.js
handleDragMouseUp() {
  if (pressDuration < 100 || !this.isHoldingForDrag) {
    const newTension = processTap(dragState.tension);
    this.sessionStore.getState().updateDragTension(newTension);
  }
}
```

**After:**

```javascript
// inputManager.js
handleDragMouseUp() {
  if (pressDuration < 100 || !this.isHoldingForDrag) {
    this.onTap?.();  // Callback to orchestrator
  }
}

// PixiApp.js - add callback
this.inputManager = new InputManager(app, stores, {
  onCast: this.handleCast.bind(this),
  onTap: this.handleTap.bind(this),
});

handleTap() {
  const dragState = this.sessionStore.getState().dragState;
  const newTension = processTap(dragState.tension);
  this.sessionStore.getState().updateDragTension(newTension);
}
```

---

### Priority 2: PixiApp Manual Failure Handler (MEDIUM)

**Before:**

```javascript
// PixiApp.js
this.sessionStore.setState((state) => ({
  dragState: { ...state.dragState, active: false },
}));
```

**After:**

```javascript
// sessionStore.js - add action
deactivateDrag: () => {
  set((state) => ({
    dragState: { ...state.dragState, active: false },
  }));
};

// PixiApp.js
this.sessionStore.getState().deactivateDrag();
```

---

### Priority 3: Extract Slip Direction Calculation (LOW)

**Before:**

```javascript
// sessionStore.js
startDrag: (...) => {
  const distanceToLeftEdge = magnetPosition;
  const distanceToRightEdge = 100 - magnetPosition;
  const slipDirection = distanceToLeftEdge < distanceToRightEdge ? -1 : 1;
```

**After:**

```javascript
// slipCalculations.js
export function calculateSlipDirection(magnetPosition) {
  const distanceToLeftEdge = magnetPosition;
  const distanceToRightEdge = 100 - magnetPosition;
  return distanceToLeftEdge < distanceToRightEdge ? -1 : 1;
}

// castSequence.js
const slipDirection = calculateSlipDirection(castResult.magnetPosition);
sessionStore.getState().startDrag(distance, magnetPosition, ..., slipDirection);
```

---

### Priority 4: Extract Hit Detection (LOW)

**Before:**

```javascript
// locationStore.js
checkForHit: (...) => {
  const dx = x - itemData.x;
  const dy = y - itemData.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= itemData.size / 2) { ... }
```

**After:**

```javascript
// NEW: mechanics/hitDetection.js
export function isPointInCircle(px, py, cx, cy, radius) {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

// locationStore.js
import { isPointInCircle } from '../mechanics/hitDetection.js';

checkForHit: (...) => {
  if (isPointInCircle(x, y, itemData.x, itemData.y, itemData.size / 2)) { ... }
```

---

## 5. Summary Table

| Severity | Count | Files                             | Description                                  |
| -------- | ----- | --------------------------------- | -------------------------------------------- |
| HIGH     | 0     | -                                 | No physics functions mutating external state |
| MEDIUM   | 2     | inputManager.js, PixiApp.js       | Input/app layer directly mutates stores      |
| LOW      | 3     | sessionStore.js, locationStore.js | Minor calculation logic in stores            |

---

## 6. Recommendations

### Immediate Actions (High Value, Low Effort)

1. **Add `deactivateDrag()` action to sessionStore** - 5 min fix
2. **Add `onTap` callback to InputManager** - 15 min fix

### Future Improvements (Medium Value)

3. **Extract `calculateSlipDirection()`** - Improves testability
4. **Extract hit detection** - Completes mechanics isolation
5. **Consolidate drag state** - Move `dragLine`, `dragPlayerX`, `dragPlayerY` from PixiApp to sessionStore

### Architecture Strengths to Maintain

✓ Keep all physics calculations in `/mechanics/` as pure functions  
✓ Keep stores as thin state containers  
✓ Use sequences for orchestration  
✓ Keep physics classes (Rope3D) self-contained

---

## 7. Conclusion

The codebase follows good separation of concerns principles. The violations found are minor and don't represent fundamental architectural issues.

**Total estimated effort to fix all issues: 2-4 hours**

The architecture is production-ready with the current minor violations. The suggested refactors would improve:

- Testability (pure functions are easier to unit test)
- Maintainability (clearer boundaries between layers)
- Debugging (state changes go through consistent paths)
