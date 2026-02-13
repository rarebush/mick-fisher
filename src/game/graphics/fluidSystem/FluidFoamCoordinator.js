/**
 * FluidFoamCoordinator.js
 * Main coordinator for the particle-based fluid foam system.
 * Manages wave spawning, particle lifecycle, and orchestrates the velocity field and particle simulation.
 *
 * References design doc: Game Mechanics - Horizontal Drag Phase.md (foam behavior)
 * Replaces static Voronoi foam with dynamic particle simulation.
 */

import { WORLD_X, WORLD_Y, WORLD_Z } from "../../mechanics/worldDimensions.js";

export class FluidFoamCoordinator {
  /**
   * @param {Object} config - Configuration options
   * @param {number} config.gridWidth - Fluid grid width (e.g., 320)
   * @param {number} config.gridHeight - Fluid grid height (e.g., 180)
   * @param {number} config.maxParticles - Maximum particle count (e.g., 10000)
   * @param {number} config.waveInterval - Time between wave spawns in seconds (e.g., 1.0)
   * @param {number} config.particlesPerWave - Number of particles per wave (e.g., 200)
   */
  constructor(config = {}) {
    this.config = {
      gridWidth: config.gridWidth || 320,
      gridHeight: config.gridHeight || 180,
      maxParticles: config.maxParticles || 10000,
      waveInterval: config.waveInterval || 1.0, // seconds
      particlesPerWave: config.particlesPerWave || 200,
      maxAge: config.maxAge || 8.0, // seconds before fade complete
      baseFlowSpeed: config.baseFlowSpeed || 1.0,
      ...config,
    };

    // Particle pool - stores all particle data
    this.particles = [];
    this.activeParticleCount = 0;

    // Wave spawning state
    this.timeSinceLastWave = 0;
    this.nextWaveInterval = this.config.waveInterval;

    // Flow parameters (connected to game state)
    this.flowSpeed = this.config.baseFlowSpeed;
    this.choppiness = 1.0; // 0-2+ range, affects spawn rate

    // Sub-systems (initialized externally)
    this.velocityField = null; // FluidVelocityField instance
    this.particleState = null; // FluidParticleState instance
    this.renderer = null; // FluidParticleRenderer instance
    this.boundaryTexture = null; // FluidBoundaryTexture instance (optional)
  }

  /**
   * Initialize the coordinator with sub-systems.
   * @param {FluidVelocityField} velocityField
   * @param {FluidParticleState} particleState
   * @param {FluidParticleRenderer} renderer
   * @param {FluidBoundaryTexture} boundaryTexture - Optional collision boundaries
   */
  initialize(velocityField, particleState, renderer, boundaryTexture = null) {
    this.velocityField = velocityField;
    this.particleState = particleState;
    this.renderer = renderer;
    this.boundaryTexture = boundaryTexture;

    if (boundaryTexture) {
      this.setBoundaryTexture(boundaryTexture);
    }

    // Initialize particle pool to max capacity
    this._initializeParticlePool();

    console.log("[FluidFoam] Coordinator initialized:", {
      maxParticles: this.config.maxParticles,
      waveInterval: this.config.waveInterval,
      particlesPerWave: this.config.particlesPerWave,
      activeParticles: this.activeParticleCount,
    });
  }

  /**
   * Create particle pool with max capacity.
   * Particles are recycled rather than created/destroyed.
   * @private
   */
  _initializeParticlePool() {
    this.particles = [];
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        active: false,
        scale: 1.0,
      });
    }
  }

  /**
   * Update fluid foam simulation.
   * Called every frame from PixiApp ticker.
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    // Update wave spawning timer
    this.timeSinceLastWave += deltaTime;

    // Spawn waves at intervals (faster when choppier)
    const adjustedInterval =
      this.nextWaveInterval / (0.5 + this.choppiness * 0.5);
    if (this.timeSinceLastWave >= adjustedInterval) {
      this._spawnWave();
      this.timeSinceLastWave = 0;
      // Add slight randomness to next interval
      this.nextWaveInterval =
        this.config.waveInterval * (0.8 + Math.random() * 0.4);
    }

    // Update particle ages and mark inactive
    this._updateParticleAges(deltaTime);

    // Update velocity field (if it has internal dynamics)
    if (this.velocityField) {
      this.velocityField.update(deltaTime, this.flowSpeed);
    }

    // Update particle positions via advection
    if (this.particleState) {
      this.particleState.update(
        deltaTime,
        this.velocityField,
        this.particles,
        this.boundaryTexture,
      );
    }

    // Update renderer
    if (this.renderer) {
      this.renderer.update(this.particles, this.activeParticleCount);
    }
  }

  /**
   * Spawn a wave of foam particles.
   * @private
   */
  _spawnWave() {
    // Calculate how many particles we can spawn
    const availableSlots = this.config.maxParticles - this.activeParticleCount;
    const spawnCount = Math.min(this.config.particlesPerWave, availableSlots);

    if (spawnCount <= 0) return;

    // Spawn position: near upstream edge (left bank)
    const upstreamBand = 1.0; // World units from the left bank

    // Debug: Log spawn position occasionally
    if (Math.random() < 0.1) {
      console.log("[FluidFoam] Spawning wave in band", {
        xMin: WORLD_X.MIN.toFixed(2),
        xMax: (WORLD_X.MIN + upstreamBand).toFixed(2),
      });
    }

    // Find inactive particles and activate them
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < spawnCount; i++) {
      const particle = this.particles[i];
      if (!particle.active) {
        // Random position across upstream spawn band
        particle.x = WORLD_X.MIN + Math.random() * upstreamBand;
        particle.y =
          WORLD_Y.WATER_NEAR +
          Math.random() * (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR);
        particle.vx = this.flowSpeed * 0.1; // Small initial velocity
        particle.vy = (Math.random() - 0.5) * 0.05;
        particle.age = 0;
        particle.active = true;
        particle.scale = 0.3 + Math.random() * 0.5; // Smaller size variation (0.3-0.8)

        spawned++;
        this.activeParticleCount++;
      }
    }
  }

  /**
   * Update particle ages and deactivate old particles.
   * @param {number} deltaTime - Time elapsed in seconds
   * @private
   */
  _updateParticleAges(deltaTime) {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.active) {
        particle.age += deltaTime;

        // Deactivate particles that exceed max age
        if (particle.age >= this.config.maxAge) {
          particle.active = false;
          this.activeParticleCount--;
        }
      }
    }
  }

  /**
   * Set flow speed (connected to game's flowStepSpeed).
   * @param {number} speed - Flow speed multiplier
   */
  setFlowSpeed(speed) {
    this.flowSpeed = speed;
  }

  /**
   * Set choppiness (connected to game's water choppiness).
   * @param {number} choppiness - Choppiness value (0-2+)
   */
  setChoppiness(choppiness) {
    this.choppiness = choppiness;
  }

  /**
   * Set boundary texture and flag solver to recompute.
   * @param {FluidBoundaryTexture} boundaryTexture
   */
  setBoundaryTexture(boundaryTexture) {
    this.boundaryTexture = boundaryTexture;
    if (this.velocityField?.setBoundaryTexture) {
      this.velocityField.setBoundaryTexture(boundaryTexture);
    }
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    this.particles = [];
    this.activeParticleCount = 0;

    if (this.velocityField) {
      this.velocityField.destroy();
      this.velocityField = null;
    }

    if (this.particleState) {
      this.particleState.destroy();
      this.particleState = null;
    }

    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }
}
