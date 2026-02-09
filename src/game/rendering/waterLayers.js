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
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { computeDepthCoeffs, generateNoiseTexture } from "./sceneHelpers.js";

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
  } = context;
  const { submergedWallTiles, reflectionContainer } = layerInputs;

  // --- Riverbed tiles ---
  const riverbedTiles = new PIXI.Container();
  let riverbedSpritesheet = null;
  try {
    riverbedSpritesheet = await loadSpriteSheet(
      "/sprites/riverbed.png",
      "/sprites/riverbed.json",
    );
  } catch (error) {
    console.warn("[RIVERBED] Failed to load /sprites/riverbed.json", error);
  }

  const riverbedTexture = riverbedSpritesheet?.textures?.frame1 ?? null;

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

  // Edge foam (localized to the river wall line at Y=0)
  const edgeFoamTiles = new PIXI.Container();
  let edgeFoamShader = null;

  if (hasWaterTiles) {
    const tileScale = {
      x: tileScreenSize.width / waterAreaTexture.width,
      y: tileScreenSize.height / waterAreaTexture.height,
    };

    foamShader = createFoamShader({
      flowDir: [flowDirX, flowDirY],
      noiseBasisX,
      noiseBasisY,
    });
    foamTiles.filters = [foamShader];

    placeTileGrid({
      container: foamTiles,
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

    addWaterSurfaceFill(foamTiles, viewport);
  }

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
  //     3. waterSurfaceTiles    — semi-transparent water depth tint
  //     4. reflectionContainer  — sky + clouds + wall reflections
  //   undisplaced (no filter, composited on top):
  //     5. foamTiles            — surface foam (stretched Voronoi)
  //     6. edgeFoamTiles        — shoreline foam band (river wall edge)
  //     7. sparkleTiles         — specular highlights (topmost water effect)
  const displacedLayers = new PIXI.Container();
  displacedLayers.addChild(
    riverbedTiles,
    submergedWallTiles,
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
  waterGroup.addChild(displacedLayers, foamTiles, edgeFoamTiles, sparkleTiles);

  if (hasWaterTiles) {
    applyWaterSurfaceMask(waterSurfaceTiles, displacedLayers, viewport);
    applyWaterSurfaceMask(foamTiles, waterGroup, viewport);
    applyWaterSurfaceMask(edgeFoamTiles, waterGroup, viewport);
    applyWaterSurfaceMask(sparkleTiles, waterGroup, viewport);
  }

  return {
    waterGroup,
    waterSurfaceTiles,
    causticsFilter,
    underwaterTintFilter,
    waterSurfaceShader,
    sparkleShader,
    foamShader,
    edgeFoamShader,
    displacementSprite,
    displacementFilter,
  };
}
