import { Filter, GlProgram, UniformGroup } from "pixi.js";

// Pixi v8 default filter vertex shader (same as waterSurfaceShader)
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
  vScreenPos = aPosition * uOutputFrame.zw + uOutputFrame.xy;
}
`;

const sparkleFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

uniform float uMaskThreshold;
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

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec4 tex = texture(uTexture, vTextureCoord);

  // Skip transparent pixels (gaps between diamond-shaped iso tiles)
  if (tex.a < 0.01) {
    finalColor = vec4(0.0);
    return;
  }

  float maxChannel = max(max(tex.r, tex.g), tex.b);
  float mask = 1.0 - step(uMaskThreshold, maxChannel);

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
  float alpha = sparkle * mask;
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
 * @param {number}   options.maskThreshold  - brightness cutoff for mask   (default 0.9)
 * @param {number}   options.sparkleScale   - sparkle noise frequency     (default 0.08)
 * @param {number}   options.sparkleSpeed   - sparkle scroll speed        (default 1.0)
 * @param {number}   options.sparkleThreshold - rarity threshold 0-2      (default 0.63)
 * @param {number}   options.sparkleClipDebug - show clip noise 0/1       (default 0)
 * @param {number[]} options.flowDir          - normalized screen-space flow direction [x,y]
 * @param {number[]} options.noiseBasisX      - screen-space iso X basis [x,y] (default [1,0])
 * @param {number[]} options.noiseBasisY      - screen-space iso Y basis [x,y] (default [0,1])
 */
export function createSparkleShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: defaultFilterVert,
    fragment: sparkleFragment,
    name: "sparkle-overlay-filter",
  });

  const sparkleUniforms = new UniformGroup({
    uMaskThreshold: {
      value: Number.isFinite(options.maskThreshold)
        ? options.maskThreshold
        : 0.9,
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
