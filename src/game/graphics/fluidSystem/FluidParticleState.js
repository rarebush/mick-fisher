/**
 * FluidParticleState.js
 * Manages particle position and velocity state.
 * Handles particle advection through the velocity field.
 *
 * Initially uses CPU-based particle updates.
 * Can be extended to GPU-based texture updates for better performance.
 */

import { WORLD_X, WORLD_Y } from "../../mechanics/worldDimensions.js";

export class FluidParticleState {
  /**
   * @param {Object} config
   * @param {number} config.maxParticles - Maximum number of particles
   */
  constructor(config) {
    this.maxParticles = config.maxParticles;
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

    if (!Number.isFinite(particle.x) || !Number.isFinite(particle.y)) {
      this._resetParticle(particle);
      return;
    }

    // Get velocity at particle position
    const velocity = this._sampleVelocity(
      particle.x,
      particle.y,
      velocityField,
    );

    // Calculate new position
    const newX = particle.x + velocity.vx * deltaTime;
    const newY = particle.y + velocity.vy * deltaTime;

    if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
      this._resetParticle(particle);
      return;
    }

    // Check for obstacle collision if boundary texture provided
    if (boundaryTexture) {
      if (boundaryTexture.isObstacle(newX, newY)) {
        this.collisionCount++;

        // Log collisions (throttled)
        const now = Date.now();
        if (now - this.lastCollisionLog > 2000) {
          console.log("[FluidParticle] Collisions:", this.collisionCount);
          this.lastCollisionLog = now;
        }

        const resolved = this._resolveObstacle(
          newX,
          newY,
          velocityField,
          boundaryTexture,
        );

        if (!resolved) {
          return;
        }

        particle.x = resolved.x;
        particle.y = resolved.y;
      } else {
        particle.x = newX;
        particle.y = newY;
      }
    } else {
      // Debug: Log if no boundary texture is provided
      if (!this._loggedNoBoundary) {
        console.log("[FluidParticle] advectParticle: No boundary texture!");
        this._loggedNoBoundary = true;
      }

      particle.x = newX;
      particle.y = newY;
    }

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

  _resetParticle(particle) {
    const spawnX = this.worldBounds.minX + Math.random() * 0.5;
    const spawnY =
      this.worldBounds.minY +
      Math.random() * (this.worldBounds.maxY - this.worldBounds.minY);

    particle.x = spawnX;
    particle.y = spawnY;
    particle.vx = 0;
    particle.vy = 0;
    particle.age = 0;
  }

  _resolveObstacle(worldX, worldY, velocityField, boundaryTexture) {
    const stepX = velocityField?.width
      ? (this.worldBounds.maxX - this.worldBounds.minX) / velocityField.width
      : 0.05;
    const stepY = velocityField?.height
      ? (this.worldBounds.maxY - this.worldBounds.minY) / velocityField.height
      : 0.05;

    const offsets = [
      [0, stepY],
      [0, -stepY],
      [stepX, 0],
      [-stepX, 0],
      [stepX, stepY],
      [stepX, -stepY],
      [-stepX, stepY],
      [-stepX, -stepY],
    ];

    for (const [dx, dy] of offsets) {
      const candidateX = worldX + dx;
      const candidateY = worldY + dy;

      if (!boundaryTexture.isObstacle(candidateX, candidateY)) {
        return { x: candidateX, y: candidateY };
      }
    }

    return null;
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
    if (velocityField?.sampleVelocity) {
      return velocityField.sampleVelocity(worldX, worldY);
    }

    return {
      vx: velocityField ? velocityField.flowSpeed : 1.0,
      vy: 0.0,
    };
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    // No resources to cleanup yet
    // Future: Destroy GPU textures if using texture-based particle state
  }
}
