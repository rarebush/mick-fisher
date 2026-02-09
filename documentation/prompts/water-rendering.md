# Water Rendering System Implementation Guide

## Context & World Space

You are implementing a multi-layered water rendering system for a 2.5D fishing game using PixiJS. The game uses **dimetric projection** (26.565°) to project 3D world coordinates to 2D screen space.

### World Space Geometry

```javascript
// From worldConstants.js - DO NOT MODIFY
export const WORLD_X = {
  MIN: -4, // Left bank
  MAX: 4, // Right bank
  WIDTH: 8, // Total river width
};

export const WORLD_Y = {
  WATER_NEAR: 0, // Where water begins (at wall)
  WATER_FAR: 6, // Far edge of water (extends into scene)
};

export const WORLD_Z = {
  RIVERBED: 0, // Bottom surface (Z=0)
  WATER_SURFACE: 1, // Top of water (Z=1)
  WALKWAY: 3, // Where avatar stands
  AVATAR_HAND: 4.5, // Cast origin height
};
```

**Key Facts:**

- River is **8 units wide (X)** × **6 units deep (Y)** × **1 unit tall (Z)**
- Riverbed is **completely flat** in world space (no actual depth variation)
- Water meets vertical wall at Y=0 (no beach/shoreline)
- Dimensions may change during development - all sizing must be **dynamic**

### Projection Details

- **Dimetric angle:** 26.565° (arctan(0.5))
- **Pixels per unit:** ~36 pixels
- **Ground tile size:** 64×32 pixels (standard pixel art isometric)
- **Render order:** Back to front (items at higher Y render first)

---

## System Architecture

### Layer Stack (Bottom to Top)

```
7. Rope Reflection (TODO — mirrored rope sprite + distortion)
6. Sparkle Overlay (specular highlights, topmost water effect)
5. Reflections (procedural sky gradient + FBM clouds + wall reflection sprites)
4. Water Surface (semi-transparent depth-gradient tint with masking)
3. Submerged Wall Tiles (bottom wall portion, luminosity-tinted)
2. Riverbed Tiles (luminosity-tinted + animated Voronoi caustics)
1. [Implicit] Water-coloured background (NOT rendered — see note below)
```

**Current rendering pipeline:**

1. Riverbed tiles rendered with underwater luminosity tint (ColorMatrixFilter), then caustics filter adds animated Voronoi light patterns on top
2. Submerged wall tiles rendered with underwater luminosity tint (same ColorMatrixFilter)
3. Water surface tiles rendered with depth-gradient shader (near-to-far colour + opacity + noise + banding)
4. Reflection container rendered with procedural sky/clouds composited behind wall reflection sprites, controlled by `uReflectionAlpha`
5. Sparkle tiles rendered with specular highlight shader
6. All of the above wrapped in `waterGroup` with a shared `DisplacementFilter` for water flow animation

**Underwater tint approach:**

Tiles below the water surface use a `ColorMatrixFilter` with a luminosity-blend matrix that maps pixel luminance to the water colour (`waterColorNear * scale`). This makes tiles inherently carry the water hue based on their brightness. Filter chain order on riverbed: `[underwaterTintFilter, causticsFilter]` — tint first so caustics add warm highlights on top.

**Alternative: PixiJS `luminosity` blend mode** (`import 'pixi.js/advanced-blend-modes'`):
More performant (no render-to-texture) and more accurate, but requires a water-coloured background shape behind the tiles for the blend mode to pull hue/saturation from. Not currently used because: (a) the riverbed is the bottom-most layer with nothing behind it, and (b) the blend mode interacts unpredictably with the caustics filter chain (filters render to offscreen texture first, then blend mode composites the output). Revisit if the filter pipeline changes.

---

## Layer 1: Riverbed with Simulated Depth

### Purpose

Create illusion of depth variation on flat riverbed using procedurally generated heightmap.

### Implementation Steps

**Step 1.1: Integrate Perlin Noise Library**

Use this library: https://github.com/blackears/PerlinNoiseMaker/blob/master/noiseMaker.js

Create: `src/game/graphics/waterSystem/perlinNoise.js`

```javascript
// Copy the PerlinNoise class from the library above
// Export it for use in heightmap generation
export class PerlinNoise {
  // ... (paste library code here)
}
```

**Step 1.2: Create Heightmap Generator**

Create: `src/game/graphics/waterSystem/heightmapGenerator.js`

```javascript
import { PerlinNoise } from "./perlinNoise.js";

/**
 * Generate a heightmap texture for simulated riverbed depth.
 * Combines linear gradient (shallow near → deep far) with Perlin noise for natural variation.
 *
 * @param {number} worldWidth - River width in world units (e.g., 8 from WORLD_X.WIDTH)
 * @param {number} worldDepth - River depth in world units (e.g., 6 from WORLD_Y.WATER_FAR)
 * @param {number} pixelsPerUnit - Viewport pixels per world unit (~36)
 * @returns {PIXI.Texture} Grayscale texture (0=shallow, 1=deep)
 */
export function generateRiverbedHeightMap(
  worldWidth,
  worldDepth,
  pixelsPerUnit
) {
  // Calculate texture dimensions
  const width = Math.ceil(worldWidth * pixelsPerUnit);
  const height = Math.ceil(worldDepth * pixelsPerUnit);

  // Create canvas for texture generation
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);

  // Initialize Perlin noise generator
  const noise = new PerlinNoise();
  noise.setSeed(Math.random()); // Random seed for variation

  // Generate heightmap
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Linear gradient: 0 at top (Y=0, near) → 1 at bottom (Y=6, far)
      const depthGradient = y / height;

      // Perlin noise for natural undulation
      const noiseScale = 0.05; // Adjust for detail (lower = larger features)
      const noiseValue = noise.noise(x * noiseScale, y * noiseScale, 0);
      // Perlin returns [-1, 1], normalize to [0, 1]
      const normalizedNoise = (noiseValue + 1) * 0.5;
      const noiseMod = (normalizedNoise - 0.5) * 0.2; // ±10% variation

      // Combine: gradient dominates, noise adds subtle variation
      const heightValue = Math.max(0, Math.min(1, depthGradient + noiseMod));

      // Write grayscale value to all RGB channels
      const idx = (y * width + x) * 4;
      const gray = Math.floor(heightValue * 255);
      imageData.data[idx] = gray; // R
      imageData.data[idx + 1] = gray; // G
      imageData.data[idx + 2] = gray; // B
      imageData.data[idx + 3] = 255; // A (fully opaque)
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to PixiJS texture
  return PIXI.Texture.from(canvas);
}
```

**Step 1.3: Create Depth Gradient Shader**

Create: `src/game/graphics/waterSystem/shaders/depthGradient.frag`

```glsl
// Fragment shader for depth-based color interpolation
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;     // Not used, but required by PixiJS
uniform sampler2D heightMap;    // Our generated heightmap
uniform vec3 shallowColor;      // Light blue (near water)
uniform vec3 deepColor;         // Dark blue (far water)

void main() {
    // Sample heightmap (grayscale: 0=shallow, 1=deep)
    float depth = texture2D(heightMap, vTextureCoord).r;

    // Interpolate between shallow and deep colors
    vec3 color = mix(shallowColor, deepColor, depth);

    gl_FragColor = vec4(color, 1.0);
}
```

Create: `src/game/graphics/waterSystem/depthGradientShader.js`

```javascript
import * as PIXI from "pixi.js";
import depthFragmentShader from "./shaders/depthGradient.frag";

/**
 * Create depth gradient shader for riverbed.
 * @param {PIXI.Texture} heightMap - Generated heightmap texture
 * @param {Array<number>} shallowColor - RGB [0-1] for shallow water
 * @param {Array<number>} deepColor - RGB [0-1] for deep water
 * @returns {PIXI.Filter}
 */
export function createDepthGradientShader(heightMap, shallowColor, deepColor) {
  return new PIXI.Filter(null, depthFragmentShader, {
    heightMap: heightMap,
    shallowColor: shallowColor,
    deepColor: deepColor,
  });
}
```

**Step 1.4: Setup Riverbed Sprite**

In your main water setup (e.g., `src/game/graphics/waterLayers.js`):

```javascript
import { WORLD_X, WORLD_Y, WORLD_Z } from "../mechanics/worldConstants.js";
import {
  createViewport,
  getSurfaceScreenBounds,
} from "../mechanics/worldConstants.js";
import { generateRiverbedHeightMap } from "./waterSystem/heightmapGenerator.js";
import { createDepthGradientShader } from "./waterSystem/depthGradientShader.js";

export function setupRiverbedLayer(app) {
  const viewport = createViewport(app.screen.width, app.screen.height);

  // Generate heightmap based on current world dimensions
  const heightMap = generateRiverbedHeightMap(
    WORLD_X.WIDTH, // 8 units
    WORLD_Y.WATER_FAR, // 6 units
    viewport.pixelsPerUnit // ~36 pixels/unit
  );

  // Get screen bounds for riverbed surface (Z=0)
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

  // Create sprite covering riverbed area
  const riverbedSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  riverbedSprite.x = riverbedBounds.left;
  riverbedSprite.y = riverbedBounds.top;
  riverbedSprite.width = riverbedBounds.right - riverbedBounds.left;
  riverbedSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  // Apply depth gradient shader
  const depthShader = createDepthGradientShader(
    heightMap,
    [0.48, 0.64, 0.72], // Shallow: light blue (adjust per location)
    [0.29, 0.36, 0.44] // Deep: dark blue
  );

  riverbedSprite.filters = [depthShader];

  return { riverbedSprite, heightMap, riverbedBounds };
}
```

**Testing Step 1:**

- You should see blue water that gets darker from top (near wall) to bottom (far edge)
- Subtle undulation from Perlin noise should be visible
- Changing `WORLD_X.WIDTH` or `WORLD_Y.WATER_FAR` and regenerating should scale appropriately

---

## Layer 2: Cloud Shadows (Procedural, on Riverbed)

### Purpose

Dark patches drifting across riverbed, simulating overhead clouds blocking light.

### Implementation Steps

**Step 2.1: Create Noise Function for Shaders**

Create: `src/game/graphics/waterSystem/shaders/noise2D.glsl`

```glsl
// 2D Simplex noise function
// Source: https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                        0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                       -0.577350269189626,  // -1.0 + 2.0 * C.x
                        0.024390243902439); // 1.0 / 41.0
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}
```

**Step 2.2: Create Cloud Shadow Shader**

Create: `src/game/graphics/waterSystem/shaders/cloudShadow.frag`

```glsl
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;        // Riverbed texture
uniform float time;                // Animation time
uniform vec2 cloudSpeed;           // Movement speed (e.g., [0.0, 0.02])
uniform float cloudScale;          // Pattern scale (e.g., 3.0)
uniform float shadowIntensity;     // Darkening strength (e.g., 0.25)

// Include noise function (paste noise2D.glsl contents here or use #include if supported)
// ... (paste snoise function from above)

void main() {
    // Calculate cloud UV with movement
    // Note: cloudSpeed.y is positive to move bottom→top in screen space
    vec2 cloudUV = vTextureCoord * cloudScale + cloudSpeed * time;

    // Two octaves of noise for cloud-like pattern
    float cloud1 = snoise(cloudUV);
    float cloud2 = snoise(cloudUV * 2.0);

    // Combine octaves (weighted)
    float cloudPattern = cloud1 * 0.6 + cloud2 * 0.4;

    // Threshold to create cloud shapes (not uniform noise)
    // smoothstep creates soft edges
    cloudPattern = smoothstep(0.3, 0.7, cloudPattern);

    // Get base riverbed color
    vec4 baseColor = texture2D(uSampler, vTextureCoord);

    // Darken by cloud shadow
    vec3 shadowedColor = baseColor.rgb * (1.0 - cloudPattern * shadowIntensity);

    gl_FragColor = vec4(shadowedColor, baseColor.a);
}
```

Create: `src/game/graphics/waterSystem/cloudShadowShader.js`

```javascript
import * as PIXI from "pixi.js";
import cloudShadowFragmentShader from "./shaders/cloudShadow.frag";

/**
 * Create cloud shadow shader for riverbed.
 * @param {Object} options
 * @param {Array<number>} options.cloudSpeed - [x, y] movement (y should be positive for bottom→top)
 * @param {number} options.cloudScale - Pattern scale (larger = bigger clouds)
 * @param {number} options.shadowIntensity - Darkening amount (0-1)
 * @returns {PIXI.Filter}
 */
export function createCloudShadowShader(options = {}) {
  return new PIXI.Filter(null, cloudShadowFragmentShader, {
    time: 0,
    cloudSpeed: options.cloudSpeed || [0.0, 0.02], // Move bottom→top
    cloudScale: options.cloudScale || 3.0,
    shadowIntensity: options.shadowIntensity || 0.25,
  });
}
```

**Step 2.3: Apply to Riverbed**

Update your riverbed setup:

```javascript
import { createCloudShadowShader } from "./waterSystem/cloudShadowShader.js";

export function setupRiverbedLayer(app) {
  // ... (previous riverbed setup)

  // Create cloud shadow shader
  const cloudShadowShader = createCloudShadowShader({
    cloudSpeed: [0.0, 0.02], // Move north (bottom→top in screen space)
    cloudScale: 3.0,
    shadowIntensity: 0.25,
  });

  // Apply both depth gradient AND cloud shadows
  riverbedSprite.filters = [depthShader, cloudShadowShader];

  // Animate cloud shadows in game loop
  app.ticker.add((delta) => {
    cloudShadowShader.uniforms.time += delta * 0.016; // 60 FPS → 0.016s per frame
  });

  return { riverbedSprite, heightMap, riverbedBounds, cloudShadowShader };
}
```

**Testing Step 2:**

- Dark patches should drift from bottom to top of screen
- Patches should have soft, cloud-like edges
- Movement should be slow and smooth

---

## Layer 3: Caustics (Tileable Texture)

### Purpose

Shimmering light patterns on riverbed, faded by depth.

### Implementation Steps

**Step 3.1: Create Caustics Shader**

Create: `src/game/graphics/waterSystem/shaders/caustics.frag`

```glsl
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;        // Not used
uniform sampler2D causticsTex;     // Your tileable caustics texture
uniform sampler2D heightMap;       // Same heightmap from riverbed
uniform float time;                // Animation time
uniform vec2 tiling;               // How many times to repeat (e.g., [4.0, 4.0])
uniform vec2 scrollSpeed;          // UV scroll speed (e.g., [0.02, 0.015])
uniform float baseOpacity;         // Base visibility (e.g., 0.3)

void main() {
    // Scroll UVs for animation
    vec2 causticsUV = vTextureCoord * tiling + scrollSpeed * time;

    // Sample caustics texture (tiling wraps automatically)
    vec4 caustics = texture2D(causticsTex, causticsUV);

    // Get depth from heightmap
    float depth = texture2D(heightMap, vTextureCoord).r;

    // Fade caustics with depth (shallow = bright, deep = dim)
    float visibility = 1.0 - depth;
    float finalOpacity = baseOpacity * visibility;

    gl_FragColor = vec4(caustics.rgb, caustics.a * finalOpacity);
}
```

Create: `src/game/graphics/waterSystem/causticsShader.js`

```javascript
import * as PIXI from "pixi.js";
import causticsFragmentShader from "./shaders/caustics.frag";

/**
 * Create caustics shader.
 * @param {PIXI.Texture} causticsTexture - Your tileable caustics texture
 * @param {PIXI.Texture} heightMap - Same heightmap from riverbed
 * @param {Object} options
 * @returns {PIXI.Filter}
 */
export function createCausticsShader(causticsTexture, heightMap, options = {}) {
  // Ensure texture wraps/repeats
  causticsTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

  return new PIXI.Filter(null, causticsFragmentShader, {
    causticsTex: causticsTexture,
    heightMap: heightMap,
    time: 0,
    tiling: options.tiling || [4.0, 4.0],
    scrollSpeed: options.scrollSpeed || [0.02, 0.015],
    baseOpacity: options.baseOpacity || 0.3,
  });
}
```

**Step 3.2: Setup Caustics Layer**

```javascript
import { createCausticsShader } from "./waterSystem/causticsShader.js";

export function setupCausticsLayer(app, riverbedBounds, heightMap) {
  // Load your caustics texture
  const causticsTexture = PIXI.Texture.from("path/to/caustics.png");

  // Create sprite covering same area as riverbed
  const causticsSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  causticsSprite.x = riverbedBounds.left;
  causticsSprite.y = riverbedBounds.top;
  causticsSprite.width = riverbedBounds.right - riverbedBounds.left;
  causticsSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  // Apply caustics shader
  const causticsShader = createCausticsShader(causticsTexture, heightMap, {
    tiling: [4.0, 4.0], // Repeat 4x across river
    scrollSpeed: [0.02, 0.015], // Slow diagonal scroll
    baseOpacity: 0.3,
  });

  causticsSprite.filters = [causticsShader];
  causticsSprite.blendMode = PIXI.BLEND_MODES.ADD; // Additive for light effect

  // Animate in game loop
  app.ticker.add((delta) => {
    causticsShader.uniforms.time += delta * 0.016;
  });

  return { causticsSprite, causticsShader };
}
```

**Testing Step 3:**

- Light patterns should shimmer across riverbed
- Patterns should be brighter near top (shallow) and dimmer at bottom (deep)
- Slow scrolling animation should be visible

---

## Layer 4: Water Distortion (DuDv Displacement + Pixel Snap)

### Purpose

Create wavy water effect that distorts all underlying layers, then snap to 2×2 pixel grid.

### Implementation Steps

**Step 4.1: Setup DuDv Displacement Filter**

```javascript
export function setupWaterDistortion(app, riverbedBounds) {
  // Load your DuDv map texture
  const dudvTexture = PIXI.Texture.from("path/to/dudv.png");
  dudvTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

  // Create sprite for displacement map (not visible, just drives distortion)
  const dudvSprite = new PIXI.Sprite(dudvTexture);
  dudvSprite.width = riverbedBounds.right - riverbedBounds.left;
  dudvSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  // Create displacement filter
  const displacementFilter = new PIXI.DisplacementFilter(dudvSprite);
  displacementFilter.scale.x = 20; // Horizontal distortion strength
  displacementFilter.scale.y = 20; // Vertical distortion strength

  // Animate DuDv sprite to create ripple motion
  app.ticker.add((delta) => {
    dudvSprite.x += 0.5 * delta; // Drift right
    dudvSprite.y += 0.3 * delta; // Drift down
  });

  return { displacementFilter, dudvSprite };
}
```

**Step 4.2: Create Pixel Snap Shader**

Create: `src/game/graphics/waterSystem/shaders/pixelSnap.frag`

```glsl
// Snap distorted pixels to 2×2 grid for chunky pixel art look
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec2 pixelSize;      // Size of pixel blocks (e.g., [2.0, 2.0])
uniform vec2 textureSize;    // Texture dimensions in pixels

void main() {
    // Round to nearest pixel block
    vec2 pixelCoord = floor(vTextureCoord * textureSize / pixelSize) * pixelSize;

    // Sample from center of pixel block
    vec2 centerCoord = (pixelCoord + pixelSize * 0.5) / textureSize;

    gl_FragColor = texture2D(uSampler, centerCoord);
}
```

Create: `src/game/graphics/waterSystem/pixelSnapShader.js`

```javascript
import * as PIXI from "pixi.js";
import pixelSnapFragmentShader from "./shaders/pixelSnap.frag";

/**
 * Create pixel snap shader for chunky pixel art.
 * @param {number} textureWidth - Texture width in pixels
 * @param {number} textureHeight - Texture height in pixels
 * @param {number} pixelSize - Block size (default: 2 for 2×2 blocks)
 * @returns {PIXI.Filter}
 */
export function createPixelSnapShader(
  textureWidth,
  textureHeight,
  pixelSize = 2
) {
  return new PIXI.Filter(null, pixelSnapFragmentShader, {
    pixelSize: [pixelSize, pixelSize],
    textureSize: [textureWidth, textureHeight],
  });
}
```

**Step 4.3: Combine Riverbed + Caustics into Water Container**

```javascript
export function setupWaterContainer(
  app,
  riverbedSprite,
  causticsSprite,
  riverbedBounds
) {
  // Create container for all water layers
  const waterContainer = new PIXI.Container();
  waterContainer.addChild(riverbedSprite, causticsSprite);

  // Setup distortion
  const { displacementFilter, dudvSprite } = setupWaterDistortion(
    app,
    riverbedBounds
  );

  // Setup pixel snap
  const pixelSnapShader = createPixelSnapShader(
    riverbedBounds.right - riverbedBounds.left,
    riverbedBounds.bottom - riverbedBounds.top,
    2 // 2×2 pixel blocks
  );

  // Apply filters: displacement FIRST, then pixel snap
  waterContainer.filters = [displacementFilter, pixelSnapShader];

  return { waterContainer, displacementFilter, pixelSnapShader };
}
```

**Testing Step 4:**

- Water should appear wavy/rippled
- Distortion should affect both riverbed colors and caustics
- Pixels should snap to 2×2 grid (chunky, not smooth)

---

## Layer 5: Cloud Reflections (Procedural, on Surface)

### Purpose

Bright patches on water surface mirroring overhead clouds, **offset from shadows**.

### Critical Offset Calculation

**Physics:** Clouds moving north (bottom→top in screen space) cast shadows **before** appearing in reflections.

**Offset formula:**

```
Cloud height above water = 50 world units (arbitrary, controls offset magnitude)
Water surface at Y=0 (near) to Y=6 (far)

Reflection offset in screen space:
  offsetY = cloudHeight * sin(26.565°) * pixelsPerUnit
  offsetY ≈ 50 * 0.447 * 36 ≈ 804 pixels

Simplified: Use fixed pixel offset based on desired lag
```

### Implementation Steps

**Step 5.1: Create Cloud Reflection Shader**

Create: `src/game/graphics/waterSystem/shaders/cloudReflection.frag`

```glsl
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform float time;
uniform vec2 cloudSpeed;           // Same as shadows: [0.0, 0.02]
uniform float cloudScale;          // Same as shadows: 3.0
uniform float reflectionIntensity; // Brightening amount (e.g., 0.15)
uniform float reflectionOffset;    // Y-offset in UV space (e.g., 0.3)

// Include noise function (same as cloud shadows)
// ... (paste snoise function)

void main() {
    // CRITICAL: Apply Y-offset to simulate clouds being "ahead" of their shadows
    vec2 offsetCoord = vTextureCoord;
    offsetCoord.y -= reflectionOffset; // Move UV up (clouds appear "north" of shadows)

    // Calculate cloud UV with movement (same speed as shadows)
    vec2 cloudUV = offsetCoord * cloudScale + cloudSpeed * time;

    // Two octaves of noise (identical to shadows)
    float cloud1 = snoise(cloudUV);
    float cloud2 = snoise(cloudUV * 2.0);
    float cloudPattern = cloud1 * 0.6 + cloud2 * 0.4;
    cloudPattern = smoothstep(0.3, 0.7, cloudPattern);

    // Brighten instead of darken
    vec4 baseColor = texture2D(uSampler, vTextureCoord);
    vec3 brightened = baseColor.rgb + vec3(cloudPattern * reflectionIntensity);

    gl_FragColor = vec4(brightened, baseColor.a);
}
```

Create: `src/game/graphics/waterSystem/cloudReflectionShader.js`

```javascript
import * as PIXI from "pixi.js";
import cloudReflectionFragmentShader from "./shaders/cloudReflection.frag";

/**
 * Create cloud reflection shader.
 * CRITICAL: Must use same cloudSpeed and cloudScale as shadow shader!
 * @param {Object} options
 * @param {number} options.reflectionOffset - Y-offset in UV space (0-1)
 * @returns {PIXI.Filter}
 */
export function createCloudReflectionShader(options = {}) {
  return new PIXI.Filter(null, cloudReflectionFragmentShader, {
    time: 0,
    cloudSpeed: options.cloudSpeed || [0.0, 0.02], // MUST match shadows
    cloudScale: options.cloudScale || 3.0, // MUST match shadows
    reflectionIntensity: options.reflectionIntensity || 0.15,
    reflectionOffset: options.reflectionOffset || 0.3, // 30% of river depth
  });
}
```

**Step 5.2: Setup Cloud Reflection Layer**

```javascript
export function setupCloudReflectionLayer(
  app,
  riverbedBounds,
  displacementFilter,
  pixelSnapShader
) {
  // Create sprite covering water surface
  const cloudReflectionSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  cloudReflectionSprite.x = riverbedBounds.left;
  cloudReflectionSprite.y = riverbedBounds.top;
  cloudReflectionSprite.width = riverbedBounds.right - riverbedBounds.left;
  cloudReflectionSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  // Create reflection shader with offset
  const cloudReflectionShader = createCloudReflectionShader({
    cloudSpeed: [0.0, 0.02], // SAME as shadows
    cloudScale: 3.0, // SAME as shadows
    reflectionIntensity: 0.15,
    reflectionOffset: 0.3, // Reflections appear 30% "ahead" (north) of shadows
  });

  // Apply reflection shader + same distortion as water
  cloudReflectionSprite.filters = [
    cloudReflectionShader,
    displacementFilter, // Ripple with water
    pixelSnapShader, // Match pixel grid
  ];

  cloudReflectionSprite.blendMode = PIXI.BLEND_MODES.ADD; // Brighten water

  // Animate (same time as shadows for synchronization)
  app.ticker.add((delta) => {
    cloudReflectionShader.uniforms.time += delta * 0.016;
  });

  return { cloudReflectionSprite, cloudReflectionShader };
}
```

**Testing Step 5:**

- Bright patches should move bottom→top (same direction as shadows)
- Reflections should appear **ahead** (north) of shadows
- Visual sequence: shadow passes over point → reflection passes over same point later
- Both should ripple with water distortion

---

## Layer 6: Rope Reflection

### Purpose

Mirror the dynamically rendered rope that connects cast location to water surface.

### Implementation Steps

**Step 6.1: Create Reflection Container**

```javascript
export function setupReflectionContainer(
  app,
  waterSurfaceBounds,
  displacementFilter,
  pixelSnapShader
) {
  // Create container for mirrored sprites
  const reflectionContainer = new PIXI.Container();

  // Flip vertically
  reflectionContainer.scale.y = -1;

  // Position below water surface (mirror point)
  const waterSurfaceY = waterSurfaceBounds.top; // Screen Y of water surface (Z=1)
  reflectionContainer.y = waterSurfaceY * 2; // Mirror below

  // Fade reflection
  reflectionContainer.alpha = 0.3;

  // Apply same distortion as water
  reflectionContainer.filters = [displacementFilter, pixelSnapShader];

  return reflectionContainer;
}
```

**Step 6.2: Add Rope Reflection**

Assuming you have a rope rendering system (e.g., `RopeGraphics3D`):

```javascript
// In your rope update logic:
function updateRopeReflection(ropePoints, reflectionContainer) {
  // Clear previous reflection
  reflectionContainer.removeChildren();

  // Create mirrored rope graphics
  const ropeReflection = new PIXI.Graphics();

  // Draw rope segments (same as main rope, but in reflection container)
  ropeReflection.lineStyle(2, 0x654321); // Brown rope color

  if (ropePoints.length > 0) {
    ropeReflection.moveTo(ropePoints[0].x, ropePoints[0].y);
    for (let i = 1; i < ropePoints.length; i++) {
      ropeReflection.lineTo(ropePoints[i].x, ropePoints[i].y);
    }
  }

  reflectionContainer.addChild(ropeReflection);
}

// Call this whenever rope updates:
// updateRopeReflection(rope.screenPoints, reflectionContainer);
```

**Testing Step 6:**

- When rope is visible, reflection should appear below water surface
- Reflection should be flipped vertically
- Reflection should ripple with water distortion

---

## Complete Integration

### Main Setup Function

Create: `src/game/graphics/waterLayers.js`

```javascript
import * as PIXI from "pixi.js";
import { WORLD_X, WORLD_Y, WORLD_Z } from "../mechanics/worldConstants.js";
import {
  createViewport,
  getSurfaceScreenBounds,
} from "../mechanics/worldConstants.js";

// Import all water system modules
import { generateRiverbedHeightMap } from "./waterSystem/heightmapGenerator.js";
import { createDepthGradientShader } from "./waterSystem/depthGradientShader.js";
import { createCloudShadowShader } from "./waterSystem/cloudShadowShader.js";
import { createCausticsShader } from "./waterSystem/causticsShader.js";
import { createPixelSnapShader } from "./waterSystem/pixelSnapShader.js";
import { createCloudReflectionShader } from "./waterSystem/cloudReflectionShader.js";

/**
 * Setup complete water rendering system.
 * @param {PIXI.Application} app - PixiJS application
 * @returns {Object} All water layers and shaders for animation
 */
export function setupWaterLayers(app) {
  const viewport = createViewport(app.screen.width, app.screen.height);

  // Get screen bounds for layers
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);
  const waterSurfaceBounds = getSurfaceScreenBounds(
    WORLD_Z.WATER_SURFACE,
    viewport
  );

  // 1. Generate heightmap
  const heightMap = generateRiverbedHeightMap(
    WORLD_X.WIDTH,
    WORLD_Y.WATER_FAR,
    viewport.pixelsPerUnit
  );

  // 2. Setup riverbed layer
  const riverbedSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  riverbedSprite.x = riverbedBounds.left;
  riverbedSprite.y = riverbedBounds.top;
  riverbedSprite.width = riverbedBounds.right - riverbedBounds.left;
  riverbedSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  const depthShader = createDepthGradientShader(
    heightMap,
    [0.48, 0.64, 0.72], // Shallow blue
    [0.29, 0.36, 0.44] // Deep blue
  );

  const cloudShadowShader = createCloudShadowShader({
    cloudSpeed: [0.0, 0.02],
    cloudScale: 3.0,
    shadowIntensity: 0.25,
  });

  riverbedSprite.filters = [depthShader, cloudShadowShader];

  // 3. Setup caustics layer
  const causticsTexture = PIXI.Texture.from("assets/caustics.png");
  const causticsSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  causticsSprite.x = riverbedBounds.left;
  causticsSprite.y = riverbedBounds.top;
  causticsSprite.width = riverbedBounds.right - riverbedBounds.left;
  causticsSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  const causticsShader = createCausticsShader(causticsTexture, heightMap, {
    tiling: [4.0, 4.0],
    scrollSpeed: [0.02, 0.015],
    baseOpacity: 0.3,
  });

  causticsSprite.filters = [causticsShader];
  causticsSprite.blendMode = PIXI.BLEND_MODES.ADD;

  // 4. Create water container (riverbed + caustics)
  const waterContainer = new PIXI.Container();
  waterContainer.addChild(riverbedSprite, causticsSprite);

  // 5. Setup water distortion
  const dudvTexture = PIXI.Texture.from("assets/dudv.png");
  dudvTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

  const dudvSprite = new PIXI.Sprite(dudvTexture);
  dudvSprite.width = riverbedBounds.right - riverbedBounds.left;
  dudvSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  const displacementFilter = new PIXI.DisplacementFilter(dudvSprite);
  displacementFilter.scale.set(20, 20);

  const pixelSnapShader = createPixelSnapShader(
    riverbedBounds.right - riverbedBounds.left,
    riverbedBounds.bottom - riverbedBounds.top,
    2
  );

  waterContainer.filters = [displacementFilter, pixelSnapShader];

  // 6. Setup cloud reflections
  const cloudReflectionSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  cloudReflectionSprite.x = riverbedBounds.left;
  cloudReflectionSprite.y = riverbedBounds.top;
  cloudReflectionSprite.width = riverbedBounds.right - riverbedBounds.left;
  cloudReflectionSprite.height = riverbedBounds.bottom - riverbedBounds.top;

  const cloudReflectionShader = createCloudReflectionShader({
    cloudSpeed: [0.0, 0.02], // SAME as shadows
    cloudScale: 3.0, // SAME as shadows
    reflectionIntensity: 0.15,
    reflectionOffset: 0.3,
  });

  cloudReflectionSprite.filters = [
    cloudReflectionShader,
    displacementFilter,
    pixelSnapShader,
  ];
  cloudReflectionSprite.blendMode = PIXI.BLEND_MODES.ADD;

  // 7. Setup reflection container
  const reflectionContainer = new PIXI.Container();
  reflectionContainer.scale.y = -1;
  reflectionContainer.y = waterSurfaceBounds.top * 2;
  reflectionContainer.alpha = 0.3;
  reflectionContainer.filters = [displacementFilter, pixelSnapShader];

  // Add all layers to stage
  app.stage.addChild(
    waterContainer,
    cloudReflectionSprite,
    reflectionContainer
  );

  // Animation loop
  app.ticker.add((delta) => {
    const deltaTime = delta * 0.016;

    // Animate DuDv map (water ripples)
    dudvSprite.x += 0.5 * delta;
    dudvSprite.y += 0.3 * delta;

    // Animate shaders (clouds and caustics)
    cloudShadowShader.uniforms.time += deltaTime;
    cloudReflectionShader.uniforms.time += deltaTime;
    causticsShader.uniforms.time += deltaTime;
  });

  return {
    waterContainer,
    cloudReflectionSprite,
    reflectionContainer,
    heightMap,
    shaders: {
      depth: depthShader,
      cloudShadow: cloudShadowShader,
      caustics: causticsShader,
      cloudReflection: cloudReflectionShader,
      pixelSnap: pixelSnapShader,
    },
  };
}
```

---

## Location-Specific Presets

Create: `src/game/graphics/waterSystem/locationPresets.js`

```javascript
/**
 * Water rendering presets for each location.
 * Customize colors, intensities, and effects per location.
 */
export const WATER_PRESETS = {
  picturesque_river: {
    name: "Picturesque River",
    shallowColor: [0.48, 0.64, 0.72], // Light blue
    deepColor: [0.29, 0.36, 0.44], // Medium blue
    causticsOpacity: 0.3,
    causticsTiling: [4.0, 4.0],
    causticsScrollSpeed: [0.02, 0.015],
    cloudShadowIntensity: 0.15,
    cloudReflectionIntensity: 0.2,
    cloudSpeed: [0.0, 0.02],
    cloudScale: 3.0,
    distortionStrength: 15,
  },

  industrial_canal: {
    name: "Industrial Canal",
    shallowColor: [0.24, 0.29, 0.24], // Murky green
    deepColor: [0.1, 0.14, 0.13], // Very dark
    causticsOpacity: 0.05, // Barely visible
    causticsTiling: [4.0, 4.0],
    causticsScrollSpeed: [0.03, 0.02], // Faster (turbulent)
    cloudShadowIntensity: 0.3, // Heavier clouds
    cloudReflectionIntensity: 0.05, // Barely visible
    cloudSpeed: [0.0, 0.025],
    cloudScale: 2.5,
    distortionStrength: 25, // More turbulent
  },

  castle_moat: {
    name: "Castle Moat",
    shallowColor: [0.35, 0.44, 0.37], // Murky green
    deepColor: [0.18, 0.25, 0.22],
    causticsOpacity: 0.2,
    causticsTiling: [3.0, 3.0],
    causticsScrollSpeed: [0.01, 0.01], // Very slow (still water)
    cloudShadowIntensity: 0.2,
    cloudReflectionIntensity: 0.15,
    cloudSpeed: [0.0, 0.015],
    cloudScale: 3.5,
    distortionStrength: 10, // Calm water
  },

  sewage_works: {
    name: "Sewage Works",
    shallowColor: [0.2, 0.22, 0.18], // Brown-grey
    deepColor: [0.08, 0.1, 0.08],
    causticsOpacity: 0.0, // No caustics (opaque)
    causticsTiling: [4.0, 4.0],
    causticsScrollSpeed: [0.0, 0.0],
    cloudShadowIntensity: 0.25,
    cloudReflectionIntensity: 0.02, // Almost none
    cloudSpeed: [0.0, 0.02],
    cloudScale: 3.0,
    distortionStrength: 20,
  },
};

/**
 * Apply preset to water shaders.
 * @param {Object} shaders - Object containing all shader references
 * @param {string} presetName - Key from WATER_PRESETS
 */
export function applyWaterPreset(shaders, presetName) {
  const preset = WATER_PRESETS[presetName];
  if (!preset) {
    console.warn(`Unknown water preset: ${presetName}`);
    return;
  }

  // Update depth gradient colors
  shaders.depth.uniforms.shallowColor = preset.shallowColor;
  shaders.depth.uniforms.deepColor = preset.deepColor;

  // Update caustics
  shaders.caustics.uniforms.baseOpacity = preset.causticsOpacity;
  shaders.caustics.uniforms.tiling = preset.causticsTiling;
  shaders.caustics.uniforms.scrollSpeed = preset.causticsScrollSpeed;

  // Update cloud shadows
  shaders.cloudShadow.uniforms.shadowIntensity = preset.cloudShadowIntensity;
  shaders.cloudShadow.uniforms.cloudSpeed = preset.cloudSpeed;
  shaders.cloudShadow.uniforms.cloudScale = preset.cloudScale;

  // Update cloud reflections
  shaders.cloudReflection.uniforms.reflectionIntensity =
    preset.cloudReflectionIntensity;
  shaders.cloudReflection.uniforms.cloudSpeed = preset.cloudSpeed;
  shaders.cloudReflection.uniforms.cloudScale = preset.cloudScale;

  // Update distortion (this is on the filter, not shader uniform)
  // You'd need to pass displacementFilter separately or store it in shaders object
}
```

---

## Performance Checklist

- [ ] Heightmap generation: <50ms on initial load
- [ ] Each shader pass: <0.5ms per frame
- [ ] Total water system: <3ms per frame
- [ ] Test on target device (iPad)
- [ ] Profile with PixiJS DevTools

**If performance issues arise:**

1. Reduce `cloudScale` (fewer noise calculations)
2. Lower `distortionStrength` (less pixel displacement)
3. Reduce `causticsTiling` (fewer texture samples)
4. Increase `pixelSize` to 4×4 (chunkier pixels, less processing)

---

## Testing Checklist

### Layer 1: Riverbed Depth

- [ ] Water gets darker from top to bottom
- [ ] Perlin noise adds subtle undulation
- [ ] Changing `WORLD_Y.WATER_FAR` scales appropriately

### Layer 2: Cloud Shadows

- [ ] Dark patches move bottom→top (north)
- [ ] Movement is slow and smooth
- [ ] Patches have cloud-like shapes

### Layer 3: Caustics

- [ ] Light patterns shimmer on riverbed
- [ ] Brighter at top (shallow), dimmer at bottom (deep)
- [ ] Slow diagonal scroll visible

### Layer 4: Water Distortion

- [ ] Everything underwater appears wavy
- [ ] Distortion is chunky (2×2 pixels), not smooth
- [ ] Ripples move continuously

### Layer 5: Cloud Reflections

- [ ] Bright patches move bottom→top (same as shadows)
- [ ] Reflections appear **ahead** (north) of shadows
- [ ] Reflections ripple with water

### Layer 6: Rope Reflection

- [ ] Rope appears mirrored below water surface
- [ ] Reflection is flipped vertically
- [ ] Reflection ripples with water

### Integration

- [ ] All layers render in correct order
- [ ] No z-fighting or layer conflicts
- [ ] Performance is stable (60 FPS)
- [ ] Switching locations updates presets correctly

---

## Common Issues & Solutions

### Issue: Cloud reflections and shadows move at same position (no offset)

**Solution:** Check `reflectionOffset` uniform in cloud reflection shader. Increase value (e.g., 0.3 → 0.5).

### Issue: Water looks smooth, not chunky/pixelated

**Solution:** Ensure `pixelSnapShader` is applied **after** `displacementFilter`. Check filter order.

### Issue: Caustics don't fade with depth

**Solution:** Verify `heightMap` uniform is correctly passed to caustics shader. Check texture binding.

### Issue: Noise function crashes shader

**Solution:** Ensure `snoise` function is included in shader code. Some environments don't support `#include`, so paste function directly.

### Issue: DuDv distortion not visible

**Solution:**

1. Check `displacementFilter.scale` values (try increasing to 40)
2. Verify DuDv texture has red/green channels (not grayscale)
3. Ensure `wrapMode` is set to `REPEAT`

### Issue: Performance drops below 60 FPS

**Solution:**

1. Profile with PixiJS DevTools to identify bottleneck
2. Reduce noise octaves (remove `cloud2` calculation)
3. Increase `pixelSize` to 4×4
4. Lower `causticsTiling` to [2.0, 2.0]

---

## Asset Requirements Summary

### You Must Provide

- **Caustics texture:** Tileable, 64×64px or 128×128px, grayscale or colored

### You Have

- **DuDv texture:** 512×512px (or similar), red/green channels for X/Y displacement

### System Generates

- **Heightmap:** Generated at runtime via Perlin noise
- **Cloud patterns:** Procedural noise in shaders (no texture needed)

---

## File Structure

```
src/game/graphics/
├── waterLayers.js                    # Main setup (integration)
├── waterSystem/
│   ├── perlinNoise.js               # Perlin noise library
│   ├── heightmapGenerator.js        # Heightmap generation
│   ├── depthGradientShader.js       # Layer 1 shader wrapper
│   ├── cloudShadowShader.js         # Layer 2 shader wrapper
│   ├── causticsShader.js            # Layer 3 shader wrapper
│   ├── pixelSnapShader.js           # Layer 4 (part 2) shader wrapper
│   ├── cloudReflectionShader.js     # Layer 5 shader wrapper
│   ├── locationPresets.js           # Per-location configurations
│   └── shaders/
│       ├── noise2D.glsl             # Reusable noise function
│       ├── depthGradient.frag       # Layer 1 fragment shader
│       ├── cloudShadow.frag         # Layer 2 fragment shader
│       ├── caustics.frag            # Layer 3 fragment shader
│       ├── pixelSnap.frag           # Layer 4 fragment shader
│       └── cloudReflection.frag     # Layer 5 fragment shader
```

---

## Next Steps

1. **Implement Layer 1** (riverbed depth) first - this is the foundation
2. Test and verify depth gradient + Perlin noise works
3. Add layers incrementally (2 → 3 → 4 → 5 → 6)
4. Test each layer independently before moving to next
5. Once all layers work, create location presets
6. Profile performance and optimize if needed

**Start with:** `heightmapGenerator.js` + `depthGradientShader.js`
