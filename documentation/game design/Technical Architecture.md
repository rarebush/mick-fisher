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
- Debounced state updates (don't update UI on every frame)

**Device-Specific:**

- Detect device capabilities on load
- Reduce particle counts on lower-end devices
- Adjust animation quality based on FPS monitoring
- Fallback to simpler audio on devices with limited Web Audio API support
