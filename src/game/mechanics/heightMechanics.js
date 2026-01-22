/**
 * heightMechanics.js
 * Z-axis height management for 3D rope physics
 * Defines height levels and phase-based magnet positioning
 */

/**
 * Height constants in pixels
 * Z = 0 is riverbed (ground level)
 * Higher Z values = higher positions on screen
 */
export const HEIGHTS = {
  AVATAR: 100, // Avatar standing on pier
  WATER_SURFACE: 60, // Top of water layer
  RIVERBED: 0, // Bottom of river (ground level)
};

/**
 * Linear interpolation helper
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Calculate magnet's Z position based on current game phase
 * @param {string} phase - 'cast', 'drag', or 'lift'
 * @param {number} progress - 0 to 1, phase completion percentage
 * @returns {number} Z-position in pixels
 */
export function getMagnetHeight(phase, progress) {
  switch (phase) {
    case "cast":
      // Magnet falling through air then water
      if (progress < 0.5) {
        // First half: air (avatar → water surface)
        return lerp(HEIGHTS.AVATAR, HEIGHTS.WATER_SURFACE, progress * 2);
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

    case "idle":
    default:
      // Default to avatar height when idle
      return HEIGHTS.AVATAR;
  }
}

/**
 * Get avatar position with height
 * Avatar is always on the pier at the top
 * Converts screen coordinates to 3D world coordinates
 * @param {number} screenX - Avatar screen X position
 * @param {number} screenY - Avatar screen Y position
 * @returns {{x: number, y: number, z: number}}
 */
export function getAvatarPosition(screenX, screenY) {
  // Avatar is always at pier height
  const z = HEIGHTS.AVATAR;

  // Convert screen coordinates to world coordinates
  const worldY = screenY + z; // Reverse the toScreen() projection

  return {
    x: screenX,
    y: worldY,
    z: z,
  };
}

/**
 * Get magnet position with calculated height
 * Converts screen coordinates to 3D world coordinates
 * @param {number} screenX - Magnet screen X position
 * @param {number} screenY - Magnet screen Y position
 * @param {string} phase - Current game phase
 * @param {number} progress - Phase completion (0 to 1)
 * @returns {{x: number, y: number, z: number}}
 */
export function getMagnetPosition(screenX, screenY, phase, progress) {
  // Get Z height for this phase
  const z = getMagnetHeight(phase, progress);

  // Convert screen coordinates to world coordinates
  // Screen Y includes visual depth offset from Z projection
  // World Y should be the screen Y position compensated for Z offset
  const worldY = screenY + z; // Reverse the toScreen() projection: screenY = worldY - z

  return {
    x: screenX,
    y: worldY,
    z: z,
  };
}

/**
 * Calculate rope segment count based on distance
 * Longer casts get more segments for smoother curves
 * @param {number} distance - Distance in pixels
 * @returns {number} Number of rope segments
 */
export function calculateRopeSegments(distance) {
  // Base: 1 segment per 15 pixels, minimum 10, maximum 30
  const segments = Math.floor(distance / 15);
  return Math.max(10, Math.min(30, segments));
}

/**
 * Check if magnet is underwater
 * @param {number} z - Magnet Z position
 * @returns {boolean} True if underwater
 */
export function isUnderwater(z) {
  return z < HEIGHTS.WATER_SURFACE;
}

/**
 * Get water resistance multiplier based on depth
 * @param {number} z - Current Z position
 * @returns {number} Resistance multiplier (1.0 = air, >1.0 = water)
 */
export function getWaterResistance(z) {
  if (z >= HEIGHTS.WATER_SURFACE) {
    return 1.0; // No resistance in air
  }

  // Gradually increase resistance as we go deeper
  const depth = HEIGHTS.WATER_SURFACE - z;
  const maxDepth = HEIGHTS.WATER_SURFACE - HEIGHTS.RIVERBED;
  const depthRatio = depth / maxDepth;

  // Water resistance increases with depth
  return 1.0 + depthRatio * 0.5; // 1.0 to 1.5x resistance
}
