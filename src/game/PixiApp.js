/**
 * mick-fisher - Magnet Fishing Game
 *
 * PixiApp.js
 * Core PixiJS application orchestration
 *
 * @author Stuart Allen
 */

import * as PIXI from "pixi.js";
import useLocationStore from "./state/locationStore.js";
import {
  destroy as destroyPixiApp,
  resize as resizePixiApp,
  setRenderResolutionScale,
  setupDebugOverlay,
  setupManualFailureListener,
  setupSceneInternal,
} from "./app/pixiAppLifecycle.js";
import {
  handleCast,
  handleFluidSplat,
  handleMagnetDragSplat,
  handleMagnetLandingSplat,
  handleRopeWaterSplat,
  setupInteraction,
} from "./app/pixiAppInteractions.js";
import {
  tickerUpdateCastAim,
  tickerUpdateCaustics,
  tickerUpdateDragMechanics,
  tickerUpdateRope,
  tickerUpdateSprites,
} from "./app/pixiAppTickers.js";

export class PixiApp {
  constructor(
    canvas,
    width,
    height,
    gameStore,
    sessionStore,
    locationStore,
    inventoryStore,
  ) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.isDestroyed = false;
    this.isInitializing = false;
    this.gameStore = gameStore;
    this.sessionStore = sessionStore;
    this.locationStore = locationStore || useLocationStore;
    this.inventoryStore = inventoryStore;

    // Managers (initialized in setupScene)
    this.spriteManager = null;
    this.inputManager = null;
    this.debugOverlay = null;

    // Spritesheet references
    this.waterSpritesheet = null;
    this.waterTiles = [];

    // Environment layer references
    this.environmentLayers = null;
    this.sceneContainer = null;
    this.gameStoreUnsubscribe = null;
    this.spriteLayers = null;

    // Drag timing (for deltaTime calculations)
    this.lastDragUpdateTime = null;
    this.dragStartTime = null;
    this.lastRopeUpdateTime = null; // For rope render timing

    // Drag bubble interval
    this.dragBubbleInterval = null;

    // Rope physics for drag visualization

    this.dragLine = null;
    this.dragLineUnderwater = null;
    this.dragLineDebug = null;
    this.dragPlayerX = 0;
    this.dragPlayerY = 0;
    this.castAimOverlay = null;

    // Water animation state (used by tickerUpdateCaustics)
    this._smoothCurrentSpeed = 1;
    this._smoothChoppiness = 1;
    this._flowAccumTime = 0;
    this._flowPhase = 0;
    this._displacementTime = 0;
    this._reflectionTime = 0;
    this._smoothCloudCover = 0.5;

    this._foamSplatPresets = {
      input: { radiusWorld: 0.7, strength: 8.0, maxForce: 0.6 },
      landing: { radiusWorld: 1.2, strength: 6.0 },
      magnetDrag: { radiusWorld: 0.55, scale: 0.12, min: 0.15, max: 1.2 },
      rope: { radiusWorld: 0.4, scale: 0.03, min: 0.05, max: 0.4 },
    };
  }

  async initialize() {
    if (this.isDestroyed) {
      console.log("PixiApp was destroyed before init completed");
      return;
    }

    if (this.isInitializing) {
      console.warn("PixiApp initialization already in progress");
      return;
    }

    if (this.app) {
      console.warn("PixiApp already initialized");
      return;
    }

    this.isInitializing = true;

    try {
      // PixiJS v8 async initialization
      this.app = new PIXI.Application();
      const initialRenderResolutionScale =
        this.gameStore?.getState()?.renderResolutionScale ?? 1;

      await this.app.init({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        backgroundColor: 0x4a7c9e,
        preference: "webgl",
        hello: true,
        antialias: false, // Disable antialiasing for pixel art
        resolution: initialRenderResolutionScale,
        autoDensity: false,
        roundPixels: false, // Allow sub-pixel motion (test for foam judder)
      });

      console.log(
        "[RENDERER] Type:",
        this.app.renderer?.constructor?.name,
        this.app.renderer?.type,
      );
      console.log("[RENDERER] Filter system:", this.app.renderer?.filter);
      console.log(
        "[RENDERER] Systems keys:",
        Object.keys(this.app.renderer?.systems ?? {}),
      );

      if (this.isDestroyed) {
        console.log("PixiApp was destroyed during init");
        this.app.destroy(true);
        this.app = null;
        this.isInitializing = false;
        return;
      }

      // Enable PixiJS DevTools
      if (import.meta.env.DEV) {
        globalThis.__PIXI_APP__ = this.app;
      }

      // Final check before setting up scene
      if (!this.isDestroyed && this.app) {
        await this.setupSceneInternal();
        this.setupDebugOverlay(); // Must be before setupInteraction so InputManager can access it
        this.setupInteraction();
        this.setupManualFailureListener();
        console.log("PixiJS initialized successfully");
      }
    } catch (err) {
      console.error("PixiJS initialization error:", err);
      this.isDestroyed = true;
      if (this.app) {
        this.app.destroy(true);
        this.app = null;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  async setupSceneInternal() {
    return setupSceneInternal(this);
  }

  setupInteraction() {
    return setupInteraction(this);
  }

  setRenderResolutionScale(scale) {
    return setRenderResolutionScale(this, scale);
  }

  // Cast callback invoked by InputManager
  async handleCast(x, y, quadrant) {
    return handleCast(this, x, y, quadrant);
  }

  handleFluidSplat(worldX, worldY, deltaWorldX, deltaWorldY) {
    return handleFluidSplat(this, worldX, worldY, deltaWorldX, deltaWorldY);
  }

  handleMagnetLandingSplat(worldX, worldY) {
    return handleMagnetLandingSplat(this, worldX, worldY);
  }

  handleMagnetDragSplat(worldX, worldY, speed) {
    return handleMagnetDragSplat(this, worldX, worldY, speed);
  }

  handleRopeWaterSplat(worldX, worldY, speed) {
    return handleRopeWaterSplat(this, worldX, worldY, speed);
  }

  _withFoamCoordinator(callback) {
    return this.environmentLayers?.fluidFoamCoordinator &&
      typeof callback === "function"
      ? callback(this.environmentLayers.fluidFoamCoordinator)
      : undefined;
  }

  setupDebugOverlay() {
    return setupDebugOverlay(this);
  }

  setupManualFailureListener() {
    return setupManualFailureListener(this);
  }

  // Ticker method for sprite updates
  tickerUpdateSprites() {
    return tickerUpdateSprites(this);
  }

  // Ticker method for drag mechanics updates
  async tickerUpdateDragMechanics() {
    return tickerUpdateDragMechanics(this);
  }

  // Ticker method for rope rendering during drag
  tickerUpdateRope() {
    return tickerUpdateRope(this);
  }

  // Ticker method for cast aim oscillators and preview
  tickerUpdateCastAim() {
    return tickerUpdateCastAim(this);
  }

  // Ticker method for caustics + displacement animation
  tickerUpdateCaustics() {
    return tickerUpdateCaustics(this);
  }

  resize(width, height) {
    return resizePixiApp(this, width, height);
  }

  /**
   * Pause the PixiJS ticker (stops rendering loop)
   */
  pauseTicker() {
    if (this.app && !this.isDestroyed) {
      this.app.ticker.stop();
      console.log("PixiJS ticker paused");
    }
  }

  /**
   * Resume the PixiJS ticker (starts rendering loop)
   */
  resumeTicker() {
    if (this.app && !this.isDestroyed) {
      this.app.ticker.start();
      console.log("PixiJS ticker resumed");
    }
  }

  destroy() {
    return destroyPixiApp(this);
  }
}
