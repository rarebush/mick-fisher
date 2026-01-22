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

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} - Distance between points
 */
export function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two circles overlap
 * @param {number} x1 - First circle center X
 * @param {number} y1 - First circle center Y
 * @param {number} r1 - First circle radius
 * @param {number} x2 - Second circle center X
 * @param {number} y2 - Second circle center Y
 * @param {number} r2 - Second circle radius
 * @returns {boolean} - True if circles overlap
 */
export function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  const distance = getDistance(x1, y1, x2, y2);
  return distance <= r1 + r2;
}
