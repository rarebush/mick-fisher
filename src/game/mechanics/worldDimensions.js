/**
 * worldDimensions.js
 * World-space dimensions and avatar anchor positions.
 */

export const WORLD_X = {
  MIN: -14, // Left bank
  MAX: 14, // Right bank
  CENTER: 0,
  WIDTH: 28,
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
  y: 0,
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

export const WORLD_Y = {
  // Walkway extends behind avatar to fill backdrop
  WALKWAY_BACK: -3, // Back edge of walkway (toward camera)
  WALKWAY_FRONT: 0, // Front edge of walkway (where avatar stands)

  AVATAR: -1, // Avatar is set back from the front edge

  // Wall is at the front edge, no Y depth (vertical surface)
  WALL_EDGE: 0, // Wall is at Y=0, spans Z from walkway to water

  // Water and riverbed extend from near to far
  WATER_NEAR: 0, // Where water begins (at wall base)
  WATER_FAR: 16, // Far edge of water
  RIVERBED_NEAR: 0, // Where riverbed begins
  RIVERBED_FAR: 16, // Far edge of riverbed

  MIN: -3,
  MAX: 16,
};

export const CAMERA_FOCUS = {
  x: 0,
  y: (WORLD_Y.WALKWAY_BACK + WORLD_Y.WATER_FAR) / 2,
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
