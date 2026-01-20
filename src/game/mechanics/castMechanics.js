/**
 * Casting Mechanics
 * Handles quadrant selection, placement RNG, and item spawning
 */

import {
  getLocation,
  getQuadrantZone,
  getQuadrantDistance,
  getQuadrantDepth,
} from "../data/locationDatabase.js";
import { getItem } from "../data/itemDatabase.js";
import {
  rollMagnetLandingPosition,
  getDistanceToNearestEdge,
} from "./slipCalculations.js";

/**
 * Roll for item spawn in selected quadrant
 * @param {number} quadrant - Quadrant number (0-9)
 * @param {string} locationId - Location ID
 * @returns {object|null} - Spawned item object or null if nothing
 */
export function rollForItem(quadrant, locationId) {
  const location = getLocation(locationId);
  if (!location) return null;

  const zone = getQuadrantZone(quadrant);
  const spawnTable = location.spawnTables[zone];

  if (!spawnTable) return null;

  // Calculate total weight including "nothing"
  const itemWeights = Object.entries(spawnTable.items);
  const totalItemWeight = itemWeights.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );
  const totalWeight = totalItemWeight + spawnTable.nothingWeight;

  // Roll random number
  const roll = Math.random() * totalWeight;

  // Check if "nothing" was rolled
  if (roll < spawnTable.nothingWeight) {
    return null; // No item
  }

  // Find which item was rolled
  let cumulative = spawnTable.nothingWeight;
  for (const [itemId, weight] of itemWeights) {
    cumulative += weight;
    if (roll < cumulative) {
      return getItem(itemId);
    }
  }

  return null; // Fallback
}

/**
 * Calculate placement quality (affects initial slip rate)
 * Based on RNG - simulates how well magnet landed on item
 * @returns {object} - { placement: 'center' | 'edge' | 'corner', multiplier: number }
 */
export function rollPlacementQuality() {
  const roll = Math.random();

  if (roll < 0.5) {
    // 50% chance - Center placement (best)
    return {
      placement: "center",
      multiplier: 0.7, // 30% slip reduction
      label: "Center Grip",
    };
  } else if (roll < 0.85) {
    // 35% chance - Edge placement (medium)
    return {
      placement: "edge",
      multiplier: 1.0, // Normal slip
      label: "Edge Grip",
    };
  } else {
    // 15% chance - Corner placement (worst)
    return {
      placement: "corner",
      multiplier: 1.5, // 50% slip increase
      label: "Corner Grip",
    };
  }
}

/**
 * Get random distance within quadrant range
 * @param {number} quadrant - Quadrant number (0-9)
 * @returns {number} - Distance in meters
 */
export function getRandomDistance(quadrant) {
  const range = getQuadrantDistance(quadrant);
  return range.min + Math.random() * (range.max - range.min);
}

/**
 * Get random depth within quadrant range
 * @param {number} quadrant - Quadrant number (0-9)
 * @param {string} locationId - Location ID (affects depth multiplier)
 * @returns {number} - Depth in meters
 */
export function getRandomDepth(quadrant, locationId) {
  const range = getQuadrantDepth(quadrant);
  const location = getLocation(locationId);
  const depth = range.min + Math.random() * (range.max - range.min);

  return depth * (location?.depthMultiplier || 1.0);
}

/**
 * Execute complete cast sequence (positional slip model)
 * @param {number} quadrant - Selected quadrant (0-9)
 * @param {string} locationId - Current location
 * @returns {object} - Cast result with item, distance, depth, magnetPosition
 */
export function executeCast(quadrant, locationId) {
  const item = rollForItem(quadrant, locationId);

  if (!item) {
    return {
      success: false,
      item: null,
      distance: getRandomDistance(quadrant),
      depth: getRandomDepth(quadrant, locationId),
      magnetPosition: null,
      magnetContactWidth: 6, // Reduced for more slip risk
    };
  }

  const distance = getRandomDistance(quadrant);
  const depth = getRandomDepth(quadrant, locationId);

  // Roll for magnet landing position (0-100 on item surface)
  const magnetContactWidth = 6; // Basic magnet width (reduced for more slip risk)
  const magnetPosition = rollMagnetLandingPosition(magnetContactWidth);

  // Calculate placement quality based on position
  const distanceToEdge = getDistanceToNearestEdge(magnetPosition);
  let placementQuality;
  if (distanceToEdge >= 40) {
    placementQuality = { placement: "center", label: "Perfect Center" };
  } else if (distanceToEdge >= 25) {
    placementQuality = { placement: "good", label: "Good Center" };
  } else if (distanceToEdge >= 15) {
    placementQuality = { placement: "edge", label: "Edge Grip" };
  } else {
    placementQuality = { placement: "corner", label: "Corner Grip" };
  }

  return {
    success: true,
    item: { ...item }, // Clone item data
    distance,
    depth,
    magnetPosition,
    magnetContactWidth,
    placementQuality,
  };
}

/**
 * Check if quadrant is accessible with current equipment
 * @param {number} quadrant - Quadrant number (0-9)
 * @param {number} lineLength - Equipment line length in meters
 * @returns {boolean} - True if accessible
 */
export function isQuadrantAccessible(quadrant, lineLength) {
  const range = getQuadrantDistance(quadrant);
  return range.max <= lineLength;
}
