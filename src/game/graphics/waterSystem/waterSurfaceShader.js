import { Filter, GlProgram, UniformGroup } from "pixi.js";

// Pixi v8 default filter vertex shader
// Source: pixijs/src/filters/defaults/defaultFilter.vert
const defaultFilterVert = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreenPos;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  // Pass absolute screen position to fragment shader so it doesn't
  // need to re-declare uInputSize/uOutputFrame (avoids precision mismatch).
  vScreenPos = aPosition * uOutputFrame.zw + uOutputFrame.xy;
}
`;

const waterSurfaceFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Custom uniforms (bound via resources.waterUniforms)
uniform vec3 uWaterColor;
uniform float uWaterAlpha;
uniform float uMaskThreshold;
uniform vec3 uDepthCoeffs;
uniform float uDepthDarken;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uDepthBands;
uniform float uTime;
uniform float uSparkleScale;
uniform float uSparkleSpeed;
uniform float uSparkleThreshold;
uniform float uSparkleIntensity;

// --- 2D gradient noise (Perlin-style) ---

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep
  return mix(
    mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
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

  // Darken the water colour based on depth (deeper = darker)
  float darken = mix(1.0, uDepthDarken, depthWithNoise);
  vec3 depthColor = uWaterColor * darken;

  // Deeper water is slightly more opaque (harder to see riverbed)
  float depthAlpha = mix(uWaterAlpha, min(uWaterAlpha + 0.25, 1.0), depthWithNoise);

  vec3 color = mix(tex.rgb, depthColor, mask);
  float alpha = mix(tex.a, depthAlpha, mask);

  // --- Sparkles: dual scrolling noise subtracted for chaotic glints ---
  // Two Perlin noise layers scroll in opposite directions along the
  // isometric X axis. Where they peak in opposite polarities, the
  // difference spikes — a hard step isolates those rare points as
  // bright sparkle pixels.
  float t = floor(uTime * 24.0) / 24.0; // 24 FPS quantized
  vec2 scrollDir = vec2(0.894, 0.447);   // isometric X direction
  vec2 sp = vScreenPos * uSparkleScale;

  float n1 = gradientNoise(sp + scrollDir * t * uSparkleSpeed);
  float n2 = gradientNoise(sp * 1.3 - scrollDir * t * uSparkleSpeed + 50.0);

  float diff = n1 - n2;
  float sparkle = step(uSparkleThreshold, abs(diff));

  // Clip with a dense high-frequency noise to break blobs into smaller fragments
  float clipNoise = gradientNoise(sp * 2.0);
  sparkle *= step(0.0, clipNoise);

  // Where sparkles are active, force pure white at full opacity
  // so they punch through the semi-transparent water surface.
  color = mix(color, vec3(1.0), sparkle * mask);
  alpha = mix(alpha, 1.0, sparkle * mask);

  // Output premultiplied alpha (PixiJS internal format)
  finalColor = vec4(color * alpha, alpha);
}
`;

/**
 * Create the water surface filter.
 *
 * @param {Object} options
 * @param {number[]} options.waterColor     - RGB [0-1] base water colour  (default [0.17, 0.45, 0.63])
 * @param {number}   options.waterAlpha     - base opacity                 (default 0.7)
 * @param {number}   options.maskThreshold  - brightness cutoff for mask   (default 0.9)
 * @param {number[]} options.depthCoeffs    - [A,B,C] where depth = A*sx + B*sy + C (required)
 * @param {number}   options.depthDarken    - brightness at max depth 0-1  (default 0.4)
 * @param {number}   options.noiseScale     - noise frequency              (default 0.015)
 * @param {number}   options.noiseStrength  - noise amplitude              (default 0.15)
 * @param {number}   options.depthBands     - quantize depth into N steps  (default 0 = smooth)
 * @param {number}   options.sparkleScale   - sparkle noise frequency     (default 0.03)
 * @param {number}   options.sparkleSpeed   - sparkle scroll speed        (default 1.0)
 * @param {number}   options.sparkleThreshold - rarity threshold 0-2      (default 1.4)
 * @param {number}   options.sparkleIntensity - sparkle brightness 0-1    (default 0.4)
 */
export function createWaterSurfaceShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: defaultFilterVert,
    fragment: waterSurfaceFragment,
    name: "water-surface-filter",
  });

  const waterUniforms = new UniformGroup({
    uWaterColor: {
      value: options.waterColor || [0.17, 0.45, 0.63],
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
    uDepthDarken: {
      value: Number.isFinite(options.depthDarken) ? options.depthDarken : 0.4,
      type: "f32",
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
    uTime: {
      value: 0,
      type: "f32",
    },
    uSparkleScale: {
      value: Number.isFinite(options.sparkleScale)
        ? options.sparkleScale
        : 0.08,
      type: "f32",
    },
    uSparkleSpeed: {
      value: Number.isFinite(options.sparkleSpeed) ? options.sparkleSpeed : 1.0,
      type: "f32",
    },
    uSparkleThreshold: {
      value: Number.isFinite(options.sparkleThreshold)
        ? options.sparkleThreshold
        : 0.63,
      type: "f32",
    },
    uSparkleIntensity: {
      value: Number.isFinite(options.sparkleIntensity)
        ? options.sparkleIntensity
        : 0.4,
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
