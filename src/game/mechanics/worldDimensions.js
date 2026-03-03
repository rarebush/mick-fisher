/**
 * worldDimensions.js
 * World-space dimensions and avatar anchor positions.
 * setDebugEnabled(false) to hide debug visuals (world bounds, avatar position)
 */

const WORLD_X_MIN = -15;
const WORLD_X_MAX = 8;
const WORLD_X_WIDTH = WORLD_X_MAX - WORLD_X_MIN;
const WORLD_X_SPAWN_BUFFER = 4;
const WORLD_X_SPAWN_MIN = WORLD_X_MIN - WORLD_X_SPAWN_BUFFER;
const WORLD_X_SPAWN_WIDTH = WORLD_X_WIDTH + WORLD_X_SPAWN_BUFFER;

export const WORLD_X = {
  MIN: WORLD_X_MIN, // Left bank
  MAX: WORLD_X_MAX, // Right bank
  CENTER: 0,
  WIDTH: WORLD_X_WIDTH,
  SPAWN_BUFFER: WORLD_X_SPAWN_BUFFER,
  SPAWN_MIN: WORLD_X_SPAWN_MIN,
  SPAWN_WIDTH: WORLD_X_SPAWN_WIDTH,
};

export const WORLD_Z = {
  RIVERBED: 0, // Ground level - items rest here
  WATER_SURFACE: 1, // Top of water
  WALKWAY: 3, // Pier/walkway surface where avatar stands
  AVATAR_FEET: 3, // Avatar feet position (same as walkway surface)
  AVATAR_HAND: 4.5, // Avatar's hand when holding rod (above walkway)
  MAX: 16, // Vertical world extent
};

export const AVATAR_CAST_OFFSET = {
  x: 0,
  y: 0.25,
  z: WORLD_Z.AVATAR_HAND - WORLD_Z.AVATAR_FEET,
};

/**
 * Get avatar world position (feet/base).
 * @returns {{x:number,y:number,z:number}}
 */
export function getAvatarWorldPosition() {
  return {
    x: 0,
    y: WORLD_Y.AVATAR,
    z: WORLD_Z.AVATAR_FEET,
  };
}

/**
 * Get avatar cast origin (hand) position.
 * @param {{x?:number,y?:number,z?:number}} offset - Optional extra offset
 * @returns {{x:number,y:number,z:number}}
 */
export function getAvatarHandWorldPosition(offset = {}) {
  const avatar = getAvatarWorldPosition();
  return {
    x: avatar.x + AVATAR_CAST_OFFSET.x + (offset.x || 0),
    y: avatar.y + AVATAR_CAST_OFFSET.y + (offset.y || 0),
    z: avatar.z + AVATAR_CAST_OFFSET.z + (offset.z || 0),
  };
}

const WORLD_Y_WALKWAY_BACK = -5;
const WORLD_Y_WATER_NEAR = 0;
const WORLD_Y_WATER_FAR = 15;
const WORLD_Y_WATER_DEPTH = WORLD_Y_WATER_FAR - WORLD_Y_WATER_NEAR;

export const WORLD_Y = {
  // Walkway extends behind avatar to fill backdrop
  WALKWAY_BACK: WORLD_Y_WALKWAY_BACK, // Back edge of walkway (toward camera)
  WALKWAY_FRONT: 0, // Front edge of walkway (where avatar stands)

  AVATAR: -0.25, // Avatar is set back from the front edge

  // Wall is at the front edge, no Y depth (vertical surface)
  WALL_EDGE: 0, // Wall is at Y=0, spans Z from walkway to water

  // Water and riverbed extend from near to far
  WATER_NEAR: WORLD_Y_WATER_NEAR, // Where water begins (at wall base)
  WATER_FAR: WORLD_Y_WATER_FAR, // Far edge of water
  WATER_DEPTH: WORLD_Y_WATER_DEPTH,
  RIVERBED_NEAR: WORLD_Y_WATER_NEAR, // Where riverbed begins
  RIVERBED_FAR: WORLD_Y_WATER_FAR, // Far edge of riverbed

  MIN: WORLD_Y_WALKWAY_BACK,
  MAX: WORLD_Y_WATER_FAR,
};

export const CAMERA_FOCUS = {
  x: -3,
  y: (WORLD_Y.WALKWAY_BACK + WORLD_Y.WATER_FAR) / 2.5,
  z: WORLD_Z.WATER_SURFACE,
};

/**
 * Calculate world X bounds based on screen aspect ratio
 * Ensures world space has consistent proportions regardless of screen size
 * @returns {{min: number, max: number, center: number}} World X boundaries
 */
export function getWorldXBounds() {
  return {
    min: WORLD_X.MIN,
    max: WORLD_X.MAX,
    center: WORLD_X.CENTER,
    width: WORLD_X.WIDTH,
  };
}
