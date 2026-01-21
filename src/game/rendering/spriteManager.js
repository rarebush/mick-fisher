/**
 * Sprite Manager
 * Handles creation, positioning, and cleanup of item and magnet sprites during drag
 */

import {
  createPlaceholderSprite,
  createMagnetSprite,
} from "../graphics/placeholderSprites.js";

export class SpriteManager {
  constructor(app) {
    this.app = app;
    this.itemSprite = null;
    this.magnetSprite = null;
  }

  /**
   * Update sprite positions during drag phase (called by ticker)
   */
  updateSprites(item, itemPos) {
    if (!this.app || !itemPos) return;

    // Create item sprite if needed
    if (!this.itemSprite && item) {
      this.itemSprite = createPlaceholderSprite(item.category);
      this.itemSprite.scale.set(2); // Make it bigger for visibility
      this.app.stage.addChild(this.itemSprite);
    }

    // Create magnet sprite if needed
    if (!this.magnetSprite) {
      this.magnetSprite = createMagnetSprite();
      this.magnetSprite.scale.set(2);
      this.app.stage.addChild(this.magnetSprite);
    }

    // Update positions
    if (this.itemSprite) {
      this.itemSprite.x = itemPos.x - this.itemSprite.width / 2;
      this.itemSprite.y = itemPos.y - this.itemSprite.height / 2;
    }

    if (this.magnetSprite) {
      // Magnet positioned above the item
      this.magnetSprite.x = itemPos.x - this.magnetSprite.width / 2;
      this.magnetSprite.y = itemPos.y - this.magnetSprite.height - 5;
    }
  }

  /**
   * Remove item and magnet sprites
   */
  clearSprites() {
    if (this.itemSprite) {
      if (this.itemSprite.parent) {
        this.app.stage.removeChild(this.itemSprite);
      }
      this.itemSprite.destroy();
      this.itemSprite = null;
    }

    if (this.magnetSprite) {
      if (this.magnetSprite.parent) {
        this.app.stage.removeChild(this.magnetSprite);
      }
      this.magnetSprite.destroy();
      this.magnetSprite = null;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.clearSprites();
    this.app = null;
  }
}
