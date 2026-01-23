/**
 * heightMechanics.js
 * Z-axis height management for 3D rope physics
 * Defines height levels and phase-based magnet positioning
 *
 * This module provides game-phase-aware position calculations.
 * All heights are in abstract world units from worldConstants.js.
 */

import {
  WORLD_Z,
  WORLD_Y,
  lerp,
  isUnderwater as worldIsUnderwater,
  getWaterDepth,
} from "./worldConstants.js";

/**
 * Height constants in abstract world units
 * Re-exported from worldConstants for backward compatibility
 * @deprecated Import directly from worldConstants.js instead
 */
export const HEIGHTS = {
  AVATAR: WORLD_Z.WALKWAY, // Avatar standing on pier (Z=3)
  AVATAR_HAND: WORLD_Z.AVATAR_HAND, // Avatar's hand position (Z=4.2)
  WATER_SURFACE: WORLD_Z.WATER_SURFACE, // Top of water layer (Z=1)
  RIVERBED: WORLD_Z.RIVERBED, // Bottom of river (Z=0)
};

/**
 * Calculate magnet's Z position based on current game phase
 * @param {string} phase - 'cast', 'throwing', 'splashing', 'sinking', 'settling', 'drag', 'lift', 'reeling', 'idle'
 * @param {number} progress - 0 to 1, phase completion percentage
 * @returns {number} Z-position in world units
 */
export function getMagnetHeight(phase, progress) {
  switch (phase) {
    case "throwing":
      // Magnet arcing through air from hand to water surface
      return lerp(HEIGHTS.AVATAR_HAND, HEIGHTS.WATER_SURFACE, progress);

    case "splashing":
      // Brief moment at water surface
      return HEIGHTS.WATER_SURFACE;

    case "sinking":
      // Sinking from water surface to riverbed
      return lerp(HEIGHTS.WATER_SURFACE, HEIGHTS.RIVERBED, progress);

    case "settling":
      // Resting on riverbed
      return HEIGHTS.RIVERBED;

    case "cast":
      // Legacy: combined cast phases
      if (progress < 0.5) {
        // First half: air (avatar hand → water surface)
        return lerp(HEIGHTS.AVATAR_HAND, HEIGHTS.WATER_SURFACE, progress * 2);
      }
      // Second half: water (surface → riverbed)
      return lerp(
        HEIGHTS.WATER_SURFACE,
        HEIGHTS.RIVERBED,
        (progress - 0.5) * 2,
      );

    case "drag":
      // Magnet dragging along riverbed
      return HEIGHTS.RIVERBED;

    case "lift":
      // Rising from riverbed through water to surface
      return lerp(HEIGHTS.RIVERBED, HEIGHTS.WATER_SURFACE, progress);

    case "reeling":
      // Reeling in - magnet rises from current position toward avatar
      // Progress 0 = at riverbed, 1 = at avatar hand
      return lerp(HEIGHTS.RIVERBED, HEIGHTS.AVATAR_HAND, progress);

    case "idle":
    default:
      // Default to avatar hand height when idle
      return HEIGHTS.AVATAR_HAND;
  }
}

/**
 * Get avatar's world position
 * Avatar is always on the pier at the front of the scene
 * @param {Object} viewport - Viewport configuration from worldConstants
 * @returns {{x: number, y: number, z: number}} World coordinates
 */
export function getAvatarWorldPosition(viewport) {
  return {
    x: viewport.screenWidth / 2, // Center of screen (world X = screen X)
    y: WORLD_Y.AVATAR, // At the front of the scene
    z: WORLD_Z.AVATAR_HAND, // Hand height for rope attachment
  };
}

/**
 * Get avatar position with height (legacy compatibility)
 * @deprecated Use getAvatarWorldPosition() with viewport instead
 * @param {number} screenX - Avatar screen X position
 * @param {number} screenY - Avatar screen Y position (ignored - uses world position)
 * @param {Object} viewport - Optional viewport for proper calculation
 * @returns {{x: number, y: number, z: number}} World coordinates
 */
export function getAvatarPosition(screenX, screenY, viewport = null) {
  // Avatar is at a fixed world position, not derived from screen coordinates
  const z = HEIGHTS.AVATAR_HAND;
  const worldY = WORLD_Y.AVATAR;

  return {
    x: screenX,
    y: worldY,
    z: z,
  };
}

/**
 * Get magnet's world position based on target and phase
 * @param {number} targetWorldX - Target world X (where magnet lands)
 * @param {number} targetWorldY - Target world Y (depth on riverbed)
 * @param {string} phase - Current game phase
 * @param {number} progress - Phase completion (0 to 1)
 * @returns {{x: number, y: number, z: number}} World coordinates
 */
export function getMagnetWorldPosition(
  targetWorldX,
  targetWorldY,
  phase,
  progress,
) {
  const z = getMagnetHeight(phase, progress);

  // During throwing, interpolate X and Y from avatar to target
  if (phase === "throwing") {
    const avatarX = targetWorldX; // Assume straight throw for now
    const avatarY = WORLD_Y.AVATAR;
    return {
      x: lerp(avatarX, targetWorldX, progress),
      y: lerp(avatarY, targetWorldY, progress),
      z: z,
    };
  }

  // For all other phases, magnet is at target X/Y, only Z changes
  return {
    x: targetWorldX,
    y: targetWorldY,
    z: z,
  };
}

/**
 * Get magnet position with calculated height (legacy compatibility)
 * Converts screen coordinates to 3D world coordinates
 * @deprecated Use getMagnetWorldPosition() instead
 * @param {number} screenX - Magnet screen X position
 * @param {number} screenY - Magnet screen Y position
 * @param {string} phase - Current game phase
 * @param {number} progress - Phase completion (0 to 1)
 * @returns {{x: number, y: number, z: number}} World coordinates
 */
export function getMagnetPosition(screenX, screenY, phase, progress) {
  const z = getMagnetHeight(phase, progress);

  // For legacy compatibility, derive worldY from screenY
  // screenY = worldY - z, so worldY = screenY + z
  // But this is problematic - screenY is in pixels, z is in world units
  // This function should be deprecated in favor of getMagnetWorldPosition

  return {
    x: screenX,
    y: screenY, // This should be worldY, not screenY - keeping for compatibility
    z: z,
  };
}

/**
 * Calculate rope segment count based on world distance
 * @param {number} worldDistance - Distance in world units
 * @param {Object} viewport - Viewport configuration
 * @returns {number} Number of rope segments
 */
export function calculateRopeSegments(worldDistance, viewport = null) {
  // Convert to approximate pixel distance for segment calculation
  const pixelDistance = viewport
    ? worldDistance * viewport.pixelsPerUnit
    : worldDistance * 50;
  // Base: 1 segment per 15 pixels, minimum 10, maximum 30
  const segments = Math.floor(pixelDistance / 15);
  return Math.max(10, Math.min(30, segments));
}

/**
 * Check if magnet is underwater
 * @param {number} z - World Z position
 * @returns {boolean} True if underwater
 */
export function isUnderwater(z) {
  return worldIsUnderwater(z);
}

/**
 * Get water resistance multiplier based on depth
 * @param {number} z - Current world Z position
 * @returns {number} Resistance multiplier (1.0 = air, >1.0 = water)
 */
export function getWaterResistance(z) {
  if (z >= WORLD_Z.WATER_SURFACE) {
    return 1.0; // No resistance in air
  }

  const depth = getWaterDepth(z);
  const maxDepth = WORLD_Z.WATER_SURFACE - WORLD_Z.RIVERBED;
  const depthRatio = depth / maxDepth;

  // Water resistance increases with depth
  return 1.0 + depthRatio * 0.5; // 1.0 to 1.5x resistance
}
