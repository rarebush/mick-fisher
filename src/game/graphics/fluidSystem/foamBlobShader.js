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
uniform float uBandCount;
uniform float uAlphaScale;
uniform float uBlurStrength;
uniform vec3 uCoreColor;
uniform vec3 uEdgeColor;

void main() {
  float c = texture(uTexture, vTextureCoord).r;
  float n = texture(uTexture, vTextureCoord + vec2(0.0, uTexelSize.y)).r;
  float s = texture(uTexture, vTextureCoord - vec2(0.0, uTexelSize.y)).r;
  float e = texture(uTexture, vTextureCoord + vec2(uTexelSize.x, 0.0)).r;
  float w = texture(uTexture, vTextureCoord - vec2(uTexelSize.x, 0.0)).r;
  float blur = (c + n + s + e + w) * 0.2;
  float d = mix(c, blur, uBlurStrength);

  float blob = smoothstep(uThresholdLow, uThresholdHigh, d);
  float bands = floor(blob * uBandCount + 0.0001) / uBandCount;
  float alpha = smoothstep(uAlphaLow, uAlphaHigh, d) * uAlphaScale;

  vec3 color = mix(uEdgeColor, uCoreColor, bands);
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
    uBandCount: { value: options.bandCount ?? 4.0, type: "f32" },
    uAlphaScale: { value: options.alphaScale ?? 0.9, type: "f32" },
    uBlurStrength: { value: options.blurStrength ?? 0.6, type: "f32" },
    uCoreColor: {
      value: options.coreColor ?? [1.0, 1.0, 1.0],
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
