import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const causticsFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Custom uniforms (bound via resources.causticsUniforms)
uniform float uTime;
uniform vec3 uDepthCoeffs;
uniform float uCausticsScale;
uniform float uCausticsSpeed;
uniform float uCausticsIntensity;
uniform float uSpecularIntensity;
uniform vec3 uCausticsColor;
uniform float uFlowPhase;
uniform float uChoppiness;
uniform vec2 uFlowDir;
uniform vec2 uNoiseBasisX;
uniform vec2 uNoiseBasisY;

// --- Hash for Voronoi cell centres (unsigned, returns [0,1]) ---
// Sin-free so it works at mediump (iPad / mobile GPUs).

vec2 hash22u(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Simple value noise for coordinate warping
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash22u(i).x;
  float b = hash22u(i + vec2(1.0, 0.0)).x;
  float c = hash22u(i + vec2(0.0, 1.0)).x;
  float d = hash22u(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// --- Voronoi F2-F1 (caustic web lines) ---
// Returns the difference between the 2nd-nearest and nearest cell distances.
// This produces thin bright lines at cell boundaries — the characteristic
// web/net pattern of real underwater caustics.

float voronoiCaustic(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 1.0; // nearest distance
  float f2 = 1.0; // second-nearest distance
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      // Static cell centres — animation comes from warping the input coords.
      vec2 cellCenter = hash22u(i + neighbor);
      float dist = length(neighbor + cellCenter - f);
      if (dist < f1) {
        f2 = f1;
        f1 = dist;
      } else if (dist < f2) {
        f2 = dist;
      }
    }
  }
  return f2 - f1;
}

// --- main ---

void main() {
  vec4 tex = texture(uTexture, vTextureCoord);

  // Skip transparent pixels (gaps between diamond-shaped iso tiles)
  if (tex.a < 0.01) {
    finalColor = vec4(0.0);
    return;
  }

  // Isometric depth (0 = near/shallow, 1 = far/deep)
  float depth = uDepthCoeffs.x * vScreenPos.x
              + uDepthCoeffs.y * vScreenPos.y
              + uDepthCoeffs.z;
  depth = clamp(depth, 0.0, 1.0);

  // Fade caustics with depth: bright in shallow water, dim in deep water
  float depthVisibility = 1.0 - depth;

  // Warp coordinates with time-animated noise so Voronoi cell edges become
  // organic curves that flow over time. The Voronoi grid itself is static,
  // so cells can never merge/clump — only the warp field moves.
  // Warp scroll and drift are biased along the downstream (isometric X)
  // direction so caustics visually track the river current.
  vec2 causticsBasis = vec2(
    dot(vScreenPos, uNoiseBasisX),
    dot(vScreenPos, uNoiseBasisY)
  );
  vec2 basePos = causticsBasis * uCausticsScale * 0.01;
  // Quantize time to 24 FPS for pixel art animation style
  float t = floor(uTime * uCausticsSpeed * 24.0) / 24.0;
  vec2 flowDir = vec2(
    dot(uFlowDir, uNoiseBasisX),
    dot(uFlowDir, uNoiseBasisY)
  );
  vec2 warp = vec2(
    valueNoise(basePos * 3.0 + flowDir * t * 0.3 + 50.0),
    valueNoise(basePos * 3.0 + flowDir * t * 0.2 + 100.0)
  );
  // Choppier water → larger warp amplitude → more scattered caustic patterns.
  // uFlowPhase replaces t*currentSpeed for the drift — accumulated in JS so
  // speed transitions don't cause discontinuities.
  vec2 warpedPos = basePos + (warp - 0.5) * 0.2 * uChoppiness - flowDir * uFlowPhase * 0.4;

  // Single Voronoi F2-F1 with warped coordinates for organic cell edges.
  float edgeDist = voronoiCaustic(warpedPos);

  // Hard-edged caustic lines (fully aliased for pixel art)
  float caustic = 1.0 - step(0.08, edgeDist);

  // Specular highlight: brighter core at the very centre of each line.
  float specular = 1.0 - step(0.015, edgeDist);

  // Final caustic brightness: base + specular core
  float baseBrightness = caustic * uCausticsIntensity * depthVisibility;
  float specBrightness = specular * uSpecularIntensity * depthVisibility;

  // Additive caustic light on top of the existing riverbed colour.
  // Base caustic: warm tint, dimmer. Specular core: bright white.
  vec3 color = tex.rgb
             + uCausticsColor * baseBrightness
             + vec3(1.0) * specBrightness;

  // Output premultiplied alpha (PixiJS internal format)
  finalColor = vec4(color * tex.a, tex.a);
}
`;

/**
 * Create a procedural caustics filter for the riverbed.
 *
 * Generates animated Voronoi-based light patterns entirely in GLSL.
 * Depth-faded using the same isometric depth coefficients as the water
 * surface shader so caustics are bright near the wall and dim in deep water.
 *
 * @param {Object} options
 * @param {number[]} options.depthCoeffs       - [A,B,C] depth = A*sx + B*sy + C (required)
 * @param {number}   options.causticsScale     - Voronoi cell size               (default 8.0)
 * @param {number}   options.causticsSpeed     - animation speed                 (default 0.4)
 * @param {number}   options.causticsIntensity - brightness multiplier           (default 0.3)
 * @param {number}   options.specularIntensity - specular core brightness        (default 1.0)
 * @param {number[]} options.causticsColor     - RGB tint for light              (default [1, 0.95, 0.8])
 * @param {number[]} options.flowDir           - normalized screen-space flow direction [x,y]
 * @param {number[]} options.noiseBasisX       - screen-space iso X basis [x,y] (default [1,0])
 * @param {number[]} options.noiseBasisY       - screen-space iso Y basis [x,y] (default [0,1])
 */
export function createCausticsShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: causticsFragment,
    name: "caustics-filter",
  });

  const causticsUniforms = new UniformGroup({
    uTime: {
      value: 0,
      type: "f32",
    },
    uDepthCoeffs: {
      value: options.depthCoeffs || [0, 0, 0],
      type: "vec3<f32>",
    },
    uCausticsScale: {
      value: Number.isFinite(options.causticsScale)
        ? options.causticsScale
        : 8.0,
      type: "f32",
    },
    uCausticsSpeed: {
      value: Number.isFinite(options.causticsSpeed)
        ? options.causticsSpeed
        : 0.4,
      type: "f32",
    },
    uCausticsIntensity: {
      value: Number.isFinite(options.causticsIntensity)
        ? options.causticsIntensity
        : 0.3,
      type: "f32",
    },
    uSpecularIntensity: {
      value: Number.isFinite(options.specularIntensity)
        ? options.specularIntensity
        : 1.0,
      type: "f32",
    },
    uCausticsColor: {
      value: options.causticsColor || [1.0, 0.95, 0.8],
      type: "vec3<f32>",
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
  });

  return new Filter({
    glProgram,
    resources: {
      causticsUniforms,
    },
    padding: 0,
  });
}
