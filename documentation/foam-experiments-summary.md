# Foam Experiments Summary

Date: 2026-02-13
Owner: rarebush/mick-fisher
Branch: main

## Goal

Explore fluid/foam current shift zones, integrate them into the foam system, and attempt a GPU-only approach for advection and rendering.

## Timeline and Outcomes

1. Baseline: splat-only particle mode

- Particles were driven directly by input splats without velocity-field advection.
- Added right-click splats for quick testing of water response.
- Added drift current, boundary collisions, and gentle radial repel for the magnet/rope.

2. Shift zone catalog and debug overlay

- Created a data catalog of shift zones (whirlpool, repel, rapid) using world-space coordinates.
- Wired shift zones into the foam coordinator.
- Added overlay drawing for shift-zone rings and labels.

3. Shift zones baked into velocity field

- Shift zones were converted into splats applied to the velocity field.
- Added clamping and scaling to reduce over-fast motion.
- Added debug overlays to visualize the velocity field.

4. Velocity field readback issues

- GPU readback returned empty buffers (length 0), so CPU sampling was invalid.
- Added CPU fallback velocity grid with decay and sampling.
- Shift zones were applied to the CPU fallback to keep them visible.

5. GPU-only density advection attempt

- Implemented a GPU foam density renderer that advects density using the velocity texture.
- Added a new density advection shader and render targets.
- Disabled particle advection and relied on density advection.
- Added filter area and safe setFromMatrix handling to fix init issues.

6. Tuning and stabilization

- Adjusted dissipation, injection alpha, density velocity scale, and particle scale.
- Added debug preview of the velocity texture to inspect the field.
- Reduced solver precompute steps and tuned solver parameters.
- Outcome: density remained blobby/static, sometimes growing, and velocity influence was weak.

7. Decision

- GPU-only density advection did not reach a stable, responsive result.
- We are returning to splat-only mode for stability.

## Key Additions and Modifications

- Shift zone data catalog and defaults.
- Foam coordinator support for shift zones and splat routing.
- Velocity field splat support and CPU fallback grid.
- GPU density advection renderer and shader.
- Debug overlays for zones and velocity visualization.
- Input splats (right-click), magnet landing/drag splats, and rope/water splats.

## Current State (after rollback request)

- Splat-only mode enabled.
- GPU density advection disabled.
- Shift zones disabled in the active foam setup (data remains for future use).
- Velocity preview disabled.

## Notes

- The GPU readback issue (zero-length pixel buffer) is still unresolved.
- The GPU density advection path exists but is inactive.
- CPU fallback velocity field remains in place for future testing.
