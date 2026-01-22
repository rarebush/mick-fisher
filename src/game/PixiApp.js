/**
 * mick-fisher - Magnet Fishing Game
 *
 * PixiApp.js
 * Core PixiJS application orchestration
 *
 * @author Stuart Allen
 */

import * as PIXI from "pixi.js";
import { DebugOverlay } from "./graphics/debugOverlay.js";
import useLocationStore from "./state/locationStore.js";

// Import new modules
import {
  setupScene,
  setupWaterBackground,
  drawQuadrantGrid,
  setupEnvironmentLayers,
} from "./rendering/sceneSetup.js";
import { SpriteManager } from "./rendering/spriteManager.js";
import { InputManager } from "./input/inputManager.js";
import {
  executeCastSequence,
  handleDragFailure,
  renderRope,
} from "./sequences/castSequence.js";
import {
  getItemPosition,
  updateDragMechanics,
  updateRopePhysics,
} from "./sequences/dragSequence.js";

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

    // Drag timing (for deltaTime calculations)
    this.lastDragUpdateTime = null;
    this.dragStartTime = null;
    this.lastRopeUpdateTime = null; // For 3D rope physics timing

    // Drag bubble interval
    this.dragBubbleInterval = null;

    // Rope physics for drag visualization

    this.dragLine = null;
    this.dragPlayerX = 0;
    this.dragPlayerY = 0;
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

      await this.app.init({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        backgroundColor: 0x4a7c9e,
        antialias: false, // Disable antialiasing for pixel art
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        roundPixels: true, // Round coordinates to whole pixels
      });

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
    if (!this.app || this.isDestroyed) return;

    // Initialize managers
    this.spriteManager = new SpriteManager(this.app);

    // Setup tickers for continuous updates
    this.app.ticker.add(this.tickerUpdateSprites, this);
    this.app.ticker.add(this.tickerUpdateDragMechanics, this);
    this.app.ticker.add(this.tickerUpdateRope, this);

    // Create scene container to offset for 3D perspective
    // This prevents negative Y coordinates from rendering off-screen
    this.sceneContainer = new PIXI.Container();
    this.sceneContainer.y = 0; // No offset needed - layers fill screen
    this.app.stage.addChild(this.sceneContainer);

    // Setup 3D environment layers (pier, wall, water, riverbed)
    this.environmentLayers = setupEnvironmentLayers(
      this.sceneContainer,
      this.app.screen.width,
      this.app.screen.height,
    );

    // No need to apply Y offset - layers are positioned to fill screen
    console.log(`[SCENE] Environment layers created, filling full screen`);

    // Setup scene (shore, text) - now deprecated in favor of environment layers
    // setupScene(this.app);

    // Setup water background and store references
    // Note: Disabled in favor of environment layers with static water
    // You can re-enable this for animated water tiles if desired
    /*
    const { waterSpritesheet, waterTiles } = await setupWaterBackground(
      this.app,
    );
    this.waterSpritesheet = waterSpritesheet;
    this.waterTiles = waterTiles || [];
    */

    // Draw quadrant grid on top
    drawQuadrantGrid(this.app);
  }

  setupInteraction() {
    if (!this.app || this.isDestroyed) return;

    // Initialize input manager
    this.inputManager = new InputManager(
      this.app,
      this.gameStore,
      this.sessionStore,
      this.locationStore,
      this.debugOverlay,
      {
        onCast: this.handleCast.bind(this),
      },
    );

    // Setup event listeners
    this.inputManager.setupInteraction();
  }

  // Cast callback invoked by InputManager
  async handleCast(x, y, quadrant) {
    const result = await executeCastSequence(
      this.app,
      this.gameStore,
      this.sessionStore,
      this.locationStore,
      this.debugOverlay,
      x,
      y,
      quadrant,
      () => getItemPosition(this.app, this.sessionStore),
      this, // Pass PixiApp instance for immediate rope storage
    );

    if (result) {
      this.dragBubbleInterval = result.dragBubbleInterval;
      this.dragLine = result.line;
      this.dragPlayerX = result.playerX;
      this.dragPlayerY = result.playerY;
    }
  }

  setupDebugOverlay() {
    if (!this.app || this.isDestroyed) return;

    this.debugOverlay = new DebugOverlay(
      this.app,
      this.width,
      this.height,
      this.locationStore,
    );

    // Subscribe to location store changes to update engaged items display
    this.locationStoreUnsubscribe = this.locationStore.subscribe(
      (state) => state.engagedItems,
      () => {
        console.log(
          "[DEBUG] Location store subscription fired - updating markers",
        );
        if (this.debugOverlay && this.gameStore) {
          const currentLocation =
            this.gameStore.getState().currentLocation || "picturesque-river";
          this.debugOverlay.updateEngagedItems(currentLocation);
        }
      },
    );

    console.log("Debug overlay initialized. Press 'D' to toggle.");
  }

  setupManualFailureListener() {
    // Handle manual "Give Up" button
    this.handleManualFailure = async (event) => {
      const gamePhase = this.gameStore?.getState().gamePhase;
      const dragState = this.sessionStore?.getState().dragState;

      // Only allow during active dragging
      if (gamePhase === "dragging" && dragState?.active) {
        console.log("[MANUAL FAILURE] Player gave up");

        // Immediately deactivate drag and set reeling phase to stop ticker physics
        this.sessionStore.setState((state) => ({
          dragState: {
            ...state.dragState,
            active: false,
          },
        }));
        this.sessionStore.getState().setPhase("reeling");

        // Trigger failure at current distance (with rope reel-in animation)
        const currentDistance = event.detail.distance || dragState.distance;
        await handleDragFailure(
          this.app,
          this.gameStore,
          this.sessionStore,
          this.locationStore,
          this.debugOverlay,
          currentDistance,
          this.inputManager
            ? this.inputManager.getQuadrantFromPosition.bind(this.inputManager)
            : null,
          null, // No 2D rope
          this.dragLine,
          this.dragPlayerX,
          this.dragPlayerY,
        );

        // Complete drag session AFTER reel-in animation
        this.sessionStore.getState().completeDrag();

        // Clear line reference after reel-in
        this.dragLine = null;

        // Store failure reason - manual yank = tension overload
        this.gameStore.setState((state) => ({
          currentCast: {
            ...state.currentCast,
            failureReason: "tension-overload",
          },
        }));

        // Complete cast as failure
        this.gameStore.getState().completeCast(false);

        // Return to idle after brief delay
        setTimeout(() => {
          if (this.app && !this.isDestroyed) {
            this.gameStore.getState().setGamePhase("idle");
          }
        }, 1000);
      }
    };

    window.addEventListener("manualDragFailure", this.handleManualFailure);
  }

  // Ticker method for sprite updates
  tickerUpdateSprites() {
    if (!this.spriteManager) return;

    const dragState = this.sessionStore?.getState().dragState;
    const gamePhase = this.gameStore?.getState().gamePhase;

    if (gamePhase !== "dragging" || !dragState?.active) {
      this.spriteManager.clearSprites();
      return;
    }

    const currentCast = this.gameStore?.getState().currentCast;
    const item = currentCast?.item;

    if (!item) {
      this.spriteManager.clearSprites();
      return;
    }

    const itemPos = getItemPosition(this.app, this.sessionStore);
    this.spriteManager.updateSprites(item, itemPos);
  }

  // Ticker method for drag mechanics updates
  async tickerUpdateDragMechanics() {
    const result = await updateDragMechanics(
      this.app,
      this.gameStore,
      this.sessionStore,
      this.inventoryStore,
      this.locationStore,
      this.debugOverlay,
      this.lastDragUpdateTime,
      this.dragStartTime,
      async (failureDistance) => {
        await handleDragFailure(
          this.app,
          this.gameStore,
          this.sessionStore,
          this.locationStore,
          this.debugOverlay,
          failureDistance,
          this.inputManager
            ? this.inputManager.getQuadrantFromPosition.bind(this.inputManager)
            : null,
          null, // No 2D rope
          this.dragLine,
          this.dragPlayerX,
          this.dragPlayerY,
        );
        // Clear line reference after reel-in
        this.dragLine = null;
      },
      () => {
        // Clean up line and rope state on successful retrieval
        if (this.dragLine && this.dragLine.parent) {
          this.dragLine.parent.removeChild(this.dragLine);
          this.dragLine.destroy();
          this.dragLine = null;
        }

        // Clear 3D rope from sessionStore
        if (this.sessionStore) {
          this.sessionStore.getState().setRope(null);
          this.sessionStore.getState().setPhase("idle");
          this.sessionStore.getState().setPhaseProgress(0);
          this.sessionStore.getState().setCastPosition(null, null);
        }
      },
    );

    this.lastDragUpdateTime = result.lastDragUpdateTime;
    this.dragStartTime = result.dragStartTime;
  }

  // Ticker method for rope physics updates during drag
  tickerUpdateRope() {
    if (!this.app || !this.dragLine) {
      return;
    }

    // Calculate delta time for physics
    const now = performance.now();
    const deltaTime = this.lastRopeUpdateTime
      ? (now - this.lastRopeUpdateTime) / 1000
      : 1 / 60; // Default to 60 FPS

    // Log if deltaTime is suspiciously large
    if (deltaTime > 0.1) {
      console.warn(
        `[TICKER] Large deltaTime in tickerUpdateRope: ${deltaTime.toFixed(3)}s (${(now - this.lastRopeUpdateTime).toFixed(0)}ms)`,
      );
    }

    this.lastRopeUpdateTime = now;

    // Update 3D rope physics and get screen coordinates
    const screenPoints = updateRopePhysics(
      this.app,
      this.sessionStore,
      deltaTime,
      this.dragPlayerX,
      this.dragPlayerY,
    );

    if (screenPoints && this.dragLine) {
      // Render 3D rope using screen-projected points
      this.dragLine.clear();
      this.dragLine.setStrokeStyle({ width: 3, color: 0x8b4513 }); // Brown rope color

      if (screenPoints.length > 0) {
        this.dragLine.moveTo(screenPoints[0].x, screenPoints[0].y);

        for (let i = 1; i < screenPoints.length; i++) {
          this.dragLine.lineTo(screenPoints[i].x, screenPoints[i].y);
        }

        this.dragLine.stroke();
      }
    }
  }

  resize(width, height) {
    if (!this.app || this.isDestroyed) return;

    try {
      this.app.renderer.resize(width, height);
      this.width = width;
      this.height = height;

      // Update debug overlay if it exists
      if (this.debugOverlay) {
        this.debugOverlay.resize(width, height);
      }
    } catch (err) {
      console.warn("Error during resize:", err);
    }
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
    console.log("PixiApp.destroy() called");

    if (this.isDestroyed) {
      console.log("PixiApp already destroyed, skipping");
      return;
    }

    this.isDestroyed = true;

    // Stop drag bubble animations
    if (this.dragBubbleInterval) {
      clearInterval(this.dragBubbleInterval);
      this.dragBubbleInterval = null;
    }

    // Clean up rope graphics
    if (this.dragLine) {
      if (this.dragLine.parent) {
        this.dragLine.parent.removeChild(this.dragLine);
      }
      this.dragLine.destroy();
      this.dragLine = null;
    }

    // Clean up rope graphics
    if (this.dragLine) {
      if (this.dragLine.parent) {
        this.dragLine.parent.removeChild(this.dragLine);
      }
      this.dragLine.destroy();
      this.dragLine = null;
    }

    // Clean up manual failure listener
    if (this.handleManualFailure) {
      window.removeEventListener("manualDragFailure", this.handleManualFailure);
      this.handleManualFailure = null;
    }

    // Clean up location store subscription
    if (this.locationStoreUnsubscribe) {
      this.locationStoreUnsubscribe();
      this.locationStoreUnsubscribe = null;
    }

    // Clean up debug overlay
    if (this.debugOverlay) {
      this.debugOverlay.destroy();
      this.debugOverlay = null;
    }

    // Clean up sprite manager
    if (this.spriteManager) {
      this.spriteManager.clearSprites();
      this.spriteManager = null;
    }

    // Clean up input manager (handles all keyboard/pointer events)
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }

    if (this.app) {
      // Safely destroy - check if renderer exists
      try {
        // Clear DevTools reference
        if (import.meta.env.DEV && globalThis.__PIXI_APP__ === this.app) {
          globalThis.__PIXI_APP__ = null;
        }

        this.app.destroy(true, { children: true, texture: true });
        console.log("PixiJS app destroyed successfully");
      } catch (err) {
        console.warn("Error during PixiJS destroy:", err);
      }
      this.app = null;
    }
  }
}
