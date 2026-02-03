import { WORLD_Z } from "./worldDimensions.js";
import { projectToIsometric } from "./projection.js";

/**
 * Render layer constants for static elements
 * Lower values render first (behind), higher values render on top
 */
export const RENDER_LAYERS = {
  WALKWAY: 0,
  AVATAR: 1,
  WALL_FACE: 2,
  RIVERBED: 3,
  ITEMS_ON_RIVERBED: 4,
  WATER_SURFACE: 5,
  // Magnet layer is dynamic based on position
};

/**
 * Get the render layer for the magnet based on its current position
 * @param {number} worldZ - Magnet's current Z height
 * @returns {number} Render layer value
 */
export function getMagnetRenderLayer(worldZ) {
  if (worldZ > WORLD_Z.WATER_SURFACE) {
    return 1.5;
  }
  if (worldZ > WORLD_Z.RIVERBED) {
    return 4.5;
  }
  return RENDER_LAYERS.ITEMS_ON_RIVERBED;
}

/**
 * Calculate sort key for depth ordering of dynamic objects
 * Objects with larger sort keys are further back and should render first
 * @param {number} worldY - World Y position (depth)
 * @param {number} worldZ - World Z position (height)
 * @param {number} worldX - World X position (horizontal)
 * @returns {number} Sort key (matches projected screenY, without offset)
 */
export function calculateSortKey(worldY, worldZ, worldX = 0) {
  return projectToIsometric(worldX, worldY, worldZ).y;
}
