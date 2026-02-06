import { WORLD_X, WORLD_Y } from "./worldDimensions.js";
import { clamp } from "../physics/vectorUtils.js";

export function getWaterBounds(viewport = null) {
  return {
    minX: viewport?.worldXMin ?? WORLD_X.MIN,
    maxX: viewport?.worldXMax ?? WORLD_X.MAX,
    minY: WORLD_Y.WATER_NEAR,
    maxY: WORLD_Y.WATER_FAR,
  };
}

export function getRiverbedBounds(viewport = null) {
  return {
    minX: viewport?.worldXMin ?? WORLD_X.MIN,
    maxX: viewport?.worldXMax ?? WORLD_X.MAX,
    minY: WORLD_Y.RIVERBED_NEAR,
    maxY: WORLD_Y.RIVERBED_FAR,
  };
}

export function clampPositionToBounds(position, bounds) {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function clampTargetToBounds(target, bounds) {
  if (!target?.position) return;
  target.position = {
    ...target.position,
    ...clampPositionToBounds(target.position, bounds),
  };
}
