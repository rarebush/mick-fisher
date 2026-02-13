/**
 * FluidVelocityField.js
 * Manages the 2D velocity field for fluid simulation.
 * Uses PixiJS RenderTextures for GPU-based velocity storage.
 *
 * Initially implements a simple static flow (left to right).
 * Can be extended with Navier-Stokes simulation for dynamic velocity updates.
 */

import { RenderTexture, Texture, Sprite, Rectangle } from "pixi.js";
import { WORLD_X, WORLD_Y } from "../../mechanics/worldDimensions.js";
import {
  createAdvectionFilter,
  createApplyForcesFilter,
  createDivergenceFilter,
  createJacobiPressureFilter,
  createJacobiVelocityFilter,
  createGradientSubtractFilter,
  createVelocityBoundaryFilter,
  createPressureBoundaryFilter,
  createClearFilter,
} from "./fluidShaders.js";

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
    this.needsSolve = true; // Initial steady-state solve required
    this.solverStepsRemaining = 0;
    this.isSolving = false;
    this.cachedFieldValid = false;
    this.cachedFieldBlend = 0.35;

    this.solverConfig = {
      timeStep: 1 / 60,
      dissipation: 0.995,
      viscosity: 0.0003,
      pressureIterations: 18,
      diffusionIterations: 4,
      precomputeSteps: 48,
      stepsPerFrame: 4,
    };

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

    this._initializePassResources();
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

    this.pressureTextures = {
      read: RenderTexture.create({ width: this.width, height: this.height }),
      write: RenderTexture.create({ width: this.width, height: this.height }),
    };

    this.divergenceTexture = RenderTexture.create({
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

  _initializePassResources() {
    this.passSprite = new Sprite(Texture.WHITE);
    this.passSprite.width = this.width;
    this.passSprite.height = this.height;
    this.passSprite.filterArea = new Rectangle(0, 0, this.width, this.height);

    this.boundaryTexture = null;

    const advection = createAdvectionFilter();
    const forces = createApplyForcesFilter();
    const divergence = createDivergenceFilter();
    const pressure = createJacobiPressureFilter();
    const velocityJacobi = createJacobiVelocityFilter();
    const gradient = createGradientSubtractFilter();
    const velocityBoundary = createVelocityBoundaryFilter();
    const pressureBoundary = createPressureBoundaryFilter();
    const clear = createClearFilter();

    this.advectionFilter = advection.filter;
    this.advectionUniforms = advection.uniforms;

    this.forceFilter = forces.filter;
    this.forceUniforms = forces.uniforms;

    this.divergenceFilter = divergence.filter;
    this.divergenceUniforms = divergence.uniforms;

    this.pressureFilter = pressure.filter;
    this.pressureUniforms = pressure.uniforms;

    this.velocityJacobiFilter = velocityJacobi.filter;
    this.velocityJacobiUniforms = velocityJacobi.uniforms;

    this.gradientFilter = gradient.filter;
    this.gradientUniforms = gradient.uniforms;

    this.velocityBoundaryFilter = velocityBoundary.filter;
    this.velocityBoundaryUniforms = velocityBoundary.uniforms;

    this.pressureBoundaryFilter = pressureBoundary.filter;
    this.pressureBoundaryUniforms = pressureBoundary.uniforms;

    this.clearFilter = clear.filter;
    this.clearUniforms = clear.uniforms;

    this._setTexelUniforms();

    this._clearVelocityField();
    this._clearPressureField();
  }

  _setTexelUniforms() {
    const texel = [1 / this.width, 1 / this.height];
    this.advectionUniforms.uniforms.uTexelSize = texel;
    this.divergenceUniforms.uniforms.uTexelSize = texel;
    this.pressureUniforms.uniforms.uTexelSize = texel;
    this.velocityJacobiUniforms.uniforms.uTexelSize = texel;
    this.gradientUniforms.uniforms.uTexelSize = texel;
    this.velocityBoundaryUniforms.uniforms.uTexelSize = texel;
    this.pressureBoundaryUniforms.uniforms.uTexelSize = texel;
  }

  _clearVelocityField() {
    this.clearUniforms.uniforms.uClearColor = [0.5, 0.5, 0.0, 1.0];
    this._renderPass(
      this.clearFilter,
      Texture.WHITE,
      this.velocityTextures.read,
    );
    this._renderPass(
      this.clearFilter,
      Texture.WHITE,
      this.velocityTextures.write,
    );
  }

  _clearPressureField() {
    this.clearUniforms.uniforms.uClearColor = [0.5, 0.0, 0.0, 1.0];
    this._renderPass(
      this.clearFilter,
      Texture.WHITE,
      this.pressureTextures.read,
    );
    this._renderPass(
      this.clearFilter,
      Texture.WHITE,
      this.pressureTextures.write,
    );
  }

  /**
   * Update velocity field.
   * Currently static, but can be extended with Navier-Stokes simulation.
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {number} flowSpeed - Flow speed multiplier from game state
   */
  update(deltaTime, flowSpeed) {
    // Update flow speed from game state
    if (flowSpeed !== this.flowSpeed) {
      this.flowSpeed = flowSpeed;
      this.needsSolve = true;
      this.solverStepsRemaining = 0;
    }

    if (!this.needsSolve) {
      this.isSolving = false;
      return;
    }

    if (this.solverStepsRemaining <= 0) {
      this.solverStepsRemaining = this.solverConfig.precomputeSteps;
    }

    this.isSolving = true;

    const steps = Math.min(
      this.solverConfig.stepsPerFrame,
      this.solverStepsRemaining,
    );

    for (let i = 0; i < steps; i++) {
      this._stepSolver(Math.min(deltaTime, this.solverConfig.timeStep));
      this.solverStepsRemaining--;
    }

    if (this.solverStepsRemaining <= 0) {
      this.needsSolve = false;
      this.isSolving = false;
      this._cacheVelocityPixels();
    }
  }

  _stepSolver(dt) {
    const boundarySource = this.boundaryTexture
      ? this.boundaryTexture.getTexture().source
      : Texture.WHITE.source;

    this.advectionFilter.resources.uBoundary = boundarySource;
    this.forceFilter.resources.uBoundary = boundarySource;
    this.divergenceFilter.resources.uBoundary = boundarySource;
    this.pressureFilter.resources.uBoundary = boundarySource;
    this.velocityJacobiFilter.resources.uBoundary = boundarySource;
    this.gradientFilter.resources.uBoundary = boundarySource;
    this.velocityBoundaryFilter.resources.uBoundary = boundarySource;
    this.pressureBoundaryFilter.resources.uBoundary = boundarySource;

    this.advectionUniforms.uniforms.uDt = dt;
    this.advectionUniforms.uniforms.uDissipation =
      this.solverConfig.dissipation;

    this.forceUniforms.uniforms.uDt = dt;
    this.forceUniforms.uniforms.uForce = this._getFlowForceUV();

    this._renderPass(
      this.forceFilter,
      this.velocityTextures.read,
      this.velocityTextures.write,
    );
    this._swapTextures();

    this._renderPass(
      this.advectionFilter,
      this.velocityTextures.read,
      this.velocityTextures.write,
    );
    this._swapTextures();

    this._diffuseVelocity(dt, boundarySource);

    this._renderPass(
      this.divergenceFilter,
      this.velocityTextures.read,
      this.divergenceTexture,
    );

    this._clearPressureField();
    this._solvePressure(boundarySource);

    this.gradientFilter.resources.uPressure = this.pressureTextures.read.source;
    this._renderPass(
      this.gradientFilter,
      this.velocityTextures.read,
      this.velocityTextures.write,
    );
    this._swapTextures();

    this._renderPass(
      this.velocityBoundaryFilter,
      this.velocityTextures.read,
      this.velocityTextures.write,
    );
    this._swapTextures();
  }

  _diffuseVelocity(dt, boundarySource) {
    const a = this.solverConfig.viscosity * dt * this.width * this.height;
    const alpha = a;
    const beta = 1.0 + 4.0 * a;

    this.velocityJacobiUniforms.uniforms.uAlpha = alpha;
    this.velocityJacobiUniforms.uniforms.uBeta = beta;
    this.velocityJacobiFilter.resources.uBoundary = boundarySource;
    this.velocityJacobiFilter.resources.uSource =
      this.velocityTextures.read.source;

    for (let i = 0; i < this.solverConfig.diffusionIterations; i++) {
      this._renderPass(
        this.velocityJacobiFilter,
        this.velocityTextures.read,
        this.velocityTextures.write,
      );
      this._swapTextures();
    }
  }

  _solvePressure(boundarySource) {
    this.pressureUniforms.uniforms.uAlpha = -1.0;
    this.pressureUniforms.uniforms.uBeta = 4.0;
    this.pressureFilter.resources.uBoundary = boundarySource;
    this.pressureFilter.resources.uDivergence = this.divergenceTexture.source;

    for (let i = 0; i < this.solverConfig.pressureIterations; i++) {
      this._renderPass(
        this.pressureFilter,
        this.pressureTextures.read,
        this.pressureTextures.write,
      );
      this._swapPressureTextures();
    }

    this._renderPass(
      this.pressureBoundaryFilter,
      this.pressureTextures.read,
      this.pressureTextures.write,
    );
    this._swapPressureTextures();
  }

  _renderPass(filter, inputTexture, outputTexture) {
    this.passSprite.texture = inputTexture;
    this.passSprite.filters = [filter];
    this.renderer.render({
      container: this.passSprite,
      target: outputTexture,
      clear: true,
    });
    this.passSprite.filters = null;
  }

  _swapPressureTextures() {
    const temp = this.pressureTextures.read;
    this.pressureTextures.read = this.pressureTextures.write;
    this.pressureTextures.write = temp;
  }

  _getFlowForceUV() {
    const width = this.worldBounds.maxX - this.worldBounds.minX;
    const height = this.worldBounds.maxY - this.worldBounds.minY;
    const forceU = width > 0 ? this.flowSpeed / width : 0;
    const forceV = height > 0 ? 0 : 0;
    return [forceU, forceV];
  }

  _cacheVelocityPixels() {
    try {
      this.cachedVelocityPixels = this.renderer.extract.pixels({
        target: this.velocityTextures.read,
      });
      this._evaluateCachedField();
    } catch (error) {
      console.warn("[FluidVelocity] Failed to cache velocity pixels", error);
      this.cachedVelocityPixels = null;
      this.cachedFieldValid = false;
    }
  }

  _evaluateCachedField() {
    if (!this.cachedVelocityPixels) {
      this.cachedFieldValid = false;
      return;
    }

    const sampleX = 8;
    const sampleY = 4;
    let sum = 0;
    let max = 0;
    let count = 0;

    for (let y = 0; y < sampleY; y++) {
      for (let x = 0; x < sampleX; x++) {
        const px = Math.floor(((x + 0.5) / sampleX) * this.width);
        const py = Math.floor(((y + 0.5) / sampleY) * this.height);
        const idx = (py * this.width + px) * 4;

        const encX = this.cachedVelocityPixels[idx] / 255;
        const encY = this.cachedVelocityPixels[idx + 1] / 255;
        const velU = encX * 2 - 1;
        const velV = encY * 2 - 1;
        const mag = Math.hypot(velU, velV);

        if (!Number.isFinite(mag)) {
          this.cachedFieldValid = false;
          return;
        }

        sum += mag;
        max = Math.max(max, mag);
        count++;
      }
    }

    const mean = count > 0 ? sum / count : 0;
    this.cachedFieldValid = mean > 0.0005 && max <= 2.0;
  }

  /**
   * Mark the velocity field as dirty (e.g., obstacles changed).
   */
  markDirty() {
    this.needsSolve = true;
    this.solverStepsRemaining = 0;
  }

  /**
   * Check whether the field needs a solver pass.
   * @returns {boolean}
   */
  getNeedsSolve() {
    return this.needsSolve;
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

  setBoundaryTexture(boundaryTexture) {
    this.boundaryTexture = boundaryTexture;
    this.markDirty();
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

  sampleVelocity(worldX, worldY) {
    if (
      this.isSolving ||
      !this.cachedVelocityPixels ||
      !this.cachedFieldValid
    ) {
      return { vx: this.flowSpeed, vy: 0 };
    }

    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      return { vx: this.flowSpeed, vy: 0 };
    }

    const uv = this.worldToUV(worldX, worldY);
    if (!Number.isFinite(uv.u) || !Number.isFinite(uv.v)) {
      return { vx: this.flowSpeed, vy: 0 };
    }

    const px = Math.min(
      this.width - 1,
      Math.max(0, Math.floor(uv.u * this.width)),
    );
    const py = Math.min(
      this.height - 1,
      Math.max(0, Math.floor(uv.v * this.height)),
    );
    const idx = (py * this.width + px) * 4;

    if (
      !Number.isFinite(idx) ||
      idx < 0 ||
      idx + 1 >= this.cachedVelocityPixels.length
    ) {
      return { vx: this.flowSpeed, vy: 0 };
    }

    const encX = this.cachedVelocityPixels[idx] / 255;
    const encY = this.cachedVelocityPixels[idx + 1] / 255;
    const velU = encX * 2 - 1;
    const velV = encY * 2 - 1;

    const worldWidth = this.worldBounds.maxX - this.worldBounds.minX;
    const worldHeight = this.worldBounds.maxY - this.worldBounds.minY;

    const baseVx = this.flowSpeed;
    const baseVy = 0;
    const blend = this.cachedFieldBlend;

    return {
      vx: baseVx * (1 - blend) + velU * worldWidth * blend,
      vy: baseVy * (1 - blend) + velV * worldHeight * blend,
    };
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

    if (this.pressureTextures?.read) {
      this.pressureTextures.read.destroy();
    }
    if (this.pressureTextures?.write) {
      this.pressureTextures.write.destroy();
    }
    if (this.divergenceTexture) {
      this.divergenceTexture.destroy();
    }

    if (this.passSprite) {
      this.passSprite.destroy();
      this.passSprite = null;
    }
  }
}
