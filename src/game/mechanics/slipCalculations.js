/**
 * Slip Calculations - Positional Model
 * Core risk/reward mechanic - magnet slides across item surface
 *
 * Magnet occupies position 0-100 on item surface.
 * Slides toward nearest edge. Falls off when edges exceed 0 or 100.
 */

/**
 * Determine initial magnet landing position on item surface
 * Ensures magnet contact area stays within bounds (0-100)
 * @param {number} contactWidth - Width of magnet contact area (default 10)
 * @returns {number} - Position on surface (0-100 units)
 */
export function rollMagnetLandingPosition(contactWidth = 10) {
  // Ensure magnet edges don't exceed boundaries
  const minPosition = contactWidth / 2;
  const maxPosition = 100 - contactWidth / 2;
  return minPosition + Math.random() * (maxPosition - minPosition);
}

/**
 * Get distance from magnet position to nearest edge
 * @param {number} position - Current magnet position (0-100)
 * @returns {number} - Distance to nearest edge in units
 */
export function getDistanceToNearestEdge(position) {
  const distanceToLeftEdge = position;
  const distanceToRightEdge = 100 - position;
  return Math.min(distanceToLeftEdge, distanceToRightEdge);
}

/**
 * Calculate slip rate in units per second (positional model)
 * Based on documentation: slip rate × surface modifier × tension modifier
 * @param {object} item - Item being retrieved
 * @param {number} tension - Current tension (0-100%)
 * @returns {number} - Slip rate in units per second
 */
export function calculateSlipRate(item, tension) {
  // Base slip rate from item (units per second at baseline)
  const baseSlipRate = item.slipRate || 1.0;

  // Surface condition modifier (from documentation table)
  const surfaceModifiers = {
    clean: 1.0, // Clean metal baseline
    rusty: 1.5, // Light rust
    sludge: 3.0, // Heavy sludge
  };
  const surfaceMultiplier = surfaceModifiers[item.surfaceCondition] || 1.0;

  // Tension modifier (from documentation table)
  const tensionMultiplier = getTensionSlipMultiplier(tension);

  return baseSlipRate * surfaceMultiplier * tensionMultiplier;
}

/**
 * Get tension-based slip multiplier
 * Based on documentation table
 * @param {number} tension - Current tension (0-100%)
 * @returns {number} - Slip rate multiplier
 */
export function getTensionSlipMultiplier(tension) {
  if (tension >= 81) return 5.0; // Danger zone (increased from 4.0)
  if (tension >= 61) return 2.5; // High (increased from 2.0)
  if (tension >= 31) return 1.3; // Medium (increased from 1.0)
  if (tension >= 1) return 0.5; // Low
  return 0; // No tension = no slip
}

/**
 * Update magnet position based on slip rate and time
 * @param {number} currentPosition - Current position (0-100)
 * @param {number} slipDirection - Direction (-1 left, 1 right)
 * @param {number} slipRate - Units per second
 * @param {number} deltaTime - Time elapsed in seconds
 * @returns {number} - New position
 */
export function updateMagnetPosition(
  currentPosition,
  slipDirection,
  slipRate,
  deltaTime,
) {
  const slipDistance = slipRate * deltaTime;
  return currentPosition + slipDirection * slipDistance;
}

/**
 * Check if magnet has slipped off the item
 * Only fails when magnet is COMPLETELY off (no contact remaining)
 * @param {number} position - Magnet center position (0-100)
 * @param {number} contactWidth - Magnet contact width (typically 10)
 * @returns {boolean} - True if magnet has fallen off completely
 */
export function hasMagnetSlippedOff(position, contactWidth = 10) {
  const magnetLeftEdge = position - contactWidth / 2;
  const magnetRightEdge = position + contactWidth / 2;
  // Only fail if completely off - no contact remaining
  return magnetRightEdge <= 0 || magnetLeftEdge >= 100;
}

/**
 * Calculate drag speed based on tension
 * @param {number} tension - Current tension (0-100%)
 * @param {number} itemWeight - Item weight in kg
 * @returns {number} - Drag speed in meters per second
 */
export function calculateDragSpeed(tension, itemWeight = 10) {
  if (tension >= 100) return 0; // Ripped off

  // Base speed from tension (documentation table)
  let speedMultiplier = 0;
  if (tension >= 86) speedMultiplier = 1.9;
  else if (tension >= 71) speedMultiplier = 1.6;
  else if (tension >= 51) speedMultiplier = 1.2;
  else if (tension >= 31) speedMultiplier = 0.8;
  else if (tension >= 1) speedMultiplier = 0.45;

  // Weight resistance (heavier = slower)
  const weightModifier = Math.max(0.5, Math.min(1.5, 10 / itemWeight));

  // Base drag speed (meters per second at optimal conditions)
  const BASE_DRAG_SPEED = 0.6; // Reduced from 2.0 for balanced gameplay

  return speedMultiplier * weightModifier * BASE_DRAG_SPEED;
}

/**
 * Calculate lift speed based on tap rate
 * @param {number} tapRate - Taps per second
 * @param {number} itemWeight - Item weight in kg
 * @returns {number} - Lift speed in meters per second
 */
export function calculateLiftSpeed(tapRate, itemWeight = 10) {
  // Base speed from tap rate (documentation table)
  let baseSpeed = 0;
  if (tapRate > 3) baseSpeed = 2.0;
  else if (tapRate >= 2) baseSpeed = 1.5;
  else if (tapRate >= 1) baseSpeed = 0.8;
  else baseSpeed = 0.3;

  // Weight resistance - heavier items need faster tapping
  const weightFactor = Math.max(0.5, 10 / itemWeight);

  return baseSpeed * weightFactor;
}

/**
 * Calculate slip chance reduction from good tension management
 * Rewards players who maintain consistent mid-range tension
 * @param {array} dragMemory - Array of {tension, timestamp} objects
 * @returns {number} - Bonus multiplier (0.8-1.0, lower is better)
 */
export function calculateConsistencyBonus(dragMemory) {
  if (!dragMemory || dragMemory.length < 5) return 1.0;

  // Calculate variance in tension over time
  const tensions = dragMemory.map((m) => m.tension);
  const avg = tensions.reduce((a, b) => a + b, 0) / tensions.length;
  const variance =
    tensions.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) /
    tensions.length;

  // Low variance + mid-range average = bonus
  if (variance < 100 && avg >= 40 && avg <= 60) {
    return 0.8; // 20% slip reduction
  } else if (variance < 200) {
    return 0.9; // 10% slip reduction
  }

  return 1.0; // No bonus
}
