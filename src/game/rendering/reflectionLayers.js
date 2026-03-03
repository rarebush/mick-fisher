/**
 * Reflection Layers
 * Pixel-level iso-reflected wall textures and reflection tile placement
 * with water surface diamond masking, procedural sky/cloud reflections,
 * and depth-based Fresnel opacity.
 */

import * as PIXI from "pixi.js";
import {
  ISO_RATIO,
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  projectToScreen,
} from "../mechanics/worldConstants.js";
import { createReflectionShader } from "../graphics/waterSystem/reflectionShader.js";

/**
 * Create a reflected version of a tile texture by reversing the iso column step
 * direction at the pixel level. In the original tile, every ISO_RATIO columns
 * of pixels step 1px down. The reflected version steps 1px up instead, AND
 * flips the content within each column vertically (for a water mirror effect).
 *
 * @param {PIXI.Texture} texture - Source spritesheet frame texture
 * @param {number} isoRatio - Columns per 1px vertical step (e.g. 2 for 2:1 iso)
 * @returns {PIXI.Texture} New texture with reversed iso slant
 */
function createReflectedTexture(texture, isoRatio) {
  const w = texture.frame.width;
  const h = texture.frame.height;

  // Draw source frame to a temporary canvas to read its pixels
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext("2d");
  const img = texture.source.resource; // HTMLImageElement from spritesheet
  srcCtx.drawImage(img, texture.frame.x, texture.frame.y, w, h, 0, 0, w, h);
  const srcData = srcCtx.getImageData(0, 0, w, h);

  // Max iso offset across the tile width (e.g. 15 for a 32px wide tile at 2:1)
  const maxShift = Math.floor((w - 1) / isoRatio);

  // Output is the same size as the input
  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  const outData = outCtx.createImageData(w, h);

  // For each column, reposition it so columns sit at the bottom of the
  // bounding box instead of the top, with the stepping reversed.
  //
  // Original: column x has content starting at Y = isoOffset (from top, stepping down)
  // Reflected: column x has content ending at Y = h-1-isoOffset (from bottom, stepping up)
  //
  // The per-column shift is: maxShift - 2 * isoOffset
  // (positive = move down, negative = move up; out-of-bounds pixels are
  // transparent in the original so they're safely clipped)

  for (let x = 0; x < w; x++) {
    const isoOffset = Math.floor(x / isoRatio);
    const shift = maxShift - 2 * isoOffset;

    for (let srcY = 0; srcY < h; srcY++) {
      const dstY = srcY + shift;
      if (dstY < 0 || dstY >= h) continue; // clip out-of-bounds (transparent)

      const srcIdx = (srcY * w + x) * 4;
      const dstIdx = (dstY * w + x) * 4;

      outData.data[dstIdx] = srcData.data[srcIdx];
      outData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
      outData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
      outData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
    }
  }

  outCtx.putImageData(outData, 0, 0);

  const newTexture = PIXI.Texture.from(outCanvas);
  newTexture.source.scaleMode = "nearest";
  return newTexture;
}

/**
 * Create the wall reflection container with masked reflection tiles,
 * procedural sky/cloud reflections, and depth-based Fresnel opacity.
 *
 * @param {Object} context - Shared scene context
 * @param {Object} context.viewport - Viewport for projection
 * @param {Object} context.projectionMetrics - Projection metrics
 * @param {Object} context.tileScreenSize - Tile screen size { width, height }
 * @param {Array<{x: number, y: number}>} context.waterSurfaceCorners - Screen-space corners for masking
 * @param {number[]} context.depthCoeffs - [A,B,C] isometric depth coefficients for the water surface
 * @param {number[]} context.noiseBasisX - Isometric X basis vector [x,y]
 * @param {number[]} context.noiseBasisY - Isometric Y basis vector [x,y]
 * @param {Object} textures - Wall textures (same as wallLayers)
 * @param {PIXI.Texture|null} textures.bottom - Bottom wall texture (used for guard check)
 * @param {PIXI.Texture|null} textures.middle - Middle wall texture (may be null)
 * @param {PIXI.Texture|null} textures.top - Top wall texture
 * @returns {{ reflectionContainer: PIXI.Container, reflectionShader: Filter }} Container and filter reference
 */
export function createReflectionLayers(context, textures) {
  const {
    viewport,
    projectionMetrics,
    tileScreenSize,
    waterSurfaceCorners,
    depthCoeffs,
    noiseBasisX,
    noiseBasisY,
  } = context;
  const reflectionContainer = new PIXI.Container();
  reflectionContainer.roundPixels = true;

  if (textures.bottom?.source && textures.top?.source) {
    // Pre-create reflected textures (one per wall tier)
    const reflectedMiddleTexture = textures.middle?.source
      ? createReflectedTexture(textures.middle, ISO_RATIO)
      : null;
    const reflectedTopTexture = createReflectedTexture(textures.top, ISO_RATIO);

    const addReflectionTile = (reflectedTex, worldX, worldY, worldZ) => {
      const screen = projectToScreen(worldX, worldY, worldZ, viewport);
      // Mirror axis: the water surface screen Y at this tile's X position.
      const mirrorY = projectToScreen(
        worldX,
        WORLD_Y.WALL_EDGE,
        WORLD_Z.WATER_SURFACE,
        viewport,
      ).y;

      const tile = new PIXI.Sprite(reflectedTex);
      const tileH = reflectedTex.height;
      const halfIsoOverhang = tileScreenSize.height / 4;
      tile.anchor.set(
        0.5,
        (projectionMetrics.screenYPerWorldZUnit + halfIsoOverhang) / tileH,
      );
      tile.scale.set(1, -1);
      tile.x = screen.x;
      tile.y = 2 * mirrorY - screen.y;
      reflectionContainer.addChild(tile);
    };

    const startX = Math.floor(WORLD_X.MIN);
    const endX = Math.ceil(WORLD_X.MAX);
    const wallY = WORLD_Y.WALL_EDGE;
    const baseZ = WORLD_Z.RIVERBED;
    const wallHeightUnits = Math.max(
      2,
      Math.round(WORLD_Z.WALKWAY - WORLD_Z.RIVERBED),
    );
    const topZ = baseZ + wallHeightUnits - 1;

    // Only reflect wall tiers above the water surface line
    const reflectMinZ = Math.ceil(WORLD_Z.WATER_SURFACE);

    for (let x = startX; x < endX; x += 1) {
      const worldX = x + 0.5;

      if (wallHeightUnits > 2 && reflectedMiddleTexture) {
        for (let z = Math.max(reflectMinZ, baseZ + 1); z < topZ; z += 1) {
          addReflectionTile(reflectedMiddleTexture, worldX, wallY, z);
        }
      }

      if (topZ >= reflectMinZ) {
        addReflectionTile(reflectedTopTexture, worldX, wallY, topZ);
      }
    }
  }

  // Transparent diamond fill — ensures the filter's bounding box covers
  // the full water diamond, not just the wall tile area near the top edge.
  const diamondFill = new PIXI.Graphics();
  diamondFill.moveTo(waterSurfaceCorners[0].x, waterSurfaceCorners[0].y);
  for (let i = 1; i < waterSurfaceCorners.length; i += 1) {
    diamondFill.lineTo(waterSurfaceCorners[i].x, waterSurfaceCorners[i].y);
  }
  diamondFill.closePath();
  diamondFill.fill({ color: 0x000000, alpha: 0 });
  reflectionContainer.addChildAt(diamondFill, 0);

  // Mask reflections to water surface diamond
  const reflectionMask = new PIXI.Graphics();
  reflectionMask.moveTo(waterSurfaceCorners[0].x, waterSurfaceCorners[0].y);
  for (let i = 1; i < waterSurfaceCorners.length; i += 1) {
    reflectionMask.lineTo(waterSurfaceCorners[i].x, waterSurfaceCorners[i].y);
  }
  reflectionMask.closePath();
  reflectionMask.fill({ color: 0xffffff });
  reflectionContainer.mask = reflectionMask;
  reflectionContainer.addChild(reflectionMask);

  // Apply reflection filter (sky gradient + clouds + Fresnel opacity).
  // Replaces the old flat alpha: 0.9 — Fresnel now controls per-pixel opacity.
  const reflectionShader = createReflectionShader({
    depthCoeffs,
    noiseBasisX,
    noiseBasisY,
  });
  reflectionContainer.filters = [reflectionShader];

  return { reflectionContainer, reflectionShader };
}
