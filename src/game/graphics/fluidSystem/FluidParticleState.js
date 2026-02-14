/**
 * FluidParticleState.js
 * Manages particle position and velocity state.
 * Handles particle advection using particle velocity + drift.
 *
 * Uses CPU-based particle updates.
 * Can be extended to texture-backed updates if needed.
 */

import { WORLD_X, WORLD_Y } from "../../mechanics/worldDimensions.js";

export class FluidParticleState {
  /**
   * @param {Object} config
   * @param {number} config.maxParticles - Maximum number of particles
   * @param {number} [config.spawnBufferX] - Extra world-space units to extend leftward
   */
  constructor(config) {
    this.maxParticles = config.maxParticles;
    this.spawnBufferX = Number.isFinite(config.spawnBufferX)
      ? config.spawnBufferX
      : 0;
    this.spawnInMainArea = Boolean(config.spawnInMainArea);
    this.useParticleVelocity = Boolean(config.useParticleVelocity);
    this.velocityDamping = Number.isFinite(config.velocityDamping)
      ? config.velocityDamping
      : 0.9;
    this.driftVelocityX = Number.isFinite(config.driftVelocityX)
      ? config.driftVelocityX
      : 0.0;
    this.driftVelocityY = Number.isFinite(config.driftVelocityY)
      ? config.driftVelocityY
      : 0.0;
    this.killOutOfBounds = Boolean(config.killOutOfBounds);
    this.collisionCount = 0; // Debug: Track collision events
    this.lastCollisionLog = 0; // Throttle collision logging

    // World space bounds for wrapping
    this.worldBounds = {
      minX: WORLD_X.MIN - this.spawnBufferX,
      maxX: WORLD_X.MAX,
      minY: WORLD_Y.WATER_NEAR,
      maxY: WORLD_Y.WATER_FAR,
    };
  }

  /**
   * Update particle positions via advection using particle velocity + drift.
   *
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {Array<Object>} particles - Array of particles to update
   * @param {FluidBoundaryTexture} boundaryTexture - Optional boundary texture for collision
   */
  update(deltaTime, particles, boundaryTexture = null) {
    // Debug: Log boundary status once

    // Advect each active particle using particle velocity + drift
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].active) {
        this.advectParticle(particles[i], deltaTime, boundaryTexture);
      }
    }
  }

  /**
   * Advect a single particle using simple Euler integration.
   *
   * @param {Object} particle - Particle to update
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {FluidBoundaryTexture} boundaryTexture - Optional boundary texture for collision
   */
  advectParticle(particle, deltaTime, boundaryTexture = null) {
    if (!particle.active) return;

    const safeDeltaTime = Math.min(Math.max(deltaTime, 0), 1 / 30);

    if (!Number.isFinite(particle.x) || !Number.isFinite(particle.y)) {
      this._resetParticle(particle);
      return;
    }

    // Get velocity at particle position
    const velocity = this.useParticleVelocity
      ? {
          vx: (particle.vx || 0) + this.driftVelocityX,
          vy: (particle.vy || 0) + this.driftVelocityY,
        }
      : {
          vx: this.driftVelocityX,
          vy: this.driftVelocityY,
        };

    // Calculate new position
    const newX = particle.x + velocity.vx * safeDeltaTime;
    const newY = particle.y + velocity.vy * safeDeltaTime;

    if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
      this._resetParticle(particle);
      return;
    }

    // Check for obstacle collision if boundary texture provided
    if (boundaryTexture) {
      if (boundaryTexture.isObstacle(newX, newY)) {
        this.collisionCount++;
        const { stepX, stepY } = this._getCollisionStep();
        const normal = this._estimateObstacleNormal(
          newX,
          newY,
          stepX,
          stepY,
          boundaryTexture,
        );
        if (normal) {
          const dot = velocity.vx * normal.nx + velocity.vy * normal.ny;
          const slideVx = velocity.vx - dot * normal.nx;
          const slideVy = velocity.vy - dot * normal.ny;
          const origSpeed = Math.hypot(velocity.vx, velocity.vy);
          let slideSpeed = Math.hypot(slideVx, slideVy);
          let cappedSlideVx = slideVx;
          let cappedSlideVy = slideVy;
          if (origSpeed > 0 && slideSpeed > origSpeed) {
            const scale = origSpeed / slideSpeed;
            cappedSlideVx *= scale;
            cappedSlideVy *= scale;
            slideSpeed = origSpeed;
          }
          const slideDamping = 0.5;
          const dampedSlideVx = cappedSlideVx * slideDamping;
          const dampedSlideVy = cappedSlideVy * slideDamping;
          const slideX = particle.x + dampedSlideVx * safeDeltaTime;
          const slideY = particle.y + dampedSlideVy * safeDeltaTime;

          if (
            Number.isFinite(slideX) &&
            Number.isFinite(slideY) &&
            !boundaryTexture.isObstacle(slideX, slideY)
          ) {
            particle.x = slideX;
            particle.y = slideY;
            if (this.useParticleVelocity) {
              particle.vx = dampedSlideVx;
              particle.vy = dampedSlideVy;
            }
          } else {
            const resolved = this._resolveObstacle(newX, newY, boundaryTexture);

            if (!resolved) {
              return;
            }

            particle.x = resolved.x;
            particle.y = resolved.y;
            if (this.useParticleVelocity && normal) {
              particle.vx = dampedSlideVx;
              particle.vy = dampedSlideVy;
            }
          }
        } else {
          const resolved = this._resolveObstacle(newX, newY, boundaryTexture);

          if (!resolved) {
            return;
          }

          particle.x = resolved.x;
          particle.y = resolved.y;
        }
      } else {
        particle.x = newX;
        particle.y = newY;
      }
    } else {
      // Debug: Log if no boundary texture is provided

      particle.x = newX;
      particle.y = newY;
    }

    if (this.useParticleVelocity) {
      const damping = Number.isFinite(particle.splashDamping)
        ? particle.splashDamping
        : this.velocityDamping;
      particle.vx *= damping;
      particle.vy *= damping;
      if (Number.isFinite(particle.splashDamping)) {
        const nextDamping =
          particle.splashDamping +
          (this.velocityDamping - particle.splashDamping) * 0.6;
        particle.splashDamping = nextDamping;
        if (Math.abs(nextDamping - this.velocityDamping) < 0.001) {
          particle.splashDamping = null;
        }
      }
    }
    if (!this.killOutOfBounds) {
      // Apply horizontal wrapping (left bank to right bank)
      if (particle.x > this.worldBounds.maxX) {
        particle.x =
          this.worldBounds.minX + (particle.x - this.worldBounds.maxX);
      } else if (particle.x < this.worldBounds.minX) {
        particle.x =
          this.worldBounds.maxX - (this.worldBounds.minX - particle.x);
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
  }

  _resetParticle(particle) {
    const spawnBand = this.spawnInMainArea
      ? Math.max(0.5, WORLD_X.WIDTH)
      : Math.max(0.5, this.spawnBufferX || 0.5);
    const spawnMinX = this.spawnInMainArea
      ? WORLD_X.MIN
      : this.worldBounds.minX;
    const spawnX = spawnMinX + Math.random() * spawnBand;
    const spawnY =
      this.worldBounds.minY +
      Math.random() * (this.worldBounds.maxY - this.worldBounds.minY);

    particle.x = spawnX;
    particle.y = spawnY;
    particle.vx = 0;
    particle.vy = 0;
    particle.age = 0;
  }

  _getCollisionStep() {
    const step = 0.05;
    return { stepX: step, stepY: step };
  }

  _estimateObstacleNormal(worldX, worldY, stepX, stepY, boundaryTexture) {
    const left = boundaryTexture.isObstacle(worldX - stepX, worldY) ? 1 : 0;
    const right = boundaryTexture.isObstacle(worldX + stepX, worldY) ? 1 : 0;
    const down = boundaryTexture.isObstacle(worldX, worldY - stepY) ? 1 : 0;
    const up = boundaryTexture.isObstacle(worldX, worldY + stepY) ? 1 : 0;

    const nx = left - right;
    const ny = down - up;
    const len = Math.hypot(nx, ny);
    if (!Number.isFinite(len) || len < 0.0001) {
      return null;
    }

    return { nx: nx / len, ny: ny / len };
  }

  _resolveObstacle(worldX, worldY, boundaryTexture) {
    const { stepX, stepY } = this._getCollisionStep();

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
   * Cleanup resources.
   */
  destroy() {
    // No resources to cleanup yet.
  }
}
