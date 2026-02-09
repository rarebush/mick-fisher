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

## Reflection system (sky + clouds + wall reflections)

- `reflectionShader.js` generates procedural sky gradient + FBM clouds behind wall reflection sprites
- Sky/clouds composited at full opacity first, then `uReflectionAlpha` applied to the entire composite as a single opacity multiplier — this prevents wall tiles from becoming transparent and revealing clouds behind them
- `uReflectionAlpha` is exposed as a UI slider via the game store (`reflectionAlpha` state)
- Cloud coverage mapped from `cloudCover` (0-1) to FBM `uCloudThreshold` via `0.25 - cloudCover * 0.4` — tuned so clouds appear across the full slider range

## Underwater tint (luminosity blend via ColorMatrixFilter)

Tiles below the water surface (riverbed + submerged walls) are tinted using a `ColorMatrixFilter` with a custom luminosity-blend matrix. The matrix extracts Rec. 601 luminance from each pixel and multiplies it by the water colour, so tiles inherently carry the water hue based on their brightness rather than appearing as grey tiles with a transparent colour wash on top.

```javascript
// Luminance × waterColor matrix (applied once at setup, not per-frame)
filter.matrix = [
  lr*wR, lg*wR, lb*wR, 0, 0,   // R = luminance * waterColor.r * scale
  lr*wG, lg*wG, lb*wG, 0, 0,   // G = luminance * waterColor.g * scale
  lr*wB, lg*wB, lb*wB, 0, 0,   // B = luminance * waterColor.b * scale
  0,     0,     0,     1, 0,   // Alpha unchanged
];
```

**Tuning levers:**
- `scale` parameter (default 3): brightens the result to compensate for dark water colour values
- `filter.alpha` (0-1): blends between original tile colours and the tinted result

**Filter chain order:** `[underwaterTintFilter, causticsFilter]` on riverbed — tint first so caustics add warm highlights on top of the tinted base rather than being desaturated away. Submerged walls get `[underwaterTintFilter]` only.

### Alternative considered: PixiJS advanced `luminosity` blend mode

PixiJS provides `container.blendMode = 'luminosity'` via `import 'pixi.js/advanced-blend-modes'`. This would be more performant (no render-to-texture pass — compositing happens during normal draw calls) and more accurate to true luminosity blending.

**Why it wasn't used:**
1. Requires a solid water-coloured rectangle (or diamond) behind the tiles for the blend mode to pull hue/saturation from — the riverbed is the bottom-most layer with nothing below it
2. The blend mode interacts unpredictably with filter chains: PixiJS applies container filters first (in an offscreen texture), then composites the filter output with the blend mode. The caustics filter on the riverbed means the blend mode wouldn't see the water-coloured background — it would see whatever is below the filter output
3. A diamond-shaped fill matching the water area bounds would add complexity for an uncertain interaction with the existing filter pipeline

**Revisiting:** If the caustics filter is ever removed or the filter pipeline is restructured, the blend mode approach should be reconsidered. It eliminates 2 render-to-texture operations (one per underwater container).

## UI sliders (debug controls)

Added slider controls wired to the game store and updated per-frame in `PixiApp.js`:
- **Reflection α** (`reflectionAlpha`) — controls `uReflectionAlpha` on the reflection shader
- **Water α** (`waterAlpha`) — controls `uWaterAlpha` on the water surface shader
- **Mask thresh** (`waterMaskThreshold`) — controls `uMaskThreshold` on the water surface shader
- **Cloud cover** (`cloudCover`) — mapped to `uCloudThreshold` on the reflection shader

## Key files (updated)

- `src/game/rendering/waterLayers.js` — water layer assembly, underwater tint (`applyUnderwaterTint`), shared water colours
- `src/game/rendering/reflectionLayers.js` — wall reflection textures, reflection container, sky/cloud shader setup
- `src/game/graphics/waterSystem/reflectionShader.js` — sky + clouds + wall reflection compositing shader
- `src/game/graphics/waterSystem/waterSurfaceShader.js` — water surface depth gradient, opacity, masking
- `src/game/graphics/waterSystem/causticsShader.js` — animated Voronoi caustics on riverbed
- `src/game/graphics/waterSystem/sparkleShader.js` — specular highlight overlay
- `src/game/rendering/sceneSetup.js` — orchestrates all layers, returns `environmentLayers` to PixiApp
- `src/game/PixiApp.js` — tick loop animating shader uniforms, UI slider sync
- `src/components/ui/ReflectionAlphaSlider.jsx` — reflection opacity slider
- `src/components/ui/WaterAlphaSlider.jsx` — water surface opacity slider
- `src/components/ui/WaterMaskSlider.jsx` — mask threshold slider
- `src/components/ui/CloudCoverInput.jsx` — cloud cover slider

## Next steps

1. Tune water colours (`waterColorNear`, `waterColorFar`) and underwater tint `scale` for the target art style
2. Tune caustics params (`causticsScale`, `causticsSpeed`, `causticsIntensity`, `causticsColor`)
3. Tune displacement params (`scale`, `flowSpeed`, noise texture size/amplitude)
4. Consider adding `uTime` to the water surface shader for animated ripple/shimmer
5. Revisit PixiJS `luminosity` blend mode if filter pipeline changes (see notes above)
6. Follow `water-rendering.md` for rope reflection layer
