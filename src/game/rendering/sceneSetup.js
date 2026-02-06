/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 *
 * Uses world constants for consistent projection from 3D world space to 2D screen.
 * World coordinates: X = horizontal, Y = depth (toward river), Z = height
 * Screen projection: pixel isometric (~26.565°) from world coordinates
 */

import * as PIXI from "pixi.js";
import { DisplacementFilter } from "pixi.js";
import { loadSpriteSheet } from "../graphics/spriteLoader.js";
import { createWaterSurfaceShader } from "../graphics/waterSystem/waterSurfaceShader.js";
import { createCausticsShader } from "../graphics/waterSystem/causticsShader.js";
import {
  WORLD_X,
  WORLD_Z,
  WORLD_Y,
  createViewport,
  getProjectionMetrics,
  projectToScreen,
} from "../mechanics/worldConstants.js";

/**
 * Compute linear depth coefficients for a given Z-plane.
 * Returns [A, B, C] where depth = A*screenX + B*screenY + C maps
 * screen coordinates to normalised world-Y (0 = WATER_NEAR, 1 = WATER_FAR).
 * Uses a 3-point solve so the gradient follows the true isometric Y axis.
 */
function computeDepthCoeffs(z, viewport) {
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
function generateNoiseTexture(size = 128) {
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
    0x00c2ff
  );
  container.addChild(waterVolume);

  const waterSurfaceWireframe = new PIXI.Graphics();
  const waterSurfaceCorners = [
    projectToScreen(
      WORLD_X.MIN,
      WORLD_Y.WATER_NEAR,
      WORLD_Z.WATER_SURFACE,
      viewport
    ),
    projectToScreen(
      WORLD_X.MAX,
      WORLD_Y.WATER_NEAR,
      WORLD_Z.WATER_SURFACE,
      viewport
    ),
    projectToScreen(
      WORLD_X.MAX,
      WORLD_Y.WATER_FAR,
      WORLD_Z.WATER_SURFACE,
      viewport
    ),
    projectToScreen(
      WORLD_X.MIN,
      WORLD_Y.WATER_FAR,
      WORLD_Z.WATER_SURFACE,
      viewport
    ),
  ];
  waterSurfaceWireframe.moveTo(
    waterSurfaceCorners[0].x,
    waterSurfaceCorners[0].y
  );
  for (let i = 1; i < waterSurfaceCorners.length; i += 1) {
    waterSurfaceWireframe.lineTo(
      waterSurfaceCorners[i].x,
      waterSurfaceCorners[i].y
    );
  }
  waterSurfaceWireframe.closePath();
  waterSurfaceWireframe.stroke({ width: 1, color: 0x6d6d6d, alpha: 0.8 });

  // Riverbed tiles (draw first, behind water)
  const riverbedTiles = new PIXI.Container();
  let riverbedSpritesheet = null;
  try {
    riverbedSpritesheet = await loadSpriteSheet(
      "/sprites/riverbed.png",
      "/sprites/riverbed.json"
    );
  } catch (error) {
    console.warn("[RIVERBED] Failed to load /sprites/riverbed.json", error);
  }

  // frame0 = empty, frame1 = the riverbed tile
  const riverbedTexture = riverbedSpritesheet?.textures?.frame1 ?? null;

  if (riverbedTexture?.source) {
    riverbedTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;

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
          viewport
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

  // Apply caustics filter to riverbed tiles (visible through semi-transparent water above)
  const riverbedDepthCoeffs = computeDepthCoeffs(WORLD_Z.RIVERBED, viewport);
  const causticsFilter = createCausticsShader({
    depthCoeffs: riverbedDepthCoeffs,
    causticsScale: 4.0,
    causticsSpeed: 0.4,
    causticsIntensity: 0.15,
    causticsColor: [1.0, 0.95, 0.8],
  });
  riverbedTiles.filters = [causticsFilter];

  // River wall tiles (draw between riverbed and water surface)
  const riverWallTiles = new PIXI.Container();
  let riverWallSpritesheet = null;
  try {
    riverWallSpritesheet = await loadSpriteSheet(
      "/sprites/riverWall.png",
      "/sprites/riverWall.json"
    );
  } catch (error) {
    console.warn("[RIVERWALL] Failed to load /sprites/riverWall.json", error);
  }

  // frame0 = empty, frame1 = bottom, frame2 = middle, frame3 = top
  const riverWallBottomTexture = riverWallSpritesheet?.textures?.frame1 ?? null;
  const riverWallMiddleTexture = riverWallSpritesheet?.textures?.frame2 ?? null;
  const riverWallTopTexture = riverWallSpritesheet?.textures?.frame3 ?? null;

  if (riverWallBottomTexture?.source && riverWallTopTexture?.source) {
    riverWallBottomTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;
    riverWallTopTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;
    if (riverWallMiddleTexture?.source) {
      riverWallMiddleTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;
    }

    // Wall spans from riverbed (Z=0) up to walkway (Z=3).
    // Each tile covers one world unit of height.
    const wallHeightUnits = Math.max(
      2,
      Math.round(WORLD_Z.WALKWAY - WORLD_Z.RIVERBED)
    );
    const startX = Math.floor(WORLD_X.MIN);
    const endX = Math.ceil(WORLD_X.MAX);
    const wallY = WORLD_Y.WALL_EDGE;
    const baseZ = WORLD_Z.RIVERBED;
    const topZ = baseZ + wallHeightUnits - 1;

    const addWallTile = (texture, worldX, worldY, worldZ) => {
      const screen = projectToScreen(worldX, worldY, worldZ, viewport);
      const tile = new PIXI.Sprite(texture);
      // Wall tile parallelogram base edge runs from sprite (0,36) to (32,52).
      // projectToScreen gives the midpoint of that base edge = sprite (16,44).
      // Anchor must point there so the tile aligns with Y=0 in world space.
      const tileH = texture.height; // 52
      const halfIsoOverhang = projectionMetrics.screenYPerWorldUnit / 2; // 8
      tile.anchor.set(
        0.5,
        (projectionMetrics.screenYPerWorldZUnit + halfIsoOverhang) / tileH
      );
      // Wall tiles are pre-shaped; keep native pixel size.
      tile.scale.set(1, 1);
      tile.x = screen.x;
      tile.y = screen.y;
      riverWallTiles.addChild(tile);
    };

    for (let x = startX; x < endX; x += 1) {
      const worldX = x + 0.5;
      addWallTile(riverWallBottomTexture, worldX, wallY, baseZ);

      if (wallHeightUnits > 2 && riverWallMiddleTexture?.source) {
        for (let z = baseZ + 1; z < topZ; z += 1) {
          addWallTile(riverWallMiddleTexture, worldX, wallY, z);
        }
      }

      addWallTile(riverWallTopTexture, worldX, wallY, topZ);
    }
  }

  // Water surface tiles (draw second, on top of riverbed)
  const waterSurfaceTiles = new PIXI.Container();
  const waterSurfaceAreaTiles = new PIXI.Container();
  const waterSurfaceEdgeTiles = new PIXI.Container();
  waterSurfaceTiles.addChild(waterSurfaceAreaTiles, waterSurfaceEdgeTiles);

  let waterSpritesheet = null;
  try {
    waterSpritesheet = await loadSpriteSheet(
      "/sprites/water.png",
      "/sprites/water.json"
    );
  } catch (error) {
    console.warn("[WATER] Failed to load /sprites/water.json", error);
  }

  const waterAreaTexture = waterSpritesheet?.textures?.frame1 ?? null;
  const waterEdgeTexture = waterSpritesheet?.textures?.frame2 ?? null;

  let waterSurfaceShader = null;

  if (waterAreaTexture?.source) {
    waterAreaTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;
    if (waterEdgeTexture?.source) {
      waterEdgeTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST;
    }

    const tileWidthPx = projectionMetrics.screenXPerWorldUnit * 2;
    const tileHeightPx = projectionMetrics.screenYPerWorldUnit * 2;
    const tileScaleX = tileWidthPx / waterAreaTexture.width;
    const tileScaleY = tileHeightPx / waterAreaTexture.height;

    const waterSurfaceDepthCoeffs = computeDepthCoeffs(
      WORLD_Z.WATER_SURFACE,
      viewport
    );

    waterSurfaceShader = createWaterSurfaceShader({
      waterColor: [0.17, 0.45, 0.63],
      waterAlpha: 0.7,
      maskThreshold: 0.9,
      depthCoeffs: waterSurfaceDepthCoeffs,
      depthDarken: 0.4,
      noiseScale: 0.015,
      noiseStrength: 0.15,
      depthBands: 6,
    });
    // Apply to parent so both area and edge tiles get the water tint.
    // Black pixels → water color, white pixels (wall seam) → passthrough.
    waterSurfaceTiles.filters = [waterSurfaceShader];

    // Tile only over the defined water surface area
    const startX = Math.floor(WORLD_X.MIN);
    const endX = Math.ceil(WORLD_X.MAX);
    const startY = Math.floor(WORLD_Y.WATER_NEAR);
    const endY = Math.ceil(WORLD_Y.WATER_FAR);

    for (let y = startY; y < endY; y += 1) {
      const useEdgeTile = y === startY && waterEdgeTexture?.source;
      const tileTexture = useEdgeTile ? waterEdgeTexture : waterAreaTexture;
      const targetContainer = useEdgeTile
        ? waterSurfaceEdgeTiles
        : waterSurfaceAreaTiles;

      for (let x = startX; x < endX; x += 1) {
        const screen = projectToScreen(
          x + 0.5,
          y + 0.5,
          WORLD_Z.WATER_SURFACE,
          viewport
        );
        const tile = new PIXI.Sprite(tileTexture);
        tile.anchor.set(0.5, 0.5);
        tile.scale.set(tileScaleX, tileScaleY);
        tile.x = screen.x;
        tile.y = screen.y;
        targetContainer.addChild(tile);
      }
    }
  }
  // Wrap riverbed + water surface in a shared waterGroup container.
  // The DisplacementFilter on this group makes both layers ripple together.
  // River wall tiles are kept outside so displacement doesn't warp them.
  const waterGroup = new PIXI.Container();
  waterGroup.addChild(riverbedTiles, waterSurfaceTiles);

  // Procedural noise displacement for water flow
  const noiseTexture = generateNoiseTexture(128);
  const displacementSprite = new PIXI.Sprite(noiseTexture);
  displacementSprite.width = width;
  displacementSprite.height = height;
  waterGroup.addChild(displacementSprite);

  const displacementFilter = new DisplacementFilter({
    sprite: displacementSprite,
    scale: 4,
  });
  waterGroup.filters = [displacementFilter];

  container.addChild(waterGroup);
  // River wall renders after (in front of) the water surface — it's the
  // near vertical face above the water line, unaffected by displacement.
  container.addChild(riverWallTiles);
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
    0xff00ff
  );
  container.addChild(walkwayVolume);

  // Debug: draw world-space axes through the origin (0,0,0)
  const axisLength = 4; // world units in each direction
  const originAxes = new PIXI.Graphics();
  const origin = projectToScreen(0, 0, 0, viewport);
  const xEnd = projectToScreen(axisLength, 0, 0, viewport);
  const yEnd = projectToScreen(0, axisLength, 0, viewport);
  const zEnd = projectToScreen(0, 0, axisLength, viewport);
  // X axis
  originAxes.moveTo(origin.x, origin.y);
  originAxes.lineTo(xEnd.x, xEnd.y);
  originAxes.stroke({ width: 1, color: 0x000000, alpha: 1 });
  // Y axis
  originAxes.moveTo(origin.x, origin.y);
  originAxes.lineTo(yEnd.x, yEnd.y);
  originAxes.stroke({ width: 1, color: 0x000000, alpha: 1 });
  // Z axis
  originAxes.moveTo(origin.x, origin.y);
  originAxes.lineTo(zEnd.x, zEnd.y);
  originAxes.stroke({ width: 1, color: 0x000000, alpha: 1 });
  container.addChild(originAxes);

  console.log(
    `[ENVIRONMENT] Wireframe volumes: water (Z=${WORLD_Z.RIVERBED}-${WORLD_Z.WATER_SURFACE}), walkway (Z=${WORLD_Z.RIVERBED}-${WORLD_Z.WALKWAY})`
  );

  // Compute the isometric X-axis direction in screen space for flow animation.
  // World -X → +X maps to top-left → bottom-right on screen.
  const isoXLen = Math.sqrt(
    projectionMetrics.screenXPerWorldUnit ** 2 +
      projectionMetrics.screenYPerWorldUnit ** 2
  );
  const flowDirX = projectionMetrics.screenXPerWorldUnit / isoXLen;
  const flowDirY = projectionMetrics.screenYPerWorldUnit / isoXLen;

  return {
    waterVolume,
    waterSurfaceTiles,
    walkwayVolume,
    viewport,
    causticsFilter,
    waterSurfaceShader,
    displacementSprite,
    flowDirX,
    flowDirY,
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
    `[QUADRANTS] Grid: worldX ${xMin}-${xMax}, worldY ${yMin}-${yMax}, Z=${z}`
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
