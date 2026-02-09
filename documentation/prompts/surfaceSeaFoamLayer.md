# Surface Sea Foam Layer (Stretched Voronoi)

## Purpose

Create organic foam patterns that stretch along river flow direction, becoming more elongated as flow speed increases. Foam density controlled by choppiness.

## Layer Position

Between water surface base and glints (above reflections if those exist).

## Shader Inputs

```glsl
uniform float flowSpeed;      // 0-1: river current speed
uniform float choppiness;     // 0-1: water turbulence
uniform vec2 flowDirection;   // Normalized direction vector
uniform float time;           // Animation time
```

## Core Algorithm

### 1. UV Stretching

```glsl
// Base foam scale (how many cells across screen)
vec2 foamUV = uv * 20.0;

// Stretch factor: slow river = 1x (circular), fast river = 4x (elongated)
float stretch = 1.0 + flowSpeed * 3.0;

// Apply stretch along flow direction
// Assuming flow is primarily horizontal (+X), stretch X axis
foamUV.x *= stretch;
```

### 2. Voronoi Pattern Generation

```glsl
// Animate foam flowing downstream
vec2 flowedUV = foamUV + flowDirection * time * flowSpeed;

// Generate Voronoi cells (returns 0-1, cells are brighter centers)
float voronoi = voronoiNoise(flowedUV);

// Invert if needed (foam at cell edges vs centers)
// voronoi = 1.0 - voronoi; // Try both
```

### 3. Perforate with Noise (Create Holes)

```glsl
// Medium-frequency noise to break up solid foam
float perforation = perlinNoise(flowedUV * 0.5);

// Keep foam only where noise is high (creates broken patches)
voronoi *= smoothstep(0.3, 0.7, perforation);
```

### 4. Patch Masking (Cluster Foam)

```glsl
// Large-scale noise for patchy distribution
float patchMask = perlinNoise(flowedUV * 0.2);

// Only show foam in certain regions
patchMask = smoothstep(0.4, 0.6, patchMask);

// Combine
float foam = voronoi * patchMask;
```

### 5. Choppiness Control

```glsl
// More foam in choppy water, less in calm
foam *= choppiness;

// Optional: threshold to create distinct foam pixels
foam = smoothstep(0.5, 0.7, foam);
```

### 6. Foam Color & Blending

```glsl
// Off-white (not pure white like glints)
vec3 foamColor = vec3(0.95, 0.97, 1.0); // Pale blue-white

// Blend over water surface
// foam value is alpha (0-1)
vec3 finalColor = mix(waterSurfaceColor, foamColor, foam);

// OR additive for brighter look:
// finalColor = waterSurfaceColor + foamColor * foam * 0.8;
```

## Visual Behavior

**Slow river (flowSpeed = 0.2):**

- stretch = 1.6 (slightly oval cells)
- Gentle elongation
- Foam moves slowly

**Fast river (flowSpeed = 0.8):**

- stretch = 3.4 (highly stretched, streaky)
- Pronounced streaks along flow
- Foam rushes downstream

**Calm water (choppiness = 0.2):**

- Sparse foam patches
- Subtle, barely visible

**Choppy water (choppiness = 0.9):**

- Dense foam coverage
- Highly visible, turbulent look

## Complete Fragment Shader Snippet

```glsl
// === SURFACE FOAM ===

// 1. Stretch UVs
vec2 foamUV = uv * 20.0;
float stretch = 1.0 + flowSpeed * 3.0;
foamUV.x *= stretch;

// 2. Animate with flow
vec2 flowedUV = foamUV + flowDirection * time * flowSpeed;

// 3. Generate voronoi
float voronoi = voronoiNoise(flowedUV);

// 4. Perforate
float perforation = perlinNoise(flowedUV * 0.5);
voronoi *= smoothstep(0.3, 0.7, perforation);

// 5. Patch mask
float patchMask = perlinNoise(flowedUV * 0.2);
patchMask = smoothstep(0.4, 0.6, patchMask);

// 6. Combine and apply choppiness
float foam = voronoi * patchMask * choppiness;
foam = smoothstep(0.5, 0.7, foam);

// 7. Blend foam color
vec3 foamColor = vec3(0.95, 0.97, 1.0);
vec3 color = mix(waterSurfaceColor, foamColor, foam);
```

## Tunable Parameters

```glsl
const float FOAM_SCALE = 20.0;           // Cell size (higher = smaller cells)
const float FOAM_STRETCH_MAX = 3.0;      // Max elongation (1-4 typical)
const float PERFORATION_SCALE = 0.5;     // Hole size relative to cells
const float PERFORATION_THRESHOLD = 0.3; // Amount of perforation
const float PATCH_SCALE = 0.2;           // Size of foam clusters
const float PATCH_THRESHOLD = 0.4;       // Density of patches
const float FOAM_THRESHOLD = 0.5;        // Binary foam cutoff
```

## Implementation Notes

**Voronoi Function Required:**
If you don't have a Voronoi noise function, you'll need to implement one. Basic 2D Voronoi:

```glsl
float voronoiNoise(vec2 uv) {
    vec2 cell = floor(uv);
    vec2 fract = fract(uv);

    float minDist = 1.0;
    for(int y = -1; y <= 1; y++) {
        for(int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(cell + neighbor); // Random point in cell
            vec2 diff = neighbor + point - fract;
            float dist = length(diff);
            minDist = min(minDist, dist);
        }
    }

    return minDist; // 0 at cell centers, higher at edges
}

// Hash function for random points
vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)),
                          dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
```

**Performance:**

- Voronoi with 3×3 neighbor check: ~9 distance calculations per pixel
- At 360p (230,400 pixels): ~2M calculations per frame
- Very fast on modern GPUs, acceptable on mobile

**Alternative Optimization:**
Use texture-based Voronoi (pre-baked pattern) if performance is a concern, then just stretch UVs.

## Next Steps After Implementation

1. **Test stretch values:** Try stretch = 1-5 range to find sweet spot
2. **Tune thresholds:** Adjust perforation/patch values for desired foam density
3. **Color tweaking:** Try pure white vs off-white, see what reads better at 360p
4. **Edge foam integration:** Decide if Voronoi is enough or needs separate edge system

This layer alone should give you dynamic, flow-responsive foam that distinguishes slow glass-like rivers from fast turbulent ones.
