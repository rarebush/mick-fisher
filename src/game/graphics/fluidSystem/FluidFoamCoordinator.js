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
   * @param {number} config.spawnBufferX - World units to extend leftward for spawn
   * @param {number} config.spawnNoiseScale - Noise frequency for spawn clustering
   * @param {number} config.spawnNoiseThreshold - Noise cutoff for spawn acceptance
   * @param {number} config.spawnNoiseSharpness - Exponent to sharpen clusters
   */
  constructor(config = {}) {
    this.config = {
      gridWidth: config.gridWidth || 320,
      gridHeight: config.gridHeight || 180,
      maxParticles: config.maxParticles || 10000,
      waveInterval: config.waveInterval || 1.0, // seconds
      particlesPerWave: config.particlesPerWave || 200,
      maxAge: config.maxAge || 16.0, // seconds before fade complete
      spawnBufferX: Number.isFinite(config.spawnBufferX)
        ? config.spawnBufferX
        : 0,
      spawnNoiseScale: Number.isFinite(config.spawnNoiseScale)
        ? config.spawnNoiseScale
        : 2.5,
      spawnNoiseThreshold: Number.isFinite(config.spawnNoiseThreshold)
        ? config.spawnNoiseThreshold
        : 0.95,
      spawnNoiseSharpness: Number.isFinite(config.spawnNoiseSharpness)
        ? config.spawnNoiseSharpness
        : 2.2,
      spawnNoiseDebugStep: Number.isFinite(config.spawnNoiseDebugStep)
        ? config.spawnNoiseDebugStep
        : 0.0625,
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
    this.spawnNoiseDebug = null;
    this.spawnNoiseRange = null;
    this.spawnNoiseOffset = { x: 0, y: 0 };
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

    // Spawn position: within offscreen upstream buffer (left of the bank)
    const upstreamBand = Math.max(0.5, this.config.spawnBufferX || 0.5);
    const spawnMinX = WORLD_X.MIN - upstreamBand;

    this._updateSpawnNoiseOffset();
    this._updateSpawnNoiseRange(spawnMinX, upstreamBand);
    if (this.spawnNoiseDebug) {
      this._drawSpawnNoiseDebug(spawnMinX, upstreamBand);
    }

    // Debug: Log spawn position occasionally

    // Find inactive particles and activate them using noise-clustered spawn
    let spawned = 0;
    let attempts = 0;
    const maxAttempts = spawnCount * 25;
    for (let i = 0; i < this.particles.length && spawned < spawnCount; i++) {
      const particle = this.particles[i];
      if (particle.active) {
        continue;
      }

      if (attempts >= maxAttempts) {
        break;
      }

      const candidate = this._pickSpawnCandidate(spawnMinX, upstreamBand);
      attempts++;
      if (!candidate) {
        i--;
        continue;
      }

      particle.x = candidate.x;
      particle.y = candidate.y;
      particle.vx = this.flowSpeed * 0.1; // Small initial velocity
      particle.vy = (Math.random() - 0.5) * 0.05;
      particle.age = 0;
      particle.active = true;
      particle.scale = 0.3 + Math.random() * 0.5; // Smaller size variation (0.3-0.8)

      spawned++;
      this.activeParticleCount++;
    }
  }

  setSpawnNoiseDebug(debugConfig) {
    this.spawnNoiseDebug = debugConfig;
  }

  _drawSpawnNoiseDebug(spawnMinX, upstreamBand) {
    if (
      !this.spawnNoiseDebug?.graphics ||
      !this.spawnNoiseDebug?.worldToScreen
    ) {
      return;
    }

    const graphics = this.spawnNoiseDebug.graphics;
    const worldToScreen = this.spawnNoiseDebug.worldToScreen;
    const z =
      Number.isFinite(this.spawnNoiseDebug.z) && this.spawnNoiseDebug.z !== null
        ? this.spawnNoiseDebug.z
        : WORLD_Z.WATER_SURFACE;

    graphics.clear();

    const minX = spawnMinX;
    const maxX = spawnMinX + upstreamBand;
    const minY = WORLD_Y.WATER_NEAR;
    const maxY = WORLD_Y.WATER_FAR;
    const step = Math.max(0.05, this.config.spawnNoiseDebugStep);
    const thresholdValue = this._getSpawnThresholdValue();

    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const clusterValue = this._clusterValue(x, y, spawnMinX, upstreamBand);
        const isSpawn = clusterValue >= thresholdValue;

        const color = isSpawn ? 0x000000 : 0xffffff;
        const alpha = isSpawn ? 0.6 : 0.15;

        const screenPos = worldToScreen(x, y, z);
        graphics.circle(screenPos.x, screenPos.y, 2).fill({ color, alpha });
      }
    }
  }

  _pickSpawnCandidate(spawnMinX, upstreamBand) {
    const x = spawnMinX + Math.random() * upstreamBand;
    const y =
      WORLD_Y.WATER_NEAR +
      Math.random() * (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR);

    const clusterValue = this._clusterValue(x, y, spawnMinX, upstreamBand);

    const thresholdValue = this._getSpawnThresholdValue();
    if (clusterValue < thresholdValue) {
      return null;
    }

    return { x, y };
  }

  _clusterValue(x, y, spawnMinX, upstreamBand) {
    const height = WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR;
    const width = upstreamBand;
    // Map noise so the long axis aligns with world X (spawn width).
    const u = (x - spawnMinX) / width;
    const v = (y - WORLD_Y.WATER_NEAR) / height;

    const aspect = width / height;
    const scaledX =
      u * this.config.spawnNoiseScale * aspect + this.spawnNoiseOffset.x;
    const scaledY = v * this.config.spawnNoiseScale + this.spawnNoiseOffset.y;
    const warp = this._fbmNoise2D(scaledX * 0.8 + 7.7, scaledY * 0.8 - 3.1, 2);
    const warpX = scaledX + (warp - 0.5) * 0.8;
    const warpY = scaledY + (warp - 0.5) * 0.8;

    const noiseValue = this._fbmNoise2D(warpX, warpY, 4);
    return Math.pow(noiseValue, this.config.spawnNoiseSharpness);
  }

  _getSpawnThresholdValue() {
    const range = this.spawnNoiseRange;
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      return this.config.spawnNoiseThreshold;
    }

    const span = range.max - range.min;
    if (span <= 0.00001) {
      return range.max;
    }

    return range.min + span * this.config.spawnNoiseThreshold;
  }

  _updateSpawnNoiseRange(spawnMinX, upstreamBand) {
    const samplesX = 28;
    const samplesY = 14;
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (let iy = 0; iy < samplesY; iy++) {
      const v = samplesY === 1 ? 0.5 : iy / (samplesY - 1);
      const y =
        WORLD_Y.WATER_NEAR + v * (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR);
      for (let ix = 0; ix < samplesX; ix++) {
        const u = samplesX === 1 ? 0.5 : ix / (samplesX - 1);
        const x = spawnMinX + u * upstreamBand;
        const value = this._clusterValue(x, y, spawnMinX, upstreamBand);
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
    }

    this.spawnNoiseRange = {
      min: minValue,
      max: maxValue,
    };
  }

  _updateSpawnNoiseOffset() {
    this.spawnNoiseOffset = {
      x: Math.random() * 1000,
      y: Math.random() * 1000,
    };
  }

  _perlinNoise2D(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = this._fade(x - x0);
    const sy = this._fade(y - y0);

    const g00 = this._grad2D(x0, y0, x - x0, y - y0);
    const g10 = this._grad2D(x1, y0, x - x1, y - y0);
    const g01 = this._grad2D(x0, y1, x - x0, y - y1);
    const g11 = this._grad2D(x1, y1, x - x1, y - y1);

    const ix0 = this._lerp(g00, g10, sx);
    const ix1 = this._lerp(g01, g11, sx);

    const value = this._lerp(ix0, ix1, sy);
    return value * 0.5 + 0.5;
  }

  _fbmNoise2D(x, y, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;

    for (let i = 0; i < octaves; i++) {
      const rotated = this._rotate2D(x * frequency, y * frequency, 0.72);
      value += this._perlinNoise2D(rotated.x, rotated.y) * amplitude;
      frequency *= 2.03;
      amplitude *= 0.5;
    }

    return value;
  }

  _rotate2D(x, y, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x: x * cosA - y * sinA,
      y: x * sinA + y * cosA,
    };
  }

  _grad2D(ix, iy, dx, dy) {
    const angle = this._hash2D(ix, iy) * Math.PI * 2;
    const gx = Math.cos(angle);
    const gy = Math.sin(angle);
    return gx * dx + gy * dy;
  }

  _hash2D(x, y) {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return h - Math.floor(h);
  }

  _fade(t) {
    return t * t * (3 - 2 * t);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
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
