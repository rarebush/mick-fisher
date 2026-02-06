import { WORLD_Y, WORLD_Z } from "./worldDimensions.js";
import { normalize } from "../physics/vectorUtils.js";

const ISO_ANGLE_RAD = Math.atan(0.5); // 26.565° for 2:1 pixel ratio
const ISO_SIN = Math.sin(ISO_ANGLE_RAD); // ~0.4472
const ISO_COS = Math.cos(ISO_ANGLE_RAD); // ~0.8944
const TARGET_TILE_PIXEL_WIDTH = 64; // Standard pixel art isometric width
const TARGET_TILE_PIXEL_HEIGHT = 32; // Standard pixel art isometric height
const TARGET_PPU_FROM_WIDTH = TARGET_TILE_PIXEL_WIDTH / (2 * ISO_COS);
const TARGET_PPU_FROM_HEIGHT = TARGET_TILE_PIXEL_HEIGHT / (2 * ISO_SIN);
export const TARGET_PPU = Math.round(
  (TARGET_PPU_FROM_WIDTH + TARGET_PPU_FROM_HEIGHT) / 2
); // ≈36 pixels per world unit
const WORLD_UNITS_PER_METER =
  (TARGET_TILE_PIXEL_WIDTH / (2 * ISO_COS * TARGET_PPU) +
    TARGET_TILE_PIXEL_HEIGHT / (2 * ISO_SIN * TARGET_PPU)) /
  2; // ≈0.9938 (scaling factor for projection)

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
 * Convert screen position to world position at a given Z height
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {number} worldZ - World Z coordinate
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
  const direction = normalize({ x: deltaX, y: deltaY });
  if (direction.x === 0 && direction.y === 0) return 0;

  const screenOrigin = worldToScreen(
    { x: toWorld.x, y: toWorld.y, z: planeZ },
    viewport
  );
  const screenAhead = worldToScreen(
    {
      x: toWorld.x + direction.x,
      y: toWorld.y + direction.y,
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
 * @param {number} worldZ - The Z height of the surface
 * @param {Object} viewport - Viewport configuration
 * @returns {{top: number, bottom: number}} Screen Y coordinates (top is smaller)
 */
export function getSurfaceScreenBounds(worldZ, viewport) {
  let nearY, farY;

  if (worldZ >= WORLD_Z.WALKWAY) {
    nearY = WORLD_Y.WALKWAY_BACK;
    farY = WORLD_Y.WALKWAY_FRONT;
  } else if (worldZ >= WORLD_Z.WATER_SURFACE) {
    nearY = WORLD_Y.WATER_NEAR;
    farY = WORLD_Y.WATER_FAR;
  } else {
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
