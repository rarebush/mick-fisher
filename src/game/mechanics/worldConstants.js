/**
 * worldConstants.js
 * Single source of truth for world space dimensions
 *
 * COORDINATE SYSTEM:
 * - World X: Horizontal position (left/right) in world units
 * - World Y: Depth (distance from avatar toward the river) in world units
 * - World Z: Height (vertical elevation) in world units
 *
 * PROJECTION FORMULA (pixel isometric, ~26.565°):
 *   isoX = (worldX - worldY) * cos(26.565°)
 *   isoY = (worldX + worldY) * sin(26.565°) - worldZ
 *   screenX = isoX * pixelsPerUnit + screenXOffset
 *   screenY = isoY * pixelsPerUnit + screenYOffset
 *
 * IMPORTANT: ALL three coordinates (X, Y, Z) use the same world unit system.
 * The pixelsPerUnit scale factor converts world units to screen pixels.
 * World X=0 is at the center of the screen (avatar position).
 * This ensures 3D distance calculations (sqrt(dx² + dy² + dz²)) are correct.
 *
 * Example with 640x360 base resolution:
 *   - World focus (0, 17.5, 1) → Screen position (320px, 180px) [center]
 */

// =============================================================================
// WORLD HEIGHTS (Z-axis) - Abstract units
// =============================================================================

export const WORLD_X = {
  MIN: -4, // Left bank
  MAX: 4, // Right bank
  CENTER: 0,
  WIDTH: 8,
};

export const WORLD_Z = {
  RIVERBED: 0, // Ground level - items rest here
  WATER_SURFACE: 1, // Top of water
  WALKWAY: 3, // Pier/walkway surface where avatar stands
  AVATAR_FEET: 3, // Avatar feet position (same as walkway surface)
  AVATAR_HAND: 4.5, // Avatar's hand when holding rod (above walkway)
  MAX: 16, // Vertical world extent
};

export const AVATAR_CAST_OFFSET = {
  x: 0,
  y: 0,
  z: WORLD_Z.AVATAR_HAND - WORLD_Z.AVATAR_FEET,
};

/**
 * Get avatar world position (feet/base).
 * @returns {{x:number,y:number,z:number}}
 */
export function getAvatarWorldPosition() {
  return {
    x: 0,
    y: WORLD_Y.AVATAR,
    z: WORLD_Z.AVATAR_FEET,
  };
}

/**
 * Get avatar cast origin (hand) position.
 * @param {{x?:number,y?:number,z?:number}} offset - Optional extra offset
 * @returns {{x:number,y:number,z:number}}
 */
export function getAvatarHandWorldPosition(offset = {}) {
  const avatar = getAvatarWorldPosition();
  return {
    x: avatar.x + AVATAR_CAST_OFFSET.x + (offset.x || 0),
    y: avatar.y + AVATAR_CAST_OFFSET.y + (offset.y || 0),
    z: avatar.z + AVATAR_CAST_OFFSET.z + (offset.z || 0),
  };
}

// =============================================================================
// WORLD DEPTH (Y-axis) - Abstract units
// How far the scene extends from avatar toward the back
// Negative Y = behind the avatar (toward camera), Positive Y = toward river
// =============================================================================

export const WORLD_Y = {
  // Walkway extends behind avatar to fill backdrop
  WALKWAY_BACK: -3, // Back edge of walkway (toward camera)
  WALKWAY_FRONT: 0, // Front edge of walkway (where avatar stands)

  AVATAR: -1, // Avatar is set back from the front edge

  // Wall is at the front edge, no Y depth (vertical surface)
  WALL_EDGE: 0, // Wall is at Y=0, spans Z from walkway to water

  // Water and riverbed extend from near to far
  WATER_NEAR: 0, // Where water begins (at wall base)
  WATER_FAR: 6, // Far edge of water
  RIVERBED_NEAR: 0, // Where riverbed begins
  RIVERBED_FAR: 6, // Far edge of riverbed

  MIN: -3,
  MAX: 6,
};

export const CAMERA_FOCUS = {
  x: 0,
  y: (WORLD_Y.WALKWAY_BACK + WORLD_Y.WATER_FAR) / 2,
  z: WORLD_Z.WATER_SURFACE,
};

// =============================================================================
// PROJECTION CONFIGURATION - Pixel Art Isometric (Dimetric)
// =============================================================================
// This system uses "pixel isometric" projection (actually dimetric, not true
// isometric). The 26.565° angle (arctan(0.5)) creates a 2:1 pixel ratio for
// clean diagonal edges in pixel art (2 pixels right : 1 pixel down).
//
// DESIGN PRIORITY: Horizontal tiling (ground/water tiles) over vertical.
//   - Ground tiles: 64×32 pixels (standard pixel art isometric)
//   - Z displacement: ~36 pixels per world unit (freeform, non-tiling)
//
// WHY NOT 32 PIXELS FOR Z?
//   The 2:1 pixel ratio constrains: diamond height ≈ 32px, Z ≈ 36px.
//   Cannot have both 64×32 tiles AND 32px Z. We choose seamless tiling.
//
// PRACTICAL IMPACT:
//   - 1×1 world ground tile → 64×32 pixel diamond ✓
//   - 1 world unit height (Z) → ~36 pixels ✓
//   - Fish/item sprites: freeform heights (0.5m = 18px, 2m = 72px)
//   - Use 4-pixel grid for sprites (36 = 9×4)
// =============================================================================

const ISO_ANGLE_RAD = Math.atan(0.5); // 26.565° for 2:1 pixel ratio
const ISO_SIN = Math.sin(ISO_ANGLE_RAD); // ~0.4472
const ISO_COS = Math.cos(ISO_ANGLE_RAD); // ~0.8944
const TARGET_TILE_PIXEL_WIDTH = 64; // Standard pixel art isometric width
const TARGET_TILE_PIXEL_HEIGHT = 32; // Standard pixel art isometric height
const TARGET_PPU_FROM_WIDTH = TARGET_TILE_PIXEL_WIDTH / (2 * ISO_COS);
const TARGET_PPU_FROM_HEIGHT = TARGET_TILE_PIXEL_HEIGHT / (2 * ISO_SIN);
const TARGET_PPU = Math.round(
  (TARGET_PPU_FROM_WIDTH + TARGET_PPU_FROM_HEIGHT) / 2
); // ≈36 pixels per world unit
const WORLD_UNITS_PER_METER =
  (TARGET_TILE_PIXEL_WIDTH / (2 * ISO_COS * TARGET_PPU) +
    TARGET_TILE_PIXEL_HEIGHT / (2 * ISO_SIN * TARGET_PPU)) /
  2; // ≈0.9938 (scaling factor for projection)

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
export function getWorldXBounds() {
  return {
    min: WORLD_X.MIN,
    max: WORLD_X.MAX,
    center: WORLD_X.CENTER,
    width: WORLD_X.WIDTH,
  };
}

// =============================================================================
// VIEWPORT CONFIGURATION
// Defines how world units map to screen pixels
// =============================================================================

/**
 * Project a 3D world position into isometric space (world units, no pixels)
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} worldZ
 * @returns {{x:number,y:number}}
 */
export function projectToIsometric(worldX, worldY, worldZ) {
  const scaledX = worldX * WORLD_UNITS_PER_METER;
  const scaledY = worldY * WORLD_UNITS_PER_METER;
  const scaledZ = worldZ * WORLD_UNITS_PER_METER;
  return {
    x: (scaledX - scaledY) * ISO_COS,
    y: (scaledX + scaledY) * ISO_SIN - scaledZ,
  };
}

/**
 * Get projection metrics for debugging and UI display.
 * @param {Object} viewport
 * @returns {{angleDegrees:number,pixelsPerUnit:number,screenXPerWorldUnit:number,screenYPerWorldUnit:number,screenYPerWorldZUnit:number}}
 */
export function getProjectionMetrics(viewport) {
  const pixelsPerUnit = Number.isFinite(viewport?.pixelsPerUnit)
    ? viewport.pixelsPerUnit
    : 0;
  return {
    angleDegrees: (ISO_ANGLE_RAD * 180) / Math.PI,
    pixelsPerUnit,
    screenXPerWorldUnit: ISO_COS * WORLD_UNITS_PER_METER * pixelsPerUnit,
    screenYPerWorldUnit: ISO_SIN * WORLD_UNITS_PER_METER * pixelsPerUnit,
    screenYPerWorldZUnit: WORLD_UNITS_PER_METER * pixelsPerUnit,
  };
}

/**
 * Compute projected bounds for a world-space AABB
 * @param {{xMin:number,xMax:number,yMin:number,yMax:number,zMin:number,zMax:number}} bounds
 * @returns {{minX:number,maxX:number,minY:number,maxY:number}}
 */
export function getProjectedWorldBounds(bounds) {
  const corners = [
    [bounds.xMin, bounds.yMin, bounds.zMin],
    [bounds.xMin, bounds.yMin, bounds.zMax],
    [bounds.xMin, bounds.yMax, bounds.zMin],
    [bounds.xMin, bounds.yMax, bounds.zMax],
    [bounds.xMax, bounds.yMin, bounds.zMin],
    [bounds.xMax, bounds.yMin, bounds.zMax],
    [bounds.xMax, bounds.yMax, bounds.zMin],
    [bounds.xMax, bounds.yMax, bounds.zMax],
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [worldX, worldY, worldZ] of corners) {
    const projected = projectToIsometric(worldX, worldY, worldZ);
    minX = Math.min(minX, projected.x);
    maxX = Math.max(maxX, projected.x);
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Get screen-space projections for world-space corner samples
 * Useful for debugging that bounds fit within the viewport
 * @param {Object} viewport
 * @returns {{world:{x:number,y:number,z:number},screen:{x:number,y:number}}[]}
 */
export function getWorldBoundsProjectionSamples(viewport) {
  const bounds = {
    xMin: WORLD_X.MIN,
    xMax: WORLD_X.MAX,
    yMin: WORLD_Y.MIN,
    yMax: WORLD_Y.MAX,
    zMin: WORLD_Z.RIVERBED,
    zMax: WORLD_Z.MAX,
  };

  const corners = [
    [bounds.xMin, bounds.yMin, bounds.zMin],
    [bounds.xMin, bounds.yMin, bounds.zMax],
    [bounds.xMin, bounds.yMax, bounds.zMin],
    [bounds.xMin, bounds.yMax, bounds.zMax],
    [bounds.xMax, bounds.yMin, bounds.zMin],
    [bounds.xMax, bounds.yMin, bounds.zMax],
    [bounds.xMax, bounds.yMax, bounds.zMin],
    [bounds.xMax, bounds.yMax, bounds.zMax],
  ];

  return corners.map(([worldX, worldY, worldZ]) => ({
    world: { x: worldX, y: worldY, z: worldZ },
    screen: projectToScreen(worldX, worldY, worldZ, viewport),
  }));
}

/**
 * Calculate viewport configuration based on screen dimensions
 * Uses fixed camera focus point and fixed scale (TARGET_PPU)
 * @param {number} screenWidth - Viewport width in pixels
 * @param {number} screenHeight - Viewport height in pixels
 * @returns {Object} Viewport configuration
 */
export function createViewport(screenWidth, screenHeight) {
  const focusProjected = projectToIsometric(
    CAMERA_FOCUS.x,
    CAMERA_FOCUS.y,
    CAMERA_FOCUS.z
  );

  const pixelsPerUnit = TARGET_PPU;
  const screenXOffset = screenWidth / 2 - focusProjected.x * pixelsPerUnit;
  const screenYOffset = screenHeight / 2 - focusProjected.y * pixelsPerUnit;

  // Calculate world X bounds based on screen aspect ratio
  const worldXBounds = getWorldXBounds();

  return {
    screenWidth,
    screenHeight,
    pixelsPerUnit,
    screenXOffset,
    screenYOffset,
    // World bounds for reference
    worldXMin: worldXBounds.min,
    worldXMax: worldXBounds.max,
    worldXCenter: worldXBounds.center,
    worldXWidth: worldXBounds.width,
    worldYMin: WORLD_Y.MIN,
    worldYMax: WORLD_Y.MAX,
    worldZMin: WORLD_Z.RIVERBED,
    worldZMax: WORLD_Z.MAX,
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
  const projected = projectToIsometric(worldX, worldY, worldZ);
  return {
    x: projected.x * viewport.pixelsPerUnit + viewport.screenXOffset,
    y: projected.y * viewport.pixelsPerUnit + viewport.screenYOffset,
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
  const projectedX =
    (screenX - viewport.screenXOffset) / viewport.pixelsPerUnit;
  const projectedY =
    (screenY - viewport.screenYOffset) / viewport.pixelsPerUnit;

  const scaledZ = worldZ * WORLD_UNITS_PER_METER;
  const isoX = projectedX / ISO_COS;
  const isoY = (projectedY + scaledZ) / ISO_SIN;
  const scaledWorldX = (isoX + isoY) / 2;
  const scaledWorldY = (isoY - isoX) / 2;

  return {
    x: scaledWorldX / WORLD_UNITS_PER_METER,
    y: scaledWorldY / WORLD_UNITS_PER_METER,
    z: worldZ,
  };
}

/**
 * Get screen-space angle for a world-space direction on a given plane.
 * Direction is computed from world X/Y only (ignores Z).
 * @param {{x: number, y: number}} fromWorld - World origin (X/Y)
 * @param {{x: number, y: number}} toWorld - World target (X/Y)
 * @param {number} planeZ - World Z plane to project onto
 * @param {Object} viewport - Viewport configuration
 * @returns {number} Angle in radians in screen space
 */
export function getWorldDirectionScreenAngle(
  fromWorld,
  toWorld,
  planeZ,
  viewport
) {
  const deltaX = toWorld.x - fromWorld.x;
  const deltaY = toWorld.y - fromWorld.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance === 0) return 0;

  const directionX = deltaX / distance;
  const directionY = deltaY / distance;

  const screenOrigin = worldToScreen(
    { x: toWorld.x, y: toWorld.y, z: planeZ },
    viewport
  );
  const screenAhead = worldToScreen(
    {
      x: toWorld.x + directionX,
      y: toWorld.y + directionY,
      z: planeZ,
    },
    viewport
  );
  return Math.atan2(
    screenAhead.y - screenOrigin.y,
    screenAhead.x - screenOrigin.x
  );
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
 * @param {number} worldX - World X position (horizontal)
 * @returns {number} Sort key (matches projected screenY, without offset)
 */
export function calculateSortKey(worldY, worldZ, worldX = 0) {
  const scaledX = worldX * WORLD_UNITS_PER_METER;
  const scaledY = worldY * WORLD_UNITS_PER_METER;
  const scaledZ = worldZ * WORLD_UNITS_PER_METER;
  return (scaledX + scaledY) * ISO_SIN - scaledZ;
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
