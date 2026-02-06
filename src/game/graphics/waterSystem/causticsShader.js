import { Filter, GlProgram, UniformGroup } from "pixi.js";

// Same custom vertex shader as waterSurfaceShader.js — passes vScreenPos
// as a varying so the fragment shader can compute isometric depth without
// re-declaring uInputSize/uOutputFrame (avoids precision mismatch).
const causticsVert = /* glsl */ `
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

// --- Hash for Voronoi cell centres ---

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// Simple value noise for coordinate warping
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash22(i), vec2(1.0));
  float b = dot(hash22(i + vec2(1.0, 0.0)), vec2(1.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), vec2(1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), vec2(1.0));
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
      vec2 cellCenter = hash22(i + neighbor);
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
  vec2 basePos = vScreenPos * uCausticsScale * 0.01;
  // Quantize time to 12 FPS for pixel art animation style
  float t = floor(uTime * uCausticsSpeed * 24.0) / 24.0;
  vec2 warp = vec2(
    valueNoise(basePos * 3.0 + vec2(t * 0.3, t * 0.2) + 50.0),
    valueNoise(basePos * 3.0 + vec2(t * -0.2, t * 0.35) + 100.0)
  );
  vec2 warpedPos = basePos + (warp - 0.5) * 0.2;

  // Two Voronoi F2-F1 layers at different scales for natural interference.
  float v1 = voronoiCaustic(warpedPos);
  float v2 = voronoiCaustic(warpedPos * 1.7);

  // Combine layers — min emphasises the brightest web lines from either layer
  float edgeDist = min(v1, v2);

  // Hard-edged caustic lines (fully aliased for pixel art)
  float caustic = 1.0 - step(0.08, edgeDist);

  // Specular highlight: brighter core in the thickest parts of the lines.
  // A tighter threshold picks out only the very centre of each line.
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
 * @param {number}   options.specularIntensity - specular core brightness        (default 0.4)
 * @param {number[]} options.causticsColor     - RGB tint for light              (default [1, 0.95, 0.8])
 */
export function createCausticsShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: causticsVert,
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
  });

  return new Filter({
    glProgram,
    resources: {
      causticsUniforms,
    },
    padding: 0,
  });
}
