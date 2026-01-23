# Architecture Review - Code Organization Analysis

## Summary

Reviewed current codebase structure against Technical Architecture documentation to identify misplaced functionality and architectural inconsistencies.

---

## Current Structure vs Documented Structure

### ✅ What We Have (Extra Folders)

- `/sequences/` - Orchestration logic (not in original design doc)
- `/animations/` - Visual animations (not in original design doc)
- `/physics/` - Physics simulations (not in original design doc)
- `/rendering/` - Scene rendering (not in original design doc)
- `/graphics/` - Graphics utilities (not in original design doc)
- `/input/` - Input management (not in original design doc)

### 📋 What We're Missing (From Design Doc)

- `/utils/` - Constants, helpers, responsive utilities
- `/hooks/` - React hooks for game loop, audio, timers, input
- `/audio/` - Audio management

**Assessment**: The extra folders (`sequences`, `animations`, `physics`, etc.) are **good architectural additions** that provide better separation of concerns than the original design doc suggested. This is an evolution, not a problem.

---

## Issues Found

### 🔴 **CRITICAL: Misplaced Functions**

#### 1. `calculateLiftSpeed()` in slipCalculations.js

**Location**: [slipCalculations.js](src/game/mechanics/slipCalculations.js#L110)  
**Should be in**: `liftMechanics.js` (doesn't exist yet)

**Reason**:

- Calculates vertical lift speed based on tap rate
- Has nothing to do with slip mechanics (magnet sliding on surface)
- Design doc: "liftMechanics.js - Tap rhythm, slip accumulation"

**Impact**: Medium - Will be needed when lift phase is implemented

---

#### 2. `getItemPosition()` in dragSequence.js

**Location**: [dragSequence.js](src/game/sequences/dragSequence.js#L15)  
**Should be in**: `dragMechanics.js` or a new `/utils/positionCalculations.js`

**Reason**:

- Pure calculation: converts distance progress to screen coordinates
- Not orchestration logic (which is what sequences are for)
- Reusable utility that might be needed elsewhere

**Impact**: Low - Works fine where it is, but violates SRP

---

#### 3. `getItemSize()` in castMechanics.js

**Location**: [castMechanics.js](src/game/mechanics/castMechanics.js#L237)  
**Should be in**: `itemDatabase.js` as item property OR `/utils/itemHelpers.js`

**Reason**:

- Visual/display concern, not casting logic
- Used for rendering item sprites, not for spawn mechanics
- Should be co-located with item data or visual utilities

**Impact**: Low - Currently only used during cast, but will be needed for rendering during drag/lift

---

#### 4. `calculateDistanceFromPosition()` in castMechanics.js (PRIVATE)

**Location**: [castMechanics.js](src/game/mechanics/castMechanics.js#L24) (not exported)  
**Status**: ⚠️ WATCH - Currently private, used for re-engaged items

**Reason**:

- Position-to-distance conversion
- Inverse of `getItemPosition()`
- Might belong in shared utilities if both functions are extracted

**Impact**: None currently (private function)

---

### 🟡 **MODERATE: Architectural Observations**

#### 5. `calculateConsistencyBonus()` in slipCalculations.js

**Location**: [slipCalculations.js](src/game/mechanics/slipCalculations.js#L130)  
**Current status**: Correct location (calculates slip rate modifier)

**Observation**: This function is actually slip-related (reduces slip based on tension consistency), so it's in the right file. However, it's **not currently used anywhere** in the codebase.

**Recommendation**: Either implement the feature or move to a "future features" file to reduce clutter.

---

#### 6. Sequence vs Mechanics Boundary

**Current Design**:

- `/mechanics/` - Pure calculation functions (stateless)
- `/sequences/` - Orchestration that calls mechanics + animations + state updates

**Example**:

- `castMechanics.executeCast()` - Performs RNG rolls, returns result
- `castSequence.executeCastSequence()` - Calls animations, mechanics, updates stores

**Assessment**: ✅ This is a **good separation** - sequences tie everything together, mechanics are testable in isolation.

---

### 🟢 **GOOD: Things That Are Correct**

#### 7. `updateDragMechanics()` in dragSequence.js

**Why it's correct**: This is orchestration (calls mechanics + updates state + handles completion), not pure calculation. Sequences are the right place.

#### 8. Slip functions in slipCalculations.js

All slip-related functions are correctly placed:

- `rollMagnetLandingPosition()`
- `getDistanceToNearestEdge()`
- `calculateSlipRate()`
- `getTensionSlipMultiplier()`
- `updateMagnetPosition()`
- `hasMagnetSlippedOff()`

#### 9. Drag functions in dragMechanics.js

Correctly placed after recent refactor:

- `calculateTensionBuildRate()` - Tension mechanics
- `processTap()` - Input mechanics
- `calculateDragSpeed()` - Distance progression (moved from slipCalculations ✅)
- `updateDragState()` - Drag state machine
- `estimateDragTime()` - Drag timing
- `checkForSnag()` - Drag events
- `getRecommendedTension()` - Drag strategy

---

## Recommendations

### Immediate Actions

1. **Create `liftMechanics.js`** (when lift phase is implemented):
   - Move `calculateLiftSpeed()` from slipCalculations.js
   - Add tap rhythm logic
   - Add lift slip accumulation

2. **Create `/utils/positionCalculations.js`** or `/utils/helpers.js`:
   - Move `getItemPosition()` from dragSequence.js
   - Move `calculateDistanceFromPosition()` from castMechanics.js (make it exported)
   - These functions are inverses and should live together

3. **Move `getItemSize()` to better location**:
   - Option A: Add as computed property in itemDatabase.js
   - Option B: Create `/utils/itemHelpers.js`
   - Preferred: Option A (keep item data together)

4. **Review `calculateConsistencyBonus()`**:
   - Is this feature being implemented?
   - If not, move to a "future features" comment or separate file
   - If yes, ensure it's actually called somewhere

---

### Future Considerations

5. **Create missing architectural pieces from design doc**:
   - `/audio/` folder when audio is implemented
   - `/utils/constants.js` for magic numbers currently hardcoded
   - `/utils/helpers.js` for shared utilities

6. **Document the evolved architecture**:
   - Update Technical Architecture.md to reflect `/sequences/`, `/animations/`, `/physics/` folders
   - These are good additions that improve on the original design

---

## File Responsibility Summary

### `/mechanics/` - Pure Calculations (Stateless)

- `castMechanics.js` - Spawn RNG, placement quality
- `dragMechanics.js` - Tension, speed, drag state updates
- `slipCalculations.js` - Slip rates, magnet position
- `liftMechanics.js` - **TO CREATE** - Lift speed, tap mechanics
- `worldConstants.js` - Single source of truth for world space dimensions and projection

### `/sequences/` - Orchestration (Stateful)

- `castSequence.js` - Ties cast animations + mechanics + state
- `dragSequence.js` - Ties drag animations + mechanics + state + ticker

### `/animations/` - Visual Effects

- `castAnimations.js` - Rope throw, bubbles, ripples
- `messageAnimations.js` - UI messages

### `/physics/` - Simulation

- `RopePhysics3D.js` - 3D rope physics using Verlet integration

### `/rendering/` - Scene Management

- `sceneSetup.js` - PixiJS stage setup
- `spriteManager.js` - Sprite lifecycle

### `/graphics/` - Graphics Utilities

- `debugOverlay.js` - Debug visualization
- `placeholderSprites.js` - Temporary sprite generation
- `spriteLoader.js` - Asset loading

### `/input/` - Input Handling

- `inputManager.js` - Unified input system

---

## Conclusion

**Overall Architecture Health: 🟢 GOOD**

The codebase has evolved beyond the original design doc in positive ways. The main issues are:

1. ✅ **FIXED**: `calculateDragSpeed()` moved to dragMechanics.js
2. ⚠️ **TODO**: `calculateLiftSpeed()` should move when liftMechanics.js is created
3. ⚠️ **TODO**: Position calculation utilities should be extracted to /utils/
4. ⚠️ **TODO**: `getItemSize()` should be moved to item data or utilities

None of these are critical bugs - they're architectural cleanup that will make the codebase more maintainable as features expand.
