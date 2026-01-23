/**
 * worldConstants.js
 * Single source of truth for world space dimensions
 *
 * COORDINATE SYSTEM:
 * - World X: Horizontal position (left/right) in world units
 * - World Y: Depth (distance from avatar toward the river) in world units
 * - World Z: Height (vertical elevation) in world units
 *
 * PROJECTION FORMULA:
 *   screenX = worldX * pixelsPerUnit + screenWidth / 2
 *   screenY = (worldY - worldZ) * pixelsPerUnit + screenYOffset
 *
 * IMPORTANT: ALL three coordinates (X, Y, Z) use the same world unit system.
 * The pixelsPerUnit scale factor (typically ~85.6) converts world units to screen pixels.
 * World X=0 is at the center of the screen (avatar position).
 * This ensures 3D distance calculations (sqrt(dx² + dy² + dz²)) are correct.
 *
 * Example with pixelsPerUnit = 85.6, screenWidth = 854px:
 *   - World position (0, 1.5, 4.2) → Screen position (427px, -146.52px) [center]
 *   - World position (-5, 0, 0) → Screen position (0px, 408px) [left edge]
 *   - World position (+5, 0, 0) → Screen position (854px, 408px) [right edge]
 */

// =============================================================================
// WORLD HEIGHTS (Z-axis) - Abstract units
// =============================================================================

export const WORLD_Z = {
  RIVERBED: 0, // Ground level - items rest here
  WATER_SURFACE: 1, // Top of water
  WALKWAY: 3, // Pier/walkway surface where avatar stands
  AVATAR_HAND: 4.2, // Avatar's hand when holding rod (above walkway)
};

// =============================================================================
// WORLD DEPTH (Y-axis) - Abstract units
// How far the scene extends from avatar toward the back
// Negative Y = behind the avatar (toward camera), Positive Y = toward river
// =============================================================================

export const WORLD_Y = {
  // Walkway extends behind avatar to fill backdrop
  WALKWAY_BACK: -4, // Back edge of walkway (toward camera, fills screen top)
  WALKWAY_FRONT: 0, // Front edge of walkway (where avatar stands)

  AVATAR: 0, // Avatar is at the front edge of walkway

  // Wall is at the front edge, no Y depth (vertical surface)
  WALL_EDGE: 0, // Wall is at Y=0, spans Z from walkway to water

  // Water and riverbed extend from near to far
  WATER_NEAR: 0, // Where water begins (at wall base)
  WATER_FAR: 6, // Far edge of water
  RIVERBED_NEAR: 0, // Where riverbed begins
  RIVERBED_FAR: 6, // Far edge of riverbed
};

// =============================================================================
// WORLD WIDTH (X-axis) - Abstract units
// Calculated based on screen aspect ratio to maintain proportions
// =============================================================================

/**
 * Calculate world X bounds based on screen aspect ratio
 * Ensures world space has consistent proportions regardless of screen size
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @param {number} pixelsPerUnit - Scale factor (pixels per world unit)
 * @returns {{min: number, max: number, center: number}} World X boundaries
 */
export function getWorldXBounds(screenWidth, screenHeight, pixelsPerUnit) {
  // World width in units based on screen aspect ratio
  const worldWidth = screenWidth / pixelsPerUnit;

  // Center the world space at X=0 (avatar in middle)
  const worldXMin = -worldWidth / 2;
  const worldXMax = worldWidth / 2;

  return {
    min: worldXMin,
    max: worldXMax,
    center: 0,
    width: worldWidth,
  };
}

// =============================================================================
// VIEWPORT CONFIGURATION
// Defines how world units map to screen pixels
// =============================================================================

/**
 * Calculate viewport scale based on screen dimensions
 * @param {number} screenWidth - Viewport width in pixels
 * @param {number} screenHeight - Viewport height in pixels
 * @returns {Object} Viewport configuration
 */
export function createViewport(screenWidth, screenHeight) {
  // The scene spans from Y=0 (avatar) to Y=6 (far riverbed)
  // And from Z=0 (riverbed) to Z=4.2 (avatar hand)
  // Screen Y range needed: (Y - Z) from (0 - 4.2) = -4.2 to (6 - 0) = 6
  // Total screen Y range: 10.2 world units

  const worldYRange = WORLD_Y.RIVERBED_FAR - WORLD_Y.AVATAR; // 6 units of depth
  const worldZRange = WORLD_Z.AVATAR_HAND - WORLD_Z.RIVERBED; // 4.2 units of height
  const totalScreenYRange = worldYRange + worldZRange; // 10.2 units

  // Scale to fit the viewport height with some padding
  const padding = 0.1; // 10% padding
  const usableHeight = screenHeight * (1 - padding);
  const pixelsPerUnit = usableHeight / totalScreenYRange;

  // Calculate the screen Y offset to position the scene
  // The avatar hand at (Y=0, Z=4.2) should project to screenY = 0 - 4.2 = -4.2
  // We need to offset this so the top of the scene is visible
  const topOfSceneWorldY = WORLD_Y.AVATAR - WORLD_Z.AVATAR_HAND; // -4.2
  const screenYOffset =
    -topOfSceneWorldY * pixelsPerUnit + (screenHeight * padding) / 2;

  // Calculate world X bounds based on screen aspect ratio
  const worldXBounds = getWorldXBounds(
    screenWidth,
    screenHeight,
    pixelsPerUnit,
  );

  return {
    screenWidth,
    screenHeight,
    pixelsPerUnit,
    screenYOffset,
    // World bounds for reference
    worldXMin: worldXBounds.min,
    worldXMax: worldXBounds.max,
    worldXCenter: worldXBounds.center,
    worldXWidth: worldXBounds.width,
    worldYMin: WORLD_Y.AVATAR,
    worldYMax: WORLD_Y.RIVERBED_FAR,
    worldZMin: WORLD_Z.RIVERBED,
    worldZMax: WORLD_Z.AVATAR_HAND,
  };
}

// =============================================================================
// PROJECTION FUNCTIONS
// Convert between world space and screen space
// =============================================================================

/**
 * Project a 3D world position to 2D screen position
 * @param {number} worldX - World X coordinate (in world units)
 * @param {number} worldY - World Y coordinate (depth)
 * @param {number} worldZ - World Z coordinate (height)
 * @param {Object} viewport - Viewport configuration from createViewport()
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function projectToScreen(worldX, worldY, worldZ, viewport) {
  return {
    x: worldX * viewport.pixelsPerUnit + viewport.screenWidth / 2, // World center (X=0) maps to screen center
    y: (worldY - worldZ) * viewport.pixelsPerUnit + viewport.screenYOffset,
  };
}

/**
 * Project a 3D world position to 2D screen position (simplified for X in world units)
 * @param {{x: number, y: number, z: number}} worldPos - World position
 * @param {Object} viewport - Viewport configuration
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function worldToScreen(worldPos, viewport) {
  return projectToScreen(worldPos.x, worldPos.y, worldPos.z, viewport);
}

/**
 * Convert screen position to world position on a specific surface (known Z)
 * @param {number} screenX - Screen X coordinate (in pixels)
 * @param {number} screenY - Screen Y coordinate (in pixels)
 * @param {number} worldZ - Known world Z (which surface we're clicking on)
 * @param {Object} viewport - Viewport configuration
 * @returns {{x: number, y: number, z: number}} World coordinates
 */
export function screenToWorld(screenX, screenY, worldZ, viewport) {
  // screenY = (worldY - worldZ) * pixelsPerUnit + offset
  // (screenY - offset) / pixelsPerUnit = worldY - worldZ
  // worldY = (screenY - offset) / pixelsPerUnit + worldZ
  const worldY =
    (screenY - viewport.screenYOffset) / viewport.pixelsPerUnit + worldZ;

  return {
    x: (screenX - viewport.screenWidth / 2) / viewport.pixelsPerUnit, // Screen center maps to world center (X=0)
    y: worldY,
    z: worldZ,
  };
}

/**
 * Get the screen Y boundaries for a horizontal surface at a given Z height.
 * Uses the appropriate Y range for each surface type.
 *
 * For the 2.5D projection:
 * - Higher Z values appear higher on screen (smaller screen Y)
 * - The "top" is where the surface appears nearest to camera (smallest Y)
 * - The "bottom" is where the surface appears furthest (largest Y)
 *
 * @param {number} worldZ - The Z height of the surface
 * @param {Object} viewport - Viewport configuration
 * @returns {{top: number, bottom: number}} Screen Y coordinates (top is smaller)
 */
export function getSurfaceScreenBounds(worldZ, viewport) {
  let nearY, farY;

  if (worldZ >= WORLD_Z.WALKWAY) {
    // Walkway extends from back (toward camera) to front (avatar position)
    nearY = WORLD_Y.WALKWAY_BACK;
    farY = WORLD_Y.WALKWAY_FRONT;
  } else if (worldZ >= WORLD_Z.WATER_SURFACE) {
    // Water surface spans from near to far
    nearY = WORLD_Y.WATER_NEAR;
    farY = WORLD_Y.WATER_FAR;
  } else {
    // Riverbed spans from near to far
    nearY = WORLD_Y.RIVERBED_NEAR;
    farY = WORLD_Y.RIVERBED_FAR;
  }

  const topScreenY = projectToScreen(0, nearY, worldZ, viewport).y;
  const bottomScreenY = projectToScreen(0, farY, worldZ, viewport).y;

  return {
    top: topScreenY,
    bottom: bottomScreenY,
  };
}

// =============================================================================
// RENDER ORDER / DEPTH SORTING
// =============================================================================

/**
 * Render layer constants for static elements
 * Lower values render first (behind), higher values render on top
 */
export const RENDER_LAYERS = {
  WALKWAY: 0,
  AVATAR: 1,
  WALL_FACE: 2,
  RIVERBED: 3,
  ITEMS_ON_RIVERBED: 4,
  WATER_SURFACE: 5,
  // Magnet layer is dynamic based on position
};

/**
 * Get the render layer for the magnet based on its current position
 * @param {number} worldZ - Magnet's current Z height
 * @returns {number} Render layer value
 */
export function getMagnetRenderLayer(worldZ) {
  if (worldZ > WORLD_Z.WATER_SURFACE) {
    // In air: above everything except avatar hand area
    return 1.5; // Between AVATAR and WALL_FACE
  } else if (worldZ > WORLD_Z.RIVERBED) {
    // In water: below water surface, above riverbed/items
    return 4.5; // Between ITEMS_ON_RIVERBED and WATER_SURFACE
  } else {
    // On riverbed: same as items
    return RENDER_LAYERS.ITEMS_ON_RIVERBED;
  }
}

/**
 * Calculate sort key for depth ordering of dynamic objects
 * Objects with larger sort keys are further back and should render first
 * @param {number} worldY - World Y position (depth)
 * @param {number} worldZ - World Z position (height)
 * @returns {number} Sort key (equals screenY)
 */
export function calculateSortKey(worldY, worldZ) {
  return worldY - worldZ;
}

// =============================================================================
// GAME MECHANIC HELPERS
// =============================================================================

/**
 * Check if a world position is underwater
 * @param {number} worldZ - World Z position
 * @returns {boolean} True if underwater
 */
export function isUnderwater(worldZ) {
  return worldZ < WORLD_Z.WATER_SURFACE;
}

/**
 * Check if a world position is on the riverbed
 * @param {number} worldZ - World Z position
 * @returns {boolean} True if on riverbed
 */
export function isOnRiverbed(worldZ) {
  return worldZ <= WORLD_Z.RIVERBED;
}

/**
 * Get water depth at a position (how deep below surface)
 * @param {number} worldZ - World Z position
 * @returns {number} Depth below water surface (0 if above water)
 */
export function getWaterDepth(worldZ) {
  if (worldZ >= WORLD_Z.WATER_SURFACE) return 0;
  return WORLD_Z.WATER_SURFACE - worldZ;
}

/**
 * Linear interpolation helper
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
