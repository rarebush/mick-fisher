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
  TARGET_PPU,
  projectToIsometric,
  projectToScreen,
  worldToScreen,
  screenToWorld,
  getProjectionMetrics,
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
