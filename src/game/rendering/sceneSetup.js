/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 *
 * Uses world constants for consistent projection from 3D world space to 2D screen.
 * World coordinates: X = horizontal, Y = depth (toward river), Z = height
 * Screen projection: pixel isometric (~18.435°) from world coordinates
 */

import * as PIXI from "pixi.js";
import { loadSpriteSheet } from "../graphics/spriteLoader.js";
import {
  WORLD_X,
  WORLD_Z,
  WORLD_Y,
  createViewport,
  getProjectionMetrics,
  getTileScreenSizePx,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { drawWireframeBox, computeDepthCoeffs } from "./sceneHelpers.js";
import {
  createDisplacementDebugRect,
  createOriginAxes,
  drawQuadrantGrid,
  drawWorldBoundsWireframe,
} from "./debugOverlays.js";
import { createWallLayers } from "./wallLayers.js";
import { createReflectionLayers } from "./reflectionLayers.js";
import { createWaterLayers } from "./waterLayers.js";
import { isDebugEnabled } from "../utils/debugFlags.js";

export { drawQuadrantGrid, drawWorldBoundsWireframe };

function placeTilePlane({
  container,
  texture,
  tileScale,
  startX,
  endX,
  startY,
  endY,
  z,
  viewport,
}) {
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const screen = projectToScreen(x + 0.5, y + 0.5, z, viewport);
      const tile = new PIXI.Sprite(texture);
      tile.anchor.set(0.5, 0.5);
      tile.scale.set(tileScale.x, tileScale.y);
      tile.x = screen.x;
      tile.y = screen.y;
      container.addChild(tile);
    }
  }
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
export async function setupEnvironmentLayers(
  container,
  width,
  height,
  renderer = null,
) {
  if (!container) return null;

  // Create viewport for world-to-screen projection
  const viewport = createViewport(width, height);
  const projectionMetrics = getProjectionMetrics(viewport);
  const tileScreenSize = getTileScreenSizePx(viewport);
  // Compute the isometric X-axis direction in screen space for flow animation.
  // World -X → +X maps to top-left → bottom-right on screen.
  const isoXLen = Math.sqrt(
    projectionMetrics.screenXPerWorldUnit ** 2 +
      projectionMetrics.screenYPerWorldUnit ** 2,
  );
  const flowDirX = projectionMetrics.screenXPerWorldUnit / isoXLen;
  const flowDirY = projectionMetrics.screenYPerWorldUnit / isoXLen;
  const noiseBasisX = [flowDirX, flowDirY];
  const noiseBasisY = [-flowDirY, flowDirX];

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
  waterVolume.visible = false;
  container.addChild(waterVolume);

  // Compute water surface corners (shared by reflections + debug wireframe)
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
  // waterSurfaceWireframe available if needed:
  // container.addChild(createWaterSurfaceWireframe(waterSurfaceCorners));

  // Load river wall spritesheet (shared by walls + reflections)
  let riverWallSpritesheet = null;
  try {
    riverWallSpritesheet = await loadSpriteSheet(
      "/sprites/riverWall.png",
      "/sprites/riverWall.json",
    );
  } catch (error) {
    console.warn("[RIVERWALL] Failed to load /sprites/riverWall.json", error);
  }

  let defaultSpritesheet = null;
  try {
    defaultSpritesheet = await loadSpriteSheet(
      "/sprites/default.png",
      "/sprites/default.json",
    );
  } catch (error) {
    console.warn("[DEFAULT] Failed to load /sprites/default.json", error);
  }

  // frame0 = empty, frame1 = bottom, frame2 = middle, frame3 = top
  const wallTextures = {
    bottom: riverWallSpritesheet?.textures?.frame1 ?? null,
    middle: riverWallSpritesheet?.textures?.frame2 ?? null,
    top: riverWallSpritesheet?.textures?.frame3 ?? null,
  };

  const wallContext = { viewport, projectionMetrics, tileScreenSize };
  const { riverWallTiles, submergedWallTiles } = createWallLayers(
    wallContext,
    wallTextures,
  );

  // Depth coefficients at the water surface plane (shared by reflections)
  const waterSurfaceDepthCoeffs = computeDepthCoeffs(
    WORLD_Z.WATER_SURFACE,
    viewport,
  );

  // Wall reflections in water — sky, clouds, wall tiles with Fresnel opacity
  const { reflectionContainer, reflectionShader } = createReflectionLayers(
    {
      ...wallContext,
      waterSurfaceCorners,
      depthCoeffs: waterSurfaceDepthCoeffs,
      noiseBasisX,
      noiseBasisY,
    },
    wallTextures,
  );

  // Water layers: riverbed, water surface, sparkles, displacement
  const debugEnabled = isDebugEnabled();

  const waterResult = await createWaterLayers(
    {
      viewport,
      tileScreenSize,
      flowDirX,
      flowDirY,
      noiseBasisX,
      noiseBasisY,
      renderer,
      debugContainer: debugEnabled ? container : null,
      debugEnabled,
    },
    { submergedWallTiles, reflectionContainer },
    width,
    height,
  );

  console.log(
    "[SceneSetup] waterResult.fluidFoamCoordinator:",
    waterResult.fluidFoamCoordinator,
  );

  // River wall renders behind the water surface so water effects can overlay it.
  container.addChild(riverWallTiles);
  container.addChild(waterResult.waterGroup);

  // Add debug dots container on top of everything for visibility
  if (debugEnabled && waterResult.debugDotsContainer) {
    container.addChild(waterResult.debugDotsContainer);
    console.log("[SceneSetup] Debug dots container added on top");
  }

  const walkwayTiles = new PIXI.Container();
  walkwayTiles.roundPixels = true;
  const walkwayTexture = defaultSpritesheet?.textures?.frame3 ?? null;
  if (walkwayTexture?.source) {
    walkwayTexture.source.scaleMode = "nearest";
    placeTilePlane({
      container: walkwayTiles,
      texture: walkwayTexture,
      tileScale: {
        x: tileScreenSize.width / walkwayTexture.width,
        y: tileScreenSize.height / walkwayTexture.height,
      },
      startX: Math.floor(WORLD_X.MIN),
      endX: Math.ceil(WORLD_X.MAX),
      startY: Math.floor(WORLD_Y.WALKWAY_BACK),
      endY: Math.ceil(WORLD_Y.WALKWAY_FRONT),
      z: WORLD_Z.WALKWAY,
      viewport,
    });
  }
  container.addChild(walkwayTiles);

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
  walkwayVolume.visible = false;
  container.addChild(walkwayVolume);

  // Debug overlays (hidden by default)
  if (debugEnabled) {
    const originAxes = createOriginAxes(viewport);
    originAxes.visible = false;
    container.addChild(originAxes);

    const displacementDebugRect = createDisplacementDebugRect(viewport);
    displacementDebugRect.visible = false;
    container.addChild(displacementDebugRect);
  }

  return {
    waterVolume,
    waterSurfaceTiles: waterResult.waterSurfaceTiles,
    walkwayTiles,
    walkwayVolume,
    viewport,
    causticsFilter: waterResult.causticsFilter,
    /** ColorMatrixFilter with luminosity-blend matrix for underwater tile tint. Set once at setup. */
    underwaterTintFilter: waterResult.underwaterTintFilter,
    waterSurfaceShader: waterResult.waterSurfaceShader,
    sparkleShader: waterResult.sparkleShader,
    edgeFoamShader: waterResult.edgeFoamShader,
    fluidFoamCoordinator: waterResult.fluidFoamCoordinator,
    fluidFoamDebugOverlay: waterResult.fluidFoamDebugOverlay,
    reflectionShader,
    displacementSprite: waterResult.displacementSprite,
    displacementFilter: waterResult.displacementFilter,
    flowDirX,
    flowDirY,
    /** Multiplier for all water flow animations (glints, caustics, displacement). 1 = default. */
    currentSpeed: 1,
    /** Multiplier for water choppiness (displacement amplitude). 1 = default. */
    choppiness: 1,
    /** Wind direction in screen-space [x, y] for cloud drift. */
    windDir: [0, -1],
    /** Wind speed multiplier (1 = default). */
    windSpeed: 1,
    /** Cloud cover 0-1 (0 = clear sky, 1 = overcast). */
    cloudCover: 0.5,
  };
}
