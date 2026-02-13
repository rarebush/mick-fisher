/**
 * FluidFoamDebugOverlay.js
 * Debug visualization overlay for the fluid foam system.
 * Shows particle count, spawn info, and system status.
 */

import * as PIXI from "pixi.js";

export class FluidFoamDebugOverlay {
  /**
   * @param {FluidFoamCoordinator} coordinator - Foam coordinator to debug
   * @param {PIXI.Container} parentContainer - Container to add overlay to
   * @param {{screenSize?: {width:number,height:number}, getScreenSize?: Function}} [options]
   */
  constructor(coordinator, parentContainer, options = {}) {
    this.coordinator = coordinator;
    this.parentContainer = parentContainer;
    this.screenSize = options.screenSize || null;
    this.getScreenSize = options.getScreenSize || null;

    // Create debug text
    this.debugText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 14,
        fill: 0xffffff,
        align: "left",
        stroke: { color: 0x000000, width: 3 },
      },
    });

    this.debugText.anchor.set(0, 1);
    this._updatePosition();
    this.debugText.zIndex = 10000; // High z-index to render on top

    parentContainer.addChild(this.debugText);
  }

  /**
   * Update debug display.
   */
  update() {
    if (!this.coordinator) return;

    this._updatePosition();

    const activeCount = this.coordinator.activeParticleCount;
    const maxCount = this.coordinator.config.maxParticles;
    const percentage = ((activeCount / maxCount) * 100).toFixed(1);
    const flowSpeed = this.coordinator.flowSpeed.toFixed(2);
    const choppiness = this.coordinator.choppiness.toFixed(2);
    const timeSinceWave = this.coordinator.timeSinceLastWave.toFixed(2);
    const nextWave = this.coordinator.nextWaveInterval.toFixed(2);
    const collisionCount = this.coordinator.particleState?.collisionCount ?? 0;
    const hasCollision = this.coordinator.boundaryTexture ? "YES" : "NO";

    this.debugText.text = `[FLUID FOAM DEBUG]
Active Particles: ${activeCount} / ${maxCount} (${percentage}%)
Flow Speed: ${flowSpeed}
Choppiness: ${choppiness}
Time Since Last Wave: ${timeSinceWave}s / ${nextWave}s
Collision System: ${hasCollision}
Total Collisions: ${collisionCount}
Container Visible: ${this.coordinator.renderer?.particleContainer?.visible ?? "unknown"}`;
  }

  _updatePosition() {
    const size = this.getScreenSize?.() || this.screenSize;
    const height = size?.height || 0;
    this.debugText.x = 10;
    this.debugText.y = height > 0 ? height - 10 : 10;
  }

  /**
   * Toggle visibility of debug overlay.
   */
  toggle() {
    this.debugText.visible = !this.debugText.visible;
  }

  /**
   * Set visibility of debug overlay.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.debugText.visible = visible;
  }

  /**
   * Cleanup.
   */
  destroy() {
    if (this.debugText.parent) {
      this.debugText.parent.removeChild(this.debugText);
    }
    this.debugText.destroy();
  }
}
