/**
 * Water Layers
 * Riverbed tiles (with caustics), water surface tiles (with depth shader),
 * sparkle overlay, and water group assembly with displacement filter.
 */

import * as PIXI from "pixi.js";
import { DisplacementFilter } from "pixi.js";
import { loadSpriteSheet } from "../graphics/spriteLoader.js";
import { createWaterSurfaceShader } from "../graphics/waterSystem/waterSurfaceShader.js";
import { createSparkleShader } from "../graphics/waterSystem/sparkleShader.js";
import { createCausticsShader } from "../graphics/waterSystem/causticsShader.js";
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { computeDepthCoeffs, generateNoiseTexture } from "./sceneHelpers.js";

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
  riverbedTiles.filters = [causticsFilter];

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
  const waterEdgeTexture = waterSpritesheet?.textures?.frame2 ?? null;

  let waterSurfaceShader = null;

  if (waterAreaTexture?.source) {
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
      waterColorNear: [0.086, 0.243, 0.247],
      waterColorFar: [0.035, 0.161, 0.169],
      waterAlpha: 0.7,
      maskThreshold: 0.9,
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
  }

  // --- Sparkle overlay ---
  const sparkleTiles = new PIXI.Container();
  let sparkleShader = null;

  if (waterAreaTexture?.source) {
    const tileScale = {
      x: tileScreenSize.width / waterAreaTexture.width,
      y: tileScreenSize.height / waterAreaTexture.height,
    };

    sparkleShader = createSparkleShader({
      maskThreshold: 0.9,
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
  }

  // --- Water group assembly ---
  // Draw order (bottom to top):
  //   1. riverbedTiles        — riverbed floor (seen through water)
  //   2. submergedWallTiles   — wall below water surface
  //   3. waterSurfaceTiles    — semi-transparent water depth tint
  //   4. reflectionContainer  — sky + clouds + wall reflections (Fresnel opacity)
  //   5. sparkleTiles         — specular highlights (topmost water effect)
  const waterGroup = new PIXI.Container();
  waterGroup.addChild(
    riverbedTiles,
    submergedWallTiles,
    waterSurfaceTiles,
    reflectionContainer,
    sparkleTiles,
  );

  // Procedural noise displacement for water flow
  const noiseTexture = generateNoiseTexture(128);
  const displacementSprite = new PIXI.Sprite(noiseTexture);
  displacementSprite.width = screenWidth;
  displacementSprite.height = screenHeight;
  waterGroup.addChild(displacementSprite);

  const displacementFilter = new DisplacementFilter({
    sprite: displacementSprite,
    scale: 4,
  });
  waterGroup.filters = [displacementFilter];

  return {
    waterGroup,
    waterSurfaceTiles,
    causticsFilter,
    waterSurfaceShader,
    sparkleShader,
    displacementSprite,
    displacementFilter,
  };
}
