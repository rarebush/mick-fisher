/**
 * FluidFoamCoordinator.js
 * Main coordinator for the particle-based fluid foam system.
 * Manages wave spawning, particle lifecycle, and particle simulation.
 *
 * References design doc: Game Mechanics - Horizontal Drag Phase.md (foam behavior)
 * Replaces static Voronoi foam with dynamic particle simulation.
 */

import { WORLD_X, WORLD_Y, WORLD_Z } from "../../mechanics/worldDimensions.js";
import {
  CURRENT_SHIFT_ZONES,
  CURRENT_SHIFT_ZONE_TYPES,
} from "../../data/currentShiftZones.js";

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
    this.choppiness = 1.0; // 0-2+ range, affects spawn rate

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

    const maxAge = this._getDynamicMaxAge();

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
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      if (!zone?.position) continue;

      const defaults = this._getShiftZoneDefaults(zone);
      const radiusWorld = this._getShiftZoneNumber(
        zone.radiusWorld,
        defaults.radiusWorld,
        0.6,
      );
      const strength = this._getShiftZoneNumber(
        zone.strength,
        defaults.strength,
        0.2,
      );
      const falloff = this._getShiftZoneNumber(
        zone.falloff,
        defaults.falloff,
        2.0,
      );

      const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);
      for (let p = 0; p < this.particles.length; p++) {
        const particle = this.particles[p];
        if (!particle.active) continue;

        const dx = particle.x - zone.position.x;
        const dy = particle.y - zone.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq) continue;

        const dist = Math.max(0.0001, Math.sqrt(distSq));
        const falloffScale = Math.exp(-Math.pow(dist / radiusWorld, falloff));
        const scaledStrength =
          strength *
          falloffScale *
          deltaTime *
          this.config.shiftZoneParticleScale;

        if (zone.type === "whirlpool") {
          const pullStrength = this._getShiftZoneNumber(
            zone.pullStrength,
            defaults.pullStrength,
            0.3,
          );
          const tangentialStrength = this._getShiftZoneNumber(
            zone.tangentialStrength,
            defaults.tangentialStrength,
            0.5,
          );
          const nx = dx / dist;
          const ny = dy / dist;
          const tanX = -ny;
          const tanY = nx;
          particle.vx +=
            (-nx * pullStrength + tanX * tangentialStrength) * scaledStrength;
          particle.vy +=
            (-ny * pullStrength + tanY * tangentialStrength) * scaledStrength;
          continue;
        }

        if (zone.type === "repel") {
          const nx = dx / dist;
          const ny = dy / dist;
          particle.vx += nx * scaledStrength;
          particle.vy += ny * scaledStrength;
          continue;
        }

        if (zone.type === "rapid") {
          const flowDir = zone.flowDir || defaults.flowDir || { x: 1, y: 0 };
          const flowLen = Math.hypot(flowDir.x, flowDir.y) || 1;
          const fx = flowDir.x / flowLen;
          const fy = flowDir.y / flowLen;
          const lateralStrength = this._getShiftZoneNumber(
            zone.lateralStrength,
            defaults.lateralStrength,
            0.15,
          );
          const lateralFrequency = this._getShiftZoneNumber(
            zone.lateralFrequency,
            defaults.lateralFrequency,
            1.0,
          );
          const phase = (this._flowPhase || 0) * lateralFrequency;
          const wobble = Math.sin(phase + dist * 1.4) * lateralStrength;
          const sideX = -fy;
          const sideY = fx;
          const exitBoost = this._getShiftZoneNumber(
            zone.exitBoost,
            defaults.exitBoost,
            0.0,
          );
          const exitFactor = dist / radiusWorld;

          particle.vx +=
            (fx * (1 + exitBoost * exitFactor) + sideX * wobble) *
            scaledStrength;
          particle.vy +=
            (fy * (1 + exitBoost * exitFactor) + sideY * wobble) *
            scaledStrength;
        }
      }
    }
  }

  _getShiftZoneDefaults(zone) {
    const typeConfig = CURRENT_SHIFT_ZONE_TYPES?.[zone.type?.toUpperCase()];
    return typeConfig?.defaults || {};
  }

  _getShiftZoneNumber(value, fallback, defaultValue) {
    if (Number.isFinite(value)) return value;
    if (Number.isFinite(fallback)) return fallback;
    return defaultValue;
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

    // Spawn position: configurable main-area vs upstream buffer (debug/testing)
    const spawnInMainArea = Boolean(this.config.spawnInMainArea);
    const upstreamBand = spawnInMainArea
      ? Math.max(0.5, WORLD_X.WIDTH)
      : Math.max(0.5, this.config.spawnBufferX || 0.5);
    const spawnMinX = spawnInMainArea
      ? WORLD_X.MIN
      : WORLD_X.MIN - upstreamBand;

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

    if (this.config.spawnInMainArea) {
      return { x, y };
    }

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
  _updateParticleAges(deltaTime, maxAge) {
    const effectiveMaxAge = Number.isFinite(maxAge)
      ? maxAge
      : this.config.maxAge;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.active) {
        particle.age += deltaTime;

        // Deactivate particles that exceed max age
        if (particle.age >= effectiveMaxAge) {
          particle.active = false;
          this.activeParticleCount--;
        }
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

  applyInputSplat(worldX, worldY, deltaWorldX, deltaWorldY, options = {}) {
    this._applySplatToParticles(
      worldX,
      worldY,
      deltaWorldX,
      deltaWorldY,
      options,
    );
  }

  applyLandingSplat(worldX, worldY, options = {}) {
    this._applyRadialImpulseToParticles(worldX, worldY, options, true);
  }

  applyDragRepel(worldX, worldY, options = {}) {
    this._applyRadialImpulseToParticles(worldX, worldY, options, false);
  }

  applyRopeDeflect(worldX, worldY, dirX, dirY, options = {}) {
    this._applyDirectionalShearToParticles(worldX, worldY, dirX, dirY, options);
  }

  _applyRadialImpulseToParticles(worldX, worldY, options = {}, applyDamping) {
    const radiusWorld = Number.isFinite(options.radiusWorld)
      ? options.radiusWorld
      : Number.isFinite(this.config.landingSplatRadius)
        ? this.config.landingSplatRadius
        : 0.9;
    const strength = Number.isFinite(options.strength)
      ? options.strength
      : Number.isFinite(this.config.landingSplatStrength)
        ? this.config.landingSplatStrength
        : 6.0;

    const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      let dx = particle.x - worldX;
      let dy = particle.y - worldY;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      if (distSq < 0.000001) {
        const angle = Math.random() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      }

      const dist = Math.max(0.0001, Math.sqrt(distSq));
      const falloff = Math.exp(-distSq / radiusSq);
      const impulse = strength * falloff;
      const impulseX = (dx / dist) * impulse;
      const impulseY = (dy / dist) * impulse;
      particle.vx += impulseX;
      particle.vy += impulseY;
      if (applyDamping) {
        particle.splashDamping = Math.max(
          Number.isFinite(particle.splashDamping) ? particle.splashDamping : 0,
          0.6,
        );
      }
    }
  }

  _applyDirectionalShearToParticles(worldX, worldY, dirX, dirY, options = {}) {
    const radiusWorld = Number.isFinite(options.radiusWorld)
      ? options.radiusWorld
      : 0.25;
    const strength = Number.isFinite(options.strength)
      ? options.strength
      : 0.02;

    const dirLen = Math.hypot(dirX, dirY);
    if (!Number.isFinite(dirLen) || dirLen < 0.0001) {
      return;
    }

    const dirNx = dirX / dirLen;
    const dirNy = dirY / dirLen;
    const tanX = -dirNy;
    const tanY = dirNx;

    const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      const dx = particle.x - worldX;
      const dy = particle.y - worldY;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      const side = Math.sign(dx * dirNy - dy * dirNx) || 1;
      const falloff = Math.exp(-distSq / radiusSq);
      const impulse = strength * falloff * side;
      particle.vx += tanX * impulse;
      particle.vy += tanY * impulse;
    }
  }

  _applySplatToParticles(
    worldX,
    worldY,
    deltaWorldX,
    deltaWorldY,
    options = {},
  ) {
    const radiusWorld = Number.isFinite(options.radiusWorld)
      ? options.radiusWorld
      : Number.isFinite(this.config.splatDirectRadius)
        ? this.config.splatDirectRadius
        : 0.7;
    const strength = Number.isFinite(options.strength)
      ? options.strength
      : Number.isFinite(this.config.splatDirectStrength)
        ? this.config.splatDirectStrength
        : 8.0;
    const maxForce = Number.isFinite(options.maxForce)
      ? options.maxForce
      : Number.isFinite(this.config.splatDirectMaxForce)
        ? this.config.splatDirectMaxForce
        : null;

    const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);
    let impulseX = deltaWorldX * strength;
    let impulseY = deltaWorldY * strength;
    if (Number.isFinite(maxForce)) {
      const mag = Math.hypot(impulseX, impulseY);
      if (mag > maxForce && mag > 0) {
        const scale = maxForce / mag;
        impulseX *= scale;
        impulseY *= scale;
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      const dx = particle.x - worldX;
      const dy = particle.y - worldY;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      const falloff = Math.exp(-distSq / radiusSq);
      particle.vx += impulseX * falloff;
      particle.vy += impulseY * falloff;
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
