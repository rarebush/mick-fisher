/**
 * Water Layers
 * Riverbed tiles (with caustics), single water surface (with depth shader),
 * sparkle overlay, and water group assembly with displacement filter.
 *
 * Underwater tint: tiles below the water surface (riverbed + submerged walls)
 * are tinted via a ColorMatrixFilter using a luminosity-blend matrix. The matrix
 * extracts Rec. 601 luminance and multiplies by waterColorNear * scale, so tiles
 * carry the water hue based on their brightness. Applied once at setup (not
 * per-frame) for performance.
 *
 * Filter chain on riverbed: [underwaterTintFilter] — caustics are currently
 * disabled, so only the underwater tint is applied. Submerged walls get the
 * tint filter only.
 *
 * Alternative considered: PixiJS advanced `luminosity` blend mode
 * (`container.blendMode = 'luminosity'` via `import 'pixi.js/advanced-blend-modes'`).
 * More performant (no render-to-texture) and more accurate, but requires a
 * water-coloured background shape behind tiles for hue/saturation source. Not
 * viable because: (a) riverbed is bottom-most layer with nothing behind it, and
 * (b) blend mode interacts unpredictably with the caustics filter chain (filters
 * render offscreen first, then blend mode composites the output). Revisit if
 * the filter pipeline changes — it eliminates 2 render-to-texture operations.
 */

import * as PIXI from "pixi.js";
import { BlurFilter, ColorMatrixFilter, DisplacementFilter } from "pixi.js";
import { loadSpriteSheet } from "../graphics/spriteLoader.js";
import { createWaterSurfaceShader } from "../graphics/waterSystem/waterSurfaceShader.js";
import { createSparkleShader } from "../graphics/waterSystem/sparkleShader.js";
import { createEdgeFoamShader } from "../graphics/waterSystem/edgeFoamShader.js";
import { createCausticsShader } from "../graphics/waterSystem/causticsShader.js";
import { FluidFoamCoordinator } from "../graphics/fluidSystem/FluidFoamCoordinator.js";
import { FluidParticleState } from "../graphics/fluidSystem/FluidParticleState.js";
import { FluidFoamBlobRenderer } from "../graphics/fluidSystem/FluidFoamBlobRenderer.js";
import { FluidFoamDebugOverlay } from "../graphics/fluidSystem/FluidFoamDebugOverlay.js";
import { CURRENT_SHIFT_ZONES } from "../data/currentShiftZones.js";
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  getProjectionMetrics,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import {
  computeDepthCoeffs,
  generateNoiseTexture,
  placeTileGrid,
} from "./sceneHelpers.js";
import { WATER_OBJECT_TEST_LOGS } from "../data/waterObjectTestData.js";

/**
 * Apply a luminosity blend to the underwater tint filter.
 *
 * Extracts the luminance of each pixel (Rec. 601 weights) and multiplies it
 * by the water color, so tiles carry the water hue based on their brightness.
 *
 * @param {import("pixi.js").ColorMatrixFilter} filter
 * @param {number[]} color - RGB [0-1] water color (e.g. waterColorNear)
 * @param {number} [scale=3] - Brightness multiplier to compensate for dark water colors
 */
export function applyUnderwaterTint(filter, color, scale = 3) {
  // Standard Rec. 601 luminance weights
  const lr = 0.299,
    lg = 0.587,
    lb = 0.114;
  const wR = color[0] * scale;
  const wG = color[1] * scale;
  const wB = color[2] * scale;

  filter.matrix = [
    lr * wR,
    lg * wR,
    lb * wR,
    0,
    0, // R output
    lr * wG,
    lg * wG,
    lb * wG,
    0,
    0, // G output
    lr * wB,
    lg * wB,
    lb * wB,
    0,
    0, // B output
    0,
    0,
    0,
    1,
    0, // Alpha unchanged
  ];
}

function getWaterSurfaceCorners(viewport) {
  return [
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
}

function createWaterSurfacePolygon(viewport, color, alpha) {
  const corners = getWaterSurfaceCorners(viewport);
  const polygon = new PIXI.Graphics();
  polygon.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) {
    polygon.lineTo(corners[i].x, corners[i].y);
  }
  polygon.closePath();
  polygon.fill({ color, alpha });
  return polygon;
}

function applyWaterSurfaceMask(container, parent, viewport) {
  const mask = createWaterSurfacePolygon(viewport, 0xffffff, 1);
  parent.addChild(mask);
  container.mask = mask;
}

async function buildRiverbedTiles({
  viewport,
  tileScreenSize,
  flowDirX,
  flowDirY,
  noiseBasisX,
  noiseBasisY,
  submergedWallTiles,
}) {
  const riverbedTiles = new PIXI.Container();
  riverbedTiles.roundPixels = true;
  let defaultSpritesheet = null;
  let riverbedSpritesheet = null;
  try {
    defaultSpritesheet = await loadSpriteSheet(
      "/sprites/default.png",
      "/sprites/default.json",
    );
  } catch (error) {
    console.warn("[DEFAULT] Failed to load /sprites/default.json", error);
  }

  if (!defaultSpritesheet) {
    try {
      riverbedSpritesheet = await loadSpriteSheet(
        "/sprites/riverbed.png",
        "/sprites/riverbed.json",
      );
    } catch (error) {
      console.warn("[RIVERBED] Failed to load /sprites/riverbed.json", error);
    }
  }

  const riverbedTexture =
    defaultSpritesheet?.textures?.frame4 ??
    riverbedSpritesheet?.textures?.frame1 ??
    null;

  if (riverbedTexture?.source) {
    riverbedTexture.source.scaleMode = "nearest";

    placeTileGrid({
      container: riverbedTiles,
      areaTexture: riverbedTexture,
      edgeTexture: null,
      edgeContainer: null,
      tileScale: {
        x: tileScreenSize.width / riverbedTexture.width,
        y: tileScreenSize.height / riverbedTexture.height,
      },
      startX: Math.floor(WORLD_X.MIN),
      endX: Math.ceil(WORLD_X.MAX),
      startY: Math.floor(WORLD_Y.RIVERBED_NEAR),
      endY: Math.ceil(WORLD_Y.RIVERBED_FAR),
      z: WORLD_Z.RIVERBED,
      viewport,
    });
  }

  const enableUnderwaterCaustics = false;
  let causticsFilter = null;
  if (enableUnderwaterCaustics) {
    const riverbedDepthCoeffs = computeDepthCoeffs(WORLD_Z.RIVERBED, viewport);
    causticsFilter = createCausticsShader({
      depthCoeffs: riverbedDepthCoeffs,
      causticsScale: 6,
      causticsSpeed: 0.4,
      causticsIntensity: 0.15,
      causticsColor: [1.0, 0.95, 0.8],
      flowDir: [flowDirX, flowDirY],
      noiseBasisX,
      noiseBasisY,
    });
  }
  const waterColorNear = [0.12, 0.24, 0.2];
  const waterColorFar = [0.05, 0.13, 0.12];

  const underwaterTintFilter = new ColorMatrixFilter();
  applyUnderwaterTint(underwaterTintFilter, waterColorNear);

  riverbedTiles.filters = causticsFilter
    ? [underwaterTintFilter, causticsFilter]
    : [underwaterTintFilter];
  submergedWallTiles.filters = [underwaterTintFilter];

  return {
    riverbedTiles,
    causticsFilter,
    underwaterTintFilter,
    waterColorNear,
    waterColorFar,
  };
}

function buildWaterSurfaceAndSparkle({
  viewport,
  flowDirX,
  flowDirY,
  noiseBasisX,
  noiseBasisY,
  waterColorNear,
  waterColorFar,
}) {
  const waterSurfaceTiles = new PIXI.Container();
  waterSurfaceTiles.roundPixels = true;
  const waterSurfaceDepthCoeffs = computeDepthCoeffs(
    WORLD_Z.WATER_SURFACE,
    viewport,
  );
  const waterSurfaceShader = createWaterSurfaceShader({
    waterColorNear,
    waterColorFar,
    waterAlpha: 0.7,
    depthCoeffs: waterSurfaceDepthCoeffs,
    noiseScale: 0.015,
    noiseStrength: 0.15,
    depthBands: 6,
  });
  waterSurfaceTiles.filters = [waterSurfaceShader];
  waterSurfaceTiles.addChild(createWaterSurfacePolygon(viewport, 0x000000, 0));

  const sparkleTiles = new PIXI.Container();
  const sparkleShader = createSparkleShader({
    flowDir: [flowDirX, flowDirY],
    noiseBasisX,
    noiseBasisY,
  });
  sparkleTiles.blendMode = "add";
  sparkleTiles.filters = [sparkleShader];
  sparkleTiles.addChild(createWaterSurfacePolygon(viewport, 0x000000, 0));

  const sparkleBloomTiles = new PIXI.Container();
  const sparkleBloomShader = createSparkleShader({
    flowDir: [flowDirX, flowDirY],
    noiseBasisX,
    noiseBasisY,
  });
  const sparkleBloomFilter = new BlurFilter();
  sparkleBloomFilter.strength = 4;
  sparkleBloomFilter.quality = 3;
  sparkleBloomFilter.repeatEdgePixels = true;
  sparkleBloomTiles.blendMode = "add";
  sparkleBloomTiles.filters = [sparkleBloomShader, sparkleBloomFilter];
  sparkleBloomTiles.addChild(createWaterSurfacePolygon(viewport, 0x000000, 0));

  return {
    waterSurfaceTiles,
    waterSurfaceShader,
    sparkleTiles,
    sparkleShader,
    sparkleBloomTiles,
    sparkleBloomShader,
  };
}

function buildFoamSystem({
  viewport,
  renderer,
  screenWidth,
  screenHeight,
  debugContainer,
  debugEnabled,
}) {
  const projectionMetrics = getProjectionMetrics(viewport);
  const isoScaleY =
    projectionMetrics.screenYPerWorldUnit /
    projectionMetrics.screenXPerWorldUnit;
  const foamTiles = new PIXI.Container();
  foamTiles.roundPixels = false;
  let fluidFoamCoordinator = null;
  let fluidFoamDebugOverlay = null;
  const foamGridHeight = 120;
  const foamGridWidth = Math.round(
    (WORLD_X.SPAWN_WIDTH / WORLD_Y.WATER_DEPTH) * foamGridHeight,
  );
  const foamGridDensity = foamGridHeight / WORLD_Y.WATER_DEPTH;
  const boundaryGridWidth = Math.round(WORLD_X.WIDTH * foamGridDensity);
  const boundaryGridHeight = Math.round(WORLD_Y.WATER_DEPTH * foamGridDensity);
  const foamConfig = {
    grid: { width: foamGridWidth, height: foamGridHeight },
    coordinator: {
      maxParticles: 10000,
      waveInterval: 3.5,
      particlesPerWave: 120,
      maxAge: 16.0,
      lifespanRiverLengths: 1.2,
      spawnBufferX: WORLD_X.SPAWN_BUFFER,
      spawnNoiseScale: 2.3,
      spawnNoiseThreshold: 0.985,
      shiftZoneParticleScale: 60.0,
      spawnInMainArea: false,
      disableDynamicMaxAge: false,
      cullByAge: true,
      baseFlowSpeed: 0.0,
      splatDirectRadius: 0.7,
      splatDirectStrength: 8.0,
    },
    particles: {
      maxParticles: 10000,
      spawnBufferX: WORLD_X.SPAWN_BUFFER,
      spawnInMainArea: false,
      useParticleVelocity: true,
      velocityDamping: 0.9,
      driftVelocityX: 0.25,
      driftVelocityY: 0.0,
      killOutOfBounds: true,
    },
    renderer: {
      maxParticles: 10000,
      maxAge: 8.0,
      densityScale: 0.8,
      densityAlpha: 0.55,
    },
    boundary: {
      width: boundaryGridWidth,
      height: boundaryGridHeight,
    },
  };

  if (renderer) {
    const fluidFoamParticleContainer = new PIXI.Container();
    fluidFoamParticleContainer.label = "FluidFoamBlobs";
    foamTiles.addChild(fluidFoamParticleContainer);

    fluidFoamCoordinator = new FluidFoamCoordinator({
      gridWidth: foamConfig.grid.width,
      gridHeight: foamConfig.grid.height,
      ...foamConfig.coordinator,
    });

    const particleState = new FluidParticleState(foamConfig.particles);
    const particleRenderer = new FluidFoamBlobRenderer({
      ...foamConfig.renderer,
      renderer: renderer,
      parentContainer: fluidFoamParticleContainer,
      screenSize: { width: screenWidth, height: screenHeight },
      worldToScreen: (x, y, z) => projectToScreen(x, y, z, viewport),
      isoScaleY,
    });

    const boundaryTexture = null;

    fluidFoamCoordinator.initialize(
      particleState,
      particleRenderer,
      boundaryTexture,
    );

    fluidFoamCoordinator.setShiftZones(CURRENT_SHIFT_ZONES);

    const allowDebug = Boolean(debugEnabled);
    const overlayContainer = allowDebug ? debugContainer || foamTiles : null;
    if (allowDebug && overlayContainer) {
      fluidFoamDebugOverlay = new FluidFoamDebugOverlay(
        fluidFoamCoordinator,
        overlayContainer,
        {
          screenSize: { width: screenWidth, height: screenHeight },
          worldToScreen: (x, y, z) => projectToScreen(x, y, z, viewport),
          z: WORLD_Z.WATER_SURFACE,
        },
      );
      fluidFoamDebugOverlay.setShiftZones(CURRENT_SHIFT_ZONES);

      const spawnNoiseGraphics = new PIXI.Graphics();
      spawnNoiseGraphics.zIndex = 9995;
      overlayContainer.addChild(spawnNoiseGraphics);
      fluidFoamCoordinator.setSpawnNoiseDebug({
        graphics: spawnNoiseGraphics,
        worldToScreen: (x, y, z) => projectToScreen(x, y, z, viewport),
        z: WORLD_Z.WATER_SURFACE,
      });

      const foamBoundsMinX = WORLD_X.SPAWN_MIN;
      const foamBoundsMaxX = WORLD_X.MAX;
      const foamBoundsMinY = WORLD_Y.WATER_NEAR;
      const foamBoundsMaxY = WORLD_Y.WATER_FAR;
      const foamBoundsScreen = [
        projectToScreen(
          foamBoundsMinX,
          foamBoundsMinY,
          WORLD_Z.WATER_SURFACE,
          viewport,
        ),
        projectToScreen(
          foamBoundsMaxX,
          foamBoundsMinY,
          WORLD_Z.WATER_SURFACE,
          viewport,
        ),
        projectToScreen(
          foamBoundsMaxX,
          foamBoundsMaxY,
          WORLD_Z.WATER_SURFACE,
          viewport,
        ),
        projectToScreen(
          foamBoundsMinX,
          foamBoundsMaxY,
          WORLD_Z.WATER_SURFACE,
          viewport,
        ),
      ];

      const foamBoundsOutline = new PIXI.Graphics();
      foamBoundsOutline
        .poly([
          foamBoundsScreen[0].x,
          foamBoundsScreen[0].y,
          foamBoundsScreen[1].x,
          foamBoundsScreen[1].y,
          foamBoundsScreen[2].x,
          foamBoundsScreen[2].y,
          foamBoundsScreen[3].x,
          foamBoundsScreen[3].y,
        ])
        .fill({ color: 0x00ffff, alpha: 0.08 })
        .stroke({ width: 2, color: 0x00ffff, alpha: 0.8 });
      foamBoundsOutline.zIndex = 9998;
      overlayContainer.addChild(foamBoundsOutline);
    }
  } else {
    console.warn(
      "[FluidFoam] Renderer not available, skipping fluid foam creation",
    );
  }

  return {
    foamTiles,
    fluidFoamCoordinator,
    fluidFoamDebugOverlay,
    foamConfig,
  };
}

function buildEdgeFoam({ viewport, noiseBasisX, noiseBasisY }) {
  const edgeFoamTiles = new PIXI.Container();
  edgeFoamTiles.roundPixels = false;

  const edgeStart = projectToScreen(
    WORLD_X.MIN,
    WORLD_Y.WATER_NEAR,
    WORLD_Z.WATER_SURFACE,
    viewport,
  );
  const edgeEnd = projectToScreen(
    WORLD_X.MAX,
    WORLD_Y.WATER_NEAR,
    WORLD_Z.WATER_SURFACE,
    viewport,
  );
  const edgeDir = {
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  };
  const edgeLen = Math.hypot(edgeDir.x, edgeDir.y) || 1;
  const edgeTangent = {
    x: edgeDir.x / edgeLen,
    y: edgeDir.y / edgeLen,
  };
  let edgeNormal = {
    x: -edgeTangent.y,
    y: edgeTangent.x,
  };

  const waterProbe = projectToScreen(
    WORLD_X.CENTER,
    WORLD_Y.WATER_NEAR + 1,
    WORLD_Z.WATER_SURFACE,
    viewport,
  );
  const probeVec = {
    x: waterProbe.x - edgeStart.x,
    y: waterProbe.y - edgeStart.y,
  };
  if (edgeNormal.x * probeVec.x + edgeNormal.y * probeVec.y < 0) {
    edgeNormal = {
      x: -edgeNormal.x,
      y: -edgeNormal.y,
    };
  }

  const edgeFoamShader = createEdgeFoamShader({
    noiseBasisX,
    noiseBasisY,
    edgeLinePoint: [edgeStart.x, edgeStart.y],
    edgeLineNormal: [edgeNormal.x, edgeNormal.y],
    baseWidthPx: 3.5,
    chopWidthPx: 2.0,
    varWidthPx: 3.5,
  });
  edgeFoamTiles.filters = [edgeFoamShader];
  edgeFoamTiles.addChild(createWaterSurfacePolygon(viewport, 0x000000, 0));

  return { edgeFoamTiles, edgeFoamShader };
}

async function buildWaterObjects({ viewport }) {
  const waterObjectsBelow = new PIXI.Container();
  const waterObjectsAbove = new PIXI.Container();
  waterObjectsBelow.roundPixels = true;
  waterObjectsAbove.roundPixels = true;
  const objectShiftZones = [];
  let objectSpritesheet = null;

  try {
    objectSpritesheet = await loadSpriteSheet(
      "/sprites/objects.png",
      "/sprites/objects.json",
    );
  } catch (error) {
    console.warn("[OBJECTS] Failed to load /sprites/objects.json", error);
  }

  const objectBelowTexture = objectSpritesheet?.textures?.frame0 ?? null;
  const objectAboveTexture = objectSpritesheet?.textures?.frame2 ?? null;
  const hasWaterObjects = Boolean(
    objectBelowTexture?.source && objectAboveTexture?.source,
  );

  if (hasWaterObjects) {
    objectBelowTexture.source.scaleMode = "nearest";
    objectAboveTexture.source.scaleMode = "nearest";

    const waterSurfaceCenterX = (WORLD_X.MIN + WORLD_X.MAX) / 2;
    const waterSurfaceCenterY = (WORLD_Y.WATER_NEAR + WORLD_Y.WATER_FAR) / 2;

    for (const log of WATER_OBJECT_TEST_LOGS) {
      const worldX = log.position.x + waterSurfaceCenterX;
      const worldY = log.position.y + waterSurfaceCenterY;

      const screen = projectToScreen(worldX, worldY, log.position.z, viewport);

      const belowSprite = new PIXI.Sprite(objectBelowTexture);
      belowSprite.anchor.set(0.5, 0.5);

      const trimOffsetX =
        objectBelowTexture.orig.width / 2 -
        (objectBelowTexture.trim.x + objectBelowTexture.frame.width / 2);
      const trimOffsetY =
        objectBelowTexture.orig.height / 2 -
        (objectBelowTexture.trim.y + objectBelowTexture.frame.height / 2);

      belowSprite.x = screen.x + trimOffsetX;
      belowSprite.y = screen.y + trimOffsetY;
      waterObjectsBelow.addChild(belowSprite);

      const aboveSprite = new PIXI.Sprite(objectAboveTexture);
      aboveSprite.anchor.set(0.5, 0.5);

      aboveSprite.x = screen.x + trimOffsetX;
      aboveSprite.y = screen.y + trimOffsetY;
      waterObjectsAbove.addChild(aboveSprite);

      if (log.footprint?.shape && log.footprint?.size) {
        objectShiftZones.push({
          id: `${log.id}-footprint-repel`,
          type: "repel",
          position: { x: worldX, y: worldY, z: WORLD_Z.WATER_SURFACE },
          isObjectRepel: true,
          solidInset: 0.05,
          shape: {
            type: log.footprint.shape,
            size: log.footprint.size,
            rotation: log.footprint.rotation,
          },
        });
      }
    }
  }

  return { waterObjectsBelow, waterObjectsAbove, objectShiftZones };
}

function assembleWaterGroup({
  viewport,
  screenWidth,
  screenHeight,
  riverbedTiles,
  submergedWallTiles,
  waterObjectsBelow,
  waterSurfaceTiles,
  reflectionContainer,
  foamTiles,
  edgeFoamTiles,
  sparkleTiles,
  sparkleBloomTiles,
  waterObjectsAbove,
}) {
  const displacedLayers = new PIXI.Container();
  displacedLayers.addChild(
    riverbedTiles,
    submergedWallTiles,
    waterObjectsBelow,
    waterSurfaceTiles,
    reflectionContainer,
  );

  const noiseTexture = generateNoiseTexture(128);
  const displacementSprite = new PIXI.Sprite(noiseTexture);
  displacementSprite.width = screenWidth;
  displacementSprite.height = screenHeight;
  displacedLayers.addChild(displacementSprite);

  const displacementFilter = new DisplacementFilter({
    sprite: displacementSprite,
    scale: 4,
  });
  displacedLayers.filters = [displacementFilter];

  const waterGroup = new PIXI.Container();
  waterGroup.addChild(
    displacedLayers,
    sparkleBloomTiles,
    sparkleTiles,
    foamTiles,
    edgeFoamTiles,
    waterObjectsAbove,
  );

  applyWaterSurfaceMask(waterSurfaceTiles, displacedLayers, viewport);
  applyWaterSurfaceMask(foamTiles, waterGroup, viewport);
  applyWaterSurfaceMask(edgeFoamTiles, waterGroup, viewport);
  applyWaterSurfaceMask(sparkleTiles, waterGroup, viewport);
  applyWaterSurfaceMask(sparkleBloomTiles, waterGroup, viewport);

  return { waterGroup, displacementSprite, displacementFilter };
}

/**
 * Create all water-related layers and assemble them into a waterGroup.
 *
 * @param {Object} context - Shared scene context
 * @param {Object} context.viewport
 * @param {Object} context.tileScreenSize - { width, height }
 * @param {number} context.flowDirX
 * @param {number} context.flowDirY
 * @param {number[]} context.noiseBasisX
 * @param {number[]} context.noiseBasisY
 * @param {Object} layerInputs - Pre-built containers from other modules
 * @param {PIXI.Container} layerInputs.submergedWallTiles
 * @param {PIXI.Container} layerInputs.reflectionContainer
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {Promise<Object>} Water layer results
 */
export async function createWaterLayers(
  context,
  layerInputs,
  screenWidth,
  screenHeight,
) {
  const {
    viewport,
    tileScreenSize,
    flowDirX,
    flowDirY,
    noiseBasisX,
    noiseBasisY,
    renderer,
    debugContainer,
    debugEnabled,
  } = context;
  const { submergedWallTiles, reflectionContainer } = layerInputs;
  const riverbedResult = await buildRiverbedTiles({
    viewport,
    tileScreenSize,
    flowDirX,
    flowDirY,
    noiseBasisX,
    noiseBasisY,
    submergedWallTiles,
  });
  const {
    riverbedTiles,
    causticsFilter,
    underwaterTintFilter,
    waterColorNear,
    waterColorFar,
  } = riverbedResult;

  const surfaceResult = buildWaterSurfaceAndSparkle({
    viewport,
    flowDirX,
    flowDirY,
    noiseBasisX,
    noiseBasisY,
    waterColorNear,
    waterColorFar,
  });
  const { waterSurfaceTiles, waterSurfaceShader, sparkleTiles, sparkleShader } =
    surfaceResult;
  const { sparkleBloomTiles, sparkleBloomShader } = surfaceResult;

  const foamResult = buildFoamSystem({
    viewport,
    renderer,
    screenWidth,
    screenHeight,
    debugContainer,
    debugEnabled,
  });
  const { foamTiles, fluidFoamCoordinator, fluidFoamDebugOverlay } = foamResult;

  const { edgeFoamTiles, edgeFoamShader } = buildEdgeFoam({
    viewport,
    noiseBasisX,
    noiseBasisY,
  });

  const { waterObjectsBelow, waterObjectsAbove, objectShiftZones } =
    await buildWaterObjects({
      viewport,
    });

  if (fluidFoamCoordinator) {
    const combinedShiftZones = [
      ...CURRENT_SHIFT_ZONES,
      ...(objectShiftZones || []),
    ];
    fluidFoamCoordinator.setShiftZones(combinedShiftZones);
    if (fluidFoamDebugOverlay) {
      fluidFoamDebugOverlay.setShiftZones(combinedShiftZones);
    }
  }

  const { waterGroup, displacementSprite, displacementFilter } =
    assembleWaterGroup({
      viewport,
      screenWidth,
      screenHeight,
      riverbedTiles,
      submergedWallTiles,
      waterObjectsBelow,
      waterSurfaceTiles,
      reflectionContainer,
      foamTiles,
      edgeFoamTiles,
      sparkleTiles,
      sparkleBloomTiles,
      waterObjectsAbove,
    });

  return {
    waterGroup,
    waterSurfaceTiles,
    waterObjectsBelow,
    waterObjectsAbove,
    causticsFilter,
    underwaterTintFilter,
    waterSurfaceShader,
    fluidFoamDebugOverlay,
    sparkleShader,
    sparkleBloomShader,
    edgeFoamShader,
    fluidFoamCoordinator,
    displacementSprite,
    displacementFilter,
  };
}
