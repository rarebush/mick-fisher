/**
 * Drag Mechanics
 * Handles horizontal drag phase - tension management and distance progression
 */

import {
  calculateSlipRate,
  updateMagnetPosition,
  hasMagnetSlippedOff,
} from "./slipCalculations.js";

/**
 * Calculate tension build rate based on item weight
 * @param {number} currentTension - Current tension (0-100%)
 * @param {number} itemWeight - Item weight in kg
 * @param {boolean} isHolding - Whether player is holding input
 * @returns {number} - Tension change per second
 */
export function calculateTensionBuildRate(
  currentTension,
  itemWeight,
  isHolding,
) {
  if (!isHolding) {
    // Decay rate when not holding
    return -8; // -8% per second (slower decay = harder)
  }

  // Base build rate
  const BASE_BUILD_RATE = 20; // % per second at 0% tension (faster build = harder)

  // Weight modifier (heavier = faster tension build)
  let weightMod = 1.0;
  if (itemWeight >= 60)
    weightMod = 2.4; // Very heavy (increased from 2.0)
  else if (itemWeight >= 30)
    weightMod = 1.6; // Heavy (increased from 1.4)
  else if (itemWeight >= 10) weightMod = 1.0;
  else weightMod = 0.7;

  // Diminishing returns based on current tension (smooth curve)
  const t = Math.max(0, Math.min(100, currentTension)) / 100;
  const diminishingMod = 1.0 - 0.8 * smoothstep(0.35, 0.95, t);

  return BASE_BUILD_RATE * weightMod * diminishingMod;
}

/**
 * Process a tap input (instant tension boost)
 * @param {number} currentTension - Current tension (0-100%)
 * @returns {number} - New tension value (can exceed 100% for failure detection)
 */
export function processTap(currentTension) {
  const TAP_BOOST = 10; // Fixed 10% per tap
  // Allow tension to exceed 100% so tension-overload failure can trigger
  return currentTension + TAP_BOOST;
}

/**
 * Calculate drag speed based on tension
 * @param {number} tension - Current tension (0-100%)
 * @param {number} itemWeight - Item weight in kg
 * @returns {number} - Drag speed in meters per second
 */
export function calculateDragSpeed(tension, itemWeight = 10) {
  if (tension >= 100) return 0; // Ripped off

  // Base speed from tension (smooth curve through the table points)
  const speedMultiplier = sampleCurve(tension, [
    { tension: 0, multiplier: 0 },
    { tension: 10, multiplier: 0.45 },
    { tension: 31, multiplier: 0.8 },
    { tension: 51, multiplier: 1.2 },
    { tension: 71, multiplier: 1.6 },
    { tension: 86, multiplier: 1.9 },
    { tension: 100, multiplier: 0 },
  ]);

  // Weight resistance (heavier = slower, but less punishing)
  // Design doc shows 1.0x for medium items (10-30kg)
  const weightModifier = Math.max(0.7, Math.min(1.3, 12 / itemWeight));

  // Base drag speed (meters per second at 1.0x multiplier)
  // Design doc shows speed ranges: 0.3-0.6 (low), 0.6-1.0 (med), 1.0-1.4 (high), 1.4-1.8 (danger), 1.8-2.0 (extreme)
  const BASE_DRAG_SPEED = 1.3; // Tuned to match design doc ranges now that velocity persistence works

  return speedMultiplier * weightModifier * BASE_DRAG_SPEED;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleCurve(tension, points) {
  const t = Math.max(0, Math.min(100, tension));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.tension && t <= b.tension) {
      const span = b.tension - a.tension || 1;
      const u = (t - a.tension) / span;
      const eased = smoothstep(0, 1, u);
      return a.multiplier + (b.multiplier - a.multiplier) * eased;
    }
  }
  return points[points.length - 1].multiplier;
}

/**
 * Update drag state for one frame (positional slip model)
 * @param {object} currentState - Current drag state from sessionStore
 * @param {object} item - Item being dragged
 * @param {number} deltaTime - Time since last update (seconds)
 * @returns {object} - Updated state { distance, magnetPosition, tension }
 */
export function updateDragState(currentState, item, deltaTime) {
  const {
    tension,
    distance,
    magnetPosition,
    magnetContactWidth,
    slipDirection,
    velocity = 0,
    accelerationTime = 0,
  } = currentState;

  // Calculate slip rate in units per second
  const slipRate = calculateSlipRate(item, tension);

  // Update magnet position
  const newPosition = updateMagnetPosition(
    magnetPosition,
    slipDirection,
    slipRate,
    deltaTime,
  );

  // Check if magnet has slipped off FIRST (more common failure)
  if (hasMagnetSlippedOff(newPosition, magnetContactWidth)) {
    return {
      distance: distance,
      magnetPosition: newPosition,
      tension: tension,
      velocity: velocity,
      accelerationTime: accelerationTime,
      failed: true,
      failReason: "slip-failure",
    };
  }

  // Check for instant fail at or near 100% tension (rare, catastrophic failure)
  if (tension >= 99.9) {
    return {
      distance: distance,
      magnetPosition: newPosition,
      tension: 100,
      velocity: velocity,
      accelerationTime: accelerationTime,
      failed: true,
      failReason: "tension-overload",
    };
  }

  // Calculate target speed based on tension
  const targetSpeed = calculateDragSpeed(tension, item.weight);

  // Ease velocity toward target speed with acceleration
  const ACCELERATION_RATE = 25.0; // m/s² - how quickly speed changes (very fast for responsive feel)

  let newVelocity = velocity;
  let newAccelerationTime = accelerationTime + deltaTime;

  if (Math.abs(targetSpeed - velocity) > 0.01) {
    // Still accelerating/decelerating
    const speedDiff = targetSpeed - velocity;
    const maxChange = ACCELERATION_RATE * deltaTime;
    const change =
      Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), maxChange);
    newVelocity = velocity + change;
  } else {
    // At target speed
    newVelocity = targetSpeed;
    newAccelerationTime = 0;
  }

  // Calculate distance progress using current velocity (with easing)
  const newDistance = Math.max(0, distance - newVelocity * deltaTime);

  // Check if drag complete (reached shore)
  if (newDistance <= 0) {
    return {
      distance: 0,
      magnetPosition: newPosition,
      tension: tension,
      velocity: newVelocity,
      accelerationTime: newAccelerationTime,
      complete: true,
    };
  }

  return {
    distance: newDistance,
    magnetPosition: newPosition,
    tension: tension,
    velocity: newVelocity,
    accelerationTime: newAccelerationTime,
    failed: false,
    complete: false,
  };
}

/**
 * Calculate estimated time to complete drag at current tension
 * @param {number} distance - Remaining distance
 * @param {number} tension - Current tension
 * @param {number} itemWeight - Item weight
 * @returns {number} - Estimated seconds
 */
export function estimateDragTime(distance, tension, itemWeight) {
  const speed = calculateDragSpeed(tension, itemWeight);
  if (speed === 0) return Infinity;
  return distance / speed;
}

/**
 * Check for snag event (random obstacle during drag)
 * @param {number} distance - Current distance
 * @param {number} totalDistance - Initial distance
 * @param {array} dragMemory - History of drag actions
 * @returns {boolean} - True if snag occurs
 */
export function checkForSnag(distance, totalDistance, dragMemory) {
  // Snag can only happen once per drag, in middle third
  const progress = 1 - distance / totalDistance;
  if (progress < 0.33 || progress > 0.66) return false;

  // Check if we've already had a snag (look for specific pattern in memory)
  const hadSnag = dragMemory.some((m) => m.snag === true);
  if (hadSnag) return false;

  // 15% chance per second in the snag zone
  const SNAG_CHANCE_PER_SECOND = 0.15;
  return Math.random() < SNAG_CHANCE_PER_SECOND;
}

/**
 * Get recommended tension range for optimal balance (positional slip model)
 * @param {object} item - Item being dragged
 * @param {number} magnetPosition - Current magnet position on surface
 * @param {number} slipDirection - Direction of slip (-1 or 1)
 * @returns {object} - { min, max, label }
 */
export function getRecommendedTension(item, magnetPosition, slipDirection) {
  // Calculate distance to edge in slip direction
  const distanceToEdge =
    slipDirection === -1 ? magnetPosition : 100 - magnetPosition;

  // If close to edge, recommend lower tension
  if (distanceToEdge < 15) {
    return { min: 10, max: 30, label: "Danger - Near Edge!" };
  } else if (distanceToEdge < 25) {
    return { min: 20, max: 40, label: "Caution - Moderate Risk" };
  } else if (distanceToEdge < 40) {
    return { min: 30, max: 50, label: "Balanced" };
  } else {
    return { min: 40, max: 70, label: "Safe - Optimal Speed" };
  }
}
