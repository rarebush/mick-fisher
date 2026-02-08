/**
 * worldConstants.js
 * Barrel exports for world space dimensions and projection helpers.
 */

export {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  CAMERA_FOCUS,
  AVATAR_CAST_OFFSET,
  getAvatarWorldPosition,
  getAvatarHandWorldPosition,
  getWorldXBounds,
} from "./worldDimensions.js";

export {
  ISO_RATIO,
  TARGET_PPU,
  TARGET_TILE_PIXEL_WIDTH,
  TARGET_TILE_PIXEL_HEIGHT,
  TILE_WORLD_UNITS_X,
  TILE_WORLD_UNITS_Y,
  projectToIsometric,
  projectToScreen,
  worldToScreen,
  screenToWorld,
  getProjectionMetrics,
  getTileScreenSizePx,
  getProjectedWorldBounds,
  getWorldDirectionScreenAngle,
  getSurfaceScreenBounds,
} from "./projection.js";

export { createViewport } from "./viewport.js";

export { lerp } from "./worldHelpers.js";

export {
  getWaterBounds,
  getRiverbedBounds,
  clampPositionToBounds,
  clampTargetToBounds,
} from "./worldBounds.js";
