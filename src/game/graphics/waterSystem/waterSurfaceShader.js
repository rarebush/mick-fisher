import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const waterSurfaceFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Custom uniforms (bound via resources.waterUniforms)
uniform vec3 uWaterColorNear;
uniform vec3 uWaterColorFar;
uniform float uWaterAlpha;
uniform float uMaskThreshold;
uniform vec3 uDepthCoeffs;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uDepthBands;
// --- 2D gradient noise (Perlin-style) ---

// Signed hash [-1, 1]. Sin-free so it works at mediump (iPad / mobile GPUs).
vec2 hash22s(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep
  return mix(
    mix(dot(hash22s(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22s(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22s(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22s(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian motion — 2 octaves for organic variation
float fbm(vec2 p) {
  float val  = 0.5  * gradientNoise(p);
  val       += 0.25 * gradientNoise(p * 2.0);
  return val;
}

// --- main ---

void main() {
  vec4 tex = texture(uTexture, vTextureCoord);

  // Skip transparent pixels (gaps between diamond-shaped iso tiles)
  if (tex.a < 0.01) {
    finalColor = vec4(0.0);
    return;
  }

  float maxChannel = max(max(tex.r, tex.g), tex.b);
  float mask = 1.0 - step(uMaskThreshold, maxChannel);

  // Depth from isometric world Y, precomputed as a linear function of screen position.
  // uDepthCoeffs = (A, B, C) where depth = A*screenX + B*screenY + C
  // Coefficients are derived from three projected reference points so the
  // gradient correctly follows the isometric Y axis (not screen-perpendicular).
  float depth = uDepthCoeffs.x * vScreenPos.x
              + uDepthCoeffs.y * vScreenPos.y
              + uDepthCoeffs.z;
  depth = clamp(depth, 0.0, 1.0);

  // Procedural noise adds organic variation to the depth gradient
  float noise = fbm(vScreenPos * uNoiseScale);
  float depthWithNoise = clamp(depth + noise * uNoiseStrength, 0.0, 1.0);

  // Quantize into discrete bands (0 = smooth gradient, >0 = number of steps)
  if (uDepthBands > 0.0) {
    depthWithNoise = floor(depthWithNoise * uDepthBands) / uDepthBands;
  }

  // Blend between near and far water colours based on depth
  vec3 depthColor = mix(uWaterColorNear, uWaterColorFar, depthWithNoise);

  // Deeper water is slightly more opaque (harder to see riverbed)
  float depthAlpha = mix(uWaterAlpha, min(uWaterAlpha + 0.25, 1.0), depthWithNoise);

  vec3 color = mix(tex.rgb, depthColor, mask);
  float alpha = mix(tex.a, depthAlpha, mask);

  // Output premultiplied alpha (PixiJS internal format)
  finalColor = vec4(color * alpha, alpha);
}
`;

/**
 * Create the water surface filter.
 *
 * @param {Object} options
 * @param {number[]} options.waterColorNear - RGB [0-1] near water colour (default [0.17, 0.45, 0.63])
 * @param {number[]} options.waterColorFar  - RGB [0-1] far water colour (default derived from depthDarken)
 * @param {number[]} options.waterColor     - legacy base water colour (near, default [0.17, 0.45, 0.63])
 * @param {number}   options.waterAlpha     - base opacity                 (default 0.7)
 * @param {number}   options.maskThreshold  - brightness cutoff for mask   (default 0.9)
 * @param {number[]} options.depthCoeffs    - [A,B,C] where depth = A*sx + B*sy + C (required)
 * @param {number}   options.depthDarken    - used only if waterColorFar not provided (default 0.4)
 * @param {number}   options.noiseScale     - noise frequency              (default 0.015)
 * @param {number}   options.noiseStrength  - noise amplitude              (default 0.15)
 * @param {number}   options.depthBands     - quantize depth into N steps  (default 0 = smooth)
 */
export function createWaterSurfaceShader(options = {}) {
  const depthDarken = Number.isFinite(options.depthDarken)
    ? options.depthDarken
    : 0.4;
  const waterColorNear = options.waterColorNear ||
    options.waterColor || [0.17, 0.45, 0.63];
  const waterColorFar =
    options.waterColorFar ||
    waterColorNear.map((channel) => channel * depthDarken);

  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: waterSurfaceFragment,
    name: "water-surface-filter",
  });

  const waterUniforms = new UniformGroup({
    uWaterColorNear: {
      value: waterColorNear,
      type: "vec3<f32>",
    },
    uWaterColorFar: {
      value: waterColorFar,
      type: "vec3<f32>",
    },
    uWaterAlpha: {
      value: Number.isFinite(options.waterAlpha) ? options.waterAlpha : 0.7,
      type: "f32",
    },
    uMaskThreshold: {
      value: Number.isFinite(options.maskThreshold)
        ? options.maskThreshold
        : 0.9,
      type: "f32",
    },
    uDepthCoeffs: {
      value: options.depthCoeffs || [0, 0, 0],
      type: "vec3<f32>",
    },
    uNoiseScale: {
      value: Number.isFinite(options.noiseScale) ? options.noiseScale : 0.015,
      type: "f32",
    },
    uNoiseStrength: {
      value: Number.isFinite(options.noiseStrength)
        ? options.noiseStrength
        : 0.15,
      type: "f32",
    },
    uDepthBands: {
      value: Number.isFinite(options.depthBands) ? options.depthBands : 0,
      type: "f32",
    },
  });

  return new Filter({
    glProgram,
    resources: {
      waterUniforms,
    },
    padding: 0, // Don't extend filter area beyond the container bounds
  });
}
