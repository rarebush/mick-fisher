/**
 * Sprite Manager
 * Handles creation, positioning, and cleanup of item and magnet sprites during drag
 */

import * as PIXI from "pixi.js";
import {
  createPlaceholderSprite,
  createMagnetSprite,
} from "../graphics/placeholderSprites.js";
import {
  createViewport,
  worldToScreen,
  getWorldDirectionScreenAngle,
  WORLD_Z,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import useMagnetStore from "../state/magnetStore.js";

export class SpriteManager {
  constructor(app, layerContainers = null) {
    this.app = app;
    this.itemSprite = null;
    this.magnetSprite = null;
    this.magnetDebugText = null;
    this.layerContainers = layerContainers;
  }

  /**
   * Update sprite positions during drag phase (called by ticker)
   * @param {Object} item - The item being dragged
   * @param {Object} itemWorld - World position of the item
   */
  updateSprites(item, itemWorld) {
    if (!this.app || !itemWorld) return;

    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const itemScreen = worldToScreen(itemWorld, viewport);

    // Get magnet world position from central store
    const magnetWorld = useMagnetStore.getState().getMagnetWorld();

    const magnetDepth = magnetWorld?.z ?? WORLD_Z.RIVERBED;
    const targetContainer =
      magnetDepth > WORLD_Z.WATER_SURFACE
        ? this.layerContainers?.aboveWater
        : this.layerContainers?.underwater;

    const addToTargetContainer = (sprite) => {
      if (!sprite || !targetContainer) return;
      if (sprite.parent !== targetContainer) {
        if (sprite.parent) {
          sprite.parent.removeChild(sprite);
        }
        targetContainer.addChild(sprite);
      }
    };

    // Create item sprite if needed
    if (!this.itemSprite && item) {
      this.itemSprite = createPlaceholderSprite(item.category);
      this.itemSprite.scale.set(2); // Make it bigger for visibility
      this.itemSprite.pivot.set(
        this.itemSprite.width / 2,
        this.itemSprite.height / 2,
      );
      (targetContainer || this.app.stage).addChild(this.itemSprite);
    }

    // Create magnet sprite if needed
    if (!this.magnetSprite) {
      this.magnetSprite = createMagnetSprite();
      this.magnetSprite.scale.set(2);
      this.magnetSprite.pivot.set(
        this.magnetSprite.width / 2,
        this.magnetSprite.height / 2,
      );
      (targetContainer || this.app.stage).addChild(this.magnetSprite);
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

    addToTargetContainer(this.itemSprite);
    addToTargetContainer(this.magnetSprite);

    // Update positions
    if (this.itemSprite) {
      this.itemSprite.x = itemScreen.x;
      this.itemSprite.y = itemScreen.y;
    }

    if (this.magnetSprite) {
      // Magnet positioned above the item
      this.magnetSprite.x = itemScreen.x;
      this.magnetSprite.y = itemScreen.y - this.magnetSprite.height / 2 - 5;
    }

    if (magnetWorld) {
      const avatarWorld = getAvatarWorldPosition();
      const planeZ = magnetWorld.z ?? WORLD_Z.RIVERBED;
      const orientation = getWorldDirectionScreenAngle(
        magnetWorld,
        avatarWorld,
        planeZ,
        viewport,
      );
      if (this.itemSprite) {
        this.itemSprite.rotation = orientation;
      }
      if (this.magnetSprite) {
        this.magnetSprite.rotation = orientation + Math.PI / 2;
      }
    }

    // Update debug text with world coordinates
    if (this.magnetDebugText && magnetWorld) {
      const peaks = useMagnetStore.getState().getPeakValues();
      const peakX =
        peaks && Math.abs(peaks.maxX) >= Math.abs(peaks.minX)
          ? peaks.maxX
          : peaks?.minX;
      const peakY =
        peaks && Math.abs(peaks.maxY) >= Math.abs(peaks.minY)
          ? peaks.maxY
          : peaks?.minY;
      const peakZ =
        peaks && Math.abs(peaks.maxZ) >= Math.abs(peaks.minZ)
          ? peaks.maxZ
          : peaks?.minZ;
      this.magnetDebugText.text = `Magnet World:\nX: ${magnetWorld.x.toFixed(2)} (peak: ${peakX?.toFixed(2) ?? "n/a"})\nY: ${magnetWorld.y.toFixed(2)} (peak: ${peakY?.toFixed(2) ?? "n/a"})\nZ: ${magnetWorld.z.toFixed(2)} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
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
