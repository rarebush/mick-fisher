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

## Coordinate System & Depth Model

### Dual-Plane Architecture (MVP Feature - Planned)

**Problem Statement:**

The game world conceptually operates in two distinct spatial planes:

1. **Water Surface:** Where player sees ripples, bubbles, rope endpoint
2. **River Bed:** Where items actually rest, depth varies by location

Currently, casting animations use placeholder wait periods that create physics discontinuities. A proper depth model is needed to:

- Eliminate arbitrary animation delays
- Enable realistic depth variation between locations
- Support future lift phase mechanics (Phase A/B timing based on depth)
- Allow rope physics to naturally represent depth

**Proposed Coordinate System:**

```
Screen Space (PixiJS Canvas):
┌─────────────────────────────────────────┐
│  Player/Shore (0, 80)                    │ ← Surface Plane Y=80
│              ╲                           │
│               ╲ Rope                     │
│                ╲                         │
│                 ╲                        │
│  Water Surface   ● ← Cast Click         │ ← Y=80 (visual)
│  (ripples here)  │                       │
│                  │ Depth Offset          │
│                  ↓ (varies by location)  │
│                  ● Item Location         │ ← Y=80+depth (actual)
│             River Bed                    │
└─────────────────────────────────────────┘

Plane Translation:
- Cast at (x, 80) → Item spawns at (x, 80+depth)
- Depth varies: Shallow Creek (depth=50px), Deep River (depth=200px)
- Rope length naturally shows depth: longer = deeper
```

**Coordinate Translation:**

```javascript
// When player casts at surface coordinates
function handleCastClick(surfaceX, surfaceY) {
  const currentLocation = locationStore.getCurrentLocation();
  const depth = currentLocation.depth; // e.g., 150px

  // Translate to river bed coordinates
  const bedX = surfaceX;
  const bedY = surfaceY + depth; // Item spawns below surface

  // Spawn item at bed
  spawnItem(bedX, bedY);

  // Rope naturally connects surface (player) to bed (item)
  // Rope length = distance from (playerX, 80) to (bedX, bedY)
}

// When saving engaged item position
function saveEngagedItem(bedX, bedY) {
  // Store actual bed coordinates
  engagedItems.push({ x: bedX, y: bedY });
}

// When rendering bubbles (visual feedback only)
function renderBubbles(bedX, bedY, surfaceY) {
  // Animate bubbles from bed → surface
  animateBubbleRise(bedX, bedY, bedX, surfaceY);

  // Only show bubble sprite at surface (not during rise)
  showBubbleSprite(bedX, surfaceY);
}
```

**Depth Variation by Location:**

| Location Type  | Depth (px) | Rope Length @ 5m Distance | Visual Impact             |
| -------------- | ---------- | ------------------------- | ------------------------- |
| Shallow Creek  | 50px       | ~180px                    | Rope barely visible       |
| Urban Canal    | 100px      | ~200px                    | Moderate slack            |
| Deep River     | 200px      | ~280px                    | Significant depth visible |
| Flooded Quarry | 300px      | ~360px                    | Very long rope            |

**Rope Physics Integration:**

```javascript
// Cast animation sets rope endpoints
const playerPos = { x: 200, y: 80 }; // Surface
const itemPos = { x: 350, y: 80 + 150 }; // Bed (depth=150)

// Rope physics naturally represents depth
rope.setPlayerPosition(playerPos.x, playerPos.y);
rope.setMagnetPosition(itemPos.x, itemPos.y);
rope.update(); // Slack/sag based on actual distance

// No artificial "sinking" delay needed - rope just draws from surface to bed
```

**Lift Phase Integration (Future):**

During lift phases, depth affects mechanics:

```javascript
// Phase A (Hidden Lift): Item moves from bed toward surface
const liftProgress = (depth - currentDepth) / depth; // 0-100%
const phaseADuration = depth / 20; // Deeper = longer Phase A

// Phase B (Revealed Lift): Item breaks surface, skill phase begins
if (currentDepth <= 0) {
  transitionToPhaseB(); // Item visible, slip mechanics active
}

// Player plane (future): Above water surface for retrieval
const playerHeight = -50; // 50px above water
// Creates 3 planes: Player (-50) → Surface (80) → Bed (80+depth)
```

**Implementation Status:**

- **Current:** Placeholder 500ms wait removed; cast → drag transition is immediate
- **Rope Physics:** Complete - supports arbitrary endpoint distances
- **Next Steps:**
  1. Add `depth` property to location data
  2. Implement coordinate translation in cast mechanics
  3. Update engaged item storage to use bed coordinates
  4. Add bubble rise animations (bed → surface)
  5. Integrate depth into lift phase timing

**Benefits:**

- ✅ Eliminates animation discontinuities (no more freeze during transition)
- ✅ Realistic depth variation between locations
- ✅ Rope physics naturally show depth (no special cases)
- ✅ Foundation for lift phase mechanics
- ✅ Supports future 3-plane system (player/surface/bed)

---
