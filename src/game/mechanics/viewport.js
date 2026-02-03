import {
  CAMERA_FOCUS,
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  getWorldXBounds,
} from "./worldDimensions.js";
import {
  TARGET_PPU,
  projectToIsometric,
  projectToScreen,
} from "./projection.js";

/**
 * Get screen-space projections for world-space corner samples
 * Useful for debugging that bounds fit within the viewport
 * @param {Object} viewport
 * @returns {{world:{x:number,y:number,z:number},screen:{x:number,y:number}}[]}
 */
export function getWorldBoundsProjectionSamples(viewport) {
  const bounds = {
    xMin: WORLD_X.MIN,
    xMax: WORLD_X.MAX,
    yMin: WORLD_Y.MIN,
    yMax: WORLD_Y.MAX,
    zMin: WORLD_Z.RIVERBED,
    zMax: WORLD_Z.MAX,
  };

  const corners = [
    [bounds.xMin, bounds.yMin, bounds.zMin],
    [bounds.xMin, bounds.yMin, bounds.zMax],
    [bounds.xMin, bounds.yMax, bounds.zMin],
    [bounds.xMin, bounds.yMax, bounds.zMax],
    [bounds.xMax, bounds.yMin, bounds.zMin],
    [bounds.xMax, bounds.yMin, bounds.zMax],
    [bounds.xMax, bounds.yMax, bounds.zMin],
    [bounds.xMax, bounds.yMax, bounds.zMax],
  ];

  return corners.map(([worldX, worldY, worldZ]) => ({
    world: { x: worldX, y: worldY, z: worldZ },
    screen: projectToScreen(worldX, worldY, worldZ, viewport),
  }));
}

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
