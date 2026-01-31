/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 *
 * Uses world constants for consistent projection from 3D world space to 2D screen.
 * World coordinates: X = horizontal, Y = depth (toward river), Z = height
 * Screen projection: true isometric (30°) from world coordinates
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
  projectToScreen,
  getSurfaceScreenBounds,
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

  graphics.stroke({ width: 2, color, alpha: 0.9 });
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
export function setupEnvironmentLayers(container, width, height) {
  if (!container) return null;

  // Create viewport for world-to-screen projection
  const viewport = createViewport(width, height);

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
    walkwayVolume,
    viewport,
  };
}

/**
 * Setup initial scene elements
 */
export function setupScene(app) {
  if (!app) return { waterTiles: [] };

  // Shore
  const shore = new PIXI.Graphics()
    .rect(0, 0, app.screen.width, 80)
    .fill(0x8b7355);
  app.stage.addChild(shore);

  // Text
  const text = new PIXI.Text({
    text: "Click anywhere to cast magnet",
    style: { fontSize: 20, fill: 0xffffff },
  });
  text.anchor.set(0.5);
  text.x = app.screen.width / 2;
  text.y = app.screen.height / 2;
  text.alpha = 0.5;
  app.stage.addChild(text);

  return { waterTiles: [] };
}

/**
 * Setup animated water background
 * Falls back to solid color if sprite assets not available
 */
export async function setupWaterBackground(app) {
  if (!app) return { waterSpritesheet: null, waterTiles: [] };

  try {
    // Try to load water sprite sheet
    const waterSpritesheet = await loadSpriteSheet(
      "/sprites/water.png",
      "/sprites/water.json",
    );

    // Get tile size from first frame
    const firstTexture = waterSpritesheet.animations.default[0];
    const tileWidth = firstTexture.width;
    const tileHeight = firstTexture.height;

    // Create water container to position below shore
    const waterContainer = new PIXI.Container();
    waterContainer.y = 80; // Start below shore area
    app.stage.addChild(waterContainer);

    // Create tiled background (only for the water area below shore)
    const waterTiles = createTiledBackground(
      waterContainer,
      waterSpritesheet,
      app.screen.width,
      app.screen.height - 80, // Height minus shore area
      tileWidth,
      tileHeight,
      0.1, // Animation speed
      4, // Scale 4x (32px tiles become 128px)
    );

    console.log("Water tiles loaded successfully");
    return { waterSpritesheet, waterTiles };
  } catch {
    // Fallback to solid color if sprite not found
    console.log("Water sprites not found, using fallback color");
    const water = new PIXI.Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill(0x3a6c8e);
    app.stage.addChild(water);
    return { waterSpritesheet: null, waterTiles: [] };
  }
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
