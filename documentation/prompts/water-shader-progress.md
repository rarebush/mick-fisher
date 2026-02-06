# Water Shader - Progress Summary

## Goal

Replace the flat water sprite tile with a shader-driven water surface, starting with black mask tiles + a filter that tints the black area as water color.

## Current state (working — depth gradient + noise + caustics + displacement flow)

Water surface shader masks to diamond tile pixels (area + edge) with depth gradient, Perlin noise, and optional banding. A separate procedural caustics filter on the riverbed renders animated Voronoi light patterns beneath the semi-transparent water. Both layers are wrapped in a `waterGroup` container with a `DisplacementFilter` driven by a procedural noise texture that scrolls along the isometric X axis to simulate water flow (top-left to bottom-right).

## Key files

- `src/game/rendering/sceneSetup.js` - loads tilesets, applies water surface + caustics shaders, computes depth coefficients via `computeDepthCoeffs()` helper
- `src/game/graphics/waterSystem/waterSurfaceShader.js` - water surface filter (mask, tint, depth gradient, noise, banding)
- `src/game/graphics/waterSystem/causticsShader.js` - riverbed caustics filter (animated Voronoi, depth-faded)
- `public/sprites/water.png` + `water.json` - Aseprite tileset with 3 frames: frame0 = blank, frame1 = black water body, frame2 = black with white top-right edge (wall seam)
- `.cursor/rules/pixi-filters-shaders.mdc` - documents the correct Pixi v8 filter/shader pattern
- `.cursor/rules/pixi-docs-first.mdc` - rule to check Pixi docs before writing Pixi code
- `documentation/prompts/water-rendering.md` - full multi-layer water system roadmap (for later)

## What was done

- Replaced old `isowatertest.png` tiling with `water.png`/`water.json` spritesheet (area + edge tiles in separate containers)
- Edge tiles only render on the `WORLD_Y.WATER_NEAR` row (wall seam)
- Created `waterSurfaceShader.js` with a mask-based fragment shader: black pixels get tinted to `waterColor`, white pixels pass through unchanged
- Removed the old `applyWaterSurfaceOpacity` toggle from `PixiApp.js`
- Added `preference: "webgl"` and `hello: true` to renderer init
- Added renderer debug logging (can be removed once shader is confirmed working)
- Fixed shader rectangle fill bug: added `tex.a < 0.01` early-out so transparent pixels between/around diamond tiles are not painted as water
- Added premultiplied alpha output (`color * alpha, alpha`) to match PixiJS internal format
- Set `padding: 0` on the Filter to avoid extending the filter area beyond the container bounds
- Moved filter from `waterSurfaceAreaTiles` to parent `waterSurfaceTiles` so both area and edge tiles get the water tint
- Added depth height-map: gradient darkening + opacity increase from WATER_NEAR (shallow) to WATER_FAR (deep)
- Isometric projection handled by passing screen-space near/far reference points as uniforms; shader does scalar projection onto the near→far axis
- Added procedural 2D gradient noise (2-octave fBm) for organic depth variation — generated on the fly, no texture needed
- Replaced `uNearScreenPos`/`uFarScreenPos` with `uDepthCoeffs` (vec3) — precomputed linear coefficients for exact isometric depth via 3-point solve
- Fixed precision mismatch: pass `vScreenPos` as a varying from vertex shader instead of re-declaring `uInputSize`/`uOutputFrame` in fragment
- Added `uDepthBands` uniform for optional stepped/banded depth gradient
- Extracted `computeDepthCoeffs(z, viewport)` helper in sceneSetup.js for reuse across Z-planes
- Added procedural caustics filter (`causticsShader.js`) applied to riverbed tiles: animated Voronoi cells, depth-faded, warm white tint
- Caustics animated via `tickerUpdateCaustics()` in PixiApp.js, incrementing `uTime` each frame
- Added `waterGroup` container wrapping `riverbedTiles` + `waterSurfaceTiles` with a shared `DisplacementFilter`
- Procedural 128×128 noise canvas (grey ±40 around 128) used as displacement map with REPEAT wrap mode and NEAREST scale mode
- `DisplacementFilter` from `pixi.js` applied to `waterGroup` with `scale: 4` for subtle ripple
- Displacement sprite scrolled along the isometric X direction (world -X → +X) in the ticker at 20 px/s, quantized to 24 FPS
- Flow direction derived from `projectionMetrics.screenXPerWorldUnit` / `screenYPerWorldUnit` and normalised

## Critical Pixi v8 filter lesson

Also documented in `.cursor/rules/pixi-filters-shaders.mdc`:

- You MUST explicitly create a `GlProgram` with `GlProgram.from({ vertex, fragment })` and pass it to `new Filter({ glProgram, resources })` for WebGL to work
- Use the default filter vertex from `pixijs/src/filters/defaults/defaultFilter.vert` (only has `aPosition` attribute)
- Fragment must use Pixi hybrid GLSL: `in`/`out vec4 finalColor`/`texture()`/`uniform sampler2D uTexture`
- Uniforms go in a `new UniformGroup({ ... })` passed via `resources`
- `Filter.from({ fragment })` alone does NOT create a `GlProgram`, so the filter is silently skipped on WebGL

## Next steps

1. Tune caustics params (`causticsScale`, `causticsSpeed`, `causticsIntensity`, `causticsColor`)
2. Tune water surface params (`depthDarken`, `depthBands`, `waterColor`, `waterAlpha`)
3. Tune displacement params (`scale`, `flowSpeed`, noise texture size/amplitude)
4. Add `uTime` to the water surface shader for animated ripple/shimmer
5. Follow `water-rendering.md` for cloud shadows, reflections, and rope reflection
