/**
 * Get item visual size based on category.
 * @param {object} item - Item data
 * @returns {number} - Size in pixels (diameter)
 */
export function getItemSize(item) {
  const weight = item.weight;

  if (weight >= 60) return 80; // Very heavy items - large
  if (weight >= 30) return 60; // Heavy items - medium-large
  if (weight >= 10) return 45; // Medium items
  if (weight >= 3) return 30; // Small items
  return 20; // Tiny items - difficult to hit
}
