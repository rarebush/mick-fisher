/**
 * Environment Constants
 * Centralized environment layer heights and positions
 */

/**
 * Get environment layer Y positions for current screen
 * @param {number} screenHeight - App screen height
 * @returns {Object} Layer positions
 */
export function getEnvironmentPositions(screenHeight) {
  return {
    walkwayY: 0,
    walkwayHeight: screenHeight * 0.2, // Top 20%
    wallY: screenHeight * 0.2,
    wallHeight: screenHeight * 0.2, // Next 20%
    wallBaseY: screenHeight * 0.4, // Bottom of wall (where riverbed starts)
    waterSurfaceY: screenHeight * 0.3, // Water surface (30% from top, unit 70)
    waterBottomY: screenHeight * 0.9, // Water bottom (90% from top, unit 10)
    riverbedY: screenHeight * 0.4, // Riverbed start (40% from top)
    riverbedHeight: screenHeight * 0.6, // Bottom 60%
  };
}

/**
 * Get water surface Y position
 * @param {number} screenHeight - App screen height
 * @returns {number} Y coordinate of water surface
 */
export function getWaterSurfaceY(screenHeight) {
  return screenHeight * 0.3; // 30% from top
}

/**
 * Get wall base Y position (where drag ends, lift begins)
 * @param {number} screenHeight - App screen height
 * @returns {number} Y coordinate of wall base
 */
export function getWallBaseY(screenHeight) {
  return screenHeight * 0.4; // 40% from top
}

/**
 * Get riverbed start Y position
 * @param {number} screenHeight - App screen height
 * @returns {number} Y coordinate where riverbed starts
 */
export function getRiverbedStartY(screenHeight) {
  return screenHeight * 0.4; // 40% from top
}

/**
 * Check if Y position is on the riverbed
 * @param {number} y - Y coordinate
 * @param {number} screenHeight - App screen height
 * @returns {boolean} True if on riverbed
 */
export function isOnRiverbed(y, screenHeight) {
  const riverbedStart = screenHeight * 0.4;
  return y >= riverbedStart;
}

/**
 * Check if Y position is underwater
 * @param {number} y - Y coordinate
 * @param {number} screenHeight - App screen height
 * @returns {boolean} True if underwater
 */
export function isUnderwater(y, screenHeight) {
  const waterSurface = screenHeight * 0.3;
  const waterBottom = screenHeight * 0.9;
  return y >= waterSurface && y <= waterBottom;
}
