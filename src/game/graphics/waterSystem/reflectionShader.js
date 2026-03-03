import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const reflectionFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Depth & opacity
uniform vec3 uDepthCoeffs;
uniform float uReflectionAlpha;

// Sky
uniform vec3 uSkyColorNear;
uniform vec3 uSkyColorFar;

// Clouds
uniform vec3 uCloudColor;
uniform float uCloudScale;
uniform float uCloudCover;
uniform float uCloudAlpha;
uniform float uTime;
uniform vec2 uWindDir;
uniform vec2 uNoiseBasisX;
uniform vec2 uNoiseBasisY;
uniform float uMorphTime;
uniform float uMorphScale;
uniform float uMorphStrength;
uniform vec2 uLightDir;
uniform float uLightOffset;
uniform float uLightStrength;
uniform float uSoftEdges;
uniform float uSoftLight;

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
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22s(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22s(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22s(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22s(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian motion — 3 octaves for organic cloud shapes
float fbm(vec2 p) {
  float val  = 0.5   * gradientNoise(p);
  val       += 0.25  * gradientNoise(p * 2.0);
  val       += 0.125 * gradientNoise(p * 4.0);
  return val;
}

// --- main ---

void main() {
  vec4 tex = texture(uTexture, vTextureCoord);

  // Isometric depth (0 = near/shallow, 1 = far/deep)
  float depth = uDepthCoeffs.x * vScreenPos.x
              + uDepthCoeffs.y * vScreenPos.y
              + uDepthCoeffs.z;
  depth = clamp(depth, 0.0, 1.0);

  // --- Sky gradient ---
  vec3 sky = mix(uSkyColorNear, uSkyColorFar, depth);

  // --- Procedural clouds ---
  // Transform screen position into isometric-aligned noise space
  vec2 noiseBasis = vec2(
    dot(vScreenPos, uNoiseBasisX),
    dot(vScreenPos, uNoiseBasisY)
  );
  // Scroll wind direction into noise space
  vec2 windInBasis = vec2(
    dot(uWindDir, uNoiseBasisX),
    dot(uWindDir, uNoiseBasisY)
  );
  vec2 cloudPos = noiseBasis * uCloudScale - windInBasis * uTime;

  float baseNoise = fbm(cloudPos);
  float morphNoise = fbm(cloudPos * uMorphScale + vec2(uMorphTime));
  float noise = mix(baseNoise, morphNoise, uMorphStrength);

  // Map to [0,1] for coverage control
  float n01 = noise * 0.5 + 0.5;
  float coverInput = clamp(uCloudCover, 0.0, 1.0);
  float coverT = clamp((coverInput - 0.1) / 0.65, 0.0, 1.0);
  float coverage = mix(0.43, 0.6, coverT);
  float threshold = clamp(1.0 - coverage + 0.02, 0.0, 1.0);
  float cloudMask = mix(
    step(threshold, n01),
    smoothstep(threshold - 0.03, threshold + 0.03, n01),
    step(0.5, uSoftEdges)
  );

  // Directional lighting using an offset noise sample
  float lightLen = max(length(uLightDir), 0.001);
  vec2 lightDir = uLightDir / lightLen;
  float lightSample = fbm(cloudPos + lightDir * uLightOffset);
  float lightN01 = lightSample * 0.5 + 0.5;
  float lit = mix(
    step(0.0, lightN01 - n01),
    smoothstep(-0.05, 0.05, lightN01 - n01),
    step(0.5, uSoftLight)
  );
  float brightness = mix(1.0 - uLightStrength, 1.0, lit);
  vec3 cloudColor = uCloudColor * brightness;

  // Composite: sky, then clouds on top
  vec3 reflection = mix(sky, cloudColor, cloudMask * uCloudAlpha);

  // Composite sky+clouds behind wall tiles at full opacity first,
  // then apply uReflectionAlpha to the entire result.
  vec3 bgColor = reflection;

  // Un-premultiply wall tile color (PixiJS stores premultiplied)
  vec3 wallColor = tex.rgb / max(tex.a, 0.001);
  float wallAlpha = tex.a;

  // Alpha-over: wall tiles on top of sky+clouds (both at full opacity)
  vec3 color = mix(bgColor, wallColor, wallAlpha);

  // Apply reflection opacity to the entire composite
  float alpha = uReflectionAlpha;

  // Output premultiplied alpha (PixiJS internal format)
  finalColor = vec4(color * alpha, alpha);
}
`;

/**
 * Create the reflection filter for sky, clouds, and wall reflections.
 *
 * Applied to the reflectionContainer. Generates procedural sky gradient
 * and hard-edged FBM clouds behind the existing wall reflection sprites.
 *
 * Compositing: sky + clouds are composited behind wall tiles at full opacity
 * first, then `uReflectionAlpha` is applied as a single opacity multiplier to
 * the entire result. This ensures that lowering the slider fades the whole
 * reflection uniformly — wall tiles don't become transparent and reveal
 * clouds behind them.
 *
 * @param {Object} options
 * @param {number[]} options.depthCoeffs       - [A,B,C] depth = A*sx + B*sy + C (required)
 * @param {number[]} options.skyColorNear      - RGB sky at near edge       (default [0.55, 0.75, 0.95])
 * @param {number[]} options.skyColorFar       - RGB sky at far edge        (default [0.35, 0.55, 0.85])
 * @param {number[]} options.cloudColor        - RGB cloud tint             (default [0.9, 0.92, 0.95])
 * @param {number}   options.cloudScale        - FBM noise frequency        (default 0.008)
 * @param {number}   options.cloudCover        - cover 0-1 (not full)        (default 0.5)
 * @param {number}   options.cloudAlpha        - cloud opacity 0-1          (default 0.6)
 * @param {number}   options.morphScale        - morph noise scale          (default 0.35)
 * @param {number}   options.morphStrength     - morph blend 0-1            (default 0.5)
 * @param {number}   options.lightOffset       - light sample offset        (default 0.45)
 * @param {number}   options.lightStrength     - lighting contrast 0-1      (default 0.25)
 * @param {number[]} options.lightDir          - light direction [x,y]      (default [0.6,-0.8])
 * @param {number}   options.softEdges         - cloud edge smoothing 0/1   (default 0)
 * @param {number}   options.softLight         - light edge smoothing 0/1   (default 0)
 * @param {number[]} options.windDir           - screen-space wind [x,y]    (default [1,0])
 * @param {number}   options.reflectionAlpha   - global reflection opacity  (default 0.35)
 * @param {number[]} options.noiseBasisX       - iso X basis [x,y]          (default [1,0])
 * @param {number[]} options.noiseBasisY       - iso Y basis [x,y]          (default [0,1])
 */
export function createReflectionShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: reflectionFragment,
    name: "reflection-filter",
  });

  const reflectionUniforms = new UniformGroup({
    uDepthCoeffs: {
      value: options.depthCoeffs || [0, 0, 0],
      type: "vec3<f32>",
    },
    uSkyColorNear: {
      value: options.skyColorNear || [0.55, 0.75, 0.95],
      type: "vec3<f32>",
    },
    uSkyColorFar: {
      value: options.skyColorFar || [0.35, 0.55, 0.85],
      type: "vec3<f32>",
    },
    uCloudColor: {
      value: options.cloudColor || [0.9, 0.92, 0.95],
      type: "vec3<f32>",
    },
    uCloudScale: {
      value: Number.isFinite(options.cloudScale) ? options.cloudScale : 0.008,
      type: "f32",
    },
    uCloudCover: {
      value: Number.isFinite(options.cloudCover) ? options.cloudCover : 0.5,
      type: "f32",
    },
    uCloudAlpha: {
      value: Number.isFinite(options.cloudAlpha) ? options.cloudAlpha : 0.6,
      type: "f32",
    },
    uMorphTime: {
      value: 0,
      type: "f32",
    },
    uMorphScale: {
      value: Number.isFinite(options.morphScale) ? options.morphScale : 0.35,
      type: "f32",
    },
    uMorphStrength: {
      value: Number.isFinite(options.morphStrength)
        ? options.morphStrength
        : 0.5,
      type: "f32",
    },
    uLightDir: {
      value:
        Array.isArray(options.lightDir) && options.lightDir.length === 2
          ? options.lightDir
          : [0.6, -0.8],
      type: "vec2<f32>",
    },
    uLightOffset: {
      value: Number.isFinite(options.lightOffset) ? options.lightOffset : 0.45,
      type: "f32",
    },
    uLightStrength: {
      value: Number.isFinite(options.lightStrength)
        ? options.lightStrength
        : 0.25,
      type: "f32",
    },
    uSoftEdges: {
      value: Number.isFinite(options.softEdges) ? options.softEdges : 0,
      type: "f32",
    },
    uSoftLight: {
      value: Number.isFinite(options.softLight) ? options.softLight : 0,
      type: "f32",
    },
    uWindDir: {
      value:
        Array.isArray(options.windDir) && options.windDir.length === 2
          ? options.windDir
          : [1, 0],
      type: "vec2<f32>",
    },
    uTime: {
      value: 0,
      type: "f32",
    },
    uReflectionAlpha: {
      value: Number.isFinite(options.reflectionAlpha)
        ? options.reflectionAlpha
        : 0.35,
      type: "f32",
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
  });

  return new Filter({
    glProgram,
    resources: {
      reflectionUniforms,
    },
    padding: 0,
  });
}
