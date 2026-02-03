import { WORLD_Z } from "./worldDimensions.js";

/**
 * Check if a world position is underwater
 * @param {number} worldZ - World Z position
 * @returns {boolean} True if underwater
 */
export function isUnderwater(worldZ) {
  return worldZ < WORLD_Z.WATER_SURFACE;
}

/**
 * Check if a world position is on the riverbed
 * @param {number} worldZ - World Z position
 * @returns {boolean} True if on riverbed
 */
export function isOnRiverbed(worldZ) {
  return worldZ <= WORLD_Z.RIVERBED;
}

/**
 * Get water depth at a position (how deep below surface)
 * @param {number} worldZ - World Z position
 * @returns {number} Depth below water surface (0 if above water)
 */
export function getWaterDepth(worldZ) {
  if (worldZ >= WORLD_Z.WATER_SURFACE) return 0;
  return WORLD_Z.WATER_SURFACE - worldZ;
}

/**
 * Linear interpolation helper
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
