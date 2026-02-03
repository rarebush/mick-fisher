Please review my codebase for large files, function placement, and alignment with the file structure. Use the design docs as guidance, but assume some docs are out of date.

If you find `ARCHITECTURE_REVIEW.md`, use it as context but verify against current code since it can be stale.

Code Organization Review - Updated Analysis
Large Files (by size)

- `src/game/PixiApp.js` ~31.6KB (needs splitting)
- `src/game/animations/castAnimations.js` ~24.9KB (split)
- `src/game/physics/physicsSystem.js` ~21.2KB (split)
- `src/game/input/inputManager.js` ~19.3KB (split)
- `src/game/mechanics/worldConstants.js` ~18.7KB (split)

Critical Issues

1. `PixiApp.js` is too large
   Responsibilities today:

   - Scene initialization and layer setup
   - Ticker management (sprites, drag mechanics, rope, cast aim)
   - Cast aim overlay rendering
   - Event handlers, resize handling, cleanup
     Recommended split:
   - `rendering/sceneInitializer.js` for scene setup
   - `rendering/castAimRenderer.js` for overlay drawing
   - `rendering/spriteTicker.js`, `rendering/ropeTicker.js`
   - `sequences/dragTicker.js`

2. `castAnimations.js` should be split
   Current structure:

   - `animateCastLine()` (large state machine)
   - `animateReelIn()`
   - `createRipple()`, `createBubbles()`, `startDragBubbles()` (effects)
     Recommended split:
   - `animations/castLineAnimation.js`
   - `animations/reelInAnimation.js`
   - `animations/particleEffects.js`

3. `physicsSystem.js` is dense
   Current structure:

   - Constants
   - Vector math utilities
   - Target creation and profiles
   - Wait phase logic
   - Drag phase physics and fish AI
     Recommended split:
   - `physics/vectorUtils.js`
   - `physics/targetFactory.js`
   - `physics/forceCalculations.js`
   - `physics/stateUpdates.js`
   - `physics/waitPhase.js`
   - `physics/dragPhysics.js`
   - Keep `physicsSystem.js` as a barrel re-export to avoid churn

4. `inputManager.js` should be split
   Recommended split:

   - `input/inputGeometry.js` for bounds/quadrant logic
   - `input/inputFeedback.js` for access message display
   - Keep `InputManager` for orchestration

5. `worldConstants.js` is doing too much
   Recommended split:
   - `mechanics/worldDimensions.js`
   - `mechanics/projection.js`
   - `mechanics/viewport.js`
   - `mechanics/renderLayers.js`
   - `mechanics/worldHelpers.js`
   - Keep `worldConstants.js` as a barrel re-export

Good Organization (Keep As-Is)

- `sequences/` separation is good
- `mechanics/` separation is good
- `state/` stores are reasonable
- `data/` databases are well organized
- `graphics/` utilities are clean

Missing from Original Design (still OK to add)
Based on `documentation/game design/Technical Architecture.md`:

- `/utils/` for helper functions
- `/hooks/` for React hooks (optional/future)
- `/audio/` will expand later

I can implement the refactors above and create `/utils/` with:

- `utils/positionCalculations.js` (distance/position helpers)
- `utils/itemSizing.js` (item size rules)
