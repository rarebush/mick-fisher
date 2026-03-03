import { Container, RenderTexture, Sprite, Texture } from "pixi.js";
import { WORLD_Z } from "../../mechanics/worldDimensions.js";
import { createFoamBlobFilter } from "./foamBlobShader.js";

export class FluidFoamBlobRenderer {
  /**
   * @param {Object} config
   * @param {number} config.maxParticles
   * @param {import("pixi.js").Renderer} config.renderer
   * @param {import("pixi.js").Container} config.parentContainer
   * @param {{width:number,height:number}} config.screenSize
   * @param {Function} config.worldToScreen
   * @param {number} [config.maxAge]
   * @param {number} [config.densityScale]
   * @param {number} [config.isoScaleY]
   */
  constructor(config) {
    this.maxParticles = config.maxParticles;
    this.renderer = config.renderer;
    this.parentContainer = config.parentContainer;
    this.worldToScreen = config.worldToScreen;
    this.maxAge = Number.isFinite(config.maxAge) ? config.maxAge : 8.0;
    this.densityScale = Number.isFinite(config.densityScale)
      ? config.densityScale
      : 1.0;
    this.isoScaleY = Number.isFinite(config.isoScaleY) ? config.isoScaleY : 1.0;
    this.densityAlpha = Number.isFinite(config.densityAlpha)
      ? config.densityAlpha
      : 0.6;

    this.screenSize = {
      width: config.screenSize?.width ?? 0,
      height: config.screenSize?.height ?? 0,
    };

    this.densityTexture = RenderTexture.create({
      width: Math.max(1, Math.floor(this.screenSize.width * this.densityScale)),
      height: Math.max(
        1,
        Math.floor(this.screenSize.height * this.densityScale),
      ),
    });

    this.densityContainer = new Container();
    this.densityContainer.label = "FoamDensitySprites";
    this.densityContainer.blendMode = "add";
    this.densityContainer.roundPixels = false;
    this.densityContainer.alpha = this.densityAlpha;

    this.particleTexture = this._createDensityParticleTexture();
    this.particleSprites = [];
    this._initializeSpritePool();

    this.displaySprite = new Sprite(this.densityTexture);
    this.displaySprite.label = "FoamBlobSprite";
    this.displaySprite.width = this.screenSize.width;
    this.displaySprite.height = this.screenSize.height;
    this.displaySprite.blendMode = "normal";
    this.displaySprite.roundPixels = false;
    const foamBlobFilter = createFoamBlobFilter({
      thresholdLow: 0.04,
      thresholdHigh: 0.35,
      alphaLow: 0.04,
      alphaHigh: 0.24,
      stepThreshold1: 0.65,
      stepThreshold2: 0.94,
      densityPower: 2.1,
      alphaScale: 0.85,
      blurStrength: 0.2,
      coreColor: [1.0, 1.0, 1.0],
      midColor: [1.0, 1.0, 1.0],
      edgeColor: [1.0, 1.0, 1.0],
      coreAlpha: 1.0,
      midAlpha: 0.7,
      edgeAlpha: 0.45,
      texelSize: [
        1 / Math.max(1, this.densityTexture.width),
        1 / Math.max(1, this.densityTexture.height),
      ],
    });
    this.displaySprite.filters = [foamBlobFilter];
    if (typeof window !== "undefined") {
      window.foamBlobFilter = foamBlobFilter;
      window.foamBlobUniforms =
        foamBlobFilter.resources.foamBlobUniforms.uniforms;
    }

    if (this.parentContainer) {
      this.parentContainer.addChild(this.displaySprite);
    }
  }

  _createDensityParticleTexture() {
    const size = 15;
    const radius = 7;

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
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.35)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return Texture.from(canvas);
  }

  _initializeSpritePool() {
    for (let i = 0; i < this.maxParticles; i++) {
      const sprite = new Sprite(this.particleTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 1.0;
      sprite.roundPixels = false;
      this.particleSprites.push(sprite);
      this.densityContainer.addChild(sprite);
    }
  }

  update(particles) {
    let spriteIndex = 0;

    for (
      let i = 0;
      i < particles.length && spriteIndex < this.maxParticles;
      i++
    ) {
      const particle = particles[i];
      const sprite = this.particleSprites[spriteIndex];

      if (particle.active) {
        const screenPos = this.worldToScreen(
          particle.x,
          particle.y,
          WORLD_Z.WATER_SURFACE,
        );

        sprite.x = screenPos.x * this.densityScale;
        sprite.y = screenPos.y * this.densityScale;
        sprite.scale.set(
          particle.scale * 0.7,
          particle.scale * 0.7 * this.isoScaleY,
        );

        const ageRatio = particle.age / this.maxAge;
        sprite.alpha = Math.max(0, 1.0 - ageRatio);

        sprite.visible = true;
        spriteIndex++;
      }
    }

    for (let i = spriteIndex; i < this.maxParticles; i++) {
      this.particleSprites[i].visible = false;
    }

    this.renderer.render({
      container: this.densityContainer,
      target: this.densityTexture,
      clear: true,
    });
  }

  setVisible(visible) {
    if (this.displaySprite) {
      this.displaySprite.visible = visible;
    }
  }

  destroy() {
    if (this.parentContainer && this.displaySprite?.parent) {
      this.parentContainer.removeChild(this.displaySprite);
    }

    for (const sprite of this.particleSprites) {
      sprite.destroy();
    }
    this.particleSprites = [];

    if (this.densityContainer) {
      this.densityContainer.destroy({ children: true });
    }

    if (this.displaySprite) {
      this.displaySprite.destroy();
    }

    if (this.particleTexture) {
      this.particleTexture.destroy();
      this.particleTexture = null;
    }

    if (this.densityTexture) {
      this.densityTexture.destroy(true);
      this.densityTexture = null;
    }
  }
}
