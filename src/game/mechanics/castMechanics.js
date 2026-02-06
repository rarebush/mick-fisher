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
import { calculateDistanceFromPosition } from "../utils/positionCalculations.js";
import { getItemSize } from "../utils/itemSizing.js";

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
    0
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
 * Execute complete cast sequence with engaged item checking
 * @param {number} quadrant - Selected quadrant (0-9)
 * @param {string} locationId - Current location
 * @param {number} x - Cast x position (for hit detection)
 * @param {number} y - Cast y position (for hit detection)
 * @param {object|null} hitItem - Pre-checked engaged item hit (from locationStore)
 * @returns {object} - Cast result with item, distance, depth, magnetSurfacePosition
 */
export function executeCast(
  quadrant,
  locationId,
  castWorld = { x: 0, y: 0 },
  hitItem = null
) {
  let item;
  let isEngagedItem = false;
  let itemInstanceId = null;
  let itemPositionWorld = { x: castWorld.x, y: castWorld.y };
  let itemSize = 50; // Default size in pixels

  // Check if we hit an engaged item
  if (hitItem) {
    item = hitItem.item;
    isEngagedItem = true;
    itemInstanceId = hitItem.itemId;
    // Use the item's SAVED position for progressive retrieval
    itemPositionWorld = { x: hitItem.worldX, y: hitItem.worldY };
    itemSize = hitItem.size;
    console.log(
      `[CAST] Re-engaging with lost item: ${item.name} at saved position`
    );
  } else {
    // New RNG spawn
    item = rollForItem(quadrant, locationId);
    if (item) {
      // Generate unique instance ID for this newly engaged item
      itemInstanceId = `${item.id}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      // Assign size based on item category
      itemSize = getItemSize(item);
      console.log(`[CAST] New item spawned: ${item.name}, size: ${itemSize}px`);
    }
  }

  if (!item) {
    return {
      success: false,
      item: null,
      distance: getRandomDistance(quadrant),
      depth: getRandomDepth(quadrant, locationId),
      magnetSurfacePosition: null,
      magnetContactWidth: 6,
    };
  }

  // Calculate distance based on item position
  // For re-engaged items, use 2D distance to avatar; for new items, use random
  const distance = isEngagedItem
    ? calculateDistanceFromPosition(itemPositionWorld.x, itemPositionWorld.y)
    : getRandomDistance(quadrant);
  const depth = getRandomDepth(quadrant, locationId);

  // Roll for magnet landing position (0-100 on item surface)
  const magnetContactWidth = 6;
  const magnetSurfacePosition = rollMagnetLandingPosition(magnetContactWidth);

  // Calculate placement quality based on position
  const distanceToEdge = getDistanceToNearestEdge(magnetSurfacePosition);
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
    item: { ...item },
    distance,
    depth,
    magnetSurfacePosition,
    magnetContactWidth,
    placementQuality,
    // Engaged item metadata
    isEngagedItem,
    itemInstanceId,
    itemPositionWorld,
    itemSize,
  };
}

