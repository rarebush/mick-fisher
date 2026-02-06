import { MAX_QUADRANT_DISTANCE } from "../data/locationDatabase.js";
import {
  WORLD_Y,
  WORLD_Z,
  worldToScreen,
  getAvatarWorldPosition,
} from "./worldConstants.js";
import { clamp } from "../physics/vectorUtils.js";
import {
  clampPositionToBounds,
  getRiverbedBounds,
  getWaterBounds,
} from "./worldBounds.js";

export const CAST_AIM_ANGLE_MIN_DEG = -90;
export const CAST_AIM_ANGLE_MAX_DEG = 90;

const EPSILON = 1e-6;

export function getAvatarCastOrigin() {
  const avatarWorld = getAvatarWorldPosition();
  return { x: avatarWorld.x, y: avatarWorld.y };
}

export function metersToWorldRange(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return 0;
  }
  return meters;
}

export function clampCastAngleDeg(angleDeg) {
  return clamp(angleDeg, CAST_AIM_ANGLE_MIN_DEG, CAST_AIM_ANGLE_MAX_DEG);
}

export function clampCastPower(power) {
  return clamp(power, 0, 1);
}

export function getCastDirectionFromAngleDeg(angleDeg) {
  const clampedAngle = clampCastAngleDeg(angleDeg);
  const angleRad = (clampedAngle * Math.PI) / 180;
  return {
    x: Math.sin(angleRad),
    y: Math.cos(angleRad),
  };
}

export function getMaxCastRange(direction, viewport) {
  const origin = getAvatarCastOrigin();
  const bounds = {
    minX: viewport.worldXMin,
    maxX: viewport.worldXMax,
    minY: WORLD_Y.RIVERBED_NEAR,
    maxY: WORLD_Y.RIVERBED_FAR,
  };

  let maxRange = Infinity;

  if (Math.abs(direction.x) > EPSILON) {
    const boundX = direction.x > 0 ? bounds.maxX : bounds.minX;
    maxRange = Math.min(maxRange, (boundX - origin.x) / direction.x);
  }

  if (Math.abs(direction.y) > EPSILON) {
    const boundY = direction.y > 0 ? bounds.maxY : bounds.minY;
    maxRange = Math.min(maxRange, (boundY - origin.y) / direction.y);
  }

  if (!Number.isFinite(maxRange) || maxRange < 0) {
    return 0;
  }

  return maxRange;
}

export function computeCastTargetWorld(
  angleDeg,
  power,
  viewport,
  maxRangeMeters = null,
) {
  const direction = getCastDirectionFromAngleDeg(angleDeg);
  let maxRange = getMaxCastRange(direction, viewport);
  if (Number.isFinite(maxRangeMeters)) {
    const maxRangeWorld = metersToWorldRange(maxRangeMeters);
    maxRange = Math.min(maxRange, clamp(maxRangeWorld, 0, Infinity));
  }
  const clampedPower = clampCastPower(power);
  const distance = maxRange * clampedPower;
  const origin = getAvatarCastOrigin();

  const worldTarget = {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: WORLD_Z.WATER_SURFACE,
  };

  return clampTargetToWaterSurface(worldTarget, viewport);
}

export function clampTargetToRiverbed(
  worldTarget,
  viewport,
  z = WORLD_Z.RIVERBED,
) {
  const bounds = getRiverbedBounds(viewport);
  const clamped = clampPositionToBounds(worldTarget, bounds);
  return { ...clamped, z };
}

export function clampTargetToWaterSurface(worldTarget, viewport) {
  const bounds = getWaterBounds(viewport);
  const clamped = clampPositionToBounds(worldTarget, bounds);
  return { ...clamped, z: WORLD_Z.WATER_SURFACE };
}

export function computeCastTargetScreen(
  angleDeg,
  power,
  viewport,
  maxRangeMeters = null,
) {
  const worldTarget = computeCastTargetWorld(
    angleDeg,
    power,
    viewport,
    maxRangeMeters,
  );
  return worldToScreen(worldTarget, viewport);
}
