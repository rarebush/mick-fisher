/**
 * Pure force/math helpers used by drag physics integration.
 *
 * This module computes scalar and vector force terms without mutating state.
 */

import { PHYSICS_CONSTANTS } from "./physicsConstants.js";
import {
  clamp,
  magnitude,
  normalize,
  subtract,
} from "./vectorUtils.js";

export function getLineAxis(avatarPosition, targetPosition) {
  const delta = subtract(targetPosition, avatarPosition);
  const distance = magnitude(delta);
  if (distance <= PHYSICS_CONSTANTS.LINE_AXIS_MIN_DISTANCE) {
    return { axis: { x: 0, y: 1 }, distance: 0 };
  }
  return { axis: { x: delta.x / distance, y: delta.y / distance }, distance };
}

export function getDragThresholdMax(equipment) {
  return (
    equipment?.dragThresholdMax ?? PHYSICS_CONSTANTS.DEFAULT_DRAG_THRESHOLD_MAX
  );
}

export function getDragThresholdMin(equipment) {
  return (
    equipment?.dragThresholdMin ?? PHYSICS_CONSTANTS.DEFAULT_DRAG_THRESHOLD_MIN
  );
}

export function getDragThresholdCurrent(equipment) {
  const max = getDragThresholdMax(equipment);
  const min = Math.min(getDragThresholdMin(equipment), max);
  const current = equipment?.dragThresholdCurrent;
  if (Number.isFinite(current)) {
    return clamp(current, min, max);
  }
  return max;
}

export function getSpoolCapacity(equipment) {
  return equipment?.spoolCapacity ?? PHYSICS_CONSTANTS.DEFAULT_SPOOL_CAPACITY;
}

export function getAvatarPullForceFromRpm(rpm, equipment) {
  const rpmMax = equipment?.rpmMax ?? PHYSICS_CONSTANTS.RPM_MAX;
  const powerExponent =
    equipment?.rpmPowerExponent ?? PHYSICS_CONSTANTS.RPM_POWER_EXPONENT;
  const normalized = rpmMax > 0 ? clamp(rpm / rpmMax, 0, 1) : 0;
  const curve = Math.pow(normalized, powerExponent);
  const maxPullForce = equipment?.maxPullForce ?? 0;
  return maxPullForce * curve;
}

export function getCurrentForce(target, currentEnvironment) {
  if (!currentEnvironment || currentEnvironment.strength === 0) {
    return { x: 0, y: 0 };
  }
  const effectiveStrength = currentEnvironment.strength * target.dragFactor;
  const dir = normalize(currentEnvironment.direction);
  return {
    x: dir.x * effectiveStrength,
    y: dir.y * effectiveStrength,
  };
}

export function getFriction(target, velocity, isMoving) {
  const speed = magnitude(velocity);
  if (!isMoving) {
    return {
      type: "static",
      threshold: target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT,
    };
  }
  if (speed < PHYSICS_CONSTANTS.FRICTION_MIN_SPEED) return { x: 0, y: 0 };
  const frictionMagnitude =
    target.mass * PHYSICS_CONSTANTS.KINETIC_FRICTION_COEFFICIENT;
  return {
    x: (-velocity.x / speed) * frictionMagnitude,
    y: (-velocity.y / speed) * frictionMagnitude,
  };
}
