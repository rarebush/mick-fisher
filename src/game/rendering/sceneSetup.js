/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 */

import * as PIXI from "pixi.js";
import {
  loadSpriteSheet,
  createTiledBackground,
} from "../graphics/spriteLoader.js";

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
 */
export function drawQuadrantGrid(app) {
  if (!app) return;

  const startY = 80;
  const availableHeight = app.screen.height - startY;
  const quadrantWidth = app.screen.width / 3;
  const quadrantHeight = availableHeight / 3;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const quadrant = new PIXI.Graphics()
        .rect(
          col * quadrantWidth,
          startY + row * quadrantHeight,
          quadrantWidth,
          quadrantHeight,
        )
        .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
      app.stage.addChild(quadrant);
    }
  }
}
