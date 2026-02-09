import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { filterVertWithScreenPos } from "./filterVert.js";

const edgeFoamFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vScreenPos;

out vec4 finalColor;

uniform sampler2D uTexture;

// Edge band
uniform vec2 uEdgeLinePoint;
uniform vec2 uEdgeLineNormal;
uniform float uBaseWidthPx;
uniform float uChopWidthPx;
uniform float uVarWidthPx;
uniform float uEdgeBleedPx;
uniform float uEdgeNoiseScale;
uniform float uEdgeNoiseAmp;
uniform float uCoreWidthRatio;
uniform float uMinWidthPx;
uniform float uMaxWidthPx;

// Dynamic controls (updated per-frame from ticker)
uniform float uFlowPhase;
uniform float uChoppiness;

// Color & opacity
uniform vec3 uFoamColor;
uniform float uFoamAlpha;

// Flow & coordinate system
uniform vec2 uNoiseBasisX;
uniform vec2 uNoiseBasisY;

// --- 2D gradient noise (Perlin-style) ---

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
  // --- Transform screen position into isometric-aligned noise space ---
  // --- Transform screen position into isometric-aligned noise space ---
  vec2 foamBasis = vec2(
    dot(vScreenPos, uNoiseBasisX),
    dot(vScreenPos, uNoiseBasisY)
  );

  // --- Edge band mask (distance to river wall in screen space) ---
  float distToEdge = dot(vScreenPos - uEdgeLinePoint, uEdgeLineNormal);
  float chop = max(uChoppiness, 0.0);
  float chopT = smoothstep(0.0, 1.0, min(chop, 1.5));
  float baseWidth = uBaseWidthPx + uChopWidthPx * pow(chopT, 1.7);

  // Thickness variation along the wall (constant band, uneven width)
  vec2 edgeTangent = vec2(-uEdgeLineNormal.y, uEdgeLineNormal.x);
  float edgeT = dot(vScreenPos - uEdgeLinePoint, edgeTangent);
  float wavePhase = edgeT * uEdgeNoiseScale * 0.14 + uFlowPhase * 0.25;
  float wave = sin(wavePhase) * 0.5 + 0.5;
  float thicknessNoise = gradientNoise(
    vec2(edgeT * uEdgeNoiseScale * 0.09, uFlowPhase * 0.1)
  );
  float thicknessT = mix(wave, thicknessNoise * 0.5 + 0.5, 0.35);
  float widthPx = baseWidth + thicknessT * uVarWidthPx;
  widthPx = clamp(widthPx, uMinWidthPx, uMaxWidthPx);

  float edgeDistort = gradientNoise(
    vec2(edgeT * uEdgeNoiseScale * 0.9, uFlowPhase * 0.35)
  ) * uEdgeNoiseAmp * 0.55;
  float edgeDistortHi = gradientNoise(
    vec2(edgeT * uEdgeNoiseScale * 3.4, uFlowPhase * 1.1)
  ) * uEdgeNoiseAmp * 0.35;
  float edgePos = distToEdge + edgeDistort + edgeDistortHi;

  float inner = step(-uEdgeBleedPx, edgePos);
  float outer = 1.0 - step(widthPx, edgePos);
  float edgeBand = inner * outer;

  float localPos = max(edgePos + uEdgeBleedPx, 0.0);
  float core = step(localPos, widthPx * uCoreWidthRatio);
  float foamAlpha = mix(uFoamAlpha * 0.65, uFoamAlpha, core);

  float alpha = foamAlpha * edgeBand;
  vec3 color = uFoamColor * alpha;
  finalColor = vec4(color, alpha);
}
`;

/**
 * Create the edge foam overlay filter.
 *
 * Renders a thin, irregular foam band aligned to the river wall (world Y=0),
 * widening nonlinearly with choppiness and scrolling with current flow.
 */
export function createEdgeFoamShader(options = {}) {
  const glProgram = GlProgram.from({
    vertex: filterVertWithScreenPos,
    fragment: edgeFoamFragment,
    name: "edge-foam-filter",
  });

  const edgeFoamUniforms = new UniformGroup({
    uEdgeLinePoint: {
      value:
        Array.isArray(options.edgeLinePoint) &&
        options.edgeLinePoint.length === 2
          ? options.edgeLinePoint
          : [0, 0],
      type: "vec2<f32>",
    },
    uEdgeLineNormal: {
      value:
        Array.isArray(options.edgeLineNormal) &&
        options.edgeLineNormal.length === 2
          ? options.edgeLineNormal
          : [0, 1],
      type: "vec2<f32>",
    },
    uBaseWidthPx: {
      value: Number.isFinite(options.baseWidthPx) ? options.baseWidthPx : 2.0,
      type: "f32",
    },
    uChopWidthPx: {
      value: Number.isFinite(options.chopWidthPx) ? options.chopWidthPx : 1.5,
      type: "f32",
    },
    uVarWidthPx: {
      value: Number.isFinite(options.varWidthPx) ? options.varWidthPx : 2.5,
      type: "f32",
    },
    uEdgeBleedPx: {
      value: Number.isFinite(options.edgeBleedPx) ? options.edgeBleedPx : 2,
      type: "f32",
    },
    uEdgeNoiseScale: {
      value: Number.isFinite(options.edgeNoiseScale)
        ? options.edgeNoiseScale
        : 0.02,
      type: "f32",
    },
    uEdgeNoiseAmp: {
      value: Number.isFinite(options.edgeNoiseAmp) ? options.edgeNoiseAmp : 3.0,
      type: "f32",
    },
    uCoreWidthRatio: {
      value: Number.isFinite(options.coreWidthRatio)
        ? options.coreWidthRatio
        : 0.9,
      type: "f32",
    },
    uMinWidthPx: {
      value: Number.isFinite(options.minWidthPx) ? options.minWidthPx : 2.0,
      type: "f32",
    },
    uMaxWidthPx: {
      value: Number.isFinite(options.maxWidthPx) ? options.maxWidthPx : 4.0,
      type: "f32",
    },
    uFoamColor: {
      value: options.foamColor || [0.953, 0.953, 0.953],
      type: "vec3<f32>",
    },
    uFoamAlpha: {
      value: Number.isFinite(options.foamAlpha) ? options.foamAlpha : 1.0,
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
      edgeFoamUniforms,
    },
    padding: 0,
  });
}
