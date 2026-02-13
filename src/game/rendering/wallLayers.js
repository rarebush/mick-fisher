/**
 * Wall Layers
 * River wall tile placement — splits tiles into submerged (below water)
 * and above-water containers for correct displacement and rendering.
 */

import * as PIXI from "pixi.js";
import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  projectToScreen,
} from "../mechanics/worldConstants.js";

/**
 * Create wall tile containers from pre-loaded textures.
 *
 * @param {Object} context - Shared scene context
 * @param {Object} context.viewport - Viewport for projection
 * @param {Object} context.projectionMetrics - Projection metrics
 * @param {Object} context.tileScreenSize - Tile screen size { width, height }
 * @param {Object} textures - Wall textures
 * @param {PIXI.Texture|null} textures.bottom - Bottom (submerged) wall texture
 * @param {PIXI.Texture|null} textures.middle - Middle wall texture (may be null)
 * @param {PIXI.Texture|null} textures.top - Top wall texture
 * @returns {{ riverWallTiles: PIXI.Container, submergedWallTiles: PIXI.Container }}
 */
export function createWallLayers(context, textures) {
  const { viewport, projectionMetrics, tileScreenSize } = context;
  const riverWallTiles = new PIXI.Container();
  const submergedWallTiles = new PIXI.Container();
  riverWallTiles.roundPixels = true;
  submergedWallTiles.roundPixels = true;

  if (!textures.bottom?.source || !textures.top?.source) {
    return { riverWallTiles, submergedWallTiles };
  }

  textures.bottom.source.scaleMode = "nearest";
  textures.top.source.scaleMode = "nearest";
  if (textures.middle?.source) {
    textures.middle.source.scaleMode = "nearest";
  }

  // Wall spans from riverbed (Z=0) up to walkway (Z=3).
  // Each tile covers one world unit of height.
  const wallHeightUnits = Math.max(
    2,
    Math.round(WORLD_Z.WALKWAY - WORLD_Z.RIVERBED),
  );
  const startX = Math.floor(WORLD_X.MIN);
  const endX = Math.ceil(WORLD_X.MAX);
  const wallY = WORLD_Y.WALL_EDGE;
  const baseZ = WORLD_Z.RIVERBED;
  const topZ = baseZ + wallHeightUnits - 1;

  const addWallTile = (texture, worldX, worldY, worldZ, targetContainer) => {
    const screen = projectToScreen(worldX, worldY, worldZ, viewport);
    const tile = new PIXI.Sprite(texture);
    // Wall tile parallelogram base edge runs from sprite (0,36) to (32,52).
    // projectToScreen gives the midpoint of that base edge = sprite (16,44).
    // Anchor must point there so the tile aligns with Y=0 in world space.
    const tileH = texture.height; // 52
    const halfIsoOverhang = tileScreenSize.height / 4;
    tile.anchor.set(
      0.5,
      (projectionMetrics.screenYPerWorldZUnit + halfIsoOverhang) / tileH,
    );
    // Wall tiles are pre-shaped; keep native pixel size.
    tile.scale.set(1, 1);
    tile.x = screen.x;
    tile.y = screen.y;
    targetContainer.addChild(tile);
  };

  for (let x = startX; x < endX; x += 1) {
    const worldX = x + 0.5;
    // Bottom tiles are submerged (below water surface Z) — route into
    // submergedWallTiles so they join waterGroup for displacement + overlay.
    addWallTile(textures.bottom, worldX, wallY, baseZ, submergedWallTiles);

    if (wallHeightUnits > 2 && textures.middle?.source) {
      for (let z = baseZ + 1; z < topZ; z += 1) {
        addWallTile(textures.middle, worldX, wallY, z, riverWallTiles);
      }
    }

    addWallTile(textures.top, worldX, wallY, topZ, riverWallTiles);
  }

  return { riverWallTiles, submergedWallTiles };
}
