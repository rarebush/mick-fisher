# Plan: Dynamic Fluid Foam System with Object Boundaries

Replace the static Voronoi foam shader with a particle-based fluid simulation system that spawns foam in waves, flows around water objects using sprite masks as boundaries, and wraps from left to right bank.

**Core Strategy**: Build incrementally in PixiJS using the existing shader architecture. Start with simple particle advection through a static velocity field, then add boundary interactions, then optimize. The fluid simulation will use render textures for velocity fields and particle states, while PixiJS `ParticleContainer` handles efficient particle rendering.

**Key Technical Decisions**:

- Pure PixiJS implementation (no Three.js dependency)
- Fluid grid resolution: 320×180px (balance between quality and performance)
- Particle target: 8,000-12,000 particles (tunable based on device)
- Simplified Navier-Stokes: Skip divergence-correction initially, add if needed
- Boundary system: Render sprite masks to RenderTexture once per frame

**Steps**

1. **Create fluid system foundation** - Set up the core infrastructure in [src/game/graphics/fluidSystem/](src/game/graphics/fluidSystem/) following the pattern from [waterSystem](src/game/graphics/waterSystem/):
   - Create `FluidFoamCoordinator.js` - Main class managing particle spawning, wave timing, and lifecycle
   - Create `FluidVelocityField.js` - Manages velocity field render textures (ping-pong buffers) and base flow direction
   - Create `FluidParticleState.js` - Manages particle position/velocity data as textures
   - Initialize with static velocity field pointing right (matching river flow at world scale)

2. **Implement particle rendering** - Build particle visualization using PixiJS batch rendering:
   - Create `FluidParticleRenderer.js` using PixiJS `ParticleContainer` (see [pixi-api-links.json](documentation/pixi-api-links.json#L22988))
   - Configure for position, alpha, and scale properties (size variation for visual interest)
   - Render white circles initially (replace foamShader in [waterLayers.js](src/game/rendering/waterLayers.js#L402))
   - Position particles at `WORLD_Z.WATER_SURFACE` (Z=1) coordinate space

3. **Add particle advection** - Port the fluid advection logic from [documentation/fluid_collision/src/ParticleSim.js](documentation/fluid_collision/src/ParticleSim.js):
   - Create `FluidAdvectionShader.js` - GLSL shader that reads particle positions and velocity field, outputs new positions
   - Implement bilinear interpolation for velocity sampling (handle sub-pixel precision)
   - Update particles at 60 FPS using PixiJS ticker (see [PixiApp.js](src/game/PixiApp.js#L578-L600))
   - Apply world→fluid-grid coordinate mapping (isometric world coords to 2D fluid UV space)

4. **Implement boundary system** - Convert sprite masks to fluid boundaries:
   - Create `FluidBoundaryTexture.js` - Renders all water object masks to off-screen `RenderTexture`
   - Sample object mask textures (frame1) from [waterLayers.js](src/game/rendering/waterLayers.js#L532) `objectSpritesheet`
   - Render masks to boundary texture once per frame (objects are static for now, optimize later)
   - Create `FluidBoundaryShader.js` - Applies no-slip boundary conditions (particles bounce/slide along obstacles)
   - Integrate boundary checks into advection shader

5. **Add horizontal wrapping** - Implement left-to-right bank looping:
   - In `FluidAdvectionShader.js`, detect particles exceeding `WORLD_X.MAX` (4) in world space
   - Wrap particle X position to `WORLD_X.MIN` (-8) while preserving Y position and velocity
   - Apply same wrapping to velocity field edges (toroidal topology horizontally)
   - Test with particles spawned at left edge to verify smooth wrapping

6. **Implement wave-based spawning** - Create foam spawn system in `FluidFoamCoordinator.js`:
   - Add `spawnWave(count, centerX, centerY, radius)` method - spawns blob of particles in circular area
   - Track active particle count vs max budget (8k-12k particles)
   - Implement wave timer: spawn new blob every 0.5-2 seconds (tunable parameter)
   - Spawn positions: Random Y along `[WORLD_Y.WATER_NEAR, WORLD_Y.WATER_FAR]`, X near left side `[-7, -5]`
   - Only spawn if current particle count + wave size ≤ max budget

7. **Add particle lifecycle management** - Handle foam persistence and fade-out:
   - Add age tracking to `FluidParticleState.js` (shader uniform or texture channel)
   - Increment age per frame in advection shader
   - Fade alpha based on age: `alpha = 1.0 - age/maxAge` (maxAge: 5-10 seconds)
   - Remove/recycle particles when alpha reaches 0 (free slots for new spawns)
   - Maintain particle pool to avoid reallocation

8. **Integrate with water system** - Replace current foam in [waterLayers.js](src/game/rendering/waterLayers.js):
   - Remove `foamShader` filter from `foamTiles` container
   - Add `FluidFoamCoordinator` instance to water setup (around line 402)
   - Add particle renderer to undisplaced layer stack (between reflections and edgeFoam)
   - Wire up choppiness parameter to spawn rate: higher choppiness → more frequent/larger waves
   - Connect flow speed to velocity field strength (match existing `flowStepSpeed`)

9. **Performance optimization pass** - Tune for 45-60 FPS target:
   - Profile particle count vs frame time (use browser DevTools Performance)
   - Implement adaptive particle budget: reduce max count if frame time > 16ms
   - Test with multiple water objects as boundaries
   - Consider half-res fluid grid (160×90) if bandwidth-limited
   - Add quality presets: Low (5k particles, 160×90 grid), Medium (10k, 320×180), High (15k, 640×360)

10. **Visual polish** - Fine-tune appearance before advanced physics:
    - Adjust particle size distribution (randomize scale 0.5-1.5)
    - Add subtle size pulsing based on velocity (faster = smaller/stretched)
    - Test spawn blob radius (tight clusters vs diffuse clouds)
    - Tune fade curve (linear vs exponential decay)
    - Add slight random velocity variation on spawn (prevent uniform rows)

**Verification**

After each step:

- **Visual test**: Load game, observe foam rendering at water surface
- **Performance test**: Check browser console FPS counter, target >45 FPS
- **Boundary test**: Place test logs in water ([WATER_OBJECT_TEST_LOGS](src/game/rendering/waterLayers.js)), verify foam flows around them
- **Wrapping test**: Follow individual particles from right bank, confirm they reappear at left bank
- **Spawn test**: Watch wave timing, ensure no spawning when at particle budget limit

Final validation:

- Spawn 5 waves in 10 seconds, verify smooth motion and boundary interaction
- Adjust choppiness slider (if exposed), confirm spawn rate changes
- Run for 60 seconds, verify particle recycling prevents memory growth

**Decisions**

- **Chose PixiJS-native over Three.js hybrid**: Matches existing architecture, avoids dual WebGL contexts, cleaner integration with sprite masks. Uniform type sampler2D is not supported by PixiJS. Supported uniform types are: f32, i32, vec2<f32>, vec3<f32>, vec4<f32>, mat2x2<f32>, mat3x3<f32>, mat4x4<f32>, mat3x2<f32>, mat4x2<f32>, mat2x3<f32>, mat4x3<f32>, mat2x4<f32>, mat3x4<f32>, vec2<i32>, vec3<i32>, vec4<i32>
- **Chose balanced performance over aggressive**: Allows medium quality visuals while maintaining acceptable frame rates on iPad
- **Chose real-time boundaries over static**: Enables future dynamic objects (floating debris, moving obstacles) without rework
- **Chose main foam replacement only**: Keeps edge foam shader independent, reduces scope, allows iterative improvement
- **Deferred Navier-Stokes complexity**: Start with simple advection, add pressure solver/divergence correction only if visual quality requires it
