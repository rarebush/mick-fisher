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

export { drawQuadrantGrid, drawWorldBoundsWireframe };

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
  const waterResult = await createWaterLayers(
    { viewport, tileScreenSize, flowDirX, flowDirY, noiseBasisX, noiseBasisY },
    { submergedWallTiles, reflectionContainer },
    width,
    height,
  );

  container.addChild(waterResult.waterGroup);

  // River wall renders after (in front of) the water surface — it's the
  // near vertical face above the water line, unaffected by displacement.
  container.addChild(riverWallTiles);

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
  const originAxes = createOriginAxes(viewport);
  originAxes.visible = false;
  container.addChild(originAxes);

  const displacementDebugRect = createDisplacementDebugRect(viewport);
  displacementDebugRect.visible = false;
  container.addChild(displacementDebugRect);

  return {
    waterVolume,
    waterSurfaceTiles: waterResult.waterSurfaceTiles,
    walkwayVolume,
    viewport,
    causticsFilter: waterResult.causticsFilter,
    /** ColorMatrixFilter with luminosity-blend matrix for underwater tile tint. Set once at setup. */
    underwaterTintFilter: waterResult.underwaterTintFilter,
    waterSurfaceShader: waterResult.waterSurfaceShader,
    sparkleShader: waterResult.sparkleShader,
    foamShader: waterResult.foamShader,
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
