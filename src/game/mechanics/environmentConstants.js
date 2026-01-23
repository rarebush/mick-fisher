/**
 * Environment Constants
 * Centralized environment layer heights and positions
 *
 * REFACTORED: Now uses worldConstants.js as single source of truth.
 * All calculations derive from world coordinate projection.
 */

import {
  WORLD_Z,
  createViewport,
  getSurfaceScreenBounds,
} from "./worldConstants.js";

/**
 * Get environment layer Y positions for current screen
 * Uses world coordinate projection for consistent positioning.
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional, defaults to screenHeight for square aspect)
 * @returns {Object} Layer positions
 */
export function getEnvironmentPositions(
  screenHeight,
  screenWidth = screenHeight,
) {
  const viewport = createViewport(screenWidth, screenHeight);

  const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

  return {
    walkwayY: walkwayBounds.top,
    walkwayHeight: walkwayBounds.bottom - walkwayBounds.top,
    wallY: walkwayBounds.bottom,
    wallHeight: waterBounds.top - walkwayBounds.bottom,
    wallBaseY: waterBounds.top, // Bottom of wall (where water/riverbed starts)
    waterSurfaceY: waterBounds.top,
    waterBottomY: waterBounds.bottom,
    riverbedY: waterBounds.top, // Riverbed starts where water starts (water overlays riverbed)
    riverbedHeight: riverbedBounds.bottom - waterBounds.top,
  };
}

/**
 * Get water surface Y position
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional)
 * @returns {number} Y coordinate of water surface
 */
export function getWaterSurfaceY(screenHeight, screenWidth = screenHeight) {
  const viewport = createViewport(screenWidth, screenHeight);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  return waterBounds.top;
}

/**
 * Get wall base Y position (where drag ends, lift begins)
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional)
 * @returns {number} Y coordinate of wall base
 */
export function getWallBaseY(screenHeight, screenWidth = screenHeight) {
  const viewport = createViewport(screenWidth, screenHeight);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  return waterBounds.top;
}

/**
 * Get riverbed start Y position
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional)
 * @returns {number} Y coordinate where riverbed starts
 */
export function getRiverbedStartY(screenHeight, screenWidth = screenHeight) {
  const viewport = createViewport(screenWidth, screenHeight);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  return waterBounds.top;
}

/**
 * Check if Y position is on the riverbed
 * @param {number} y - Y coordinate
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional)
 * @returns {boolean} True if on riverbed
 */
export function isOnRiverbed(y, screenHeight, screenWidth = screenHeight) {
  const viewport = createViewport(screenWidth, screenHeight);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  return y >= waterBounds.top;
}

/**
 * Check if Y position is underwater
 * @param {number} y - Y coordinate
 * @param {number} screenHeight - App screen height
 * @param {number} screenWidth - App screen width (optional)
 * @returns {boolean} True if underwater
 */
export function isUnderwater(y, screenHeight, screenWidth = screenHeight) {
  const viewport = createViewport(screenWidth, screenHeight);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  return y >= waterBounds.top && y <= waterBounds.bottom;
}
