/**
 * FluidParticleRenderer.js
 * Renders foam particles using PixiJS ParticleContainer for efficient batch rendering.
 * Converts world-space particle positions to screen coordinates for rendering.
 */

import { Container, Sprite, Texture, Graphics } from "pixi.js";
import { WORLD_Z } from "../../mechanics/worldDimensions.js";

export class FluidParticleRenderer {
  /**
   * @param {Object} config
   * @param {number} config.maxParticles - Maximum number of particles to render
   * @param {import("pixi.js").Container} config.parentContainer - Parent container to add particle container to
   * @param {Function} config.worldToScreen - Function to convert world coords to screen coords
   */
  constructor(config) {
    this.maxParticles = config.maxParticles;
    this.worldToScreen = config.worldToScreen;
    this.parentContainer = config.parentContainer;

    // Create regular container instead of ParticleContainer (PixiJS v8 compatibility)
    this.particleContainer = new Container();
    this.particleContainer.label = "ParticleSprites";

    // Force visibility and add blend mode
    this.particleContainer.visible = true;
    this.particleContainer.alpha = 1.0;
    this.particleContainer.blendMode = "normal"; // Normal blend for white foam (can try 'add' for glow)

    console.log(
      "[FluidFoam] Using regular Container instead of ParticleContainer for v8 compatibility",
    );

    // Create particle texture (simple white circle)
    this.particleTexture = this._createParticleTexture();

    // Create sprite pool
    this.particleSprites = [];
    this._initializeSpritePool();

    // Add to parent container
    if (this.parentContainer) {
      this.parentContainer.addChild(this.particleContainer);
    }
  }

  /**
   * Create a simple white circle texture for particles.
   * @returns {Texture}
   * @private
   */
  _createParticleTexture() {
    const size = 16;
    const radius = 6;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      radius,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.6)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return Texture.from(canvas);
  }

  /**
   * Initialize sprite pool for particles.
   * @private
   */
  _initializeSpritePool() {
    for (let i = 0; i < this.maxParticles; i++) {
      const sprite = new Sprite(this.particleTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 1.0;
      this.particleSprites.push(sprite);
      this.particleContainer.addChild(sprite);
    }
  }

  /**
   * Update particle rendering based on current particle state.
   * @param {Array<Object>} particles - Array of particle data
   * @param {number} activeCount - Number of active particles
   */
  update(particles, activeCount) {
    let spriteIndex = 0;
    let visibleCount = 0;

    // Update sprites for active particles
    for (
      let i = 0;
      i < particles.length && spriteIndex < this.maxParticles;
      i++
    ) {
      const particle = particles[i];
      const sprite = this.particleSprites[spriteIndex];

      if (particle.active) {
        // Convert world position to screen position
        const screenPos = this.worldToScreen(
          particle.x,
          particle.y,
          WORLD_Z.WATER_SURFACE,
        );

        // Update sprite properties
        sprite.x = screenPos.x;
        sprite.y = screenPos.y;
        sprite.scale.set(particle.scale * 0.8); // Smaller scale for fine foam

        // Fade out based on age
        const ageRatio = particle.age / 8.0; // Assuming max age of 8 seconds
        sprite.alpha = Math.max(0, 1.0 - ageRatio) * 0.6; // Moderate alpha for soft foam

        sprite.visible = true;
        spriteIndex++;
        visibleCount++;
      }
    }

    // Hide remaining sprites
    for (let i = spriteIndex; i < this.maxParticles; i++) {
      this.particleSprites[i].visible = false;
    }
  }

  /**
   * Set particle container visibility.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.particleContainer.visible = visible;
  }

  /**
   * Get the particle container for layer management.
   * @returns {ParticleContainer}
   */
  getContainer() {
    return this.particleContainer;
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    // Remove from parent
    if (this.parentContainer && this.particleContainer.parent) {
      this.parentContainer.removeChild(this.particleContainer);
    }

    // Destroy sprites
    for (const sprite of this.particleSprites) {
      sprite.destroy();
    }
    this.particleSprites = [];

    // Destroy container
    this.particleContainer.destroy({ children: true });

    // Destroy texture
    if (this.particleTexture) {
      this.particleTexture.destroy();
      this.particleTexture = null;
    }
  }
}
