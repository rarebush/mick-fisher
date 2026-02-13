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

const commonPreamble = /* glsl */ `
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;

vec2 decodeVelocity(vec2 enc) {
  return enc * 2.0 - 1.0;
}

vec2 encodeVelocity(vec2 v) {
  return v * 0.5 + 0.5;
}

float decodeScalar(float enc) {
  return enc * 2.0 - 1.0;
}

float encodeScalar(float v) {
  return v * 0.5 + 0.5;
}
`;

const advectionFragment = /* glsl */ `
${commonPreamble}

uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;

void main() {
  vec2 velocity = decodeVelocity(texture(uTexture, vTextureCoord).rg);
  vec2 prevUV = vTextureCoord - velocity * uDt;
  vec2 advected = decodeVelocity(texture(uTexture, prevUV).rg);
  advected *= uDissipation;
  finalColor = vec4(encodeVelocity(advected), 0.0, 1.0);
}
`;

const applyForcesFragment = /* glsl */ `
${commonPreamble}

uniform float uDt;
uniform vec2 uForce;

void main() {
  vec2 velocity = decodeVelocity(texture(uTexture, vTextureCoord).rg);
  velocity += uForce * uDt;
  finalColor = vec4(encodeVelocity(velocity), 0.0, 1.0);
}
`;

const divergenceFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uBoundary;
uniform vec2 uTexelSize;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

vec2 sampleVelocity(vec2 uv) {
  return decodeVelocity(texture(uTexture, uv).rg);
}

void main() {
  float obstacle = obstacleAt(vTextureCoord);
  if (obstacle > 0.5) {
    finalColor = vec4(encodeScalar(0.0), 0.0, 0.0, 1.0);
    return;
  }

  vec2 dx = vec2(uTexelSize.x, 0.0);
  vec2 dy = vec2(0.0, uTexelSize.y);

  vec2 vL = sampleVelocity(vTextureCoord - dx);
  vec2 vR = sampleVelocity(vTextureCoord + dx);
  vec2 vB = sampleVelocity(vTextureCoord - dy);
  vec2 vT = sampleVelocity(vTextureCoord + dy);

  float div = 0.5 * ((vR.x - vL.x) + (vT.y - vB.y));
  finalColor = vec4(encodeScalar(div), 0.0, 0.0, 1.0);
}
`;

const jacobiPressureFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uDivergence;
uniform sampler2D uBoundary;
uniform vec2 uTexelSize;
uniform float uAlpha;
uniform float uBeta;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

float samplePressure(vec2 uv) {
  return decodeScalar(texture(uTexture, uv).r);
}

void main() {
  float obstacle = obstacleAt(vTextureCoord);

  vec2 dx = vec2(uTexelSize.x, 0.0);
  vec2 dy = vec2(0.0, uTexelSize.y);

  float pL = samplePressure(vTextureCoord - dx);
  float pR = samplePressure(vTextureCoord + dx);
  float pB = samplePressure(vTextureCoord - dy);
  float pT = samplePressure(vTextureCoord + dy);

  if (obstacle > 0.5) {
    float avg = (pL + pR + pB + pT) * 0.25;
    finalColor = vec4(encodeScalar(avg), 0.0, 0.0, 1.0);
    return;
  }

  float div = decodeScalar(texture(uDivergence, vTextureCoord).r);
  float p = (pL + pR + pB + pT + uAlpha * div) / uBeta;
  finalColor = vec4(encodeScalar(p), 0.0, 0.0, 1.0);
}
`;

const jacobiVelocityFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uSource;
uniform sampler2D uBoundary;
uniform vec2 uTexelSize;
uniform float uAlpha;
uniform float uBeta;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

vec2 sampleVelocity(vec2 uv) {
  return decodeVelocity(texture(uTexture, uv).rg);
}

vec2 sampleSource(vec2 uv) {
  return decodeVelocity(texture(uSource, uv).rg);
}

void main() {
  float obstacle = obstacleAt(vTextureCoord);
  if (obstacle > 0.5) {
    finalColor = vec4(encodeVelocity(vec2(0.0)), 0.0, 1.0);
    return;
  }

  vec2 dx = vec2(uTexelSize.x, 0.0);
  vec2 dy = vec2(0.0, uTexelSize.y);

  vec2 vL = sampleVelocity(vTextureCoord - dx);
  vec2 vR = sampleVelocity(vTextureCoord + dx);
  vec2 vB = sampleVelocity(vTextureCoord - dy);
  vec2 vT = sampleVelocity(vTextureCoord + dy);
  vec2 v0 = sampleSource(vTextureCoord);

  vec2 v = (vL + vR + vB + vT + v0 * uAlpha) / uBeta;
  finalColor = vec4(encodeVelocity(v), 0.0, 1.0);
}
`;

const gradientSubtractFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uPressure;
uniform sampler2D uBoundary;
uniform vec2 uTexelSize;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

float samplePressure(vec2 uv) {
  return decodeScalar(texture(uPressure, uv).r);
}

void main() {
  float obstacle = obstacleAt(vTextureCoord);
  if (obstacle > 0.5) {
    finalColor = vec4(encodeVelocity(vec2(0.0)), 0.0, 1.0);
    return;
  }

  vec2 dx = vec2(uTexelSize.x, 0.0);
  vec2 dy = vec2(0.0, uTexelSize.y);

  float pL = samplePressure(vTextureCoord - dx);
  float pR = samplePressure(vTextureCoord + dx);
  float pB = samplePressure(vTextureCoord - dy);
  float pT = samplePressure(vTextureCoord + dy);

  vec2 velocity = decodeVelocity(texture(uTexture, vTextureCoord).rg);
  velocity -= 0.5 * vec2(pR - pL, pT - pB);

  finalColor = vec4(encodeVelocity(velocity), 0.0, 1.0);
}
`;

const velocityBoundaryFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uBoundary;
uniform vec2 uTexelSize;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

vec2 sampleVelocity(vec2 uv) {
  return decodeVelocity(texture(uTexture, uv).rg);
}

void main() {
  vec2 uv = vTextureCoord;
  bool edge = uv.x <= uTexelSize.x || uv.x >= 1.0 - uTexelSize.x ||
              uv.y <= uTexelSize.y || uv.y >= 1.0 - uTexelSize.y;

  float obstacle = obstacleAt(uv);
  if (edge || obstacle > 0.5) {
    vec2 dx = vec2(uTexelSize.x, 0.0);
    vec2 dy = vec2(0.0, uTexelSize.y);

    vec2 sum = vec2(0.0);
    float count = 0.0;

    vec2 uvL = uv - dx;
    vec2 uvR = uv + dx;
    vec2 uvB = uv - dy;
    vec2 uvT = uv + dy;

    float oL = obstacleAt(uvL);
    float oR = obstacleAt(uvR);
    float oB = obstacleAt(uvB);
    float oT = obstacleAt(uvT);

    if (oL < 0.5) { sum += sampleVelocity(uvL); count += 1.0; }
    if (oR < 0.5) { sum += sampleVelocity(uvR); count += 1.0; }
    if (oB < 0.5) { sum += sampleVelocity(uvB); count += 1.0; }
    if (oT < 0.5) { sum += sampleVelocity(uvT); count += 1.0; }

    vec2 avg = count > 0.0 ? sum / count : vec2(0.0);
    finalColor = vec4(encodeVelocity(-avg), 0.0, 1.0);
    return;
  }

  vec2 velocity = sampleVelocity(uv);
  finalColor = vec4(encodeVelocity(velocity), 0.0, 1.0);
}
`;

const pressureBoundaryFragment = /* glsl */ `
${commonPreamble}

uniform sampler2D uBoundary;
uniform vec2 uTexelSize;

float obstacleAt(vec2 uv) {
  float mask = texture(uBoundary, uv).r;
  return 1.0 - step(0.5, mask);
}

float samplePressure(vec2 uv) {
  return decodeScalar(texture(uTexture, uv).r);
}

void main() {
  vec2 uv = vTextureCoord;
  float obstacle = obstacleAt(uv);
  if (obstacle > 0.5) {
    vec2 dx = vec2(uTexelSize.x, 0.0);
    vec2 dy = vec2(0.0, uTexelSize.y);

    float pL = samplePressure(uv - dx);
    float pR = samplePressure(uv + dx);
    float pB = samplePressure(uv - dy);
    float pT = samplePressure(uv + dy);

    float avg = (pL + pR + pB + pT) * 0.25;
    finalColor = vec4(encodeScalar(avg), 0.0, 0.0, 1.0);
    return;
  }

  float pressure = samplePressure(uv);
  finalColor = vec4(encodeScalar(pressure), 0.0, 0.0, 1.0);
}
`;

const clearFragment = /* glsl */ `
${commonPreamble}

uniform vec4 uClearColor;

void main() {
  finalColor = uClearColor;
}
`;

function buildFilter(fragmentSource, uniformGroup, name) {
  const glProgram = GlProgram.from({
    vertex: defaultFilterVert,
    fragment: fragmentSource,
    name,
  });

  return new Filter({
    glProgram,
    resources: {
      fluidUniforms: uniformGroup,
    },
    padding: 0,
  });
}

export function createAdvectionFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
    uDt: { value: 0.016, type: "f32" },
    uDissipation: { value: 0.995, type: "f32" },
  });

  return {
    filter: buildFilter(advectionFragment, uniforms, "fluid-advection"),
    uniforms,
  };
}

export function createApplyForcesFilter() {
  const uniforms = new UniformGroup({
    uDt: { value: 0.016, type: "f32" },
    uForce: { value: [0, 0], type: "vec2<f32>" },
  });

  return {
    filter: buildFilter(applyForcesFragment, uniforms, "fluid-forces"),
    uniforms,
  };
}

export function createDivergenceFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
  });

  return {
    filter: buildFilter(divergenceFragment, uniforms, "fluid-divergence"),
    uniforms,
  };
}

export function createJacobiPressureFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
    uAlpha: { value: -1.0, type: "f32" },
    uBeta: { value: 4.0, type: "f32" },
  });

  return {
    filter: buildFilter(jacobiPressureFragment, uniforms, "fluid-pressure"),
    uniforms,
  };
}

export function createJacobiVelocityFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
    uAlpha: { value: 1.0, type: "f32" },
    uBeta: { value: 4.0, type: "f32" },
  });

  return {
    filter: buildFilter(
      jacobiVelocityFragment,
      uniforms,
      "fluid-velocity-diffuse",
    ),
    uniforms,
  };
}

export function createGradientSubtractFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
  });

  return {
    filter: buildFilter(gradientSubtractFragment, uniforms, "fluid-gradient"),
    uniforms,
  };
}

export function createVelocityBoundaryFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
  });

  return {
    filter: buildFilter(
      velocityBoundaryFragment,
      uniforms,
      "fluid-velocity-boundary",
    ),
    uniforms,
  };
}

export function createPressureBoundaryFilter() {
  const uniforms = new UniformGroup({
    uTexelSize: { value: [1, 1], type: "vec2<f32>" },
  });

  return {
    filter: buildFilter(
      pressureBoundaryFragment,
      uniforms,
      "fluid-pressure-boundary",
    ),
    uniforms,
  };
}

export function createClearFilter() {
  const uniforms = new UniformGroup({
    uClearColor: { value: [0.5, 0.5, 0.0, 1.0], type: "vec4<f32>" },
  });

  return {
    filter: buildFilter(clearFragment, uniforms, "fluid-clear"),
    uniforms,
  };
}
