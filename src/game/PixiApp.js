/**
 * mick-fisher - Magnet Fishing Game
 *
 * PixiApp.js
 * Core PixiJS application setup and scene management
 *
 * @author Stuart Allen
 */

import * as PIXI from "pixi.js";
import {
  executeCast,
  isQuadrantAccessible,
} from "./mechanics/castMechanics.js";

export class PixiApp {
  constructor(canvas, width, height, gameStore, sessionStore) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.isDestroyed = false;
    this.gameStore = gameStore;
    this.sessionStore = sessionStore;
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
      this.app = null;
      return;
    }

    // Enable PixiJS DevTools
    if (import.meta.env.DEV) {
      globalThis.__PIXI_APP__ = this.app;
    }

    // Final check before setting up scene
    if (!this.isDestroyed && this.app) {
      this.setupScene();
      this.setupInteraction();
      console.log("PixiJS initialized successfully");
    }
  }

  setupScene() {
    if (!this.app || this.isDestroyed) return;

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
    if (!this.app || this.isDestroyed) return;

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
    if (!this.app || this.isDestroyed) return;

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointerdown", (event) => {
      const { x, y } = event.global;
      if (y < 80) return; // Shore area, no casting

      // Only allow casting when idle
      const gamePhase = this.gameStore?.getState().gamePhase;
      if (gamePhase !== "idle") {
        console.log("Cannot cast - game phase:", gamePhase);
        return;
      }

      const quadrant = this.getQuadrantFromPosition(x, y);
      if (quadrant === null) return;

      // Check if quadrant is accessible
      const equipment = this.gameStore?.getState().equipment;
      if (!isQuadrantAccessible(quadrant, equipment?.lineLength || 8)) {
        console.log("Quadrant not accessible with current equipment");
        this.showAccessMessage(x, y);
        return;
      }

      console.log(
        `Cast at quadrant ${quadrant}: ${Math.round(x)}, ${Math.round(y)}`,
      );
      this.executeCastSequence(x, y, quadrant);
    });
  }

  getQuadrantFromPosition(x, y) {
    const startY = 80;
    if (y < startY) return null;

    const availableHeight = this.app.screen.height - startY;
    const quadrantWidth = this.app.screen.width / 3;
    const quadrantHeight = availableHeight / 3;

    const col = Math.floor(x / quadrantWidth);
    const row = Math.floor((y - startY) / quadrantHeight);

    if (col < 0 || col > 2 || row < 0 || row > 2) return null;

    // Map to quadrant numbers (1-9, we'll handle edge (0) later)
    return row * 3 + col + 1;
  }

  async executeCastSequence(x, y, quadrant) {
    // Visual feedback - ripple
    this.createRipple(x, y);

    // Execute cast mechanics
    const currentLocation =
      this.gameStore?.getState().currentLocation || "picturesque-river";
    const castResult = executeCast(quadrant, currentLocation);

    // Update game state
    if (this.gameStore) {
      const { startCast, setCaughtItem, setGamePhase } =
        this.gameStore.getState();
      startCast(quadrant, castResult.distance, castResult.depth);

      // Simulate cast/sink animation (1-2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (castResult.success) {
        // Item found!
        setCaughtItem(castResult.item.id);

        // Store placement info in the cast
        this.gameStore.setState((state) => ({
          currentCast: {
            ...state.currentCast,
            placementQuality: castResult.placementQuality,
          },
        }));

        // Start drag phase with magnet position
        const { startDrag } = this.sessionStore.getState();
        startDrag(
          castResult.distance,
          castResult.magnetPosition,
          castResult.magnetContactWidth,
        );
        setGamePhase("dragging");

        console.log(
          "Item caught:",
          castResult.item.name,
          "at",
          castResult.distance.toFixed(1),
          "m",
          "| Magnet position:",
          castResult.magnetPosition.toFixed(1),
          "|",
          castResult.placementQuality.label,
        );
      } else {
        // Nothing found
        this.showNothingMessage(x, y);

        // Return to idle after showing message
        setTimeout(() => {
          setGamePhase("idle");
        }, 2000);
      }
    }
  }

  showNothingMessage(x, y) {
    const text = new PIXI.Text({
      text: "Nothing here...",
      style: { fontSize: 24, fill: 0xffffff, alpha: 0.8 },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.app.stage.addChild(text);

    // Fade out
    let alpha = 0.8;
    const fadeOut = () => {
      if (this.isDestroyed) return;
      alpha -= 0.02;
      text.alpha = alpha;
      if (alpha <= 0) {
        this.app.stage.removeChild(text);
        text.destroy();
      } else {
        requestAnimationFrame(fadeOut);
      }
    };
    setTimeout(fadeOut, 1000);
  }

  showAccessMessage(x, y) {
    if (!this.app || this.isDestroyed) return;

    const text = new PIXI.Text({
      text: "Need longer line!",
      style: { fontSize: 20, fill: 0xff0000 },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.app.stage.addChild(text);

    setTimeout(() => {
      if (!this.isDestroyed && this.app) {
        this.app.stage.removeChild(text);
        text.destroy();
      }
    }, 1500);
  }

  showSuccessMessage(itemName) {
    if (!this.app || this.isDestroyed) return;

    const text = new PIXI.Text({
      text: `Caught: ${itemName}!`,
      style: { fontSize: 28, fill: 0x4caf50, fontWeight: "bold" },
    });
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2 - 50;
    this.app.stage.addChild(text);

    // Fade out
    let alpha = 1;
    const fadeOut = () => {
      if (this.isDestroyed || !this.app) return;
      alpha -= 0.02;
      text.alpha = alpha;
      if (alpha <= 0) {
        this.app.stage.removeChild(text);
        text.destroy();
      } else {
        requestAnimationFrame(fadeOut);
      }
    };
    setTimeout(fadeOut, 1500);
  }

  showFailureMessage(reason) {
    if (!this.app || this.isDestroyed) return;

    const messages = {
      "tension-overload": "Line snapped! Too much tension!",
      "slip-failure": "It slipped off!",
    };

    const text = new PIXI.Text({
      text: messages[reason] || "Lost the item!",
      style: { fontSize: 24, fill: 0xf44336, fontWeight: "bold" },
    });
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2 - 50;
    this.app.stage.addChild(text);

    // Fade out
    let alpha = 1;
    const fadeOut = () => {
      if (this.isDestroyed || !this.app) return;
      alpha -= 0.02;
      text.alpha = alpha;
      if (alpha <= 0) {
        this.app.stage.removeChild(text);
        text.destroy();
      } else {
        requestAnimationFrame(fadeOut);
      }
    };
    setTimeout(fadeOut, 1500);
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

    try {
      this.app.renderer.resize(width, height);
      this.app.stage.removeChildren();
      this.setupScene();
      this.setupInteraction();
    } catch (err) {
      console.warn("Error during resize:", err);
    }
  }

  destroy() {
    console.log("PixiApp.destroy() called");
    this.isDestroyed = true;

    if (this.app) {
      // Safely destroy - check if renderer exists
      try {
        this.app.destroy(true, { children: true, texture: true });
      } catch (err) {
        console.warn("Error during PixiJS destroy:", err);
      }
      this.app = null;
    }
  }
}
