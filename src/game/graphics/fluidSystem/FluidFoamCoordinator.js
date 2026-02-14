/**
 * FluidFoamCoordinator.js
 * Main coordinator for the particle-based fluid foam system.
 * Manages wave spawning, particle lifecycle, and particle simulation.
 *
 * References design doc: Game Mechanics - Horizontal Drag Phase.md (foam behavior)
 * Replaces static Voronoi foam with dynamic particle simulation.
 */

import { WORLD_X, WORLD_Y, WORLD_Z } from "../../mechanics/worldDimensions.js";
import { CURRENT_SHIFT_ZONES } from "../../data/currentShiftZones.js";
import {
  clusterValue,
  getSpawnThresholdValue,
  pickSpawnCandidate,
  updateSpawnNoiseOffset,
  updateSpawnNoiseRange,
} from "./foamSpawnNoise.js";
import { applyShiftZonesToParticles } from "./foamShiftZones.js";
import {
  applyDirectionalShearToParticles,
  applyRadialImpulseToParticles,
  applySplatToParticles,
} from "./foamImpulses.js";

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
      lifespanRiverLengths: Number.isFinite(config.lifespanRiverLengths)
        ? config.lifespanRiverLengths
        : null,
      lifespanMultiplier: Number.isFinite(config.lifespanMultiplier)
        ? config.lifespanMultiplier
        : 1.0,
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
      shiftZoneParticleScale: Number.isFinite(config.shiftZoneParticleScale)
        ? config.shiftZoneParticleScale
        : 1.0,
      cullByAge: config.cullByAge !== false,
      spawnInMainArea: Boolean(config.spawnInMainArea),
      disableDynamicMaxAge: Boolean(config.disableDynamicMaxAge),
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
    this.choppiness = 1.0; // 0-2+ range, affects spawn density + noise thresholds

    // Sub-systems (initialized externally)
    this.particleState = null; // FluidParticleState instance
    this.renderer = null; // Foam renderer instance
    this.boundaryTexture = null; // FluidBoundaryTexture instance (optional)
    this.spawnNoiseDebug = null;
    this.spawnNoiseRange = null;
    this.spawnNoiseOffset = { x: 0, y: 0 };
    this.shiftZones = Array.isArray(config.shiftZones)
      ? config.shiftZones
      : CURRENT_SHIFT_ZONES;
  }

  /**
   * Initialize the coordinator with sub-systems.
   * @param {FluidParticleState} particleState
   * @param {Object} renderer
   * @param {FluidBoundaryTexture} boundaryTexture - Optional collision boundaries
   */
  initialize(particleState, renderer, boundaryTexture = null) {
    this.particleState = particleState;
    this.renderer = renderer;
    this.boundaryTexture = boundaryTexture;
    this._baseDriftVelocityX = Number.isFinite(particleState?.driftVelocityX)
      ? particleState.driftVelocityX
      : 0;
    this._baseDriftVelocityY = Number.isFinite(particleState?.driftVelocityY)
      ? particleState.driftVelocityY
      : 0;

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
    this._flowPhase = (this._flowPhase || 0) + deltaTime * this.flowSpeed;

    // Update wave spawning timer
    this.timeSinceLastWave += deltaTime;

    // Spawn waves at intervals (faster when flow speed is higher)
    const speedFactor = Math.max(0, this.flowSpeed);
    const adjustedInterval =
      speedFactor > 0.0001 ? this.nextWaveInterval / speedFactor : Infinity;
    if (this.timeSinceLastWave >= adjustedInterval) {
      this._spawnWave();
      this.timeSinceLastWave = 0;
      // Add slight randomness to next interval
      this.nextWaveInterval =
        this.config.waveInterval * (0.8 + Math.random() * 0.4);
    }

    const maxAge = this._getDynamicMaxAge();
    this._rescaleParticleAges(maxAge);

    // Update particle ages and mark inactive
    this._updateParticleAges(deltaTime, maxAge);

    this._applyShiftZones(deltaTime);

    // Update particle positions using particle velocity + drift
    if (this.particleState) {
      this.particleState.update(
        deltaTime,
        this.particles,
        this.boundaryTexture,
      );
    }
    this._cullOutOfBounds();

    // Update renderer
    if (this.renderer) {
      this.renderer.maxAge = maxAge;
      this.renderer.update(this.particles);
    }
  }

  setShiftZones(zones) {
    this.shiftZones = Array.isArray(zones) ? zones : [];
  }

  _applyShiftZones(deltaTime) {
    const zones = Array.isArray(this.shiftZones) ? this.shiftZones : [];
    if (zones.length === 0) {
      return;
    }

    this._applyShiftZonesToParticles(zones, deltaTime);
  }

  _applyShiftZonesToParticles(zones, deltaTime) {
    applyShiftZonesToParticles({
      particles: this.particles,
      zones,
      deltaTime,
      config: this.config,
      flowPhase: this._flowPhase,
    });
  }

  /**
   * Spawn a wave of foam particles.
   * @private
   */
  _spawnWave() {
    const choppiness = Number.isFinite(this.choppiness) ? this.choppiness : 1;
    const choppyT = Math.max(0, Math.min(1, choppiness / 2));
    const spawnNoiseScale = this.config.spawnNoiseScale * (1 - 0.35 * choppyT);
    const spawnNoiseThreshold = Math.max(
      0.5,
      this.config.spawnNoiseThreshold - 0.12 * choppyT,
    );
    const particlesPerWave = Math.max(
      1,
      Math.round(this.config.particlesPerWave * (1 + 0.4 * choppyT)),
    );
    const spawnConfig = {
      ...this.config,
      spawnNoiseScale,
      spawnNoiseThreshold,
      particlesPerWave,
    };
    this._spawnNoiseConfig = spawnConfig;

    // Calculate how many particles we can spawn
    const availableSlots = this.config.maxParticles - this.activeParticleCount;
    const spawnCount = Math.min(spawnConfig.particlesPerWave, availableSlots);

    if (spawnCount <= 0) return;

    // Spawn position: configurable main-area vs upstream buffer (debug/testing)
    const spawnInMainArea = Boolean(this.config.spawnInMainArea);
    const upstreamBand = spawnInMainArea
      ? Math.max(0.5, WORLD_X.WIDTH)
      : Math.max(0.5, this.config.spawnBufferX || 0.5);
    const spawnMinX = spawnInMainArea
      ? WORLD_X.MIN
      : WORLD_X.MIN - upstreamBand;

    this.spawnNoiseOffset = updateSpawnNoiseOffset();
    this.spawnNoiseRange = updateSpawnNoiseRange({
      spawnMinX,
      upstreamBand,
      config: spawnConfig,
      spawnNoiseOffset: this.spawnNoiseOffset,
    });
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

      const candidate = pickSpawnCandidate({
        spawnMinX,
        upstreamBand,
        config: spawnConfig,
        spawnNoiseOffset: this.spawnNoiseOffset,
        spawnNoiseRange: this.spawnNoiseRange,
      });
      attempts++;
      if (!candidate) {
        i--;
        continue;
      }

      particle.x = candidate.x;
      particle.y = candidate.y;
      particle.vx = 0;
      particle.vy = 0;
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

    const noiseConfig = this._spawnNoiseConfig || this.config;

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
    const step = Math.max(0.05, noiseConfig.spawnNoiseDebugStep);
    const thresholdValue = getSpawnThresholdValue({
      spawnNoiseRange: this.spawnNoiseRange,
      spawnNoiseThreshold: noiseConfig.spawnNoiseThreshold,
    });

    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const cluster = clusterValue({
          x,
          y,
          spawnMinX,
          upstreamBand,
          config: noiseConfig,
          spawnNoiseOffset: this.spawnNoiseOffset,
        });
        const isSpawn = cluster >= thresholdValue;

        const color = isSpawn ? 0x000000 : 0xffffff;
        const alpha = isSpawn ? 0.6 : 0.15;

        const screenPos = worldToScreen(x, y, z);
        graphics.circle(screenPos.x, screenPos.y, 2).fill({ color, alpha });
      }
    }
  }

  /**
   * Update particle ages and deactivate old particles.
   * @param {number} deltaTime - Time elapsed in seconds
   * @private
   */
  _updateParticleAges(deltaTime, maxAge) {
    const effectiveMaxAge = Number.isFinite(maxAge)
      ? maxAge
      : this.config.maxAge;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.active) {
        particle.age += deltaTime;

        if (this.config.cullByAge && particle.age >= effectiveMaxAge) {
          particle.active = false;
          this.activeParticleCount--;
        }
      }
    }
  }

  _cullOutOfBounds() {
    if (!this.particleState?.killOutOfBounds) {
      return;
    }

    const bounds = this.particleState.worldBounds;
    if (!bounds) {
      return;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;
      if (
        particle.x < bounds.minX ||
        particle.x > bounds.maxX ||
        particle.y < bounds.minY ||
        particle.y > bounds.maxY
      ) {
        particle.active = false;
        this.activeParticleCount--;
      }
    }
  }

  _getDynamicMaxAge() {
    if (this.config.disableDynamicMaxAge) {
      return this.config.maxAge;
    }

    const spawnExtension = this.config.spawnInMainArea
      ? 0
      : this.config.spawnBufferX;
    const length = WORLD_X.WIDTH + spawnExtension;
    const driftSpeed = this.particleState?.useParticleVelocity
      ? Math.hypot(
          this.particleState.driftVelocityX || 0,
          this.particleState.driftVelocityY || 0,
        )
      : 0;
    const baseSpeed = this.flowSpeed;
    const speed = this.particleState?.useParticleVelocity
      ? driftSpeed
      : baseSpeed;
    const riverLengths = Number.isFinite(this.config.lifespanRiverLengths)
      ? this.config.lifespanRiverLengths
      : this.config.lifespanMultiplier;

    if (!Number.isFinite(length) || !Number.isFinite(speed) || speed <= 0) {
      return this.config.maxAge;
    }

    return (length / speed) * riverLengths;
  }

  _rescaleParticleAges(maxAge) {
    if (!Number.isFinite(maxAge)) {
      return;
    }

    if (!Number.isFinite(this._lastMaxAge)) {
      this._lastMaxAge = maxAge;
      return;
    }

    const prevMaxAge = this._lastMaxAge;
    if (Math.abs(prevMaxAge - maxAge) < 0.0001) {
      return;
    }

    const scale = maxAge / prevMaxAge;
    if (!Number.isFinite(scale) || scale <= 0) {
      this._lastMaxAge = maxAge;
      return;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;
      particle.age *= scale;
    }

    this._lastMaxAge = maxAge;
  }

  applyInputSplat(worldX, worldY, deltaWorldX, deltaWorldY, options = {}) {
    applySplatToParticles({
      particles: this.particles,
      config: this.config,
      worldX,
      worldY,
      deltaWorldX,
      deltaWorldY,
      options,
    });
  }

  applyLandingSplat(worldX, worldY, options = {}) {
    applyRadialImpulseToParticles({
      particles: this.particles,
      config: this.config,
      worldX,
      worldY,
      options,
      applyDamping: true,
    });
  }

  applyDragRepel(worldX, worldY, options = {}) {
    applyRadialImpulseToParticles({
      particles: this.particles,
      config: this.config,
      worldX,
      worldY,
      options,
      applyDamping: false,
    });
  }

  applyRopeDeflect(worldX, worldY, dirX, dirY, options = {}) {
    applyDirectionalShearToParticles({
      particles: this.particles,
      worldX,
      worldY,
      dirX,
      dirY,
      options,
    });
  }

  /**
   * Set flow speed (connected to game's flowStepSpeed).
   * @param {number} speed - Flow speed multiplier
   */
  setFlowSpeed(speed) {
    this.flowSpeed = speed;
    if (this.particleState) {
      const baseX = Number.isFinite(this._baseDriftVelocityX)
        ? this._baseDriftVelocityX
        : 0;
      const baseY = Number.isFinite(this._baseDriftVelocityY)
        ? this._baseDriftVelocityY
        : 0;
      this.particleState.driftVelocityX = baseX * this.flowSpeed;
      this.particleState.driftVelocityY = baseY * this.flowSpeed;
    }
  }

  /**
   * Set choppiness (connected to game's water choppiness).
   * @param {number} choppiness - Choppiness value (0-2+)
   */
  setChoppiness(choppiness) {
    this.choppiness = choppiness;
  }

  /**
   * Set boundary texture for particle collision checks.
   * @param {FluidBoundaryTexture} boundaryTexture
   */
  setBoundaryTexture(boundaryTexture) {
    this.boundaryTexture = boundaryTexture;
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    this.particles = [];
    this.activeParticleCount = 0;

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
