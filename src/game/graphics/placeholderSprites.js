/**
 * Placeholder Sprite Generator
 * Creates simple pixel-art style graphics using PixiJS Graphics API
 * for testing game mechanics before real assets are created
 */

import * as PIXI from "pixi.js";

/**
 * Create a simple fish sprite
 * @param {string} category - Item category for color variation
 * @returns {PIXI.Graphics}
 */
function createFish(category) {
  const graphics = new PIXI.Graphics();

  // Color based on category
  const colorMap = {
    "common-fish": 0x6b9bd1, // blue
    "valuable-fish": 0xffd700, // gold
    "rare-fish": 0xff69b4, // pink
  };
  const bodyColor = colorMap[category] || 0x6b9bd1;

  // Body
  graphics.ellipse(8, 6, 8, 4).fill(bodyColor);

  // Tail
  graphics.moveTo(0, 6);
  graphics.lineTo(4, 2);
  graphics.lineTo(4, 10);
  graphics.lineTo(0, 6);
  graphics.fill(bodyColor);

  // Eye
  graphics.circle(12, 5, 1.5).fill(0x000000);

  // Outline for pixel art look
  graphics.ellipse(8, 6, 8, 4).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a boot sprite
 * @returns {PIXI.Graphics}
 */
function createBoot() {
  const graphics = new PIXI.Graphics();

  // Boot body (brown)
  graphics.rect(2, 2, 8, 10).fill(0x654321);

  // Boot sole (darker)
  graphics.rect(0, 10, 12, 3).fill(0x3d2817);

  // Laces (lighter)
  graphics.rect(3, 3, 1, 6).fill(0x8b6f47);
  graphics.rect(6, 3, 1, 6).fill(0x8b6f47);

  // Outline
  graphics.rect(2, 2, 8, 10).stroke({ width: 1, color: 0x000000 });
  graphics.rect(0, 10, 12, 3).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a can sprite
 * @returns {PIXI.Graphics}
 */
function createCan() {
  const graphics = new PIXI.Graphics();

  // Can body (red - soda can)
  graphics.rect(3, 1, 8, 12).fill(0xe74c3c);

  // Top (silver)
  graphics.ellipse(7, 1, 4, 2).fill(0xc0c0c0);

  // Label stripe (white)
  graphics.rect(3, 6, 8, 2).fill(0xffffff);

  // Outline
  graphics.rect(3, 1, 8, 12).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a tire sprite
 * @returns {PIXI.Graphics}
 */
function createTire() {
  const graphics = new PIXI.Graphics();

  // Outer tire (black)
  graphics.circle(8, 8, 7).fill(0x2c3e50);

  // Inner hole (gray)
  graphics.circle(8, 8, 4).fill(0x7f8c8d);

  // Tread marks
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const x1 = 8 + Math.cos(angle) * 5;
    const y1 = 8 + Math.sin(angle) * 5;
    const x2 = 8 + Math.cos(angle) * 7;
    const y2 = 8 + Math.sin(angle) * 7;
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({ width: 1, color: 0x000000 });
  }

  // Outline
  graphics.circle(8, 8, 7).stroke({ width: 1, color: 0x000000 });
  graphics.circle(8, 8, 4).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a bicycle sprite (unused for now, reserved for future items)
 * @returns {PIXI.Graphics}
 */
// eslint-disable-next-line no-unused-vars
function createBicycle() {
  const graphics = new PIXI.Graphics();

  // Frame (gray)
  graphics.moveTo(4, 8);
  graphics.lineTo(10, 4);
  graphics.lineTo(16, 8);
  graphics.stroke({ width: 2, color: 0x95a5a6 });

  // Front wheel
  graphics.circle(4, 10, 3).stroke({ width: 1.5, color: 0x2c3e50 });

  // Back wheel
  graphics.circle(16, 10, 3).stroke({ width: 1.5, color: 0x2c3e50 });

  // Handlebars
  graphics.moveTo(10, 4);
  graphics.lineTo(10, 2);
  graphics.stroke({ width: 1.5, color: 0x95a5a6 });

  return graphics;
}

/**
 * Create a safe/treasure box sprite
 * @returns {PIXI.Graphics}
 */
function createSafe() {
  const graphics = new PIXI.Graphics();

  // Box body (dark gray)
  graphics.rect(2, 2, 12, 10).fill(0x34495e);

  // Lock/dial (gold)
  graphics.circle(8, 7, 2.5).fill(0xf39c12);

  // Hinges (silver)
  graphics.rect(2, 3, 1, 2).fill(0xbdc3c7);
  graphics.rect(2, 9, 1, 2).fill(0xbdc3c7);

  // Outline
  graphics.rect(2, 2, 12, 10).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a bottle sprite
 * @returns {PIXI.Graphics}
 */
function createBottle() {
  const graphics = new PIXI.Graphics();

  // Bottle body (green glass)
  graphics.rect(4, 4, 6, 10).fill(0x27ae60);

  // Neck
  graphics.rect(5, 1, 4, 4).fill(0x27ae60);

  // Cap (brown)
  graphics.rect(5, 0, 4, 2).fill(0x8b6f47);

  // Outline
  graphics.rect(4, 4, 6, 10).stroke({ width: 1, color: 0x000000 });
  graphics.rect(5, 1, 4, 4).stroke({ width: 1, color: 0x000000 });

  return graphics;
}

/**
 * Create a placeholder sprite based on item category
 * @param {string} category - Item category from itemDatabase
 * @returns {PIXI.Graphics}
 */
export function createPlaceholderSprite(category) {
  switch (category) {
    case "common-fish":
    case "valuable-fish":
    case "rare-fish":
      return createFish(category);

    case "common-junk": {
      // Random junk items
      const junkTypes = [createCan, createBottle];
      return junkTypes[Math.floor(Math.random() * junkTypes.length)]();
    }

    case "large-junk":
      return createTire();

    case "valuable-junk":
      return createBoot();

    case "treasure":
      return createSafe();

    default: {
      // Generic item (gray square)
      const graphics = new PIXI.Graphics();
      graphics.rect(0, 0, 12, 12).fill(0x95a5a6);
      graphics.rect(0, 0, 12, 12).stroke({ width: 1, color: 0x000000 });
      return graphics;
    }
  }
}

/**
 * Create a magnet sprite
 * @returns {PIXI.Graphics}
 */
export function createMagnetSprite() {
  const graphics = new PIXI.Graphics();

  // Horseshoe shape (classic magnet)
  // Left side (red)
  graphics.rect(0, 0, 3, 10).fill(0xe74c3c);

  // Right side (blue)
  graphics.rect(9, 0, 3, 10).fill(0x3498db);

  // Bottom connector (gray)
  graphics.rect(3, 8, 6, 2).fill(0x7f8c8d);

  // Outline
  graphics.rect(0, 0, 3, 10).stroke({ width: 1, color: 0x000000 });
  graphics.rect(9, 0, 3, 10).stroke({ width: 1, color: 0x000000 });
  graphics.rect(3, 8, 6, 2).stroke({ width: 1, color: 0x000000 });

  return graphics;
}
