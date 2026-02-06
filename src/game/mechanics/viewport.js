import { CAMERA_FOCUS, WORLD_Y, WORLD_Z, getWorldXBounds } from "./worldDimensions.js";
import { TARGET_PPU, projectToIsometric } from "./projection.js";

/**
 * Calculate viewport configuration based on screen dimensions
 * Uses fixed camera focus point and fixed scale (TARGET_PPU)
 * @param {number} screenWidth - Viewport width in pixels
 * @param {number} screenHeight - Viewport height in pixels
 * @returns {Object} Viewport configuration
 */
export function createViewport(screenWidth, screenHeight) {
  const focusProjected = projectToIsometric(
    CAMERA_FOCUS.x,
    CAMERA_FOCUS.y,
    CAMERA_FOCUS.z
  );

  const pixelsPerUnit = TARGET_PPU;
  const screenXOffset = screenWidth / 2 - focusProjected.x * pixelsPerUnit;
  const screenYOffset = screenHeight / 2 - focusProjected.y * pixelsPerUnit;

  const worldXBounds = getWorldXBounds();

  return {
    screenWidth,
    screenHeight,
    pixelsPerUnit,
    screenXOffset,
    screenYOffset,
    worldXMin: worldXBounds.min,
    worldXMax: worldXBounds.max,
    worldXCenter: worldXBounds.center,
    worldXWidth: worldXBounds.width,
    worldYMin: WORLD_Y.MIN,
    worldYMax: WORLD_Y.MAX,
    worldZMin: WORLD_Z.RIVERBED,
    worldZMax: WORLD_Z.MAX,
  };
}
