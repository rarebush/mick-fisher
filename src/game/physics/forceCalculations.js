import { PHYSICS_CONSTANTS } from "./physicsConstants.js";
import {
  clamp,
  dotProduct,
  magnitude,
  normalize,
  subtract,
} from "./vectorUtils.js";

export function getEngineTorque(tension, equipment) {
  const normalizedTension = tension / 100;
  let torqueMultiplier;
  if (normalizedTension < 0.4) {
    torqueMultiplier = Math.pow(normalizedTension / 0.4, 2) * 0.1;
  } else if (normalizedTension < 0.75) {
    const zoneProgress = (normalizedTension - 0.4) / 0.35;
    torqueMultiplier = 0.1 + zoneProgress * 0.5;
  } else {
    const zoneProgress = (normalizedTension - 0.75) / 0.25;
    torqueMultiplier = 0.6 + zoneProgress * 0.4;
  }
  return (equipment?.maxPullForce ?? 0) * torqueMultiplier;
}

export function getLineAxis(avatarPosition, targetPosition) {
  const delta = subtract(targetPosition, avatarPosition);
  const distance = magnitude(delta);
  if (distance <= 0.0001) {
    return { axis: { x: 0, y: 1 }, distance: 0 };
  }
  return { axis: { x: delta.x / distance, y: delta.y / distance }, distance };
}

export function getSignedAxisVelocity(velocity, axis) {
  return dotProduct(velocity, axis);
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

export function getPullForce(tension, equipment, target, avatarPosition) {
  const speed = magnitude(target.velocity);
  const basePull = getEngineTorque(tension, equipment);
  const efficiency =
    1 / (1 + speed * PHYSICS_CONSTANTS.REEL_EFFICIENCY_FALLOFF);
  const pullMagnitude = basePull * efficiency;
  const direction = normalize(subtract(avatarPosition, target.position));
  return {
    x: direction.x * pullMagnitude,
    y: direction.y * pullMagnitude,
  };
}

export function getWaterDrag(target, velocity, lineLength) {
  const speed = magnitude(velocity);
  if (speed < 0.001) return { x: 0, y: 0 };
  const direction = { x: -velocity.x / speed, y: -velocity.y / speed };
  const itemDrag =
    target.dragFactor * PHYSICS_CONSTANTS.WATER_DENSITY * speed * speed;
  const baselineDrag = PHYSICS_CONSTANTS.BASELINE_WATER_RESISTANCE * speed;
  const turbulenceDrag =
    PHYSICS_CONSTANTS.TURBULENCE_FACTOR * speed * speed * speed;
  const lineDrag = PHYSICS_CONSTANTS.LINE_DRAG_PER_METER * lineLength * speed;
  const totalDrag = itemDrag + baselineDrag + turbulenceDrag + lineDrag;
  return {
    x: direction.x * totalDrag,
    y: direction.y * totalDrag,
  };
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
  if (speed < 0.01) return { x: 0, y: 0 };
  const frictionMagnitude =
    target.mass * PHYSICS_CONSTANTS.KINETIC_FRICTION_COEFFICIENT;
  return {
    x: (-velocity.x / speed) * frictionMagnitude,
    y: (-velocity.y / speed) * frictionMagnitude,
  };
}
