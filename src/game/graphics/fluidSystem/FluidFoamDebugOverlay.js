/**
 * FluidFoamDebugOverlay.js
 * Debug visualization overlay for the fluid foam system.
 * Shows particle count, spawn info, and system status.
 */

import * as PIXI from "pixi.js";
import { WORLD_Z } from "../../mechanics/worldDimensions.js";

export class FluidFoamDebugOverlay {
  /**
   * @param {FluidFoamCoordinator} coordinator - Foam coordinator to debug
   * @param {PIXI.Container} parentContainer - Container to add overlay to
   * @param {{screenSize?: {width:number,height:number}, getScreenSize?: Function, worldToScreen?: Function, z?: number}} [options]
   */
  constructor(coordinator, parentContainer, options = {}) {
    this.coordinator = coordinator;
    this.parentContainer = parentContainer;
    this.screenSize = options.screenSize || null;
    this.getScreenSize = options.getScreenSize || null;
    this.worldToScreen = options.worldToScreen || null;
    this.z = Number.isFinite(options.z) ? options.z : WORLD_Z.WATER_SURFACE;

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

    this.shiftZoneGraphics = new PIXI.Graphics();
    this.shiftZoneGraphics.zIndex = 9996;
    parentContainer.addChild(this.shiftZoneGraphics);
    this.shiftZoneLabels = new Map();
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
    const foamVisible =
      this.coordinator.renderer?.displaySprite?.visible ?? "unknown";

    this.debugText.text = `[FLUID FOAM DEBUG]
Active Particles: ${activeCount} / ${maxCount} (${percentage}%)
Flow Speed: ${flowSpeed}
Choppiness: ${choppiness}
Time Since Last Wave: ${timeSinceWave}s / ${nextWave}s
Collision System: ${hasCollision}
Total Collisions: ${collisionCount}
Container Visible: ${foamVisible}`;

    this._drawShiftZones();
  }

  setShiftZones(zones) {
    this.shiftZones = Array.isArray(zones) ? zones : [];
  }

  _updatePosition() {
    const size = this.getScreenSize?.() || this.screenSize;
    const height = size?.height || 0;
    this.debugText.x = 10;
    this.debugText.y = height > 0 ? height - 10 : 10;
  }

  _drawShiftZones() {
    if (!this.worldToScreen) return;

    const zones = Array.isArray(this.shiftZones) ? this.shiftZones : [];
    this.shiftZoneGraphics.clear();

    if (this.shiftZoneLabels) {
      for (const label of this.shiftZoneLabels.values()) {
        if (label) {
          label.visible = false;
        }
      }
    }

    const typeColors = {
      whirlpool: 0x3ad0ff,
      repel: 0xffd166,
      rapid: 0x7cff6b,
    };

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      if (!zone?.position) continue;

      const radiusWorld = Number.isFinite(zone.radiusWorld)
        ? zone.radiusWorld
        : 0.6;
      const color = typeColors[zone.type] ?? 0xffffff;
      const center = this.worldToScreen(
        zone.position.x,
        zone.position.y,
        this.z,
      );
      const points = [];
      const shape = zone.shape;
      if (shape?.type) {
        const size = shape.size || {};
        const rotation = Number.isFinite(shape.rotation) ? shape.rotation : 0;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const sizeX = Number.isFinite(size.x) ? size.x : radiusWorld * 2;
        const sizeY = Number.isFinite(size.y) ? size.y : radiusWorld * 2;
        const halfX = Math.max(0.0001, sizeX / 2);
        const halfY = Math.max(0.0001, sizeY / 2);

        if (shape.type === "circle" || shape.type === "ellipse") {
          const steps = 32;
          for (let step = 0; step <= steps; step += 1) {
            const angle = (step / steps) * Math.PI * 2;
            const localX = Math.cos(angle) * halfX;
            const localY = Math.sin(angle) * halfY;
            const worldX = zone.position.x + localX * cosR - localY * sinR;
            const worldY = zone.position.y + localX * sinR + localY * cosR;
            const screen = this.worldToScreen(worldX, worldY, this.z);
            points.push(screen.x, screen.y);
          }
        } else if (shape.type === "rect" || shape.type === "square") {
          const corners = [
            { x: -halfX, y: -halfY },
            { x: halfX, y: -halfY },
            { x: halfX, y: halfY },
            { x: -halfX, y: halfY },
            { x: -halfX, y: -halfY },
          ];
          for (const corner of corners) {
            const worldX = zone.position.x + corner.x * cosR - corner.y * sinR;
            const worldY = zone.position.y + corner.x * sinR + corner.y * cosR;
            const screen = this.worldToScreen(worldX, worldY, this.z);
            points.push(screen.x, screen.y);
          }
        }
      }

      if (points.length === 0) {
        const steps = 32;
        for (let step = 0; step <= steps; step += 1) {
          const angle = (step / steps) * Math.PI * 2;
          const screen = this.worldToScreen(
            zone.position.x + Math.cos(angle) * radiusWorld,
            zone.position.y + Math.sin(angle) * radiusWorld,
            this.z,
          );
          points.push(screen.x, screen.y);
        }
      }

      this.shiftZoneGraphics
        .poly(points)
        .stroke({ width: 1, color, alpha: 0.7 });
      this.shiftZoneGraphics
        .circle(center.x, center.y, 2)
        .fill({ color, alpha: 0.9 });

      const labelId = zone.id || `${zone.type}-${i}`;
      let label = this.shiftZoneLabels.get(labelId);
      if (!label) {
        label = new PIXI.Text({
          text: zone.type || "zone",
          style: {
            fontFamily: "monospace",
            fontSize: 10,
            fill: color,
            stroke: { color: 0x000000, width: 2 },
          },
        });
        label.anchor.set(0.5, 1.2);
        this.shiftZoneLabels.set(labelId, label);
        this.parentContainer.addChild(label);
      }
      label.x = center.x;
      label.y = center.y;
      label.text = zone.type || "zone";
      label.visible = true;
    }
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

    if (this.shiftZoneGraphics?.parent) {
      this.shiftZoneGraphics.parent.removeChild(this.shiftZoneGraphics);
    }
    if (this.shiftZoneGraphics) {
      this.shiftZoneGraphics.destroy();
      this.shiftZoneGraphics = null;
    }

    if (this.shiftZoneLabels) {
      for (const label of this.shiftZoneLabels.values()) {
        if (label?.parent) {
          label.parent.removeChild(label);
        }
        label?.destroy();
      }
      this.shiftZoneLabels.clear();
    }
  }
}
