/**
 * Drag Mechanics
 * Handles horizontal drag phase - tension management and distance progression
 */

import {
  calculateSlipRate,
  calculateDragSpeed,
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

  // Diminishing returns based on current tension
  let diminishingMod = 1.0;
  if (currentTension >= 86) diminishingMod = 0.2;
  else if (currentTension >= 61) diminishingMod = 0.5;
  else if (currentTension >= 31) diminishingMod = 0.8;
  else diminishingMod = 1.0;

  return BASE_BUILD_RATE * weightMod * diminishingMod;
}

/**
 * Process a tap input (instant tension boost)
 * @param {number} currentTension - Current tension (0-100%)
 * @returns {number} - New tension value
 */
export function processTap(currentTension) {
  const TAP_BOOST = 10; // Fixed 10% per tap
  return Math.min(100, currentTension + TAP_BOOST);
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
      failed: true,
      failReason: "tension-overload",
    };
  }

  // Calculate distance progress
  const dragSpeed = calculateDragSpeed(tension, item.weight);
  const newDistance = Math.max(0, distance - dragSpeed * deltaTime);

  // Check if drag complete (reached shore)
  if (newDistance <= 0) {
    return {
      distance: 0,
      magnetPosition: newPosition,
      tension: tension,
      complete: true,
    };
  }

  return {
    distance: newDistance,
    magnetPosition: newPosition,
    tension: tension,
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
