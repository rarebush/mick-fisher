/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 */

import * as PIXI from "pixi.js";
import {
  loadSpriteSheet,
  createTiledBackground,
} from "../graphics/spriteLoader.js";
import { HEIGHTS } from "../mechanics/heightMechanics.js";

/**
 * Setup environment layers with 3D perspective
 * Creates pier, wall, water surface, and riverbed layers
 * @param {PIXI.Container} container - Container to add layers to
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {Object} Layer references
 */
export function setupEnvironmentLayers(container, width, height) {
  if (!container) return null;

  // Layout based on 100-unit system (percentages of screen height)
  // Units 0-60: Riverbed (bottom 60%)
  // Units 60-80: Wall (next 20%)
  // Units 80-100: Walkway (top 20%)
  // Units 10-70: Water (60 units tall, overlays riverbed and part of wall)

  // Convert to screen Y coordinates (0 = top of screen)
  const walkwayY = 0;
  const walkwayHeight = height * 0.2; // 20% of screen (units 80-100)

  const wallY = walkwayY + walkwayHeight;
  const wallHeight = height * 0.2; // 20% of screen (units 60-80)

  const riverbedY = wallY + wallHeight;
  const riverbedHeight = height * 0.6; // 60% of screen (units 0-60)

  // Water starts at unit 10 (90% from top) and ends at unit 70 (30% from top)
  const waterY = height * 0.3; // 30% from top (unit 70 in their system)
  const waterHeight = height * 0.6; // 60 units tall (same as riverbed width)

  const yOffset = 0; // No offset needed, layers fill the screen

  console.log(
    `[ENVIRONMENT] Walkway: ${walkwayY}px (h:${walkwayHeight.toFixed(0)}), Wall: ${wallY.toFixed(0)}-${(wallY + wallHeight).toFixed(0)}px (h:${wallHeight.toFixed(0)}), Water: ${waterY.toFixed(0)}-${(waterY + waterHeight).toFixed(0)}px (h:${waterHeight.toFixed(0)}), Riverbed: ${riverbedY.toFixed(0)}px (h:${riverbedHeight.toFixed(0)})`,
  );

  // Layer 1: Riverbed (drawn first, partially occluded by water)
  const riverbed = new PIXI.Graphics();
  // Base fill
  riverbed.rect(0, riverbedY, width, riverbedHeight);
  riverbed.fill({ color: 0x8b6914, alpha: 0.8 }); // Brown riverbed
  // Diagonal stripe pattern
  for (let x = -riverbedHeight; x < width + riverbedHeight; x += 15) {
    riverbed.moveTo(x, riverbedY);
    riverbed.lineTo(x + riverbedHeight, riverbedY + riverbedHeight);
    riverbed.stroke({ width: 1, color: 0x654321, alpha: 0.5 });
  }
  // Horizontal dots pattern
  for (let x = 10; x < width; x += 20) {
    for (let y = riverbedY + 10; y < riverbedY + riverbedHeight; y += 15) {
      riverbed.circle(x, y, 2);
      riverbed.fill({ color: 0x654321, alpha: 0.6 });
    }
  }
  riverbed.rect(0, riverbedY, width, riverbedHeight);
  riverbed.stroke({ width: 2, color: 0x654321, alpha: 1.0 }); // Dark brown outline
  container.addChild(riverbed);

  // Layer 2: River Wall (connects pier to riverbed)
  const wall = new PIXI.Graphics();
  // Base fill
  wall.rect(0, wallY, width, wallHeight);
  wall.fill({ color: 0x606060, alpha: 0.6 }); // Gray wall with transparency
  // Brick pattern - horizontal lines
  for (let y = wallY; y < wallY + wallHeight; y += 12) {
    wall.moveTo(0, y);
    wall.lineTo(width, y);
    wall.stroke({ width: 1, color: 0x404040, alpha: 0.4 });
  }
  // Brick pattern - vertical lines (offset every other row)
  for (let y = wallY; y < wallY + wallHeight; y += 24) {
    const offset = ((y - wallY) / 12) % 2 === 0 ? 0 : 20;
    for (let x = offset; x < width; x += 40) {
      wall.moveTo(x, y);
      wall.lineTo(x, Math.min(y + 12, wallY + wallHeight));
      wall.stroke({ width: 1, color: 0x404040, alpha: 0.3 });
    }
  }
  wall.rect(0, wallY, width, wallHeight);
  wall.stroke({ width: 2, color: 0x404040, alpha: 1.0 }); // Dark gray outline
  container.addChild(wall);

  // Layer 3: Water Surface (drawn on top to occlude wall and riverbed)
  const water = new PIXI.Graphics();
  // Base fill
  water.rect(0, waterY, width, waterHeight);
  water.fill({ color: 0x4a90e2, alpha: 0.4 }); // Translucent blue water
  // Horizontal wave pattern
  for (let y = waterY; y < waterY + waterHeight; y += 8) {
    const waveOffset = Math.sin(y * 0.1) * 3;
    water.moveTo(0, y);
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.sin((x + y) * 0.05) * 2;
      water.lineTo(x, y + wave + waveOffset);
    }
    water.stroke({ width: 1, color: 0x2a5f9e, alpha: 0.3 });
  }
  // Bubble circles
  for (let i = 0; i < 30; i++) {
    const x = (i * 37) % width;
    const y = waterY + ((i * 17) % waterHeight);
    const radius = 2 + (i % 3);
    water.circle(x, y, radius);
    water.stroke({ width: 1, color: 0x6ab0f2, alpha: 0.4 });
  }
  water.rect(0, waterY, width, waterHeight);
  water.stroke({ width: 2, color: 0x2a5f9e, alpha: 0.8 }); // Darker blue outline
  container.addChild(water);

  // Layer 4: Pier/Walkway (at top)
  const pier = new PIXI.Graphics();
  // Base fill
  pier.rect(0, walkwayY, width, walkwayHeight);
  pier.fill({ color: 0xc0b090, alpha: 0.9 }); // Wooden pier color
  // Horizontal wood plank lines
  for (let y = walkwayY + 12; y < walkwayY + walkwayHeight; y += 12) {
    pier.moveTo(0, y);
    pier.lineTo(width, y);
    pier.stroke({ width: 2, color: 0x8b7355, alpha: 0.6 });
  }
  // Wood grain vertical lines
  for (let x = 0; x < width; x += 60) {
    for (let y = walkwayY; y < walkwayY + walkwayHeight; y += 3) {
      const offset = Math.random() * 2 - 1;
      pier.moveTo(x + offset, y);
      pier.lineTo(x + offset, y + 2);
      pier.stroke({ width: 1, color: 0x8b7355, alpha: 0.2 });
    }
  }
  pier.rect(0, walkwayY, width, walkwayHeight);
  pier.stroke({ width: 2, color: 0x8b7355, alpha: 1.0 }); // Brown outline
  container.addChild(pier);

  // Add grid lines to show structure (wireframe effect)
  const gridLines = new PIXI.Graphics();

  // Horizontal line at water surface (top edge of water)
  gridLines.moveTo(0, waterY);
  gridLines.lineTo(width, waterY);
  gridLines.stroke({ width: 3, color: 0x2a5f9e, alpha: 1.0 });

  // Horizontal line at water bottom / riverbed intersection
  gridLines.moveTo(0, waterY + waterHeight);
  gridLines.lineTo(width, waterY + waterHeight);
  gridLines.stroke({ width: 3, color: 0x654321, alpha: 1.0 });

  // Horizontal line at wall/walkway boundary
  gridLines.moveTo(0, wallY);
  gridLines.lineTo(width, wallY);
  gridLines.stroke({ width: 3, color: 0x8b7355, alpha: 1.0 });

  // Vertical grid lines for structure
  for (let x = 0; x <= width; x += width / 8) {
    // Walkway lines
    gridLines.moveTo(x, walkwayY);
    gridLines.lineTo(x, walkwayY + walkwayHeight);
    gridLines.stroke({ width: 1, color: 0x8b7355, alpha: 0.3 });

    // Wall lines
    gridLines.moveTo(x, wallY);
    gridLines.lineTo(x, wallY + wallHeight);
    gridLines.stroke({ width: 1, color: 0x404040, alpha: 0.3 });
  }

  container.addChild(gridLines);

  console.log(
    `[ENVIRONMENT] Created 3D environment layers filling full screen (Walkway 20%, Wall 20%, Riverbed 60%, Water overlays)`,
  );

  return { riverbed, wall, water, pier, gridLines, yOffset };
}

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
 * Quadrants only cover the riverbed area (bottom 60% of screen)
 */
export function drawQuadrantGrid(app) {
  if (!app) return;

  // Quadrants only exist on the riverbed (bottom 60% of screen)
  // Riverbed starts at 40% from top (where wall ends) and goes to 100%
  const riverbedStartY = app.screen.height * 0.4; // 40% from top
  const riverbedHeight = app.screen.height * 0.6; // 60% of screen
  const quadrantWidth = app.screen.width / 3;
  const quadrantHeight = riverbedHeight / 3;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const quadrant = new PIXI.Graphics()
        .rect(
          col * quadrantWidth,
          riverbedStartY + row * quadrantHeight,
          quadrantWidth,
          quadrantHeight,
        )
        .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
      app.stage.addChild(quadrant);
    }
  }

  console.log(
    `[QUADRANTS] Grid covers riverbed only: Y ${riverbedStartY.toFixed(0)}-${app.screen.height} (${riverbedHeight.toFixed(0)}px)`,
  );
}
