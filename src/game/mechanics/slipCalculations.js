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
