/**
 * Water Layers
 * Riverbed tiles (with caustics), water surface tiles (with depth shader),
 * sparkle overlay, and water group assembly with displacement filter.
 *
 * Underwater tint: tiles below the water surface (riverbed + submerged walls)
 * are tinted via a ColorMatrixFilter using a luminosity-blend matrix. The matrix
 * extracts Rec. 601 luminance and multiplies by waterColorNear * scale, so tiles
 * carry the water hue based on their brightness. Applied once at setup (not
 * per-frame) for performance.
 *
 * Filter chain on riverbed: [underwaterTintFilter, causticsFilter] — tint first
 * so caustics add warm highlights on the tinted base. Submerged walls get the
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
import { ColorMatrixFilter, DisplacementFilter } from "pixi.js";
import { loadSpriteSheet } from "../graphics/spriteLoader.js";
import { createWaterSurfaceShader } from "../graphics/waterSystem/waterSurfaceShader.js";
import { createSparkleShader } from "../graphics/waterSystem/sparkleShader.js";
import { createFoamShader } from "../graphics/waterSystem/foamShader.js";
import { createEdgeFoamShader } from "../graphics/waterSystem/edgeFoamShader.js";
import { createCausticsShader } from "../graphics/waterSystem/causticsShader.js";
import { FluidFoamCoordinator } from "../graphics/fluidSystem/FluidFoamCoordinator.js";
import { FluidVelocityField } from "../graphics/fluidSystem/FluidVelocityField.js";
import { FluidParticleState } from "../graphics/fluidSystem/FluidParticleState.js";
import { FluidParticleRenderer } from "../graphics/fluidSystem/FluidParticleRenderer.js";
import { FluidBoundaryTexture } from "../graphics/fluidSystem/FluidBoundaryTexture.js";
import { FluidFoamDebugOverlay } from "../graphics/fluidSystem/FluidFoamDebugOverlay.js";
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { computeDepthCoeffs, generateNoiseTexture } from "./sceneHelpers.js";
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

/**
 * Place a grid of iso tiles into a container.
 *
 * @param {Object} params
 * @param {PIXI.Container} params.container - Target container
 * @param {PIXI.Texture} params.areaTexture - Default tile texture
 * @param {PIXI.Texture|null} params.edgeTexture - Edge tile texture (used for first row)
 * @param {PIXI.Container|null} params.edgeContainer - Separate container for edge tiles (if any)
 * @param {{ x: number, y: number }} params.tileScale - Scale factors
 * @param {number} params.startX
 * @param {number} params.endX
 * @param {number} params.startY
 * @param {number} params.endY
 * @param {number} params.z - World Z plane
 * @param {Object} params.viewport
 */
function placeTileGrid({
  container,
  areaTexture,
  edgeTexture,
  edgeContainer,
  tileScale,
  startX,
  endX,
  startY,
  endY,
  z,
  viewport,
}) {
  for (let y = startY; y < endY; y += 1) {
    const useEdge = y === startY && edgeTexture?.source;
    const tileTexture = useEdge ? edgeTexture : areaTexture;
    const target = useEdge && edgeContainer ? edgeContainer : container;

    for (let x = startX; x < endX; x += 1) {
      const screen = projectToScreen(x + 0.5, y + 0.5, z, viewport);
      const tile = new PIXI.Sprite(tileTexture);
      tile.anchor.set(0.5, 0.5);
      tile.scale.set(tileScale.x, tileScale.y);
      tile.x = screen.x;
      tile.y = screen.y;
      target.addChild(tile);
    }
  }
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

function addWaterSurfaceFill(container, viewport) {
  const fill = createWaterSurfacePolygon(viewport, 0x000000, 0);
  container.addChildAt(fill, 0);
}

function applyWaterSurfaceMask(container, parent, viewport) {
  const mask = createWaterSurfacePolygon(viewport, 0xffffff, 1);
  parent.addChild(mask);
  container.mask = mask;
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
  } = context;
  const { submergedWallTiles, reflectionContainer } = layerInputs;

  // --- Riverbed tiles ---
  const riverbedTiles = new PIXI.Container();
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

  // Default sheet frame order: 0 empty, 1-2 legacy water, 3 walkway, 4 riverbed.
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

  // Apply caustics filter to riverbed tiles
  const riverbedDepthCoeffs = computeDepthCoeffs(WORLD_Z.RIVERBED, viewport);
  const causticsFilter = createCausticsShader({
    depthCoeffs: riverbedDepthCoeffs,
    causticsScale: 6,
    causticsSpeed: 0.4,
    causticsIntensity: 0.15,
    causticsColor: [1.0, 0.95, 0.8],
    flowDir: [flowDirX, flowDirY],
    noiseBasisX,
    noiseBasisY,
  });
  // Shared water colour used by both the surface shader and the underwater tint.
  // Warm sage-teal — natural river alongside sandy banks.
  const waterColorNear = [0.12, 0.24, 0.2];
  const waterColorFar = [0.05, 0.13, 0.12];

  // Luminosity-blend tint for underwater layers. Uses a custom colour matrix
  // (see applyUnderwaterTint) that maps pixel luminance × waterColorNear so
  // tiles carry the water hue based on their brightness. Applied once at setup.
  const underwaterTintFilter = new ColorMatrixFilter();
  applyUnderwaterTint(underwaterTintFilter, waterColorNear);

  // Tint first, then caustics — caustic light adds warm highlights on top
  // of the water-coloured base rather than being tinted away.
  riverbedTiles.filters = [underwaterTintFilter, causticsFilter];
  submergedWallTiles.filters = [underwaterTintFilter];

  // --- Water surface tiles ---
  const waterSurfaceTiles = new PIXI.Container();
  const waterSurfaceAreaTiles = new PIXI.Container();
  const waterSurfaceEdgeTiles = new PIXI.Container();
  waterSurfaceTiles.addChild(waterSurfaceAreaTiles, waterSurfaceEdgeTiles);

  let waterSpritesheet = null;
  try {
    waterSpritesheet = await loadSpriteSheet(
      "/sprites/water.png",
      "/sprites/water.json",
    );
  } catch (error) {
    console.warn("[WATER] Failed to load /sprites/water.json", error);
  }

  const waterAreaTexture = waterSpritesheet?.textures?.frame1 ?? null;
  const waterEdgeTexture = waterAreaTexture;

  let waterSurfaceShader = null;
  const hasWaterTiles = Boolean(waterAreaTexture?.source);

  console.log("[WaterLayers] hasWaterTiles:", hasWaterTiles, {
    waterAreaTexture: Boolean(waterAreaTexture),
    source: Boolean(waterAreaTexture?.source),
  });

  if (hasWaterTiles) {
    waterAreaTexture.source.scaleMode = "nearest";
    if (waterEdgeTexture?.source) {
      waterEdgeTexture.source.scaleMode = "nearest";
    }

    const tileScale = {
      x: tileScreenSize.width / waterAreaTexture.width,
      y: tileScreenSize.height / waterAreaTexture.height,
    };

    const waterSurfaceDepthCoeffs = computeDepthCoeffs(
      WORLD_Z.WATER_SURFACE,
      viewport,
    );

    waterSurfaceShader = createWaterSurfaceShader({
      waterColorNear,
      waterColorFar,
      waterAlpha: 0.7,
      depthCoeffs: waterSurfaceDepthCoeffs,
      noiseScale: 0.015,
      noiseStrength: 0.15,
      depthBands: 6,
    });
    // Apply to parent so both area and edge tiles get the water tint.
    waterSurfaceTiles.filters = [waterSurfaceShader];

    const waterStartX = Math.floor(WORLD_X.MIN);
    const waterEndX = Math.ceil(WORLD_X.MAX);
    const waterStartY = Math.floor(WORLD_Y.WATER_NEAR);
    const waterEndY = Math.ceil(WORLD_Y.WATER_FAR);

    placeTileGrid({
      container: waterSurfaceAreaTiles,
      areaTexture: waterAreaTexture,
      edgeTexture: waterEdgeTexture,
      edgeContainer: waterSurfaceEdgeTiles,
      tileScale,
      startX: waterStartX,
      endX: waterEndX,
      startY: waterStartY,
      endY: waterEndY,
      z: WORLD_Z.WATER_SURFACE,
      viewport,
    });

    addWaterSurfaceFill(waterSurfaceTiles, viewport);
  }

  // --- Sparkle overlay ---
  const sparkleTiles = new PIXI.Container();
  let sparkleShader = null;

  if (hasWaterTiles) {
    const tileScale = {
      x: tileScreenSize.width / waterAreaTexture.width,
      y: tileScreenSize.height / waterAreaTexture.height,
    };

    sparkleShader = createSparkleShader({
      flowDir: [flowDirX, flowDirY],
      noiseBasisX,
      noiseBasisY,
    });
    sparkleTiles.filters = [sparkleShader];

    placeTileGrid({
      container: sparkleTiles,
      areaTexture: waterAreaTexture,
      edgeTexture: waterEdgeTexture,
      edgeContainer: null,
      tileScale,
      startX: Math.floor(WORLD_X.MIN),
      endX: Math.ceil(WORLD_X.MAX),
      startY: Math.floor(WORLD_Y.WATER_NEAR),
      endY: Math.ceil(WORLD_Y.WATER_FAR),
      z: WORLD_Z.WATER_SURFACE,
      viewport,
    });

    addWaterSurfaceFill(sparkleTiles, viewport);
  }

  // --- Foam overlay ---
  const foamTiles = new PIXI.Container();
  let foamShader = null;
  let fluidFoamCoordinator = null;
  let fluidFoamDebugOverlay = null;
  let fluidFoamParticleContainer = null; // Separate top-level container for particles (debugging)

  // Edge foam (localized to the river wall line at Y=0)
  const edgeFoamTiles = new PIXI.Container();
  let edgeFoamShader = null;

  // Create fluid foam system (replaces static Voronoi foam shader)
  // Always create it if renderer is available, even if water tiles are missing
  if (renderer) {
    console.log("[FluidFoam] Creating fluid foam system...");

    // Create dedicated top-level container for particles (no masking for now)
    fluidFoamParticleContainer = new PIXI.Container();
    fluidFoamParticleContainer.label = "FluidFoamParticles"; // Use label instead of name for PixiJS v8

    // Initialize fluid foam coordinator with sub-systems
    fluidFoamCoordinator = new FluidFoamCoordinator({
      gridWidth: 270, // Match water surface aspect ratio (12:8 = 1.5:1)
      gridHeight: 180,
      maxParticles: 10000,
      waveInterval: 1.0,
      particlesPerWave: 200,
      maxAge: 8.0,
      baseFlowSpeed: 2.0, // Increased to ensure particles cross the 12-unit water width in time
    });

    // Create velocity field
    const velocityField = new FluidVelocityField({
      width: 270, // Match boundary texture dimensions
      height: 180,
      renderer: renderer,
    });

    // Create particle state manager
    const particleState = new FluidParticleState({
      maxParticles: 10000,
      worldToScreen: (x, y, z) => projectToScreen(x, y, z, viewport),
    });

    // Create particle renderer - add to dedicated top-level container
    const particleRenderer = new FluidParticleRenderer({
      maxParticles: 10000,
      parentContainer: fluidFoamParticleContainer, // Top-level, no masking
      worldToScreen: (x, y, z) => projectToScreen(x, y, z, viewport),
    });

    // Create boundary texture for obstacle collision (will be populated later with waterObjectsAbove)
    // Note: waterObjectsAbove is created later in this function, so we'll pass it separately
    const boundaryTexture = null; // Will be created and set after waterObjectsAbove exists

    // Initialize coordinator with sub-systems
    fluidFoamCoordinator.initialize(
      velocityField,
      particleState,
      particleRenderer,
      boundaryTexture,
    );

    // Create debug overlay (temporary - for testing)
    // Add to debugContainer if available, otherwise add to foamTiles
    const overlayContainer = debugContainer || foamTiles;
    fluidFoamDebugOverlay = new FluidFoamDebugOverlay(
      fluidFoamCoordinator,
      overlayContainer,
    );

    console.log("[FluidFoam] Fluid foam system initialized");

    // Note: Static foam shader disabled in favor of particle-based foam
    // foamShader = createFoamShader({
    //   flowDir: [flowDirX, flowDirY],
    //   noiseBasisX,
    //   noiseBasisY,
    // });
    // foamTiles.filters = [foamShader];
  } else {
    console.warn(
      "[FluidFoam] Renderer not available, skipping fluid foam creation",
    );
  }

  // Note: Static foam tiles disabled in favor of particle-based fluid foam
  // if (hasWaterTiles) {
  //   const tileScale = {
  //     x: tileScreenSize.width / waterAreaTexture.width,
  //     y: tileScreenSize.height / waterAreaTexture.height,
  //   };
  //
  //   foamShader = createFoamShader({
  //     flowDir: [flowDirX, flowDirY],
  //     noiseBasisX,
  //     noiseBasisY,
  //   });
  //   foamTiles.filters = [foamShader];
  //
  //   placeTileGrid({
  //     container: foamTiles,
  //     areaTexture: waterAreaTexture,
  //     edgeTexture: waterEdgeTexture,
  //     edgeContainer: null,
  //     tileScale,
  //     startX: Math.floor(WORLD_X.MIN),
  //     endX: Math.ceil(WORLD_X.MAX),
  //     startY: Math.floor(WORLD_Y.WATER_NEAR),
  //     endY: Math.ceil(WORLD_Y.WATER_FAR),
  //     z: WORLD_Z.WATER_SURFACE,
  //     viewport,
  //   });
  //
  //   addWaterSurfaceFill(foamTiles, viewport);
  // }

  if (hasWaterTiles) {
    const tileScale = {
      x: tileScreenSize.width / waterAreaTexture.width,
      y: tileScreenSize.height / waterAreaTexture.height,
    };

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

    edgeFoamShader = createEdgeFoamShader({
      noiseBasisX,
      noiseBasisY,
      edgeLinePoint: [edgeStart.x, edgeStart.y],
      edgeLineNormal: [edgeNormal.x, edgeNormal.y],
      baseWidthPx: 3.5,
      chopWidthPx: 2.0,
      varWidthPx: 3.5,
    });
    edgeFoamTiles.filters = [edgeFoamShader];

    placeTileGrid({
      container: edgeFoamTiles,
      areaTexture: waterAreaTexture,
      edgeTexture: waterEdgeTexture,
      edgeContainer: null,
      tileScale,
      startX: Math.floor(WORLD_X.MIN),
      endX: Math.ceil(WORLD_X.MAX),
      startY: Math.floor(WORLD_Y.WATER_NEAR),
      endY: Math.ceil(WORLD_Y.WATER_FAR),
      z: WORLD_Z.WATER_SURFACE,
      viewport,
    });

    addWaterSurfaceFill(edgeFoamTiles, viewport);
  }

  // --- Water objects (test logs) ---
  const waterObjectsBelow = new PIXI.Container();
  const waterObjectsAbove = new PIXI.Container();
  const waterObjectMasks = new PIXI.Container(); // Collision masks for boundary texture
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
  const objectMaskTexture = objectSpritesheet?.textures?.frame1 ?? null;
  const objectAboveTexture = objectSpritesheet?.textures?.frame2 ?? null;
  const hasWaterObjects = Boolean(
    objectBelowTexture?.source && objectAboveTexture?.source,
  );

  if (hasWaterObjects) {
    objectBelowTexture.source.scaleMode = "nearest";
    objectAboveTexture.source.scaleMode = "nearest";
    if (objectMaskTexture?.source) {
      objectMaskTexture.source.scaleMode = "nearest";
    }

    // Water surface center in world space for coordinate conversion
    const waterSurfaceCenterX = (WORLD_X.MIN + WORLD_X.MAX) / 2; // -2
    const waterSurfaceCenterY = (WORLD_Y.WATER_NEAR + WORLD_Y.WATER_FAR) / 2; // 4

    for (const log of WATER_OBJECT_TEST_LOGS) {
      // Test data coordinates are LOCAL to water surface: (0,0) = center
      // Convert to world coordinates
      const worldX = log.position.x + waterSurfaceCenterX;
      const worldY = log.position.y + waterSurfaceCenterY;

      const screen = projectToScreen(worldX, worldY, log.position.z, viewport);

      console.log(`[WaterObjects SPRITE] ${log.id}:`, {
        local: `(${log.position.x}, ${log.position.y})`,
        world: `(${worldX.toFixed(2)}, ${worldY.toFixed(2)})`,
        screen: `(${screen.x.toFixed(1)}, ${screen.y.toFixed(1)})`,
      });

      const belowSprite = new PIXI.Sprite(objectBelowTexture);
      belowSprite.anchor.set(0.5, 0.5);

      // Compensate for sprite trimming:
      // Original canvas center: (384, 192)
      // Trimmed sprite center: (165+18.5, 184+25) = (183.5, 209)
      // Offset needed: (200.5, -17)
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

      // Reuse same trim offset (textures have identical trim data)
      aboveSprite.x = screen.x + trimOffsetX;
      aboveSprite.y = screen.y + trimOffsetY;
      waterObjectsAbove.addChild(aboveSprite);

      // Create mask sprite for collision detection (if available)
      if (objectMaskTexture?.source) {
        const maskSprite = new PIXI.Sprite(objectMaskTexture);
        maskSprite.anchor.set(0.5, 0.5);
        maskSprite.x = screen.x;
        maskSprite.y = screen.y;
        // Store WORLD position for boundary texture rendering
        maskSprite.worldPosition = { x: log.position.x, y: log.position.y };
        // Debug visualization: semi-transparent red tint
        maskSprite.alpha = 0.4;
        maskSprite.tint = 0xff0000; // Red overlay to show collision areas
        waterObjectMasks.addChild(maskSprite);
      }

      console.log(`[WaterObjects] ${log.id}:`, {
        local: `(${log.position.x}, ${log.position.y})`,
        world: `(${worldX.toFixed(1)}, ${worldY.toFixed(1)})`,
        screen: `(${screen.x.toFixed(1)}, ${screen.y.toFixed(1)})`,
      });
    }

    // Create boundary texture for collision detection after all mask sprites are added
    if (
      fluidFoamCoordinator &&
      renderer &&
      waterObjectMasks.children.length > 0
    ) {
      // Match texture aspect ratio to water surface world bounds
      // Water surface: 12 units wide (X: -8 to 4), 8 units deep (Y: 0 to 8) = 1.5:1 ratio
      const boundaryTexture = new FluidBoundaryTexture({
        width: 270, // 270x180 = 1.5:1 aspect ratio matching world space
        height: 180,
        renderer: renderer,
        waterObjectMasksContainer: waterObjectMasks,
        viewport: viewport,
        debugContainer: debugContainer, // Pass debug container for visualization
      });

      // Set the boundary texture in the coordinator
      fluidFoamCoordinator.boundaryTexture = boundaryTexture;
    }
  }

  // --- Water group assembly ---
  // Displacement (refraction warp) applies only to layers viewed *through*
  // the water surface. Foam and sparkles sit on top of the surface and have
  // their own flow-phase animation, so they live outside the displaced
  // sub-container to stay crisp and un-warped.
  //
  // Draw order (bottom to top):
  //   displacedLayers (with DisplacementFilter):
  //     1. riverbedTiles        — riverbed floor (seen through water)
  //     2. submergedWallTiles   — wall below water surface
  //     3. waterObjectsBelow    — submerged parts of water objects
  //     4. waterSurfaceTiles    — semi-transparent water depth tint
  //     5. reflectionContainer  — sky + clouds + wall reflections
  //   undisplaced (no filter, composited on top):
  //     6. foamTiles            — surface foam (stretched Voronoi)
  //     7. edgeFoamTiles        — shoreline foam band (river wall edge)
  //     8. sparkleTiles         — specular highlights
  //     9. waterObjectsAbove    — above-water parts of water objects
  const displacedLayers = new PIXI.Container();
  displacedLayers.addChild(
    riverbedTiles,
    submergedWallTiles,
    waterObjectsBelow,
    waterSurfaceTiles,
    reflectionContainer,
  );

  // Procedural noise displacement for water flow (refraction through surface)
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
    foamTiles,
    edgeFoamTiles,
    sparkleTiles,
    waterObjectsAbove,
    waterObjectMasks, // Debug: Show collision masks as semi-transparent red overlay
  );

  // Debug container for green dots - will be added outside waterGroup
  const debugDotsContainer = new PIXI.Container();

  // Debug: Add green dots to separate container so they render on top of everything
  for (const log of WATER_OBJECT_TEST_LOGS) {
    const waterSurfaceCenterX = (WORLD_X.MIN + WORLD_X.MAX) / 2; // -2
    const waterSurfaceCenterY = (WORLD_Y.WATER_NEAR + WORLD_Y.WATER_FAR) / 2; // 4
    const worldX = log.position.x + waterSurfaceCenterX;
    const worldY = log.position.y + waterSurfaceCenterY;
    const screen = projectToScreen(worldX, worldY, log.position.z, viewport);

    console.log(`[WaterObjects GREEN DOT] ${log.id}:`, {
      local: `(${log.position.x}, ${log.position.y})`,
      world: `(${worldX.toFixed(2)}, ${worldY.toFixed(2)})`,
      screen: `(${screen.x.toFixed(1)}, ${screen.y.toFixed(1)})`,
    });

    const debugCircle = new PIXI.Graphics();
    debugCircle.circle(0, 0, 15);
    debugCircle.fill({ color: 0x00ff00, alpha: 1.0 }); // Bright green
    debugCircle.x = screen.x;
    debugCircle.y = screen.y;
    debugDotsContainer.addChild(debugCircle);

    // TEST: Add a blue circle to waterObjectsAbove with exact same coordinates
    const testCircle = new PIXI.Graphics();
    testCircle.circle(0, 0, 20);
    testCircle.fill({ color: 0x0000ff, alpha: 1.0 }); // Bright blue
    testCircle.x = screen.x;
    testCircle.y = screen.y;
    testCircle.zIndex = 9999;
    waterObjectsAbove.addChild(testCircle);
    waterObjectsAbove.sortableChildren = true; // Enable z-index sorting

    console.log(
      `[TEST] Blue circle added at screen (${screen.x}, ${screen.y})`,
    );
    console.log(`[TEST] waterObjectsAbove:`, {
      visible: waterObjectsAbove.visible,
      alpha: waterObjectsAbove.alpha,
      children: waterObjectsAbove.children.length,
      mask: waterObjectsAbove.mask ? "YES" : "NO",
    });
  }

  // Always apply mask to foam and sparkles (even if water tiles are shader-driven)
  if (hasWaterTiles) {
    applyWaterSurfaceMask(waterSurfaceTiles, displacedLayers, viewport);
  }
  applyWaterSurfaceMask(foamTiles, waterGroup, viewport);
  applyWaterSurfaceMask(edgeFoamTiles, waterGroup, viewport);
  applyWaterSurfaceMask(sparkleTiles, waterGroup, viewport);

  console.log(
    "[WaterLayers] Applied water surface masks. foamTiles mask:",
    foamTiles.mask ? "YES" : "NO",
  );

  console.log("[WaterLayers] Returning water layers with fluid foam system");

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
    foamShader,
    edgeFoamShader,
    fluidFoamCoordinator,
    fluidFoamParticleContainer, // Return the top-level particle container
    debugDotsContainer, // Debug: Green dots showing expected object positions
    displacementSprite,
    displacementFilter,
  };
}
