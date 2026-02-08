/**
 * Debug Overlays
 * Wireframe volumes, origin axes, displacement debug rect,
 * quadrant grid, and world bounds visualization.
 */

import * as PIXI from "pixi.js";
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  createViewport,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { drawWireframeBox } from "./sceneHelpers.js";

/**
 * Draw the water surface wireframe outline.
 *
 * @param {Array<{x: number, y: number}>} waterSurfaceCorners - Pre-computed screen-space corners
 * @returns {PIXI.Graphics} The wireframe graphics object (not yet added to any container)
 */
export function createWaterSurfaceWireframe(waterSurfaceCorners) {
  const wireframe = new PIXI.Graphics();
  wireframe.moveTo(waterSurfaceCorners[0].x, waterSurfaceCorners[0].y);
  for (let i = 1; i < waterSurfaceCorners.length; i += 1) {
    wireframe.lineTo(waterSurfaceCorners[i].x, waterSurfaceCorners[i].y);
  }
  wireframe.closePath();
  wireframe.stroke({ width: 1, color: 0x6d6d6d, alpha: 0.8 });
  return wireframe;
}

/**
 * Draw the displacement debug rect — a 2D screen-space AABB around the
 * displacement-affected area. Projects the waterGroup world-space volume
 * corners and finds the axis-aligned bounding rect.
 *
 * @param {Object} viewport - Viewport for projection
 * @returns {PIXI.Graphics} The debug rect (not yet added to any container)
 */
export function createDisplacementDebugRect(viewport) {
  const displacementCorners = [
    [WORLD_X.MIN, WORLD_Y.WATER_NEAR, WORLD_Z.RIVERBED],
    [WORLD_X.MIN, WORLD_Y.WATER_NEAR, WORLD_Z.WATER_SURFACE],
    [WORLD_X.MIN, WORLD_Y.WATER_FAR, WORLD_Z.RIVERBED],
    [WORLD_X.MIN, WORLD_Y.WATER_FAR, WORLD_Z.WATER_SURFACE],
    [WORLD_X.MAX, WORLD_Y.WATER_NEAR, WORLD_Z.RIVERBED],
    [WORLD_X.MAX, WORLD_Y.WATER_NEAR, WORLD_Z.WATER_SURFACE],
    [WORLD_X.MAX, WORLD_Y.WATER_FAR, WORLD_Z.RIVERBED],
    [WORLD_X.MAX, WORLD_Y.WATER_FAR, WORLD_Z.WATER_SURFACE],
  ].map(([x, y, z]) => projectToScreen(x, y, z, viewport));

  let dMinX = Infinity,
    dMinY = Infinity,
    dMaxX = -Infinity,
    dMaxY = -Infinity;
  for (const pt of displacementCorners) {
    if (pt.x < dMinX) dMinX = pt.x;
    if (pt.y < dMinY) dMinY = pt.y;
    if (pt.x > dMaxX) dMaxX = pt.x;
    if (pt.y > dMaxY) dMaxY = pt.y;
  }

  const rect = new PIXI.Graphics();
  rect.rect(dMinX, dMinY, dMaxX - dMinX, dMaxY - dMinY);
  rect.stroke({ width: 1, color: 0xffff00, alpha: 0.9 });
  rect.zIndex = 9999;
  return rect;
}

/**
 * Draw world-space axes through the origin (0,0,0).
 *
 * @param {Object} viewport - Viewport for projection
 * @param {number} [axisLength=4] - Length of each axis in world units
 * @returns {PIXI.Graphics} The axes graphics (not yet added to any container)
 */
export function createOriginAxes(viewport, axisLength = 4) {
  const axes = new PIXI.Graphics();
  const origin = projectToScreen(0, 0, 0, viewport);
  const xEnd = projectToScreen(axisLength, 0, 0, viewport);
  const yEnd = projectToScreen(0, axisLength, 0, viewport);
  const zEnd = projectToScreen(0, 0, axisLength, viewport);

  // X axis
  axes.moveTo(origin.x, origin.y);
  axes.lineTo(xEnd.x, xEnd.y);
  axes.stroke({ width: 1, color: 0x000000, alpha: 1 });
  // Y axis
  axes.moveTo(origin.x, origin.y);
  axes.lineTo(yEnd.x, yEnd.y);
  axes.stroke({ width: 1, color: 0x000000, alpha: 1 });
  // Z axis
  axes.moveTo(origin.x, origin.y);
  axes.lineTo(zEnd.x, zEnd.y);
  axes.stroke({ width: 1, color: 0x000000, alpha: 1 });

  return axes;
}

/**
 * Draw quadrant grid overlay.
 * Quadrants only cover the riverbed area (where items can spawn).
 * Uses world constants to determine riverbed screen bounds.
 */
export function drawQuadrantGrid(app) {
  if (!app) return;

  const viewport = createViewport(app.screen.width, app.screen.height);

  const z = WORLD_Z.RIVERBED;
  const xMin = WORLD_X.MIN;
  const xMax = WORLD_X.MAX;
  const yMin = WORLD_Y.RIVERBED_NEAR;
  const yMax = WORLD_Y.RIVERBED_FAR;
  const xStep = (xMax - xMin) / 3;
  const yStep = (yMax - yMin) / 3;

  const grid = new PIXI.Graphics();
  grid.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });

  // Vertical world-space divisions (constant X)
  for (let i = 1; i < 3; i++) {
    const x = xMin + xStep * i;
    const start = projectToScreen(x, yMin, z, viewport);
    const end = projectToScreen(x, yMax, z, viewport);
    grid.moveTo(start.x, start.y);
    grid.lineTo(end.x, end.y);
  }

  // Horizontal world-space divisions (constant Y)
  for (let i = 1; i < 3; i++) {
    const y = yMin + yStep * i;
    const start = projectToScreen(xMin, y, z, viewport);
    const end = projectToScreen(xMax, y, z, viewport);
    grid.moveTo(start.x, start.y);
    grid.lineTo(end.x, end.y);
  }

  grid.stroke();
  app.stage.addChild(grid);

  console.log(
    `[QUADRANTS] Grid: worldX ${xMin}-${xMax}, worldY ${yMin}-${yMax}, Z=${z}`,
  );
}

/**
 * Draw the world-space bounding box used for viewport fitting.
 * Helpful for visualizing why the projection appears zoomed out.
 */
export function drawWorldBoundsWireframe(app, color = 0xff0000) {
  if (!app) return;

  const viewport = createViewport(app.screen.width, app.screen.height);
  const bounds = {
    xMin: WORLD_X.MIN,
    xMax: WORLD_X.MAX,
    yMin: WORLD_Y.MIN,
    yMax: WORLD_Y.MAX,
    zMin: WORLD_Z.RIVERBED,
    zMax: WORLD_Z.MAX,
  };

  const wireframe = new PIXI.Graphics();
  drawWireframeBox(wireframe, bounds, viewport, color);
  app.stage.addChild(wireframe);
}
