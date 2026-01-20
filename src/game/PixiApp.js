/**
 * mick-fisher - Magnet Fishing Game
 *
 * PixiApp.js
 * Core PixiJS application setup and scene management
 *
 * @author Stuart Allen
 */

import * as PIXI from "pixi.js";

export class PixiApp {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.isDestroyed = false;
  }

  async initialize() {
    if (this.isDestroyed) {
      console.log("PixiApp was destroyed before init completed");
      return;
    }

    // PixiJS v8 async initialization
    this.app = new PIXI.Application();

    await this.app.init({
      canvas: this.canvas,
      width: this.width,
      height: this.height,
      backgroundColor: 0x4a7c9e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (this.isDestroyed) {
      console.log("PixiApp was destroyed during init");
      this.app.destroy(true);
      return;
    }

    // Enable PixiJS DevTools
    if (import.meta.env.DEV) {
      globalThis.__PIXI_APP__ = this.app;
    }

    this.setupScene();
    this.setupInteraction();

    console.log("PixiJS initialized successfully");
  }

  setupScene() {
    // Water background
    const water = new PIXI.Graphics()
      .rect(0, 0, this.app.screen.width, this.app.screen.height)
      .fill(0x3a6c8e);
    this.app.stage.addChild(water);

    // Shore
    const shore = new PIXI.Graphics()
      .rect(0, 0, this.app.screen.width, 80)
      .fill(0x8b7355);
    this.app.stage.addChild(shore);

    // Quadrant grid
    this.drawQuadrantGrid();

    // Text
    const text = new PIXI.Text({
      text: "Click anywhere to cast magnet",
      style: { fontSize: 20, fill: 0xffffff },
    });
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2;
    text.alpha = 0.5;
    this.app.stage.addChild(text);
  }

  drawQuadrantGrid() {
    const startY = 80;
    const availableHeight = this.app.screen.height - startY;
    const quadrantWidth = this.app.screen.width / 3;
    const quadrantHeight = availableHeight / 3;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const quadrant = new PIXI.Graphics()
          .rect(
            col * quadrantWidth,
            startY + row * quadrantHeight,
            quadrantWidth,
            quadrantHeight,
          )
          .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
        this.app.stage.addChild(quadrant);
      }
    }
  }

  setupInteraction() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointerdown", (event) => {
      const { x, y } = event.global;
      if (y < 80) return;

      console.log(`Cast at: ${Math.round(x)}, ${Math.round(y)}`);
      this.createRipple(x, y);
    });
  }

  createRipple(x, y) {
    const ripple = new PIXI.Graphics()
      .circle(0, 0, 10)
      .stroke({ width: 2, color: 0xffffff });
    ripple.x = x;
    ripple.y = y;
    this.app.stage.addChild(ripple);

    let scale = 1;
    let alpha = 1;

    const animate = () => {
      if (this.isDestroyed) return;

      scale += 0.15;
      alpha -= 0.08;
      ripple.scale.set(scale);
      ripple.alpha = alpha;

      if (alpha <= 0) {
        this.app.stage.removeChild(ripple);
        ripple.destroy();
      } else {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  resize(width, height) {
    if (!this.app || this.isDestroyed) return;
    this.app.renderer.resize(width, height);
    this.app.stage.removeChildren();
    this.setupScene();
    this.setupInteraction();
  }

  destroy() {
    console.log("PixiApp.destroy() called");
    this.isDestroyed = true;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
