/**
 * Sprite Loader
 * Loads and manages sprite sheets from Aseprite exports
 */

import * as PIXI from "pixi.js";

/**
 * Load a sprite sheet and return the textures
 * @param {string} spriteSheetPath - Path to the sprite sheet PNG (e.g., '/sprites/water.png')
 * @param {string} jsonPath - Path to the Aseprite JSON file (e.g., '/sprites/water.json')
 * @returns {Promise<PIXI.Spritesheet>}
 */
export async function loadSpriteSheet(spriteSheetPath, jsonPath) {
  try {
    // Load the JSON data
    const response = await fetch(jsonPath);
    const data = await response.json();

    // Create texture from image
    const texture = await PIXI.Assets.load(spriteSheetPath);

    // Set texture to nearest-neighbor for crisp pixel art (no smoothing)
    texture.source.scaleMode = "nearest";

    // Convert Aseprite JSON to PixiJS Spritesheet format
    const spriteSheetData = convertAsepriteToPixi(data, texture);

    // Create and parse the spritesheet
    const spritesheet = new PIXI.Spritesheet(texture, spriteSheetData);
    await spritesheet.parse();

    return spritesheet;
  } catch (error) {
    console.error("Error loading sprite sheet:", error);
    throw error;
  }
}

/**
 * Convert Aseprite JSON format to PixiJS Spritesheet format
 * @param {Object} asepriteData - Aseprite JSON export data
 * @param {PIXI.Texture} texture - The loaded texture
 * @returns {Object} PixiJS spritesheet data
 */
function convertAsepriteToPixi(asepriteData, texture) {
  const frames = {};
  const animations = {};

  // Aseprite exports frames as an array or object
  const frameList = Array.isArray(asepriteData.frames)
    ? asepriteData.frames
    : Object.values(asepriteData.frames);

  // Convert each frame
  frameList.forEach((frame, index) => {
    const frameName = `frame${index}`;
    frames[frameName] = {
      frame: frame.frame,
      sourceSize: frame.sourceSize || frame.spriteSourceSize,
      spriteSourceSize: frame.spriteSourceSize || frame.frame,
    };
  });

  // Create default animation with all frames
  animations.default = Object.keys(frames);

  return {
    frames,
    animations,
    meta: {
      scale: "1",
      image: texture.source.label,
    },
  };
}

/**
 * Create an animated sprite from a sprite sheet
 * @param {PIXI.Spritesheet} spritesheet - Loaded spritesheet
 * @param {string} animationName - Name of the animation (default: 'default')
 * @param {number} speed - Animation speed (default: 0.1)
 * @returns {PIXI.AnimatedSprite}
 */
export function createAnimatedSprite(
  spritesheet,
  animationName = "default",
  speed = 0.1,
) {
  const textures = spritesheet.animations[animationName];
  const sprite = new PIXI.AnimatedSprite(textures);
  sprite.animationSpeed = speed;
  sprite.play();
  return sprite;
}

/**
 * Create a tiled background from an animated sprite
 * @param {PIXI.Container} container - Container to add tiles to
 * @param {PIXI.Spritesheet} spritesheet - Loaded spritesheet
 * @param {number} width - Width of the area to fill
 * @param {number} height - Height of the area to fill
 * @param {number} tileWidth - Width of each tile
 * @param {number} tileHeight - Height of each tile
 * @param {number} speed - Animation speed
 * @param {number} scale - Scale factor for tiles (default: 1)
 * @returns {PIXI.AnimatedSprite[]} Array of created tiles
 */
export function createTiledBackground(
  container,
  spritesheet,
  width,
  height,
  tileWidth,
  tileHeight,
  speed = 0.1,
  scale = 1,
) {
  const tiles = [];
  const scaledTileWidth = tileWidth * scale;
  const scaledTileHeight = tileHeight * scale;

  for (let y = 0; y < height; y += scaledTileHeight) {
    for (let x = 0; x < width; x += scaledTileWidth) {
      const tile = createAnimatedSprite(spritesheet, "default", speed);
      tile.x = x;
      tile.y = y;
      tile.scale.set(scale);

      // All tiles start synchronized at frame 0
      // (Remove randomization for seamless tiled animation)

      container.addChild(tile);
      tiles.push(tile);
    }
  }

  return tiles;
}
