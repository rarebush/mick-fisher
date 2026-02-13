# Fluid Foam System Architecture

## Purpose

This document describes the intended architecture for the fluid foam system in mick-fisher. It is designed to be used as context for codebase review, so that an AI assistant (e.g. GitHub Copilot) can validate the current implementation against the described design. If the implementation deviates from what is described here, that deviation should be flagged for review.

---

## 1. System Overview

The fluid foam system renders foam particles flowing across the water surface of an isometric magnet fishing game. It combines two distinct computational layers:

1. **Eulerian grid simulation** (Navier-Stokes): Computes a 2D velocity field representing how water flows across the surface, including how flow diverts around static obstacles. This is the physics layer.
2. **Lagrangian particle advection**: Foam particles are visual tracers that sample the velocity field and move accordingly. They have no influence on the fluid physics. This is the rendering layer.

This is a standard Euler-Lagrangian hybrid approach. The grid computes the flow; the particles visualise it. The "Particle Count" control adjusts visualisation density, not simulation fidelity. Grid resolution controls simulation fidelity.

### What "grid-based" means in practice

The Navier-Stokes solver operates on a fixed 2D grid of cells. Each cell stores fluid attributes: velocity (a 2D vector), pressure (a scalar), and divergence (a scalar). Every simulation timestep, a pipeline of fragment shaders reads and writes these grid textures to solve for the next state. The grid does not move or deform; it is a fixed spatial discretisation of the water surface.

Particles exist separately. They are point entities with a position and an age. Each frame, a particle looks up the velocity at its current position in the grid (by sampling the velocity texture), moves by that velocity, and gets one frame older. When a particle reaches its maximum age or exits the domain, it recycles. Particles do not write back to the grid. They are read-only consumers of the velocity field.

When a UI control labelled "Particle Count" is present (as in the Tyler Bhadra and Pavel Dobrescu reference implementations), it controls how many of these tracer points exist. Increasing it makes the flow more visually detailed. Decreasing it makes the same flow sparser. The underlying velocity field is identical either way.

---

## 2. Coordinate Spaces

There are three coordinate spaces involved. Keeping them distinct and converting between them cleanly is the most important architectural requirement.

### 2.1 World Space (3D)

The game's authoritative coordinate system. All game objects, physics, and mechanics operate here.

```
Axes:
  X: Horizontal position (left/right, parallel to river flow)
  Y: Depth into the scene (toward the river, away from the avatar)
  Z: Height/elevation

Key elevations:
  Z = 0    Riverbed (items rest here)
  Z = 1    Water surface (foam lives here)
  Z = 3    Walkway (avatar stands here)
  Z = 4.2  Avatar hand (rod tip)

Water surface extent:
  Y = 0 (near bank, wall edge) to Y = 6 (far bank)
  X = variable (depends on viewport and river width)
```

The water surface is a horizontal plane at Z = 1. The fluid simulation operates on this plane. Foam particles exist on this plane. Their world-space positions always have Z = 1.

### 2.2 Fluid Grid UV Space (2D, normalised)

The fluid simulation's internal coordinate system. A unit square from (0, 0) to (1, 1) mapped onto the water surface plane.

```
Grid UV space:
  U = 0.0  →  left bank (minimum world X of water surface)
  U = 1.0  →  right bank (maximum world X of water surface)
  V = 0.0  →  near bank (world Y = 0, wall edge)
  V = 1.0  →  far bank (world Y = 6)
```

The grid has a discrete resolution (e.g. 160x90, 320x180, or 640x360 cells). Each cell stores velocity, pressure, and boundary state. The solver operates entirely in this UV space and has no knowledge of world coordinates, isometric projection, or screen pixels.

The velocity field texture stores 2D velocity vectors per cell. When a foam particle needs to know how fast the water is moving at its location, it converts its world position to grid UV, samples the velocity texture, and applies the result back in world space.

### 2.3 Screen Space (2D, pixels)

The final rendered output after isometric projection. The game uses dimetric projection at 26.565 degrees (arctan(0.5)), which produces a 2:1 pixel ratio for clean pixel art.

```
Projection formula:
  isoX = (worldX - worldY) * cos(26.565°)
  isoY = (worldX + worldY) * sin(26.565°) - worldZ
  screenX = isoX * pixelsPerUnit + screenXOffset
  screenY = isoY * pixelsPerUnit + screenYOffset

Where:
  pixelsPerUnit ≈ 36 (from worldConstants.js)
  screenXOffset, screenYOffset = viewport centering offsets
```

Foam particles are rendered by projecting their world-space positions through this formula, exactly the same as every other game object. The fluid system does not interact with screen space for any computational purpose. Screen space is purely a rendering concern.

### 2.4 Coordinate Conversions

There are exactly two conversions the fluid system needs:

**World → Grid UV** (for sampling the velocity field and placing boundary obstacles):

```
u = (worldX - waterMinX) / (waterMaxX - waterMinX)
v = (worldY - waterMinY) / (waterMaxY - waterMinY)
```

This is a simple linear remapping. `waterMinX`, `waterMaxX`, `waterMinY`, `waterMaxY` define the world-space bounding rectangle of the water surface.

**Grid UV → World** (for converting velocity vectors back to world-space movement):

```
worldVelocityX = gridVelocityU * (waterMaxX - waterMinX)
worldVelocityY = gridVelocityV * (waterMaxY - waterMinY)
```

The velocity sampled from the grid is in UV-per-second (or UV-per-timestep). It must be scaled by the world-space extent of the water surface to produce world-units-per-second movement.

**World → Screen** is handled by the existing projection system (`projectToScreen`, `worldToScreen` from `worldConstants.js`). The fluid system should not implement its own projection. Foam particles convert to screen space for rendering using the same path as all other game objects.

### 2.5 What to avoid

Do not perform fluid simulation math in screen space. Do not attempt to align grid cells with isometric pixel diamonds. Do not project grid UV coordinates directly to screen space. The grid is an invisible physics layer occupying the same world-space footprint as the visible river. It is axis-aligned in world space, not in screen space.

---

## 3. Navier-Stokes Grid Simulation

### 3.1 Solver Pipeline

Each simulation timestep runs the following shader passes in order, reading from and writing to grid-resolution textures:

1. **Advection**: The velocity field transports itself. Each cell traces backward along its velocity to find where the fluid came from, and copies that value forward. Uses semi-Lagrangian (implicit) advection for unconditional stability.

2. **Diffusion** (viscosity): Velocity spreads to neighbouring cells. Solved via Jacobi iteration over multiple passes. Higher viscosity = more iterations = smoother flow. For water-like behaviour, viscosity should be low.

3. **External forces**: Any forces applied this frame (user interaction, river current) are added to the velocity field.

4. **Pressure solve**: Computes the pressure field needed to enforce incompressibility (divergence-free flow). This involves:
   - Computing divergence of the velocity field
   - Solving the Poisson pressure equation via Jacobi iteration
   - Subtracting the pressure gradient from the velocity field

5. **Boundary enforcement**: Applies boundary conditions at obstacle cells and domain edges. No-slip velocity conditions (boundary cells get negative average of adjacent fluid cell velocities) and pure Neumann pressure conditions (boundary cells get average pressure of adjacent fluid cells).

All of these operate on the full grid every timestep. Even if nothing is disturbing the field, the shaders still run. However, when the field has converged to a steady state (no external forces, velocity has dissipated or reached equilibrium), the computation cost is a fixed baseline determined by grid resolution, since the GPU is multiplying near-zero or stable values.

### 3.2 Texture Ping-Pong

Each attribute field (velocity, pressure) uses a pair of textures (read and write buffers). After each shader pass writes to the write buffer, the buffers are swapped so the next pass reads the updated values. This is necessary because WebGL cannot simultaneously read from and write to the same texture.

### 3.3 Grid Resolution

The grid resolution determines simulation fidelity and cost. Recommended presets:

- Low: 160 x 90 (fast, coarse flow patterns)
- Medium: 320 x 180 (good balance)
- High: 640 x 360 (detailed, matches base render resolution)

The grid resolution is independent of the screen resolution and the particle count.

---

## 4. Precompute and Caching Strategy

The full Navier-Stokes solver does not need to run every frame during normal gameplay. The key insight is that the water flow in mick-fisher has long periods of steady state punctuated by infrequent changes.

### 4.1 When to run the solver

The solver should run to convergence (until the velocity field stabilises) in these situations:

- **Initialisation**: When a scene loads, compute the steady-state flow field for the current river speed and static obstacle configuration.
- **River speed change**: When a game event changes the river current, re-run the solver to converge on the new steady state.
- **Scene reconfiguration**: If static obstacles (logs, lily pads) are added, removed, or repositioned between casts.
- **Dynamic object enters water** (optional, advanced): When the magnet splashes down or the rope drags through water, the solver could run temporarily to compute local perturbation, then cache the result once the disturbance settles.

### 4.2 When not to run the solver

During normal gameplay when the river speed is constant and obstacles are static, the solver should be dormant. The cached velocity field texture is sufficient. Foam particles sample from this cached texture every frame, which costs only texture lookups, not full simulation passes.

### 4.3 Smooth transitions

When the velocity field needs to update (e.g. river speed change), you can blend between the old cached field and the new converging field over several frames. This prevents foam particles from snapping abruptly to new flow patterns. The particles will naturally adjust as they sample the shifting velocity values.

### 4.4 Cost summary

- **Solver running**: Full shader pipeline per timestep. Cost scales with grid resolution and Jacobi iteration count. Comparable to running a separate WebGL render pass pipeline.
- **Solver dormant** (normal gameplay): Zero simulation cost. Only particle advection runs, which is a texture sample + position update per particle per frame.
- **Particle rendering**: Cost scales with particle count. Each particle needs a velocity texture sample, position update, age increment, and point sprite render.

---

## 5. Foam Particle System

### 5.1 Particle Lifecycle

Each foam particle has:

- **Position** (world X, world Y; Z is always WATER_SURFACE)
- **Age** (time since spawn, in seconds or frames)
- **Maximum age** (lifespan, after which the particle recycles)
- **Alpha/opacity** (derived from age, fades over lifetime)

Lifecycle stages:

1. **Spawn**: Particle is placed at a spawn position with age = 0 and full opacity.
2. **Advection**: Each frame, the particle's world position is converted to grid UV, the velocity texture is sampled, the velocity is converted back to world space, and the particle moves.
3. **Ageing**: Age increments. Opacity decreases (linear or exponential fade curve).
4. **Wrapping**: If a particle exits the water surface bounds (e.g. flows past the right bank), it wraps to the opposite side, or recycles.
5. **Recycling**: When age exceeds maximum, or the particle leaves the domain without wrapping, it resets to a new spawn position with age = 0.

### 5.2 Spawning

Foam spawns in waves at configurable intervals. Spawn positions are near the upstream edge (left bank in the current setup). The game's "choppiness" value influences spawn rate: choppier water = more frequent wave spawns. The game's "flowSpeed" value influences particle movement speed.

### 5.3 Particle Pool

A fixed-size pool of particles (e.g. 10,000) is allocated at initialisation. No particles are created or destroyed at runtime; they are recycled. This avoids garbage collection pressure.

### 5.4 CPU vs GPU Particle Updates

The current implementation updates particles on the CPU each frame. This is adequate for moderate particle counts (5,000-10,000). For higher counts, particle state (positions, ages) can be moved to GPU textures and updated via fragment shaders, similar to the Tyler Bhadra reference implementation where particle positions and ages are stored in textures and updated by simulation shaders.

In the GPU approach:

- Particle positions are stored in a texture (particle_span x particle_span, where particle_span = sqrt(particle_count)).
- A simulation shader reads each particle's position, samples the velocity field, computes the new position, and writes it to the output texture.
- A separate ageing shader increments age and handles recycling (resetting to initial position when max age is reached).
- A render shader reads particle positions and draws point sprites.

---

## 6. Boundary System (Obstacles)

### 6.1 Boundary Texture

Obstacles on the water surface (logs, lily pads, debris) are represented in the fluid simulation as a boundary texture. This is a grid-resolution texture where each cell is either fluid (0) or boundary (1).

The solver uses this texture during the boundary enforcement step to apply no-slip velocity conditions and Neumann pressure conditions at obstacle cells. Flow naturally diverts around obstacles without explicit pathfinding or steering logic.

### 6.2 Placing Obstacles on the Boundary Texture

Water surface objects are 2D sprites positioned in screen space and are effectively unaware of the isometric projection. They have artwork that includes a water-surface cross-section drawn as part of the spritesheet, but mapping that screen-space sprite mask back to grid UV space requires inverting the isometric projection, which is error-prone and not worth the effort.

**The adopted approach**: Use the object's world-space coordinates (which are known, since all game objects are positioned in world space) to stamp a simplified primitive shape onto the boundary texture. For a tree log, this is a circle. For an elongated object, it could be an ellipse or rounded rectangle.

The process:

1. Get the object's world position (X, Y at Z = 1, the water surface).
2. Convert to grid UV using the world-to-UV mapping.
3. Stamp a filled circle (or other primitive) of appropriate radius at that UV coordinate on the boundary texture.
4. Repeat for all static water surface objects.

This produces a boundary texture that approximates the obstacle footprints well enough that foam flows around them convincingly. The exact silhouette of the sprite's waterline cross-section versus a circle approximation is not visually distinguishable when foam particles are flowing around it.

### 6.3 When to update the boundary texture

For static obstacles (always present, never moving), the boundary texture is built once at scene initialisation and does not change.

If obstacles can appear or disappear (e.g. between casts, or as a game event), the boundary texture should be rebuilt when the configuration changes, and the velocity field should be re-solved to convergence with the new boundaries. This pairs with the precompute strategy in Section 4.

### 6.4 Boundary conditions in the solver

When the solver runs, two boundary shaders enforce conditions after the main simulation passes:

**Velocity boundaries (no-slip)**: For each boundary cell, sample the velocity of all adjacent fluid cells. Set the boundary cell's velocity to the negative average of those neighbours. This ensures fluid does not flow through obstacles and creates realistic flow separation.

**Pressure boundaries (pure Neumann)**: For each boundary cell, set its pressure to the average of adjacent fluid cell pressures. This prevents pressure discontinuities at obstacle edges.

These shaders reference the boundary texture to determine which cells are boundary and which are fluid.

---

## 7. River Current as External Force

The base river flow is an external force applied to the velocity field. In the simplest case, this is a uniform rightward (positive U direction in grid space) force applied every solver timestep. The magnitude corresponds to the game's river speed setting.

When the solver converges to steady state with this force and the boundary obstacles, the result is a velocity field where:

- Open areas have roughly uniform rightward flow
- Flow accelerates through narrow gaps between obstacles
- Eddies or stagnation zones form behind obstacles (depending on viscosity and solver resolution)
- Near-bank areas may have slightly different flow if boundaries are present

This steady-state field is what gets cached and sampled by particles during normal gameplay.

When river speed changes due to a game event, the external force magnitude changes, the solver re-runs, and a new steady state is reached.

---

## 8. Integration Points with Existing Systems

The fluid foam system integrates with the game through the following touchpoints. These are the interfaces where the fluid system reads from or writes to external game systems:

### Inputs (read from game state)

- **Water surface bounds**: World-space extent of the water surface (X range, Y range from worldConstants). Defines the mapping between world space and grid UV.
- **Water object positions**: World-space positions of static surface objects (logs, lily pads, etc.) from whatever system manages water surface object placement. Used to build the boundary texture.
- **River speed / choppiness**: Game state values that control external force magnitude and particle spawn rate. Read from game state store (Zustand).
- **Viewport**: Screen dimensions and projection parameters from `createViewport()`. Used only at the rendering stage to project particle world positions to screen positions.

### Outputs (written to rendering pipeline)

- **Foam particle positions and opacity**: World-space (X, Y) positions and alpha values for each active particle. These are projected to screen space and rendered as sprites in the water surface layer stack, between the reflections layer and the edge foam layer.

### Does not interact with

- Screen-space sprite masks or sprite artwork
- The isometric projection system (except at final render time, through the standard projection path)
- The rope physics system (future: the rope could be a dynamic boundary, but this is not in current scope)
- The riverbed or items-on-riverbed layers (foam is strictly a surface effect)

---

## 9. File Structure (Expected)

Based on the system's separation of concerns, the implementation should be organised as:

```
fluidSystem/
  FluidFoamCoordinator.js    - Orchestrator: manages solver lifecycle, spawn waves,
                                calls particle updates, triggers precompute
  FluidVelocityField.js      - Manages the 2D velocity field grid, owns the solver
                                pipeline (advection, diffusion, pressure, boundary
                                shaders), handles precompute and caching
  FluidParticleState.js       - Particle pool: positions, ages, advection logic
                                (sample velocity field, update positions, recycle)
  FluidParticleRenderer.js    - Rendering: takes particle world positions + alpha,
                                projects to screen, renders as sprites via PixiJS
  FluidBoundaryTexture.js     - Builds the boundary texture from water object
                                world positions using primitive shapes
```

Key architectural rules:

- `FluidVelocityField` should have no knowledge of particles, screen space, or PixiJS. It is a pure WebGL simulation that takes a boundary texture and external forces and produces a velocity field texture.
- `FluidParticleState` should have no knowledge of screen space or rendering. It operates in world space, converting to grid UV only to sample the velocity texture.
- `FluidParticleRenderer` should have no knowledge of the grid simulation. It receives world-space positions and projects them for display.
- `FluidBoundaryTexture` should convert world positions to grid UV and stamp primitives. It does not interact with sprite artwork or screen-space masks.
- `FluidFoamCoordinator` is the only component that knows about all the others and orchestrates their interaction.

---

## 10. Reference Implementations

Two reference implementations informed this architecture. Both are included in the project's documentation/fluid_collision directory.

### Pavel Dobrescu (PavelDoGreat) - WebGL Fluid Simulation

Source: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation

A pure WebGL Navier-Stokes fluid simulation. Uses dye advection textures as the primary visual output rather than discrete particles. Demonstrates the core solver pipeline (advection, curl/vorticity, pressure, gradient subtraction) in a single-file implementation. This is a good reference for the solver shader code.

### Tyler Bhadra et al. - 2D Fluid Collision Simulator

Source: https://tylerbhadra.github.io/Fluid_Collision_Sim/
Writeup: https://tylerbhadra.github.io/Fluid_Collision_Sim/ (CS 184 project page)

Built with Three.js and WebGL. Implements the full Euler-Lagrangian hybrid: Navier-Stokes grid simulation plus a particle visualisation layer on top. Also implements arbitrary boundary conditions (user-drawn obstacles with no-slip velocity and Neumann pressure enforcement). This is the closest reference to mick-fisher's intended architecture, particularly for the boundary system and the particle advection approach.

Key quote from Tyler's writeup: "We also created a particle simulation on top of the 2D attribute grid to better display the movement of the fluid." This confirms the particles are purely visualisation and do not participate in the fluid physics.

---

## 11. Validation Checklist

When reviewing the codebase against this document, verify:

1. **Coordinate separation**: The fluid solver operates in grid UV space only. No world coordinates or screen coordinates inside solver shaders or solver management code.

2. **Conversion correctness**: World-to-UV and UV-to-world conversions use the water surface world bounds. No isometric projection math appears in the fluid system except at the final rendering step.

3. **Particle independence**: Particles read from the velocity field but never write to it. Particle count has no effect on simulation behaviour.

4. **Boundary approach**: Obstacles are placed on the boundary texture using world-to-UV converted positions with primitive shapes (circles, ellipses), not by projecting screen-space sprite masks.

5. **Precompute capability**: The solver can run to convergence independently of the frame loop, cache its result, and go dormant. Particles can sample from a cached (static) velocity texture without the solver running.

6. **Solver completeness**: All five stages are present (advection, diffusion, external forces, pressure solve with divergence + Jacobi + gradient subtraction, boundary enforcement). Missing any stage will produce incorrect flow behaviour.

7. **Texture ping-pong**: Each attribute field uses read/write buffer pairs that swap after each shader pass.

8. **No screen-space physics**: No part of the fluid simulation, particle advection, or boundary placement operates in screen-space pixel coordinates.

9. **Integration via world space**: Foam particles are rendered by projecting their world positions through the standard game projection system (`worldToScreen` / `projectToScreen`), not through a custom rendering path.

10. **Solver triggers**: The solver runs at initialisation, on river speed change, and on obstacle configuration change. It does not run every frame during steady-state gameplay.
