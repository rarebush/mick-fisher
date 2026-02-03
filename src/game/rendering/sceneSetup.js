/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 *
 * Uses world constants for consistent projection from 3D world space to 2D screen.
 * World coordinates: X = horizontal, Y = depth (toward river), Z = height
 * Screen projection: pixel isometric (~26.565°) from world coordinates
 */

import * as PIXI from "pixi.js";
import {
  loadSpriteSheet,
  createTiledBackground,
} from "../graphics/spriteLoader.js";
import {
  WORLD_X,
  WORLD_Z,
  WORLD_Y,
  createViewport,
  getProjectionMetrics,
  projectToScreen,
  screenToWorld,
} from "../mechanics/worldConstants.js";

function drawWireframeBox(graphics, bounds, viewport, color) {
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

/**
 * Setup environment layers with 3D perspective
 * Creates pier, wall, water surface, and riverbed layers
 *
 * Layer positions are derived from world coordinates using isometric projection:
 * - Walkway: at Z = WALKWAY (3 units), Y = AVATAR (0)
 * - Wall: transition zone between walkway and water
 * - Water surface: at Z = WATER_SURFACE (1 unit), spans Y depth
 * - Riverbed: at Z = RIVERBED (0), spans Y depth
 *
 * @param {PIXI.Container} container - Container to add layers to
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {Object} Layer references
 */
export async function setupEnvironmentLayers(container, width, height) {
  if (!container) return null;

  // Create viewport for world-to-screen projection
  const viewport = createViewport(width, height);
  const projectionMetrics = getProjectionMetrics(viewport);

  const waterVolume = new PIXI.Graphics();
  drawWireframeBox(
    waterVolume,
    {
      xMin: WORLD_X.MIN,
      xMax: WORLD_X.MAX,
      yMin: WORLD_Y.WATER_NEAR,
      yMax: WORLD_Y.WATER_FAR,
      zMin: WORLD_Z.RIVERBED,
      zMax: WORLD_Z.WATER_SURFACE,
    },
    viewport,
    0x00c2ff,
  );
  container.addChild(waterVolume);

  const waterSurfaceWireframe = new PIXI.Graphics();
  const waterSurfaceCorners = [
    projectToScreen(
      WORLD_X.MIN,
      WORLD_Y.WATER_NEAR,
      WORLD_Z.WATER_SURFACE,
      viewport,
    ),
    projectToScreen(
      WORLD_X.MAX,
      WORLD_Y.WATER_NEAR,
      WORLD_Z.WATER_SURFACE,
      viewport,
    ),
    projectToScreen(
      WORLD_X.MAX,
      WORLD_Y.WATER_FAR,
      WORLD_Z.WATER_SURFACE,
      viewport,
    ),
    projectToScreen(
      WORLD_X.MIN,
      WORLD_Y.WATER_FAR,
      WORLD_Z.WATER_SURFACE,
      viewport,
    ),
  ];
  waterSurfaceWireframe.moveTo(
    waterSurfaceCorners[0].x,
    waterSurfaceCorners[0].y,
  );
  for (let i = 1; i < waterSurfaceCorners.length; i += 1) {
    waterSurfaceWireframe.lineTo(
      waterSurfaceCorners[i].x,
      waterSurfaceCorners[i].y,
    );
  }
  waterSurfaceWireframe.closePath();
  waterSurfaceWireframe.stroke({ width: 1, color: 0x6d6d6d, alpha: 0.8 });

  // Riverbed tiles (draw first, behind water)
  const riverbedTiles = new PIXI.Container();
  let riverbedTexture = null;
  try {
    riverbedTexture = await PIXI.Assets.load("/sprites/isoriverbedtest.png");
  } catch (error) {
    console.warn(
      "[RIVERBED] Failed to load /sprites/isoriverbedtest.png",
      error,
    );
  }

  if (riverbedTexture?.baseTexture) {
    riverbedTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

    const tileWidthPx = projectionMetrics.screenXPerWorldUnit * 2;
    const tileHeightPx = projectionMetrics.screenYPerWorldUnit * 2;
    const tileScaleX = tileWidthPx / riverbedTexture.width;
    const tileScaleY = tileHeightPx / riverbedTexture.height;

    // Tile only over the defined riverbed area
    const startX = Math.floor(WORLD_X.MIN);
    const endX = Math.ceil(WORLD_X.MAX);
    const startY = Math.floor(WORLD_Y.RIVERBED_NEAR);
    const endY = Math.ceil(WORLD_Y.RIVERBED_FAR);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const screen = projectToScreen(
          x + 0.5,
          y + 0.5,
          WORLD_Z.RIVERBED,
          viewport,
        );
        const tile = new PIXI.Sprite(riverbedTexture);
        tile.anchor.set(0.5, 0.5);
        tile.scale.set(tileScaleX, tileScaleY);
        tile.x = screen.x;
        tile.y = screen.y;
        riverbedTiles.addChild(tile);
      }
    }
  }
  container.addChild(riverbedTiles);

  // Water surface tiles (draw second, on top of riverbed)
  const waterSurfaceTiles = new PIXI.Container();
  let waterTexture = null;
  try {
    waterTexture = await PIXI.Assets.load("/sprites/isowatertest.png");
  } catch (error) {
    console.warn("[WATER] Failed to load /sprites/isowatertest.png", error);
  }

  if (waterTexture?.baseTexture) {
    waterTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

    const tileWidthPx = projectionMetrics.screenXPerWorldUnit * 2;
    const tileHeightPx = projectionMetrics.screenYPerWorldUnit * 2;
    const tileScaleX = tileWidthPx / waterTexture.width;
    const tileScaleY = tileHeightPx / waterTexture.height;

    // Tile only over the defined water surface area
    const startX = Math.floor(WORLD_X.MIN);
    const endX = Math.ceil(WORLD_X.MAX);
    const startY = Math.floor(WORLD_Y.WATER_NEAR);
    const endY = Math.ceil(WORLD_Y.WATER_FAR);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const screen = projectToScreen(
          x + 0.5,
          y + 0.5,
          WORLD_Z.WATER_SURFACE,
          viewport,
        );
        const tile = new PIXI.Sprite(waterTexture);
        tile.anchor.set(0.5, 0.5);
        tile.scale.set(tileScaleX, tileScaleY);
        tile.alpha = 0.5;
        tile.x = screen.x;
        tile.y = screen.y;
        waterSurfaceTiles.addChild(tile);
      }
    }
  }
  container.addChild(waterSurfaceTiles);
  // container.addChild(waterSurfaceWireframe);

  const walkwayVolume = new PIXI.Graphics();
  drawWireframeBox(
    walkwayVolume,
    {
      xMin: WORLD_X.MIN,
      xMax: WORLD_X.MAX,
      yMin: WORLD_Y.WALKWAY_BACK,
      yMax: WORLD_Y.WALKWAY_FRONT,
      zMin: WORLD_Z.RIVERBED,
      zMax: WORLD_Z.WALKWAY,
    },
    viewport,
    0xff00ff,
  );
  container.addChild(walkwayVolume);

  console.log(
    `[ENVIRONMENT] Wireframe volumes: water (Z=${WORLD_Z.RIVERBED}-${WORLD_Z.WATER_SURFACE}), walkway (Z=${WORLD_Z.RIVERBED}-${WORLD_Z.WALKWAY})`,
  );

  return {
    waterVolume,
    waterSurfaceTiles,
    walkwayVolume,
    viewport,
  };
}

/**
 * Draw quadrant grid overlay
 * Quadrants only cover the riverbed area (where items can spawn)
 * Uses world constants to determine riverbed screen bounds
 */
export function drawQuadrantGrid(app) {
  if (!app) return;

  // Create viewport for world-to-screen projection
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
