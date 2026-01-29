/**
 * Scene Setup
 * Initial scene construction - shore, grid, water background
 *
 * Uses world constants for consistent projection from 3D world space to 2D screen.
 * World coordinates: X = horizontal, Y = depth (toward river), Z = height
 * Screen projection: screenY = worldY - worldZ (orthogonal projection)
 */

import * as PIXI from "pixi.js";
import {
  loadSpriteSheet,
  createTiledBackground,
} from "../graphics/spriteLoader.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  projectToScreen,
  getSurfaceScreenBounds,
  RENDER_LAYERS,
} from "../mechanics/worldConstants.js";

const WATER_COLORS = {
  base: 0x00ffff,
  wave: 0x00cccc,
  outline: 0x00ffff,
};

export function drawWaterSurface(
  water,
  { width, height, waterY, waterHeight, opaque = false },
) {
  if (!water) return;

  const baseAlpha = opaque ? 1.0 : 0.4;
  const waveAlpha = opaque ? 1.0 : 0.3;
  const bubbleAlpha = opaque ? 1.0 : 0.4;

  water.clear();
  // Base fill - DEBUG: Bright cyan for visibility
  water.rect(0, waterY, width, waterHeight);
  water.fill({ color: WATER_COLORS.base, alpha: baseAlpha });
  // Horizontal wave pattern
  for (let y = waterY; y < waterY + waterHeight; y += 8) {
    const waveOffset = Math.sin(y * 0.1) * 3;
    water.moveTo(0, y);
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.sin((x + y) * 0.05) * 2;
      water.lineTo(x, y + wave + waveOffset);
    }
    water.stroke({ width: 1, color: WATER_COLORS.wave, alpha: waveAlpha });
  }
  // Bubble circles
  for (let i = 0; i < 30; i++) {
    const x = (i * 37) % width;
    const y = waterY + ((i * 17) % waterHeight);
    const radius = 2 + (i % 3);
    water.circle(x, y, radius);
    water.stroke({ width: 1, color: WATER_COLORS.base, alpha: bubbleAlpha });
  }
  water.rect(0, waterY, width, waterHeight);
  water.stroke({ width: 3, color: WATER_COLORS.outline, alpha: 1.0 }); // Cyan outline

  // Extend water fill to bottom of viewport (visual-only)
  const waterBottom = waterY + waterHeight;
  if (waterBottom < height) {
    water.rect(0, waterBottom, width, height - waterBottom);
    water.fill({ color: WATER_COLORS.base, alpha: baseAlpha });
  }
}

/**
 * Setup environment layers with 3D perspective
 * Creates pier, wall, water surface, and riverbed layers
 *
 * Layer positions are derived from world coordinates using orthogonal projection:
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
export function setupEnvironmentLayers(container, width, height) {
  if (!container) return null;

  // Create viewport for world-to-screen projection
  const viewport = createViewport(width, height);

  // Get screen bounds for each surface from world coordinates
  // Note: getSurfaceScreenBounds returns {top, bottom} screen Y coordinates
  const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

  // Debug: line at top of walkway Y, projected to riverbed Z
  const walkwayTopAtRiverbed = projectToScreen(
    0,
    WORLD_Y.WALKWAY_BACK,
    WORLD_Z.RIVERBED,
    viewport,
  );
  const walkwayTopLineY = walkwayTopAtRiverbed.y;

  // Walkway: horizontal surface at Z=3, spanning Y from WALKWAY_BACK to WALKWAY_FRONT
  // Per diagram: walkway is extended upward for avatar backdrop
  // This is now purely projection-based - no dependency on other layers
  const walkwayY = walkwayBounds.top;
  const walkwayHeight = walkwayBounds.bottom - walkwayBounds.top;

  // Wall: VERTICAL surface at the near edge (worldY ≈ 0), spanning Z=3 to Z=0
  // Unlike horizontal surfaces, wall has Z height but no Y depth
  // Wall top: where walkway ends (Z=3 at Y=0)
  // Wall bottom: at riverbed level (Z=0 at Y=0)
  // Per diagram: Height = (Z=3 - Z=0) * pixelsPerUnit
  const wallTopScreen = projectToScreen(
    0,
    WORLD_Y.WALL_EDGE,
    WORLD_Z.WALKWAY,
    viewport,
  );
  const wallBottomScreen = projectToScreen(
    0,
    WORLD_Y.WALL_EDGE,
    WORLD_Z.RIVERBED,
    viewport,
  );
  const wallY = wallTopScreen.y;
  const wallHeight = wallBottomScreen.y - wallTopScreen.y;

  // Riverbed: from riverbedBounds.top to riverbedBounds.bottom (worldY 0-6 at Z=0)
  // Per diagram: riverbed is at Z=0, starts BELOW where water starts
  const riverbedY = riverbedBounds.top;
  const riverbedHeight = riverbedBounds.bottom - riverbedBounds.top;

  // Water overlays riverbed (semi-transparent) - from waterBounds.top to waterBounds.bottom
  // Per diagram: water is at Z=1, shifted up relative to riverbed
  const waterY = waterBounds.top;
  const waterHeight = waterBounds.bottom - waterBounds.top;

  const yOffset = 0; // No offset needed, layers fill the screen

  console.log(
    `[ENVIRONMENT] World projection: pixelsPerUnit=${viewport.pixelsPerUnit.toFixed(1)}, screenYOffset=${viewport.screenYOffset.toFixed(0)}`,
  );
  console.log(
    `[ENVIRONMENT] Walkway: ${walkwayY.toFixed(0)}-${(walkwayY + walkwayHeight).toFixed(0)}px (Z=${WORLD_Z.WALKWAY}), Wall: ${wallY.toFixed(0)}-${(wallY + wallHeight).toFixed(0)}px, Water: ${waterY.toFixed(0)}-${(waterY + waterHeight).toFixed(0)}px (Z=${WORLD_Z.WATER_SURFACE}), Riverbed: ${riverbedY.toFixed(0)}-${(riverbedY + riverbedHeight).toFixed(0)}px (Z=${WORLD_Z.RIVERBED})`,
  );
  console.log(
    `[ENVIRONMENT] Walkway top at Z=0: ${walkwayTopLineY.toFixed(0)}px`,
  );

  // ==========================================================================
  // RENDER ORDER (per diagram.svg):
  // 1. Walkway (backdrop, behind everything)
  // 2. Avatar (on walkway) - handled separately
  // 3. Wall Face (connects walkway to water)
  // 4. Riverbed (at Z=0)
  // 5. Items on riverbed - handled separately
  // 6. Water Surface (semi-transparent, overlays riverbed)
  // 7. Magnet (dynamic based on Z position) - handled separately
  // ==========================================================================

  // Layer 1: Pier/Walkway (drawn first, at back)
  const pier = new PIXI.Graphics();
  // Base fill - DEBUG: Bright magenta/pink for visibility
  pier.rect(0, walkwayY, width, walkwayHeight);
  pier.fill({ color: 0xff00ff, alpha: 0.7 }); // Magenta walkway
  // Horizontal wood plank lines
  for (let y = walkwayY + 12; y < walkwayY + walkwayHeight; y += 12) {
    pier.moveTo(0, y);
    pier.lineTo(width, y);
    pier.stroke({ width: 2, color: 0xcc00cc, alpha: 0.6 });
  }
  // Wood grain vertical lines
  for (let x = 0; x < width; x += 60) {
    for (let y = walkwayY; y < walkwayY + walkwayHeight; y += 3) {
      const offset = Math.random() * 2 - 1;
      pier.moveTo(x + offset, y);
      pier.lineTo(x + offset, y + 2);
      pier.stroke({ width: 1, color: 0xcc00cc, alpha: 0.2 });
    }
  }
  pier.rect(0, walkwayY, width, walkwayHeight);
  pier.stroke({ width: 3, color: 0xff00ff, alpha: 1.0 }); // Magenta outline
  container.addChild(pier);

  // Debug: stick figure at walkway edge (cast origin at chest)
  const stickMan = new PIXI.Graphics();
  const headWorld = { x: 0, y: WORLD_Y.AVATAR, z: WORLD_Z.AVATAR_HAND + 0.6 };
  const chestWorld = { x: 0, y: WORLD_Y.AVATAR, z: WORLD_Z.AVATAR_HAND };
  const waistWorld = { x: 0, y: WORLD_Y.AVATAR, z: WORLD_Z.WALKWAY + 0.6 };
  const footWorld = { x: 0, y: WORLD_Y.AVATAR, z: WORLD_Z.WALKWAY };

  const headScreen = projectToScreen(
    headWorld.x,
    headWorld.y,
    headWorld.z,
    viewport,
  );
  const chestScreen = projectToScreen(
    chestWorld.x,
    chestWorld.y,
    chestWorld.z,
    viewport,
  );
  const waistScreen = projectToScreen(
    waistWorld.x,
    waistWorld.y,
    waistWorld.z,
    viewport,
  );
  const footScreen = projectToScreen(
    footWorld.x,
    footWorld.y,
    footWorld.z,
    viewport,
  );

  stickMan.circle(headScreen.x, headScreen.y, 6).stroke({
    width: 2,
    color: 0xffffff,
    alpha: 0.9,
  });
  stickMan.moveTo(headScreen.x, chestScreen.y);
  stickMan.lineTo(waistScreen.x, waistScreen.y);
  stickMan.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
  stickMan.moveTo(chestScreen.x - 6, chestScreen.y + 6);
  stickMan.lineTo(chestScreen.x + 6, chestScreen.y + 6);
  stickMan.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
  stickMan.moveTo(waistScreen.x, waistScreen.y);
  stickMan.lineTo(footScreen.x - 6, footScreen.y + 8);
  stickMan.moveTo(waistScreen.x, waistScreen.y);
  stickMan.lineTo(footScreen.x + 6, footScreen.y + 8);
  stickMan.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });

  // Cast origin marker at chest
  stickMan.circle(chestScreen.x, chestScreen.y, 3).fill({
    color: 0xffd700,
    alpha: 0.9,
  });
  container.addChild(stickMan);

  // Debug line: walkway top projected to riverbed (Z=0)
  const walkwayTopLine = new PIXI.Graphics();
  walkwayTopLine.moveTo(0, walkwayTopLineY);
  walkwayTopLine.lineTo(width, walkwayTopLineY);
  walkwayTopLine.stroke({ width: 2, color: 0x00c2ff, alpha: 0.9 });
  container.addChild(walkwayTopLine);

  // Layer 2: Avatar would be added here (handled separately by PixiApp)

  // Layer 3: River Wall (connects walkway to water/riverbed)
  const wall = new PIXI.Graphics();
  // Base fill - DEBUG: Bright orange for visibility
  wall.rect(0, wallY, width, wallHeight);
  wall.fill({ color: 0xff8800, alpha: 0.7 }); // Orange wall
  // Brick pattern - horizontal lines
  for (let y = wallY; y < wallY + wallHeight; y += 12) {
    wall.moveTo(0, y);
    wall.lineTo(width, y);
    wall.stroke({ width: 1, color: 0xcc6600, alpha: 0.4 });
  }
  // Brick pattern - vertical lines (offset every other row)
  for (let y = wallY; y < wallY + wallHeight; y += 24) {
    const offset = ((y - wallY) / 12) % 2 === 0 ? 0 : 20;
    for (let x = offset; x < width; x += 40) {
      wall.moveTo(x, y);
      wall.lineTo(x, Math.min(y + 12, wallY + wallHeight));
      wall.stroke({ width: 1, color: 0xcc6600, alpha: 0.3 });
    }
  }
  wall.rect(0, wallY, width, wallHeight);
  wall.stroke({ width: 3, color: 0xff8800, alpha: 1.0 }); // Orange outline
  container.addChild(wall);

  // Layer 4: Riverbed (at Z=0, behind water)
  const riverbed = new PIXI.Graphics();
  // Base fill - DEBUG: Bright yellow for visibility
  riverbed.rect(0, riverbedY, width, riverbedHeight);
  riverbed.fill({ color: 0xffff00, alpha: 0.7 }); // Yellow riverbed
  // Diagonal stripe pattern
  for (let x = -riverbedHeight; x < width + riverbedHeight; x += 15) {
    riverbed.moveTo(x, riverbedY);
    riverbed.lineTo(x + riverbedHeight, riverbedY + riverbedHeight);
    riverbed.stroke({ width: 1, color: 0xcccc00, alpha: 0.5 });
  }
  // Horizontal dots pattern
  for (let x = 10; x < width; x += 20) {
    for (let y = riverbedY + 10; y < riverbedY + riverbedHeight; y += 15) {
      riverbed.circle(x, y, 2);
      riverbed.fill({ color: 0xcccc00, alpha: 0.6 });
    }
  }
  riverbed.rect(0, riverbedY, width, riverbedHeight);
  riverbed.stroke({ width: 3, color: 0xffff00, alpha: 1.0 }); // Yellow outline
  container.addChild(riverbed);

  // Layer 5: Items on riverbed would be added here (handled separately)

  // Layer 6: Water Surface (semi-transparent, overlays riverbed)
  const water = new PIXI.Graphics();
  drawWaterSurface(water, { width, height, waterY, waterHeight, opaque: false });
  container.addChild(water);

  // Layer 7: Magnet would be added here with dynamic Z-based ordering (handled separately)

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
    `[ENVIRONMENT] Created 3D environment layers using world constants (Walkway Z=${WORLD_Z.WALKWAY}, Water Z=${WORLD_Z.WATER_SURFACE}, Riverbed Z=${WORLD_Z.RIVERBED})`,
  );

  return {
    riverbed,
    wall,
    water,
    pier,
    gridLines,
    yOffset,
    viewport,
    waterSurface: { y: waterY, height: waterHeight },
  };
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
 * Quadrants only cover the riverbed area (where items can spawn)
 * Uses world constants to determine riverbed screen bounds
 */
export function drawQuadrantGrid(app) {
  if (!app) return;

  // Create viewport for world-to-screen projection
  const viewport = createViewport(app.screen.width, app.screen.height);

  // Get riverbed screen bounds from world coordinates
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

  // Quadrants cover the riverbed area (worldY 0-6 at Z=0)
  // Per diagram: riverbed is from riverbedBounds.top to riverbedBounds.bottom
  const riverbedStartY = riverbedBounds.top;
  const riverbedHeight = riverbedBounds.bottom - riverbedBounds.top;
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
    `[QUADRANTS] Grid: Y ${riverbedStartY.toFixed(0)}-${(riverbedStartY + riverbedHeight).toFixed(0)}px, same as riverbed visual`,
  );
}
