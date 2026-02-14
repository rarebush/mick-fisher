Here’s a thorough, low‑risk refactor plan for the top 3 files. The theme is “split by responsibility without changing behavior,” and keep public APIs stable until the end of each phase.

**Phase 0: Baseline + Safety**

- Confirm no functional changes during refactor (only move code, keep exports/imports intact).
- Add a quick, optional smoke checklist (load scene, cast, drag, foam visible, rope render, debug overlay toggle).
- Note any stateful references that must remain on the same instance (tickers, event listeners).

**Phase 1: PixiApp.js (Orchestration vs. Subsystems)**
Goals: isolate lifecycle, tickers, and interaction wiring to shrink the class file while keeping the class as the public API.

1. **Create helper modules (no behavior changes):**
   - Pixi app lifecycle helpers
     - setupSceneInternal
     - setupDebugOverlay
     - setupManualFailureListener
     - resize
     - destroy (or split into smaller `destroy*` helpers)
   - Ticker handlers (pure methods that accept `this`)
     - tickerUpdateSprites
     - tickerUpdateDragMechanics
     - tickerUpdateRope
     - tickerUpdateCastAim
     - tickerUpdateCaustics
   - Interaction/splat handlers
     - setupInteraction
     - handleCast + splat variants + `_withFoamCoordinator`

2. **Keep the class signature and public behavior unchanged:**
   - Expose the same methods on `PixiApp` by delegating to helpers.
   - Keep `this`-dependent data within the class; helpers should accept `pixiApp` or be bound to `this` inside the class.

3. **File layout proposal**
   - New files under src/game/app/:
     - src/game/app/pixiAppLifecycle.js
     - src/game/app/pixiAppTickers.js
     - src/game/app/pixiAppInteractions.js
   - PixiApp stays in PixiApp.js, mainly delegating.

**Phase 2: FluidFoamCoordinator.js (Separation of logic clusters)**
Goals: keep the coordinator as orchestration, move math-heavy logic out.

1. **Split “spawn noise” utilities**
   - Move `_clusterValue`, `_perlinNoise2D`, `_fbmNoise2D`, `_rotate2D`, `_grad2D`, `_hash2D`, `_fade`, `_lerp`,
     `_updateSpawnNoiseRange`, `_updateSpawnNoiseOffset`, `_getSpawnThresholdValue`, `_pickSpawnCandidate`.
   - New helper module: src/game/graphics/fluidSystem/foamSpawnNoise.js
   - Coordinator calls helper functions; keep config and state in coordinator.

2. **Split “shift zone forces”**
   - Move `_applyShiftZonesToParticles`, `_getShiftZoneDefaults`, `_getShiftZoneNumber`.
   - New helper module: src/game/graphics/fluidSystem/foamShiftZones.js
   - Inputs: particles array, zones, config, flowPhase, deltaTime; output: in-place velocity updates.

3. **Split “impulses”**
   - Move `_applySplatToParticles`, `_applyRadialImpulseToParticles`, `_applyDirectionalShearToParticles`.
   - New helper module: src/game/graphics/fluidSystem/foamImpulses.js

4. **Keep coordinator responsibilities**
   - lifecycle (initialize, update, setFlowSpeed, setChoppiness, destroy)
   - particle pool + wave scheduling + external API

**Phase 3: waterLayers.js (Builder functions, same file first)**
Goals: reduce cognitive load, keep same behavior and return shape.

1. **Introduce internal builders (still in same file)**
   - `buildRiverbedTiles`
   - `buildWaterSurfaceAndSparkle`
   - `buildFoamSystem`
   - `buildEdgeFoam`
   - `buildWaterObjects`
   - `assembleWaterGroup`

2. **Stabilize return values**
   - Build each subsystem and return a small result object.
   - Combine into final return (unchanged shape).

3. **Optional extraction to modules**
   - Only after helper functions feel stable:
     - src/game/rendering/water/buildRiverbedTiles.js
     - src/game/rendering/water/buildSurfaceLayers.js
     - src/game/rendering/water/buildFoamSystem.js
     - src/game/rendering/water/buildWaterObjects.js

**Phase 4: Cleanup + Consistency**

- Normalize local naming (e.g., `waterSurfaceTiles` vs `sparkleTiles` patterns).
- Keep comments only where they explain non-obvious math or ordering rationale.
- Ensure `createWaterLayers` still returns the same keys used by sceneSetup.js.

**Risks & Mitigations**

- **Risk:** “this” binding breaks when moving methods → keep methods in class delegating to helpers that accept `pixiApp`.
- **Risk:** circular imports when splitting helpers → keep helpers dependency-light (pure functions + minimal imports).
- **Risk:** debug overlays rely on container structure → preserve container ordering and mask usage.

**Suggested order of execution**

1. PixiApp tickers extraction (least coupled; easy to verify)
2. waterLayers internal helpers (same file)
3. FluidFoamCoordinator helpers (math-only, lowest API risk)
4. Optional module extraction for water layers
