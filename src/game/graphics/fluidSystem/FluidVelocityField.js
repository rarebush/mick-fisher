/**
 * FluidVelocityField.js
 * Manages the 2D velocity field for fluid simulation.
 * Uses PixiJS RenderTextures for GPU-based velocity storage.
 *
 * Initially implements a simple static flow (left to right).
 * Can be extended with Navier-Stokes simulation for dynamic velocity updates.
 */

import * as PIXI from "pixi.js";
import { RenderTexture, Texture } from "pixi.js";
import { WORLD_X, WORLD_Y } from "../../mechanics/worldDimensions.js";

export class FluidVelocityField {
  /**
   * @param {Object} config
   * @param {number} config.width - Velocity grid width in pixels
   * @param {number} config.height - Velocity grid height in pixels
   * @param {import("pixi.js").Renderer} config.renderer - PixiJS renderer
   */
  constructor(config) {
    this.width = config.width;
    this.height = config.height;
    this.renderer = config.renderer;

    // Current flow speed (updated from game state)
    this.flowSpeed = 1.0;

    // World space bounds for coordinate mapping
    this.worldBounds = {
      minX: WORLD_X.MIN,
      maxX: WORLD_X.MAX,
      minY: WORLD_Y.WATER_NEAR,
      maxY: WORLD_Y.WATER_FAR,
    };

    // Create render textures for velocity field (ping-pong buffers)
    // RG channels store velocity: R=vx, G=vy
    this.velocityTextures = {
      read: null,
      write: null,
    };

    this._initializeTextures();
    this._initializeStaticFlow();
  }

  /**
   * Initialize velocity field textures.
   * @private
   */
  _initializeTextures() {
    // Create two textures for ping-pong rendering
    // (Needed for iterative simulation, though initially static)
    this.velocityTextures.read = RenderTexture.create({
      width: this.width,
      height: this.height,
    });

    this.velocityTextures.write = RenderTexture.create({
      width: this.width,
      height: this.height,
    });
  }

  /**
   * Initialize with a static rightward flow.
   * Creates a simple velocity field pointing right (positive X direction).
   * Note: Textures are created but not filled. The CPU-based particle advection
   * doesn't actually sample from these textures yet, so they can remain empty.
   * Future GPU-based implementation will populate these via shader.
   * @private
   */
  _initializeStaticFlow() {
    // For now, velocity field textures are created but empty
    // CPU-based particle advection in FluidParticleState uses a simple
    // static velocity without sampling textures
    // Future GPU implementation will populate textures:
    // - Create canvas with velocity data
    // - Upload to GPU texture
    // - Use in particle advection shader
  }

  /**
   * Update velocity field.
   * Currently static, but can be extended with Navier-Stokes simulation.
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {number} flowSpeed - Flow speed multiplier from game state
   */
  update(deltaTime, flowSpeed) {
    // Update flow speed from game state
    this.flowSpeed = flowSpeed;

    // Static field - no updates needed
    // Future: Add Navier-Stokes solver here
    // - Apply external forces
    // - Advect velocity field
    // - Compute divergence
    // - Solve pressure (Jacobi iterations)
    // - Subtract pressure gradient
    // - Apply boundary conditions
  }

  /**
   * Swap read/write textures (for ping-pong rendering).
   * @private
   */
  _swapTextures() {
    const temp = this.velocityTextures.read;
    this.velocityTextures.read = this.velocityTextures.write;
    this.velocityTextures.write = temp;
  }

  /**
   * Get current velocity texture for sampling.
   * @returns {RenderTexture}
   */
  getVelocityTexture() {
    return this.velocityTextures.read;
  }

  /**
   * Convert world coordinates to UV coordinates [0, 1].
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @returns {{u: number, v: number}}
   */
  worldToUV(worldX, worldY) {
    const u =
      (worldX - this.worldBounds.minX) /
      (this.worldBounds.maxX - this.worldBounds.minX);
    const v =
      (worldY - this.worldBounds.minY) /
      (this.worldBounds.maxY - this.worldBounds.minY);

    return { u, v };
  }

  /**
   * Convert UV coordinates to world coordinates.
   * @param {number} u - U coordinate [0, 1]
   * @param {number} v - V coordinate [0, 1]
   * @returns {{x: number, y: number}}
   */
  uvToWorld(u, v) {
    const x =
      this.worldBounds.minX +
      u * (this.worldBounds.maxX - this.worldBounds.minX);
    const y =
      this.worldBounds.minY +
      v * (this.worldBounds.maxY - this.worldBounds.minY);

    return { x, y };
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    if (this.velocityTextures.read) {
      this.velocityTextures.read.destroy();
    }
    if (this.velocityTextures.write) {
      this.velocityTextures.write.destroy();
    }
    this.velocityTextures = { read: null, write: null };
  }
}
