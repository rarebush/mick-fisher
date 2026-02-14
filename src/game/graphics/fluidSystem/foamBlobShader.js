import { Filter, GlProgram, UniformGroup } from "pixi.js";

const defaultFilterVert = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const foamBlobFragment = /* glsl */ `
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;
uniform float uThresholdLow;
uniform float uThresholdHigh;
uniform float uAlphaLow;
uniform float uAlphaHigh;
uniform float uStepThreshold1;
uniform float uStepThreshold2;
uniform float uDensityPower;
uniform float uAlphaScale;
uniform float uBlurStrength;
uniform vec3 uCoreColor;
uniform vec3 uMidColor;
uniform vec3 uEdgeColor;

void main() {
  float c = texture(uTexture, vTextureCoord).r;
  vec2 texel2 = uTexelSize * 2.0;
  float n = texture(uTexture, vTextureCoord + vec2(0.0, uTexelSize.y)).r;
  float s = texture(uTexture, vTextureCoord - vec2(0.0, uTexelSize.y)).r;
  float e = texture(uTexture, vTextureCoord + vec2(uTexelSize.x, 0.0)).r;
  float w = texture(uTexture, vTextureCoord - vec2(uTexelSize.x, 0.0)).r;
  float n2 = texture(uTexture, vTextureCoord + vec2(0.0, texel2.y)).r;
  float s2 = texture(uTexture, vTextureCoord - vec2(0.0, texel2.y)).r;
  float e2 = texture(uTexture, vTextureCoord + vec2(texel2.x, 0.0)).r;
  float w2 = texture(uTexture, vTextureCoord - vec2(texel2.x, 0.0)).r;
  float blur = (c + n + s + e + w + n2 + s2 + e2 + w2) * 0.11111111;
  float d = mix(c, blur, uBlurStrength);

  float density = smoothstep(uThresholdLow, uThresholdHigh, d);
  density = pow(density, uDensityPower);
  float alpha = smoothstep(uAlphaLow, uAlphaHigh, d) * uAlphaScale;

  float step1 = step(uStepThreshold1, density);
  float step2 = step(uStepThreshold2, density);
  vec3 color = mix(uEdgeColor, uMidColor, step1);
  color = mix(color, uCoreColor, step2);
  finalColor = vec4(color * alpha, alpha);
}
`;

export function createFoamBlobFilter(options = {}) {
  const uniforms = new UniformGroup({
    uTexelSize: { value: options.texelSize ?? [1, 1], type: "vec2<f32>" },
    uThresholdLow: { value: options.thresholdLow ?? 0.08, type: "f32" },
    uThresholdHigh: { value: options.thresholdHigh ?? 0.28, type: "f32" },
    uAlphaLow: { value: options.alphaLow ?? 0.05, type: "f32" },
    uAlphaHigh: { value: options.alphaHigh ?? 0.22, type: "f32" },
    uStepThreshold1: { value: options.stepThreshold1 ?? 0.45, type: "f32" },
    uStepThreshold2: { value: options.stepThreshold2 ?? 0.7, type: "f32" },
    uDensityPower: { value: options.densityPower ?? 1.6, type: "f32" },
    uAlphaScale: { value: options.alphaScale ?? 0.9, type: "f32" },
    uBlurStrength: { value: options.blurStrength ?? 0.6, type: "f32" },
    uCoreColor: {
      value: options.coreColor ?? [1.0, 1.0, 1.0],
      type: "vec3<f32>",
    },
    uMidColor: {
      value: options.midColor ?? [0.92, 0.94, 0.92],
      type: "vec3<f32>",
    },
    uEdgeColor: {
      value: options.edgeColor ?? [0.82, 0.9, 1.0],
      type: "vec3<f32>",
    },
  });

  const glProgram = GlProgram.from({
    vertex: defaultFilterVert,
    fragment: foamBlobFragment,
    name: "foam-blob",
  });

  return new Filter({
    glProgram,
    resources: {
      foamBlobUniforms: uniforms,
    },
    padding: 0,
  });
}
