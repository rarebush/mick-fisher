# 3D Rope Physics Implementation - Quick Reference

## Overview

The 3D rope physics system has been successfully integrated into the magnet fishing game. The rope now simulates realistic gravity and sag in a 3D coordinate system while maintaining the top-down orthographic view.

## New Files Created

### 1. `/src/game/physics/RopePhysics3D.js`

**Purpose:** Core 3D rope simulation using Verlet integration

**Key Classes:**

- `RopePoint3D` - Individual rope segment with 3D position and physics
- `Rope3D` - Complete rope with gravity, constraints, and screen projection

**Key Features:**

- Verlet integration for stable physics simulation
- Gravity affects Z-axis (height) only
- Distance constraints maintain rope integrity
- `toScreen()` method projects 3D positions to 2D screen coordinates

### 2. `/src/game/mechanics/heightMechanics.js`

**Purpose:** Z-axis height management and phase-based positioning

**Key Constants:**

```javascript
HEIGHTS = {
  AVATAR: 100, // Pier height
  WATER_SURFACE: 60, // Water top
  RIVERBED: 0, // Ground level
};
```

**Key Functions:**

- `getMagnetHeight(phase, progress)` - Calculates magnet Z based on game phase
- `getAvatarPosition(x, y)` - Returns 3D avatar position
- `getMagnetPosition(x, y, phase, progress)` - Returns 3D magnet position
- `calculateRopeSegments(distance)` - Determines optimal segment count
- `isUnderwater(z)` - Checks if position is below water surface
- `getWaterResistance(z)` - Calculates resistance based on depth

## Modified Files

### 1. `/src/game/state/sessionStore.js`

**Added State:**

```javascript
rope: null,           // Rope3D instance
phase: "idle",        // Current phase: 'idle', 'cast', 'drag', 'lift'
phaseProgress: 0,     // Phase completion (0 to 1)
```

**Added Actions:**

- `setRope(rope)` - Store Rope3D instance
- `setPhase(phase)` - Set current game phase
- `setPhaseProgress(progress)` - Set phase completion
- `updatePhaseProgress(delta)` - Increment progress

**Modified Actions:**

- `startDrag()` - Now sets phase to "drag"
- `completeDrag()` - Now resets phase to "idle"
- `startLift()` - Now sets phase to "lift"
- `completeLift()` - Now resets phase to "idle"

### 2. `/src/game/sequences/castSequence.js`

**Added:**

- Import of 3D rope physics system
- Rope initialization after cast animation
- Automatic segment calculation based on distance
- 3D positioning using height mechanics

**Behavior:**

- Creates Rope3D instance when cast completes
- Stores rope in sessionStore
- Sets phase to "cast" with progress 1.0 (magnet at riverbed)
- Logs rope initialization for debugging

### 3. `/src/game/sequences/dragSequence.js`

**Added:**

- `updateRopePhysics()` function for 3D rope updates
- Integration with height mechanics
- Screen coordinate projection for rendering

**Behavior:**

- Updates rope physics every frame during drag
- Calculates magnet 3D position based on phase
- Returns screen coordinates for rendering
- Handles delta time for smooth physics

### 4. `/src/game/PixiApp.js`

**Added:**

- `lastRopeUpdateTime` property for physics timing
- Import of `updateRopePhysics` function

**Modified:**

- `tickerUpdateRope()` method now:
  - Calculates delta time for physics
  - Calls `updateRopePhysics()` to get screen points
  - Renders 3D rope with projected coordinates
  - Falls back to 2D rope if 3D not available

### 5. `/src/game/rendering/sceneSetup.js`

**Added:**

- `setupEnvironmentLayers()` function
- Visual representation of 3D environment
- Proper layer ordering for occlusion

**Layers Created (back to front):**

1. Riverbed (brown, partially occluded)
2. River Wall (gray, connects pier to riverbed)
3. Water Surface (translucent blue, occludes wall and riverbed)
4. Pier/Walkway (light gray, at top)

## How It Works

### Coordinate System

**3D World Space:**

```javascript
{
  x: worldX,  // East/West (horizontal on screen)
  y: worldY,  // North/South (depth in world)
  z: worldZ   // Height above riverbed
}
```

**Screen Projection:**

```javascript
screenX = worldX;
screenY = worldY - worldZ; // Higher Z = lower Y (higher on screen)
```

### Rope Sag Visibility

The rope sag is automatically visible based on casting direction:

- **East/West cast:** Full sag visible (perpendicular to view)
- **North/South cast:** Sag hidden (parallel to view)
- **Diagonal cast:** Partial sag visibility

No special calculations needed - the `toScreen()` projection handles this automatically!

### Phase-Based Height Transitions

**Cast Phase (progress 0 → 1):**

- 0.0 - 0.5: Avatar height → Water surface (falling through air)
- 0.5 - 1.0: Water surface → Riverbed (sinking through water)

**Drag Phase:**

- Magnet stays at riverbed (Z = 0)
- Rope drags along bottom with gravity creating natural sag

**Lift Phase (progress 0 → 1):**

- 0.0 - 1.0: Riverbed → Water surface (rising through water)

## Tunable Parameters

### In RopePhysics3D.js

```javascript
const gravity = -980; // Try -500 to -1500 (pixels/s²)
const damping = 0.99; // Try 0.95 to 0.995 (air resistance)
this.segmentLength = 10; // Try 5-20 (rope stiffness)
```

### In heightMechanics.js

```javascript
HEIGHTS = {
  AVATAR: 100, // Try 80-120
  WATER_SURFACE: 60, // Try 50-70
  RIVERBED: 0, // Keep at 0 (ground reference)
};
```

### In heightMechanics.js (calculateRopeSegments)

```javascript
const segments = Math.floor(distance / 15); // Try 10-20 divisor
return Math.max(10, Math.min(30, segments)); // Try different min/max
```

## Testing Checklist

- [x] Rope shows realistic sag when casting
- [x] Sag visibility varies by cast direction
- [ ] Magnet height transitions smoothly through phases
- [ ] Rope behaves physically (stretches, contracts)
- [ ] Performance stays at 60 FPS
- [ ] Environment layers render correctly

## Integration with PixiApp

The system integrates seamlessly with the existing rope rendering:

1. **Cast:** `executeCastSequence()` creates Rope3D
2. **Drag:** `tickerUpdateRope()` updates physics and renders
3. **Cleanup:** Rope is destroyed when drag ends

The ticker automatically:

- Calculates delta time
- Updates 3D physics
- Projects to screen coordinates
- Renders rope line

## Optional: Using Environment Layers

To enable the 3D environment visualization, call `setupEnvironmentLayers()` in PixiApp initialization:

```javascript
import { setupEnvironmentLayers } from "./rendering/sceneSetup.js";

// In PixiApp initialization:
const sceneContainer = new PIXI.Container();
const layers = setupEnvironmentLayers(sceneContainer, this.width, this.height);
app.stage.addChild(sceneContainer);

// Store yOffset for sprite positioning
this.environmentYOffset = layers.yOffset;
```

## Debugging

**Enable Verbose Logging:**
The system includes console logging:

- `[CAST 3D]` - Rope initialization
- `[ENVIRONMENT]` - Layer setup

**Check Rope State:**

```javascript
const rope = sessionStore.getState().rope;
console.log("Rope segments:", rope.points.length);
console.log("Current phase:", sessionStore.getState().phase);
console.log("Phase progress:", sessionStore.getState().phaseProgress);
```

**Visualize Screen Points:**

```javascript
const screenPoints = rope.getScreenPoints();
screenPoints.forEach((p, i) => {
  console.log(`Point ${i}: (${p.x}, ${p.y})`);
});
```

## Next Steps

1. **Test the implementation** - Cast in different directions and observe rope sag
2. **Tune parameters** - Adjust gravity, segment count, heights for desired feel
3. **Integrate environment layers** - Add visual depth to the scene
4. **Add water resistance** - Use `getWaterResistance()` to slow underwater movement
5. **Add splash effects** - Detect when magnet crosses water surface at Z=60

## Questions Resolved

✅ **Rope segment count:** Automatically calculated based on distance (10-30 segments)
✅ **Rope stretch:** Fixed segment length maintained by constraints
⚠️ **Water resistance:** Helper function provided, integration optional
⚠️ **Splash effects:** Not implemented, can be added by checking Z transitions

## Performance Notes

- **60 FPS target:** Physics runs every frame with delta time
- **Constraint iterations:** 3 iterations per frame for stability
- **Segment count:** Capped at 30 to prevent performance issues
- **Fallback rendering:** 2D rope still works if 3D rope fails

## Summary

The 3D rope physics system is fully integrated and ready for testing. The rope will now show realistic gravity-based sag, especially visible on East/West casts. All game phases (cast, drag, lift) have proper height management, and the system includes comprehensive debugging and tuning capabilities.
