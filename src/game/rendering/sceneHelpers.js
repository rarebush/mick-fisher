/**
 * Scene Helpers
 * Shared utility functions used by scene rendering modules.
 */

import * as PIXI from "pixi.js";
import {
  WORLD_X,
  WORLD_Y,
  projectToScreen,
} from "../mechanics/worldConstants.js";

/**
 * Compute linear depth coefficients for a given Z-plane.
 * Returns [A, B, C] where depth = A*screenX + B*screenY + C maps
 * screen coordinates to normalised world-Y (0 = WATER_NEAR, 1 = WATER_FAR).
 * Uses a 3-point solve so the gradient follows the true isometric Y axis.
 */
export function computeDepthCoeffs(z, viewport) {
  const p0 = projectToScreen(0, WORLD_Y.WATER_NEAR, z, viewport);
  const p1 = projectToScreen(0, WORLD_Y.WATER_FAR, z, viewport);
  const p2 = projectToScreen(WORLD_X.MAX, WORLD_Y.WATER_NEAR, z, viewport);

  const dx1 = p2.x - p0.x;
  const dy1 = p2.y - p0.y;
  const dx2 = p1.x - p0.x;
  const dy2 = p1.y - p0.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const A = -dy1 / det;
  const B = dx1 / det;
  const C = -(A * p0.x + B * p0.y);
  return [A, B, C];
}

/**
 * Generate a small tileable noise texture for displacement.
 * Grey values centre around 128 (no displacement); variation drives the ripple.
 */
export function generateNoiseTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = 128 + Math.floor((Math.random() - 0.5) * 80);
    data[i] = val; // R
    data[i + 1] = val; // G
    data[i + 2] = val; // B
    data[i + 3] = 255; // A
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = PIXI.Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  texture.source.style.addressMode = "repeat";
  return texture;
}

/**
 * Draw a wireframe box in isometric projection.
 *
 * @param {PIXI.Graphics} graphics - Target graphics object
 * @param {{ xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number }} bounds
 * @param {Object} viewport - Viewport for projection
 * @param {number} color - Stroke color
 */
export function drawWireframeBox(graphics, bounds, viewport, color) {
  const corners = [
    [bounds.xMin, bounds.yMin, bounds.zMin],
    [bounds.xMin, bounds.yMin, bounds.zMax],
    [bounds.xMin, bounds.yMax, bounds.zMin],
    [bounds.xMin, bounds.yMax, bounds.zMax],
    [bounds.xMax, bounds.yMin, bounds.zMin],
    [bounds.xMax, bounds.yMin, bounds.zMax],
    [bounds.xMax, bounds.yMax, bounds.zMin],
    [bounds.xMax, bounds.yMax, bounds.zMax],
  ].map(([x, y, z]) => projectToScreen(x, y, z, viewport));

  const edges = [
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 6],
    [3, 7],
    [4, 5],
    [4, 6],
    [5, 7],
    [6, 7],
  ];

  for (const [start, end] of edges) {
    graphics.moveTo(corners[start].x, corners[start].y);
    graphics.lineTo(corners[end].x, corners[end].y);
  }

  graphics.stroke({ width: 1, color, alpha: 0.9 });
}
