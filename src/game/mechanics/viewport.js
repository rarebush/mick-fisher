import { CAMERA_FOCUS, WORLD_Y, WORLD_Z, getWorldXBounds } from "./worldDimensions.js";
import { TARGET_PPU, projectToIsometric } from "./projection.js";

/**
 * Calculate viewport configuration based on screen dimensions
 * Uses fixed camera focus point and configurable scale (TARGET_PPU by default)
 * @param {number} screenWidth - Viewport width in pixels
 * @param {number} screenHeight - Viewport height in pixels
 * @param {Object} [options]
 * @param {number} [options.pixelsPerUnit] - override base pixels-per-unit
 * @param {number} [options.zoom] - multiply pixels-per-unit for zooming
 * @returns {Object} Viewport configuration
 */
export function createViewport(screenWidth, screenHeight, options = {}) {
  const focusProjected = projectToIsometric(
    CAMERA_FOCUS.x,
    CAMERA_FOCUS.y,
    CAMERA_FOCUS.z
  );

  const basePixelsPerUnit = Number.isFinite(options.pixelsPerUnit)
    ? options.pixelsPerUnit
    : TARGET_PPU;
  const zoom = Number.isFinite(options.zoom) ? options.zoom : 1;
  const pixelsPerUnit = basePixelsPerUnit * zoom;
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
