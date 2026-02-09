import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const foamFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Foam shape
uniform float uFoamScale;
uniform float uFoamThreshold;
uniform float uFoamDriftRate;
uniform float uPerforationScale;
uniform float uPerforationThreshold;
uniform float uPatchScale;
uniform float uPatchThreshold;

// Dynamic controls (updated per-frame from ticker)
uniform float uFlowPhase;
uniform float uChoppiness;
uniform float uCurrentSpeed;

// Color & opacity
uniform vec3 uFoamColor;
uniform float uFoamAlpha;

// Flow & coordinate system
uniform vec2 uFlowDir;
uniform vec2 uNoiseBasisX;
uniform vec2 uNoiseBasisY;

// --- Hash for Voronoi cell centres (unsigned, returns [0,1]) ---
// Sin-free so it works at mediump (iPad / mobile GPUs).
// Same hash used in causticsShader.js.

vec2 hash22u(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// --- Voronoi F1 (nearest cell distance) ---
// Returns distance to the nearest cell centre.
// 0 at cell centres, ~0.7 at cell edges.
// Foam appears at edges (high distance) between cells.

float voronoiFoam(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellCenter = hash22u(i + neighbor);
      float dist = length(neighbor + cellCenter - f);
      minDist = min(minDist, dist);
    }
  }
  return minDist;
}

// --- 2D gradient noise (Perlin-style) ---
// Signed hash [-1, 1]. Sin-free so it works at mediump.
// Same noise used in sparkleShader.js and reflectionShader.js.

vec2 hash22s(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22s(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22s(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22s(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22s(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// --- main ---

void main() {
  // --- Transform screen position into isometric-aligned noise space ---
  vec2 foamBasis = vec2(
    dot(vScreenPos, uNoiseBasisX),
    dot(vScreenPos, uNoiseBasisY)
  );

  // Flow direction in noise basis space
  vec2 flowDir = vec2(
    dot(uFlowDir, uNoiseBasisX),
    dot(uFlowDir, uNoiseBasisY)
  );

  // --- 1. Scale and stretch UVs ---
  vec2 foamUV = foamBasis * uFoamScale;
  // Compress the cross-stream axis (Y in noise basis) so Voronoi cells
  // become elongated along flow (X = downstream). Multiplying Y packs more
  // cells cross-stream → each cell is narrow cross-stream, wide downstream
  // → streaks running in the flow direction.
  // At speed 0: circular cells (stretch=1). At speed 2: highly streaked (stretch=4).
  float stretch = 1.0 + clamp(uCurrentSpeed, 0.0, 2.0) * 1.5;
  foamUV.y *= stretch;

  // --- 2. Animate with accumulated flow phase ---
  // uFlowPhase is accumulated in JS at 24 FPS cadence so speed transitions
  // don't cause discontinuities (same pattern as caustics/sparkles).
  vec2 flowedUV = foamUV - flowDir * uFlowPhase * uFoamDriftRate;

  // --- 3. Generate Voronoi F1 ---
  float voronoi = voronoiFoam(flowedUV);

  // --- 4. Perforate with gradient noise (break up solid foam into holes) ---
  float perforation = gradientNoise(flowedUV * uPerforationScale);
  voronoi *= smoothstep(uPerforationThreshold, uPerforationThreshold + 0.4, perforation);

  // --- 5. Patch masking (cluster foam into regions, not uniform coverage) ---
  float patchMask = gradientNoise(flowedUV * uPatchScale);
  patchMask = smoothstep(uPatchThreshold, uPatchThreshold + 0.2, patchMask);

  // --- 6. Combine and apply choppiness ---
  float foam = voronoi * patchMask;
  // Choppier water -> lower effective threshold -> more foam visible.
  // Divide threshold by choppiness (same pattern as sparkle shader).
  // At choppiness=1: default density. >1: denser foam. <1: sparser.
  float threshold = uFoamThreshold / uChoppiness;

  // Two-step foam: brighter core with a thinner, slightly darker edge.
  // The edge band is the narrow ring just above the threshold; the core
  // is everything above threshold + offset. Lower alpha at the edge lets
  // the water surface show through, giving a subtle darker fringe.
  float edge = step(threshold, foam);
  float core = step(threshold + 0.07, foam);
  float foamAlpha = mix(uFoamAlpha * 0.6, uFoamAlpha, core) * edge;

  // --- 7. Output foam pixels ---
  // Premultiplied alpha (PixiJS internal format).
  float alpha = foamAlpha;
  vec3 color = uFoamColor * alpha;
  finalColor = vec4(color, alpha);
}
`;

/**
 * Create the surface foam overlay filter.
 *
 * Renders organic, flow-responsive foam patterns using stretched Voronoi
 * noise. Foam cells elongate along the flow direction as current speed
 * increases, and foam density scales with water choppiness. Designed to
 * sit above reflections but below sparkle glints.
 *
 * Uses the same isometric noise-basis transform as other water shaders
 * so patterns align with the river orientation.
 *
 * @param {Object} options
 * @param {number}   options.foamScale           - cell size in noise space        (default 0.04)
 * @param {number}   options.foamThreshold       - density cutoff 0-1              (default 0.45)
 * @param {number}   options.foamDriftRate       - flow scroll multiplier          (default 0.4)
 * @param {number}   options.perforationScale    - hole noise freq relative to cells (default 0.5)
 * @param {number}   options.perforationThreshold - perforation cutoff for signed noise (default -0.2)
 * @param {number}   options.patchScale          - cluster noise freq relative     (default 0.2)
 * @param {number}   options.patchThreshold      - cluster cutoff for signed noise (default -0.1)
 * @param {number[]} options.foamColor           - RGB foam tint                   (default [0.95, 0.97, 1.0])
 * @param {number}   options.foamAlpha           - core foam opacity 0-1           (default 0.9)
 * @param {number[]} options.flowDir             - normalized screen-space flow direction [x,y]
 * @param {number[]} options.noiseBasisX         - screen-space iso X basis [x,y] (default [1,0])
 * @param {number[]} options.noiseBasisY         - screen-space iso Y basis [x,y] (default [0,1])
 */
export function createFoamShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: foamFragment,
    name: "foam-overlay-filter",
  });

  const foamUniforms = new UniformGroup({
    uFoamScale: {
      value: Number.isFinite(options.foamScale) ? options.foamScale : 0.04,
      type: "f32",
    },
    uFoamThreshold: {
      value: Number.isFinite(options.foamThreshold)
        ? options.foamThreshold
        : 0.45,
      type: "f32",
    },
    uFoamDriftRate: {
      value: Number.isFinite(options.foamDriftRate)
        ? options.foamDriftRate
        : 0.4,
      type: "f32",
    },
    uPerforationScale: {
      value: Number.isFinite(options.perforationScale)
        ? options.perforationScale
        : 0.5,
      type: "f32",
    },
    uPerforationThreshold: {
      value: Number.isFinite(options.perforationThreshold)
        ? options.perforationThreshold
        : -0.2,
      type: "f32",
    },
    uPatchScale: {
      value: Number.isFinite(options.patchScale) ? options.patchScale : 0.2,
      type: "f32",
    },
    uPatchThreshold: {
      value: Number.isFinite(options.patchThreshold)
        ? options.patchThreshold
        : -0.1,
      type: "f32",
    },
    uFoamColor: {
      value: options.foamColor || [0.95, 0.97, 1.0],
      type: "vec3<f32>",
    },
    uFoamAlpha: {
      value: Number.isFinite(options.foamAlpha) ? options.foamAlpha : 0.9,
      type: "f32",
    },
    uFlowDir: {
      value:
        Array.isArray(options.flowDir) && options.flowDir.length === 2
          ? options.flowDir
          : [1, 0],
      type: "vec2<f32>",
    },
    uNoiseBasisX: {
      value:
        Array.isArray(options.noiseBasisX) && options.noiseBasisX.length === 2
          ? options.noiseBasisX
          : [1, 0],
      type: "vec2<f32>",
    },
    uNoiseBasisY: {
      value:
        Array.isArray(options.noiseBasisY) && options.noiseBasisY.length === 2
          ? options.noiseBasisY
          : [0, 1],
      type: "vec2<f32>",
    },
    uFlowPhase: {
      value: 0,
      type: "f32",
    },
    uChoppiness: {
      value: 1.0,
      type: "f32",
    },
    uCurrentSpeed: {
      value: 1.0,
      type: "f32",
    },
  });

  return new Filter({
    glProgram,
    resources: {
      foamUniforms,
    },
    padding: 0,
  });
}
