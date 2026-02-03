import { MAX_QUADRANT_DISTANCE } from "../data/locationDatabase.js";
import {
  WORLD_Y,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";

/**
 * Calculate distance from avatar based on item's X and Y position
 * Used for re-engaged items to derive distance from screen coordinates
 * Distance is the 2D distance from item to avatar (wall base center)
 * @param {number} itemWorldX - Item's X position in world space
 * @param {number} itemWorldY - Item's Y position in world space
 * @returns {number} - Estimated distance in meters
 */
export function calculateDistanceFromPosition(itemWorldX, itemWorldY) {
  const avatarWorld = getAvatarWorldPosition();
  const worldDistance = Math.hypot(
    itemWorldX - avatarWorld.x,
    itemWorldY - avatarWorld.y
  );
  const worldDepthRange = WORLD_Y.RIVERBED_FAR - WORLD_Y.AVATAR;
  if (!Number.isFinite(worldDepthRange) || worldDepthRange <= 0) {
    return 0;
  }
  const meters =
    (worldDistance / worldDepthRange) * (MAX_QUADRANT_DISTANCE || 0);
  return Math.max(0, Math.min(MAX_QUADRANT_DISTANCE, meters));
}
