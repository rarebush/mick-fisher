import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const sparkleFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

uniform float uSparkleScale;
uniform float uSparkleSpeed;
uniform float uSparkleThreshold;
uniform float uSparkleClipDebug;
uniform float uFlowPhase;
uniform float uChoppiness;
uniform vec2 uFlowDir;
uniform vec2 uNoiseBasisX;
uniform vec2 uNoiseBasisY;

// --- 2D gradient noise (Perlin-style) — same as waterSurfaceShader ---

// Signed hash [-1, 1]. Sin-free so it works at mediump (iPad / mobile GPUs).
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

void main() {
  // --- Sparkles: dual scrolling noise subtracted for chaotic glints ---
  vec2 sparkleBasis = vec2(
    dot(vScreenPos, uNoiseBasisX),
    dot(vScreenPos, uNoiseBasisY)
  );
  vec2 scrollDir = vec2(
    dot(uFlowDir, uNoiseBasisX),
    dot(uFlowDir, uNoiseBasisY)
  );
  vec2 sp = sparkleBasis * uSparkleScale;

  float n1 = gradientNoise(sp - scrollDir * uFlowPhase * uSparkleSpeed);
  float n2 = gradientNoise(sp * 1.3 - scrollDir * uFlowPhase * uSparkleSpeed * 0.55 + 50.0);

  float diff = n1 - n2;
  // Choppier water -> lower threshold -> more frequent sparkles
  float sparkle = step(uSparkleThreshold / uChoppiness, abs(diff));

  // Clip with a dense high-frequency noise to break blobs into smaller fragments
  float clipNoise = gradientNoise(sp * 2.0);
  sparkle *= step(0.0, clipNoise);

  if (uSparkleClipDebug > 0.5) {
    float debugValue = clipNoise * 0.5 + 0.5;
    finalColor = vec4(vec3(debugValue), 1.0);
    return;
  }

  // Only output sparkle pixels — fully transparent elsewhere.
  // Sparkles are pure white at full opacity (premultiplied alpha).
  float alpha = sparkle;
  finalColor = vec4(alpha, alpha, alpha, alpha);
}
`;

/**
 * Create the sparkle overlay filter.
 *
 * Renders only sparkle/glint pixels as opaque white; everything else is
 * fully transparent. Designed to sit on a container above the water
 * surface and wall reflections so sparkles are the topmost water effect.
 *
 * @param {Object} options
 * @param {number}   options.sparkleScale   - sparkle noise frequency     (default 0.16)
 * @param {number}   options.sparkleSpeed   - sparkle scroll speed        (default 1.0)
 * @param {number}   options.sparkleThreshold - rarity threshold 0-2      (default 0.78)
 * @param {number}   options.sparkleClipDebug - show clip noise 0/1       (default 0)
 * @param {number[]} options.flowDir          - normalized screen-space flow direction [x,y]
 * @param {number[]} options.noiseBasisX      - screen-space iso X basis [x,y] (default [1,0])
 * @param {number[]} options.noiseBasisY      - screen-space iso Y basis [x,y] (default [0,1])
 */
export function createSparkleShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: sparkleFragment,
    name: "sparkle-overlay-filter",
  });

  const sparkleUniforms = new UniformGroup({
    uSparkleScale: {
      value: Number.isFinite(options.sparkleScale)
        ? options.sparkleScale
        : 0.16,
      type: "f32",
    },
    uSparkleSpeed: {
      value: Number.isFinite(options.sparkleSpeed) ? options.sparkleSpeed : 1.0,
      type: "f32",
    },
    uSparkleThreshold: {
      value: Number.isFinite(options.sparkleThreshold)
        ? options.sparkleThreshold
        : 0.78,
      type: "f32",
    },
    uSparkleClipDebug: {
      value: Number.isFinite(options.sparkleClipDebug)
        ? options.sparkleClipDebug
        : 0,
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
  });

  return new Filter({
    glProgram,
    resources: {
      sparkleUniforms,
    },
    padding: 0,
  });
}
