/**
 * FluidParticleState.js
 * Manages particle position and velocity state.
 * Handles particle advection through the velocity field.
 *
 * Initially uses CPU-based particle updates.
 * Can be extended to GPU-based texture updates for better performance.
 */

import { WORLD_X, WORLD_Y, WORLD_Z } from "../../mechanics/worldDimensions.js";

export class FluidParticleState {
  /**
   * @param {Object} config
   * @param {number} config.maxParticles - Maximum number of particles
   * @param {Function} config.worldToScreen - Function to convert world coords to screen coords
   */
  constructor(config) {
    this.maxParticles = config.maxParticles;
    this.worldToScreen = config.worldToScreen;
    this.collisionCount = 0; // Debug: Track collision events
    this.lastCollisionLog = 0; // Throttle collision logging

    // World space bounds for wrapping
    this.worldBounds = {
      minX: WORLD_X.MIN,
      maxX: WORLD_X.MAX,
      minY: WORLD_Y.WATER_NEAR,
      maxY: WORLD_Y.WATER_FAR,
    };
  }

  /**
   * Update particle positions via advection through velocity field.
   * Uses semi-Lagrangian advection (trace backward, sample velocity).
   *
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {FluidVelocityField} velocityField - Velocity field to advect through
   * @param {Array<Object>} particles - Array of particles to update
   * @param {FluidBoundaryTexture} boundaryTexture - Optional boundary texture for collision
   */
  update(deltaTime, velocityField, particles, boundaryTexture = null) {
    // Debug: Log boundary status once
    if (!this._loggedBoundaryCheck) {
      console.log(
        "[FluidParticle] Boundary:",
        boundaryTexture
          ? "EXISTS (pixelData=" + !!boundaryTexture?.pixelData + ")"
          : "NULL",
      );
      this._loggedBoundaryCheck = true;
    }

    // Advect each active particle through velocity field
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].active) {
        this.advectParticle(
          particles[i],
          deltaTime,
          velocityField,
          boundaryTexture,
        );
      }
    }
  }

  /**
   * Advect a single particle through the velocity field.
   * Uses simple Euler integration with bilinear velocity sampling.
   *
   * @param {Object} particle - Particle to update
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {FluidVelocityField} velocityField - Velocity field
   * @param {FluidBoundaryTexture} boundaryTexture - Optional boundary texture for collision
   */
  advectParticle(particle, deltaTime, velocityField, boundaryTexture = null) {
    if (!particle.active) return;

    // Get velocity at particle position
    const velocity = this._sampleVelocity(
      particle.x,
      particle.y,
      velocityField,
    );

    // Calculate new position
    const newX = particle.x + velocity.vx * deltaTime;
    const newY = particle.y + velocity.vy * deltaTime;

    // Check for obstacle collision if boundary texture provided
    if (boundaryTexture) {
      // Convert new world position to screen position for collision check
      const screenPos = this.worldToScreen(newX, newY, WORLD_Z.WATER_SURFACE);

      if (boundaryTexture.isObstacle(screenPos.x, screenPos.y)) {
        // Bounce: reverse velocity and stay at current position
        particle.vx = -velocity.vx * 0.5; // Dampen bounce
        particle.vy = -velocity.vy * 0.5;

        this.collisionCount++;

        // Log collisions (throttled)
        const now = Date.now();
        if (now - this.lastCollisionLog > 2000) {
          console.log("[FluidParticle] Collisions:", this.collisionCount);
          this.lastCollisionLog = now;
        }

        return; // Don't update position
      }
    } else {
      // Debug: Log if no boundary texture is provided
      if (!this._loggedNoBoundary) {
        console.log("[FluidParticle] advectParticle: No boundary texture!");
        this._loggedNoBoundary = true;
      }
    }

    // Update particle position
    particle.x = newX;
    particle.y = newY;

    // Apply horizontal wrapping (left bank to right bank)
    if (particle.x > this.worldBounds.maxX) {
      particle.x = this.worldBounds.minX + (particle.x - this.worldBounds.maxX);
    } else if (particle.x < this.worldBounds.minX) {
      particle.x = this.worldBounds.maxX - (this.worldBounds.minX - particle.x);
    }

    // Clamp vertical position (no wrapping in Y)
    if (particle.y < this.worldBounds.minY) {
      particle.y = this.worldBounds.minY;
      particle.vy = Math.abs(particle.vy); // Bounce
    } else if (particle.y > this.worldBounds.maxY) {
      particle.y = this.worldBounds.maxY;
      particle.vy = -Math.abs(particle.vy); // Bounce
    }
  }

  /**
   * Sample velocity from velocity field at world position.
   * Uses bilinear interpolation for smooth velocity.
   *
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @param {FluidVelocityField} velocityField - Velocity field
   * @returns {{vx: number, vy: number}}
   * @private
   */
  _sampleVelocity(worldX, worldY, velocityField) {
    // For now, return static flow using current flow speed from velocity field
    // Future: Sample from velocity texture with bilinear interpolation

    // Static rightward flow scaled by current flow speed
    return {
      vx: velocityField ? velocityField.flowSpeed : 1.0, // World units per second
      vy: 0.0,
    };

    // Future GPU texture sampling implementation:
    // const uv = velocityField.worldToUV(worldX, worldY);
    // const pixel = sampleTextureBilinear(velocityField.getVelocityTexture(), uv);
    // const vx = (pixel.r / 255.0) * 4.0 - 2.0; // Denormalize from [0,255] to [-2,2]
    // const vy = (pixel.g / 255.0) * 4.0 - 2.0;
    // return { vx, vy };
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    // No resources to cleanup yet
    // Future: Destroy GPU textures if using texture-based particle state
  }
}
