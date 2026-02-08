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
uniform vec3 uWaterColorNear;
uniform vec3 uWaterColorFar;
uniform float uWaterAlpha;
uniform float uMaskThreshold;
uniform vec3 uDepthCoeffs;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uDepthBands;
uniform vec3 uSkyColor;
uniform float uReflectionStrength;
uniform float uFresnelPower;

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

  // Blend between near and far water colours based on depth
  vec3 depthColor = mix(uWaterColorNear, uWaterColorFar, depthWithNoise);

  // Deeper water is slightly more opaque (harder to see riverbed)
  float depthAlpha = mix(uWaterAlpha, min(uWaterAlpha + 0.25, 1.0), depthWithNoise);

  vec3 color = mix(tex.rgb, depthColor, mask);
  float alpha = mix(tex.a, depthAlpha, mask);

  // Sky reflection increases toward the far edge (grazing angle in iso view)
  float fresnel = pow(depth, uFresnelPower);
  float reflection = fresnel * uReflectionStrength;
  color = mix(color, uSkyColor, reflection * mask);
  alpha = mix(alpha, 1.0, reflection * mask);

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
 * @param {number[]} options.skyColor       - RGB sky reflection color     (default [0.5, 0.7, 0.9])
 * @param {number}   options.reflectionStrength - reflection amount 0-1    (default 0.35)
 * @param {number}   options.fresnelPower   - reflection falloff exponent  (default 1.6)
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
    vertex: defaultFilterVert,
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
    uSkyColor: {
      value: options.skyColor || [0.5, 0.7, 0.9],
      type: "vec3<f32>",
    },
    uReflectionStrength: {
      value: Number.isFinite(options.reflectionStrength)
        ? options.reflectionStrength
        : 0.35,
      type: "f32",
    },
    uFresnelPower: {
      value: Number.isFinite(options.fresnelPower) ? options.fresnelPower : 1.6,
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
