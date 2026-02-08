/**
 * Shared filter vertex shader for water system filters.
 *
 * Based on the Pixi v8 default filter vertex shader
 * (pixijs/src/filters/defaults/defaultFilter.vert) with an additional
 * vScreenPos varying so fragment shaders can compute world-aware effects
 * (e.g. isometric depth gradients) without re-declaring uInputSize /
 * uOutputFrame (which would cause a precision mismatch error).
 */
export const filterVertWithScreenPos = /* glsl */ `
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
