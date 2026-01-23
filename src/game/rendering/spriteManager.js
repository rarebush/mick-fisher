/**
 * Sprite Manager
 * Handles creation, positioning, and cleanup of item and magnet sprites during drag
 */

import * as PIXI from "pixi.js";
import {
  createPlaceholderSprite,
  createMagnetSprite,
} from "../graphics/placeholderSprites.js";
import useMagnetStore from "../state/magnetStore.js";

export class SpriteManager {
  constructor(app) {
    this.app = app;
    this.itemSprite = null;
    this.magnetSprite = null;
    this.magnetDebugText = null;
  }

  /**
   * Update sprite positions during drag phase (called by ticker)
   * @param {Object} item - The item being dragged
   * @param {Object} itemPos - Screen position of the item
   */
  updateSprites(item, itemPos) {
    if (!this.app || !itemPos) return;

    // Get magnet world position from central store
    const magnetWorld = useMagnetStore.getState().getMagnetWorld();

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

    // Create debug text if needed
    if (!this.magnetDebugText) {
      this.magnetDebugText = new PIXI.Text({
        text: "",
        style: {
          fontFamily: "monospace",
          fontSize: 12,
          fill: 0xffff00,
          stroke: { color: 0x000000, width: 3 },
        },
      });
      this.magnetDebugText.zIndex = 10000;
      this.app.stage.addChild(this.magnetDebugText);
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

    // Update debug text with world coordinates
    if (this.magnetDebugText && magnetWorld) {
      const peaks = useMagnetStore.getState().getPeakValues();
      this.magnetDebugText.text = `Magnet World:\nX: ${magnetWorld.x.toFixed(2)} (max: ${peaks.maxX.toFixed(2)})\nY: ${magnetWorld.y.toFixed(2)} (max: ${peaks.maxY.toFixed(2)})\nZ: ${magnetWorld.z.toFixed(2)} (max: ${peaks.maxZ.toFixed(2)})`;
      // Position debug text static in bottom-left corner
      this.magnetDebugText.x = 10;
      this.magnetDebugText.y = this.app.screen.height - 80;
      this.magnetDebugText.visible = true;
    } else if (this.magnetDebugText) {
      this.magnetDebugText.visible = false;
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

    if (this.magnetDebugText) {
      if (this.magnetDebugText.parent) {
        this.app.stage.removeChild(this.magnetDebugText);
      }
      this.magnetDebugText.destroy();
      this.magnetDebugText = null;
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
