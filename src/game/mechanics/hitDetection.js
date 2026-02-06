/**
 * Hit Detection
 * Pure functions for collision/proximity detection
 */
/**
 * Check if a point is inside a circle
 * @param {number} pointX - Point X coordinate
 * @param {number} pointY - Point Y coordinate
 * @param {number} circleX - Circle center X coordinate
 * @param {number} circleY - Circle center Y coordinate
 * @param {number} radius - Circle radius
 * @returns {boolean} - True if point is inside circle
 */
export function isPointInCircle(pointX, pointY, circleX, circleY, radius) {
  const dx = pointX - circleX;
  const dy = pointY - circleY;
  const distanceSquared = dx * dx + dy * dy;
  return distanceSquared <= radius * radius;
}

