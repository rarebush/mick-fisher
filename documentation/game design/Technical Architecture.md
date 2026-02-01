# Technical Architecture

## Tech Stack

### Core Framework

- **Build Tool:** Vite (fast dev server, optimized builds)
- **UI Framework:** React (for menus, HUD, UI overlays)
- **Game Rendering:** PixiJS + @pixi/react (WebGL-accelerated 2D rendering)
- **State Management:** Zustand (lightweight, performant game state)
- **Styling:** CSS Modules (scoped, performant styling)

### Audio

- **Sample Playback:** Howler.js (UI sounds, simple effects)
- **Procedural Audio:** Tone.js (dynamic tension, environmental sounds)
- **Approach:** Hybrid - samples for discrete events, synthesis for continuous/dynamic sounds

### Dev Tools

- **PixiJS DevTools:** Scene inspector, performance monitoring
- **Tone.js Analyzers:** Audio debugging and visualization

### Data Persistence

- **MVP:** LocalStorage (simple key-value for save data)
- **Future:** IndexedDB if data complexity grows

## Architecture Rationale

**Why PixiJS over SVG/DOM?**

- Performance headroom for particle effects, multiple animated elements
- Smooth scaling/transforms for "item approaching camera" effect
- WebGL acceleration handles future expansion (weather, complex animations)
- Proven game rendering pipeline

**Why Zustand over Context/Redux?**

- Lightweight (minimal bundle size impact)
- Less boilerplate than Redux
- Better performance than Context for frequent updates
- Easy dev tools integration

**Why Tone.js for audio?**

- Procedural tension sounds that respond to game state (slip meter rising)
- Dynamic environmental ambience
- Community support from live-coding/algorave scene
- Can create unique sounds per item/event without large audio asset library

## Core Systems

### World Constants (`worldConstants.js`)

**Single source of truth for world dimensions and projection.**

All spatial calculations derive from this module:

```javascript
import {
  WORLD_Z, // Height levels
  WORLD_Y, // Depth ranges
  createViewport, // Viewport scaling
  projectToScreen, // 3D → 2D projection
  screenToWorld, // 2D → 3D (given Z)
  worldToScreen, // Simplified projection
  getSurfaceScreenBounds, // Get screen bounds for horizontal surfaces
} from "./game/mechanics/worldConstants.js";
```

**Usage Examples:**

```javascript
// Get wall base position (where water/riverbed starts)
const viewport = createViewport(app.screen.width, app.screen.height);
const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
const wallBaseY = waterBounds.top;

// Check if click is on riverbed
const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);
if (clickY >= riverbedBounds.top && clickY <= riverbedBounds.bottom) {
  // Valid cast location
}

// Convert click to world position on riverbed
const worldPos = screenToWorld(clickX, clickY, WORLD_Z.RIVERBED, viewport);
```

### Magnet State Store (`magnetStore.js`)

**Centralized magnet lifecycle and position tracking.**

Manages magnet from spawn through all phases:

```javascript
import useMagnetStore from "./game/state/magnetStore.js";

const magnetStore = useMagnetStore.getState();

// Lifecycle methods
magnetStore.spawnMagnet(avatarX); // Start of cast
magnetStore.updateMagnetPosition(x, y, z); // Position updates (auto-tracks peaks)
magnetStore.setMagnetPhase("dragging"); // Phase transitions
magnetStore.despawnMagnet(); // End of retrieve/failure

// Query methods
const pos = magnetStore.getMagnetWorld(); // { x, y, z } or null
const peaks = magnetStore.getPeakValues(); // { maxX, maxY, maxZ, ... }
const active = magnetStore.isMagnetActive(); // boolean
```

## Project Structure (example)

```
/magnet-fishing
  /src
    /components
      /game
        CastingView.jsx          # PixiJS canvas - top-down fishing view
        TensionBar.jsx           # Hold-to-pull meter during drag
        TugMinigame.jsx          # Oscillating slider for clearing snags
        LiftInterface.jsx        # Tap rhythm + slip meter for vertical lift
        SlipMeter.jsx            # Visual slip accumulation indicator
        RevealScreen.jsx         # Item showcase after successful retrieve
      /ui
        SessionTimer.jsx         # Countdown clock for fishing sessions
        QuadrantOverlay.jsx      # Quadrant grid overlay on casting view
        InventoryPanel.jsx       # Current session catch list
        CollectionCatalog.jsx    # Silhouette discovery tracker
      /shop
        ShopInterface.jsx        # Buy/sell/upgrade screens
        RefurbStation.jsx        # Item refurbishment interface
        CraftingBench.jsx        # Upgrade crafting with materials
    /game
      /state
        gameStore.js             # Zustand store - global game state
        sessionStore.js          # Current fishing session state
        inventoryStore.js        # Player inventory management
      /mechanics
        castMechanics.js         # Quadrant selection, placement RNG
        dragMechanics.js         # Tension, snag detection, distance calc
        liftMechanics.js         # Tap rhythm, slip accumulation
        slipCalculations.js      # Placement × surface condition → slip rate
        eventSystem.js           # Probability tables, event triggers
      /data
        itemDatabase.js          # All retrievable items with properties
        locationDatabase.js      # Location themes, spawn tables
        upgradeDatabase.js       # Equipment progression trees
        eventDatabase.js         # Special events with conditions
    /audio
      audioManager.js            # Howler.js sample coordination
      proceduralAudio.js         # Tone.js synthesis (tension drone, etc)
      audioLibrary.js            # Sound effect definitions
    /utils
      constants.js               # Game balance values, timing configs
      helpers.js                 # Utility functions (RNG, lerp, etc)
      responsive.js              # Device detection, orientation handling
    /hooks
      useGameLoop.js             # RAF-based game loop for PixiJS
      useAudio.js                # Audio playback wrapper
      useTimer.js                # Session countdown timer
      useInput.js                # Hold/tap/click input handling
    /assets
      /sprites                   # Item illustrations (vector or pixel)
      /audio                     # Sample library (splashes, clicks, etc)
      /ui                        # Menu graphics, icons
    App.jsx                      # Root component, routing
    main.jsx                     # Entry point
```

## Game Loop Architecture & Update Frequencies

### Core Game Loop (60 FPS)

**Critical Systems Requiring Frame-Perfect Updates:**

All core game mechanics run at **60 FPS** (16.67ms per frame) using PixiJS ticker:

```javascript
app.ticker.add((ticker) => {
  const deltaMS = ticker.deltaMS; // Time since last frame
  const deltaTime = deltaMS / 1000; // Convert to seconds

  // Update all game state at 60 FPS
  updateTension(deltaTime);
  updateSlipPosition(deltaTime);
  checkForSnagContact(deltaTime);
  detectTapInput(deltaTime);
  updateVisuals(); // PixiJS graphics - 60 FPS
});
```

**Why 60 FPS for Core Mechanics:**

1. **Tension System:**
   - Build rate: 15%/s base with weight modifiers
   - Critical timing: Snag at 70% tension → 100% in 0.20s (12 frames at 60 FPS)
   - Player must release within ~8-10 frames to survive
   - 100% = instant rip-off requires frame-perfect detection

2. **Slip Position System:**
   - Positional slip model: magnet position (0-100 units) updates continuously
   - Formula: `position += slipDirection × (slipRate × deltaTime)`
   - Example: Heavy sludge (4.0x) × High tension (2.0x) = 8 units/s = 0.133 units/frame
   - Smooth accumulation essential for visible slip movement during revealed lift

3. **Tap Detection:**
   - Tap = press → release within 200ms (12 frames at 60 FPS)
   - Instant +10% tension requires immediate visual/audio feedback
   - Frame-level precision ensures tap vs hold distinction

4. **Weight Signature Recognition:**
   - Expert players recognize item weight within 2 seconds
   - Heavy items make tension build FASTER (visible immediately)
   - Requires smooth 60 FPS bar animation to convey weight signature

### Event System (Distance/Position-Based)

**CRITICAL: Events are NOT time-based polled - they're distance/position-triggered:**

```javascript
// Distance-based events (snag, debris scrape)
let distanceAccumulator = 0;
const SNAG_CHECK_DISTANCE = 5; // meters

app.ticker.add((ticker) => {
  if (isDragging) {
    const deltaDistance = dragSpeed * (ticker.deltaMS / 1000);
    distanceAccumulator += deltaDistance;

    // Check every 5m traveled
    while (distanceAccumulator >= 5) {
      distanceAccumulator -= 5;

      // Snag probability: 15% per 5m
      if (Math.random() < 0.15) {
        triggerSnag();
      }
    }
  }
});

// Position-based events (item rotation at 50% drag progress)
app.ticker.add((ticker) => {
  if (isDragging) {
    const dragProgress = 1 - currentDistance / initialDistance;

    if (dragProgress >= 0.5 && !rotationTriggered) {
      rotationTriggered = true;
      if (Math.random() < rotationChance) {
        triggerItemRotation();
      }
    }
  }
});

// Session-based events (current surge - once per session)
function initializeFishingSession() {
  if (Math.random() < 0.1) {
    // 10% chance per session
    const surgeTiming = Math.random() * sessionDuration;
    scheduleCurrentSurge(surgeTiming);
  }
}
```

### UI Update Frequencies (React State Sync)

**Dual Update Rate Strategy:**

Different game phases require different UI update frequencies:

```javascript
const UI_UPDATE_INTERVAL_NORMAL = 100; // 10 FPS - general UI
const UI_UPDATE_INTERVAL_CRITICAL = 33; // 30 FPS - revealed lift phase

let uiUpdateAccumulator = 0;

app.ticker.add((ticker) => {
  uiUpdateAccumulator += ticker.deltaMS;

  const updateInterval = isRevealedLift
    ? UI_UPDATE_INTERVAL_CRITICAL
    : UI_UPDATE_INTERVAL_NORMAL;

  if (uiUpdateAccumulator >= updateInterval) {
    uiUpdateAccumulator -= updateInterval;

    // Sync PixiJS state → React state
    setDisplayedTension(Math.round(tension));
    setDisplayedTimer(remainingTime);

    // Critical: Slip position during revealed lift needs 30 FPS
    if (isRevealedLift) {
      setDisplayedSlipPosition(Math.round(magnetPosition));
      setSlipDirection(slipDirection);
    }
  }
});
```

**Update Frequency Breakdown:**

| UI Element                           | Update Rate       | Rationale                                           |
| ------------------------------------ | ----------------- | --------------------------------------------------- |
| **Session Timer**                    | 1 FPS (1000ms)    | Displays in whole seconds, no need for faster       |
| **Inventory Count**                  | 1 FPS             | Changes infrequently (only on item secure)          |
| **Tension Numeric Display**          | 10 FPS (100ms)    | Acceptable latency for numeric readout              |
| **Slip Position Display (revealed)** | **30 FPS (33ms)** | **Critical for player reaction during skill phase** |
| **Catch Log**                        | On event          | Updates only when item secured                      |
| **Visual Tension Bar**               | **60 FPS**        | **PixiJS Graphics - updated every frame**           |
| **Visual Slip Widget**               | **60 FPS**        | **PixiJS Graphics - smooth position animation**     |

**Why 30 FPS for Revealed Lift Slip Display:**

During revealed lift phase (Phase 2b), player sees slip position and must react in real-time:

- Slip building at 10 units/s = 1 unit per 100ms at 10 FPS (too slow)
- At 30 FPS: updates every 33ms = 0.33 units per update (smooth enough)
- Balances responsiveness with performance (50% fewer React updates than 60 FPS)
- This phase is **skill expression** - requires tight feedback loop

### Visual Updates (PixiJS Graphics)

**All visual elements update at 60 FPS via PixiJS, NOT synced to React state:**

```javascript
// CORRECT: PixiJS handles visual bar at 60 FPS
const tensionBarGraphics = new Graphics();

app.ticker.add((ticker) => {
  // Update game state variable (60 FPS)
  updateTension(ticker.deltaMS);

  // Update visual IMMEDIATELY (PixiJS - 60 FPS)
  tensionBarGraphics.clear();
  tensionBarGraphics.beginFill(getTensionColor(tension));
  tensionBarGraphics.drawRect(0, 0, (tension / 100) * barMaxWidth, 20);
  tensionBarGraphics.endFill();

  // React numeric display updates separately at 10 FPS (handled by periodic sync)
});
```

This separation ensures:

- Bar fill animation is smooth (60 FPS visual)
- Player sees immediate weight signature (tension jumps fast = heavy item)
- Numeric display can lag slightly (10 FPS) without harming gameplay
- Reduced React re-renders for performance

### Snag Tension Multiplier

**Critical Implementation Detail:**

During snag events, tension builds at **8-10x normal rate**:

```javascript
app.ticker.add((ticker) => {
  const deltaTime = ticker.deltaMS / 1000;

  // Base tension build rate
  let tensionBuildRate = 15; // 15%/s base

  // Apply weight modifier
  tensionBuildRate *= weightModifier;

  // Apply diminishing returns
  tensionBuildRate *= diminishingCurve(currentTension);

  // CRITICAL: Apply snag multiplier
  if (isSnagged) {
    const snagMultiplier = 8 + Math.random() * 2; // 8-10x
    tensionBuildRate *= snagMultiplier;
  }

  // Update tension
  tension += tensionBuildRate * deltaTime;

  // Check for instant rip-off
  if (tension >= 100) {
    triggerInstantRipOff();
  }
});
```

**Snag Math Validation:**

- At 30% tension when snagged: 70 points to 100%
- Minimum build rate: 120%/s (8x base 15%/s)
- Time to failure: 70 / 120 = 0.583 seconds
- At 60 FPS: 0.583s = **35 frames** for player to react

## Performance Considerations

**Target Performance:**

- 60fps game loop during active retrieve
- <100ms input latency (hold/tap/click → visual feedback)
- Smooth scaling animations (no jank during item approach)
- Audio sync with visual events (<50ms offset)

**Optimization Strategies:**

- PixiJS sprite batching for multiple items/particles
- Object pooling for frequently created/destroyed elements (particles, ripples)
- Lazy loading for item assets (load location-specific items on demand)
- Audio sprite sheets for combining small samples
- **Separate PixiJS (60 FPS) from React updates (10-30 FPS)** - critical for performance

**Device-Specific:**

- Detect device capabilities on load
- Reduce particle counts on lower-end devices
- Adjust animation quality based on FPS monitoring
- Fallback to simpler audio on devices with limited Web Audio API support

## Input System Architecture

All game inputs (pointer, touch, keyboard) are managed centrally through the `InputManager` class. This provides:

- **Unified Input Handling**: Single source of truth for all input events
- **Robust Tap/Hold Detection**: Timeout-based system (100ms threshold) prevents race conditions
- **Multi-touch Prevention**: Active pointer tracking ensures only one input at a time
- **Phase-Aware Routing**: Inputs handled differently based on game phase (idle, dragging, lift)
- **Graceful Error Handling**: Window blur, pointer cancel, and edge cases properly managed

**Key Implementation Details:**

```javascript
// Separate physical state from logical state
this.isPointerDown = false; // Hardware: finger/mouse is down
this.isHoldingForDrag = false; // Logic: this counts as "holding for drag"

// Timeout-based hold detection (prevents rapid tap → hold issues)
this.holdDetectionTimeout = setTimeout(() => {
  if (this.isPointerDown) {
    this.isHoldingForDrag = true;
    sessionStore.setState({ isDragging: true });
  }
}, 100);
```

**Why This Matters:**

- Prevents the bug where rapid tapping followed by holding fails to register
- Allows seamless transition from tapping (tension boosts) to holding (continuous drag)
- More performant than polling-based detection
- Cleaner separation of concerns

**For full input system documentation, see:** [Technical Architecture - Input System](Technical%20Architecture%20-%20Input%20System.md)

---

## World-Space Coordinate System & Projection

### 3D World Space Architecture (IMPLEMENTED)

**Core Principle:**

> "Build the world in world space, then project it to screen space."

The game operates in a true 3D world coordinate system that projects to 2D screen space using true isometric projection. All game mechanics, physics, and positioning use world coordinates exclusively.

**Coordinate System:**

```
World Space Axes:
- X: Horizontal position (left/right)
- Y: Depth into the scene (toward the river, away from avatar)
- Z: Height/elevation (vertical)

Isometric Projection Formula (30°):
  isoX = (worldX - worldY) * cos(30°)
  isoY = (worldX + worldY) * sin(30°) - worldZ
  screenX = isoX * pixelsPerUnit + screenXOffset
  screenY = isoY * pixelsPerUnit + screenYOffset

Why this projection?
- Preserves consistent 3D distances in world units
- Creates isometric depth (higher Z = higher on screen)
- Fits full world bounds within viewport with consistent scaling
```

**World Dimensions (`worldConstants.js`):**

```javascript
// Z-axis heights (abstract units)
export const WORLD_Z = {
  RIVERBED: 0, // Ground level where items rest
  WATER_SURFACE: 1, // Top of water layer
  WALKWAY: 3, // Pier/walkway surface
  AVATAR_HAND: 4.2, // Avatar's hand holding rod
};

// Y-axis depths (abstract units)
export const WORLD_Y = {
  WALKWAY_BACK: -4, // Back edge of walkway (extends toward camera)
  WALKWAY_FRONT: 0, // Front edge where avatar stands
  AVATAR: 0, // Avatar position
  WALL_EDGE: 0, // Vertical wall at Y=0
  WATER_NEAR: 0, // Water starts at wall base
  WATER_FAR: 6, // Far edge of water
  RIVERBED_NEAR: 0, // Riverbed starts at wall base
  RIVERBED_FAR: 6, // Far edge of riverbed
};
```

**Viewport System:**

The viewport manages conversion between world units and screen pixels:

```javascript
const viewport = createViewport(screenWidth, screenHeight);
// Returns: { pixelsPerUnit, screenYOffset, worldBounds... }

// Project 3D world position → 2D screen position
const screenPos = projectToScreen(worldX, worldY, worldZ, viewport);

// Convert screen click → 3D world position (given known Z)
const worldPos = screenToWorld(screenX, screenY, knownZ, viewport);
```

**Layer Positioning (Pure Projection):**

All environment layers positioned via world-space projection:

```javascript
// Walkway: horizontal surface at Z=3, Y range [-4, 0]
const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);
const walkwayY = walkwayBounds.top;
const walkwayHeight = walkwayBounds.bottom - walkwayBounds.top;

// Wall: VERTICAL surface at Y=0, spanning Z from 3 to 0
const wallTop = projectToScreen(
  0,
  WORLD_Y.WALL_EDGE,
  WORLD_Z.WALKWAY,
  viewport,
);
const wallBottom = projectToScreen(
  0,
  WORLD_Y.WALL_EDGE,
  WORLD_Z.RIVERBED,
  viewport,
);
const wallY = wallTop.y;
const wallHeight = wallBottom.y - wallTop.y;

// Water: horizontal surface at Z=1, Y range [0, 6]
const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);

// Riverbed: horizontal surface at Z=0, Y range [0, 6]
const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);
```

**No Inter-Layer Dependencies:**

Each layer is positioned independently using pure projection:

- Walkway doesn't depend on wall position
- Water doesn't depend on riverbed position
- Wall height calculated from Z-span (3 to 0), not from other layers

**Render Order:**

```javascript
export const RENDER_LAYERS = {
  WALKWAY: 0, // Back layer (backdrop)
  AVATAR: 1, // Avatar on walkway
  WALL_FACE: 2, // Vertical wall
  RIVERBED: 3, // River bottom
  ITEMS_ON_RIVERBED: 4, // Items resting on bed
  WATER_SURFACE: 5, // Semi-transparent water overlay
  // Magnet layer is dynamic based on Z position
};
```

**Visual Documentation:**

See `documentation/game design/diagram.svg` for annotated visual reference showing:

- Z-height levels
- Y-depth ranges for each surface
- Projection formula
- Layer stacking order

### Centralized Magnet State (`magnetStore.js`)

**Problem Solved:**

Magnet position and state were previously scattered across multiple files. Now centralized in a single Zustand store.

**Magnet Lifecycle:**

```javascript
import useMagnetStore from "./state/magnetStore.js";

const magnetStore = useMagnetStore.getState();

// 1. Cast begins - spawn magnet at avatar hand
magnetStore.spawnMagnet(avatarWorldX);
// Sets: magnetWorld = { x, y: WORLD_Y.AVATAR, z: WORLD_Z.AVATAR_HAND }
//       magnetActive = true
//       magnetPhase = 'throwing'

// 2. During throw/drag/lift - update position
magnetStore.updateMagnetPosition(newX, newY, newZ);
// Automatically tracks peak values (max/min for each axis)

// 3. Phase transitions
magnetStore.setMagnetPhase("sinking"); // or 'dragging', 'lifting'

// 4. Retrieve complete or failure - despawn
magnetStore.despawnMagnet();
// Clears all state, resets peaks
```

**Peak Value Tracking:**

The store automatically tracks peak values throughout the cast:

```javascript
const peaks = magnetStore.getPeakValues();
// Returns: { maxX, maxY, maxZ, minX, minY, minZ }

// Used for debug visualization and analytics
```

**Debug Display:**

Static debug widget in bottom-left corner shows real-time coordinates:

```
Magnet World:
X: 350.25 (max: 425.50)
Y: 2.10 (max: 5.80)
Z: 0.00 (max: 4.20)
```

Displayed during both cast animation and drag phase - single source of truth.

### Physics Integration

**3D Rope Physics:**

`RopePhysics3D.js` operates entirely in world space:

```javascript
// Avatar position (world space)
const avatarWorld = {
  x: screenWidth / 2,
  y: WORLD_Y.AVATAR,
  z: WORLD_Z.AVATAR_HAND,
};

// Magnet position from magnetStore (world space)
const magnetWorld = magnetStore.getMagnetWorld();

// Update rope physics in world space
rope.update(deltaTime, avatarWorld, magnetWorld);

// Get rope points in world space
const worldPoints = rope.points.map((p) => p.pos);

// Project to screen for rendering
const screenPoints = worldPoints.map((p) => worldToScreen(p, viewport));
```

**Drag Mechanics:**

All position calculations in world space:

```javascript
// Cast position stored as screen coords, convert to world
const castWorld = screenToWorld(
  castScreenX,
  castScreenY,
  WORLD_Z.RIVERBED,
  viewport,
);

// Avatar target position
const avatarWorld = {
  x: screenWidth / 2,
  y: WORLD_Y.AVATAR,
  z: WORLD_Z.RIVERBED,
};

// Interpolate in world space
const itemWorld = {
  x: lerp(castWorld.x, avatarWorld.x, progress),
  y: lerp(castWorld.y, avatarWorld.y, progress),
  z: WORLD_Z.RIVERBED, // Always on riverbed during drag
};

// Update magnetStore
magnetStore.updateMagnetPosition(itemWorld.x, itemWorld.y, itemWorld.z);

// Project to screen only for rendering
const itemScreen = worldToScreen(itemWorld, viewport);
```

**Benefits:**

- ✅ Single source of truth for world dimensions
- ✅ No magic numbers or hardcoded percentages
- ✅ All physics calculations in consistent coordinate system
- ✅ Easy to adjust world scale (change pixelsPerUnit)
- ✅ Proper separation: world simulation vs screen rendering
- ✅ Foundation for future 3D features (parallax, camera rotation)
- ✅ Centralized magnet state prevents desync issues
- ✅ Peak tracking enables analytics and debugging

---
