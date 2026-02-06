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
  drawQuadrantGrid,
  setupEnvironmentLayers,
  drawWorldBoundsWireframe,
} from "./rendering/sceneSetup.js";
import { SpriteManager } from "./rendering/spriteManager.js";
import { clamp } from "./physics/vectorUtils.js";
import { InputManager } from "./input/inputManager.js";
import {
  executeCastSequence,
  handleDragFailure,
} from "./sequences/castSequence.js";
import { getItemWorldPosition } from "./sequences/dragSequence.js";
import { updateCastAimOverlay } from "./rendering/castAimRenderer.js";
import { updateSpriteTicker } from "./rendering/spriteTicker.js";
import { updateRopeTicker } from "./rendering/ropeTicker.js";
import { updateDragTicker } from "./sequences/dragTicker.js";

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
        roundPixels: true, // Round coordinates to whole pixels
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
    if (!this.app || this.isDestroyed) return;

    // Setup tickers for continuous updates
    this.app.ticker.add(this.tickerUpdateSprites, this);
    this.app.ticker.add(this.tickerUpdateDragMechanics, this);
    this.app.ticker.add(this.tickerUpdateRope, this);
    this.app.ticker.add(this.tickerUpdateCastAim, this);
    this.app.ticker.add(this.tickerUpdateCaustics, this);

    // Create scene container to offset for 3D perspective
    // This prevents negative Y coordinates from rendering off-screen
    this.sceneContainer = new PIXI.Container();
    this.sceneContainer.y = 0; // No offset needed - layers fill screen
    this.app.stage.addChild(this.sceneContainer);

    // Setup 3D environment layers (pier, wall, water, riverbed)
    this.environmentLayers = await setupEnvironmentLayers(
      this.sceneContainer,
      this.app.screen.width,
      this.app.screen.height,
    );

    this.spriteLayers = {
      underwater: new PIXI.Container(),
      aboveWater: new PIXI.Container(),
      debug: new PIXI.Container(),
    };
    const waterIndex = this.sceneContainer.getChildIndex(
      this.environmentLayers.waterVolume,
    );
    this.sceneContainer.addChildAt(this.spriteLayers.underwater, waterIndex);
    const walkwayIndex = this.sceneContainer.getChildIndex(
      this.environmentLayers.walkwayVolume,
    );
    this.sceneContainer.addChildAt(this.spriteLayers.aboveWater, walkwayIndex);
    this.sceneContainer.addChild(this.spriteLayers.debug);

    // Initialize managers
    this.spriteManager = new SpriteManager(this.app, this.spriteLayers);

    const initialRenderResolutionScale =
      this.gameStore?.getState()?.renderResolutionScale ?? 1;
    this.setRenderResolutionScale(initialRenderResolutionScale);
    if (this.gameStore && !this.gameStoreUnsubscribe) {
      // Sync initial values from store
      const storeState = this.gameStore.getState();
      if (this.environmentLayers) {
        this.environmentLayers.currentSpeed = storeState.currentSpeed ?? 1;
        this.environmentLayers.choppiness = storeState.choppiness ?? 1;
      }

      this.gameStoreUnsubscribe = this.gameStore.subscribe(
        (state, prevState) => {
          if (state.renderResolutionScale !== prevState.renderResolutionScale) {
            this.setRenderResolutionScale(state.renderResolutionScale);
          }
          if (state.currentSpeed !== prevState.currentSpeed) {
            if (this.environmentLayers) {
              this.environmentLayers.currentSpeed = state.currentSpeed;
            }
          }
          if (state.choppiness !== prevState.choppiness) {
            if (this.environmentLayers) {
              this.environmentLayers.choppiness = state.choppiness;
            }
          }
        },
      );
    }

    // No need to apply Y offset - layers are positioned to fill screen
    console.log(`[SCENE] Environment layers created, filling full screen`);

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

    // Debug: visualize viewport-fitting world bounds
    drawWorldBoundsWireframe(this.app);

    // Overlay for cast aim UI
    this.castAimOverlay = new PIXI.Graphics();
    this.castAimOverlay.zIndex = 10000;
    this.app.stage.addChild(this.castAimOverlay);

    this.castAimMask = new PIXI.Graphics();
    this.castAimMask.zIndex = 9999;
    this.app.stage.addChild(this.castAimMask);
    this.castAimOverlay.mask = this.castAimMask;
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

  setRenderResolutionScale(scale) {
    if (!this.app || this.isDestroyed) return;
    const nextScale = Number.isFinite(scale) ? clamp(scale, 1, 4) : 1;
    if (this.app.renderer.resolution === nextScale) return;

    try {
      this.app.renderer.resolution = nextScale;
      this.app.renderer.resize(this.width, this.height);
      if (this.debugOverlay) {
        this.debugOverlay.resize(this.width, this.height);
      }
    } catch (err) {
      console.warn("Error updating render resolution:", err);
    }
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
      () => getItemWorldPosition(this.app, this.sessionStore),
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
      const physicsState = this.sessionStore?.getState().physicsState;

      // Only allow during active dragging
      if (gamePhase === "dragging" && physicsState?.active) {
        console.log("[MANUAL FAILURE] Player gave up");
        this.inputManager?.resetInputState();

        // Immediately deactivate drag and set reeling phase to stop ticker physics
        this.sessionStore.getState().deactivateDrag();
        this.sessionStore.getState().setPhase("reeling");

        // Trigger failure at current distance (with rope reel-in animation)
        const currentTarget = physicsState?.target?.position;
        if (this.dragLineUnderwater && this.dragLineUnderwater.parent) {
          this.dragLineUnderwater.parent.removeChild(this.dragLineUnderwater);
          this.dragLineUnderwater.destroy();
        }
        this.dragLineUnderwater = null;
        if (this.dragLineDebug && this.dragLineDebug.parent) {
          this.dragLineDebug.parent.removeChild(this.dragLineDebug);
          this.dragLineDebug.destroy();
        }
        this.dragLineDebug = null;

        await handleDragFailure(
          this.app,
          this.gameStore,
          this.sessionStore,
          this.locationStore,
          this.debugOverlay,
          currentTarget,
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
        if (this.dragLineDebug && this.dragLineDebug.parent) {
          this.dragLineDebug.parent.removeChild(this.dragLineDebug);
          this.dragLineDebug.destroy();
        }
        this.dragLineDebug = null;

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
    updateSpriteTicker({
      spriteManager: this.spriteManager,
      sessionStore: this.sessionStore,
      gameStore: this.gameStore,
      app: this.app,
    });
  }

  // Ticker method for drag mechanics updates
  async tickerUpdateDragMechanics() {
    const result = await updateDragTicker({
      app: this.app,
      gameStore: this.gameStore,
      sessionStore: this.sessionStore,
      inventoryStore: this.inventoryStore,
      locationStore: this.locationStore,
      debugOverlay: this.debugOverlay,
      lastDragUpdateTime: this.lastDragUpdateTime,
      dragStartTime: this.dragStartTime,
      inputManager: this.inputManager,
      dragLine: this.dragLine,
      dragPlayerX: this.dragPlayerX,
      dragPlayerY: this.dragPlayerY,
      dragLineUnderwater: this.dragLineUnderwater,
      dragLineDebug: this.dragLineDebug,
    });

    this.lastDragUpdateTime = result.lastDragUpdateTime;
    this.dragStartTime = result.dragStartTime;
    this.dragLine = result.dragLine;
    this.dragLineUnderwater = result.dragLineUnderwater;
    this.dragLineDebug = result.dragLineDebug;
  }

  // Ticker method for rope rendering during drag
  tickerUpdateRope() {
    const result = updateRopeTicker({
      app: this.app,
      sessionStore: this.sessionStore,
      dragLine: this.dragLine,
      dragLineUnderwater: this.dragLineUnderwater,
      dragLineDebug: this.dragLineDebug,
      dragPlayerX: this.dragPlayerX,
      dragPlayerY: this.dragPlayerY,
      lastRopeUpdateTime: this.lastRopeUpdateTime,
    });
    this.lastRopeUpdateTime = result.lastRopeUpdateTime;
  }

  // Ticker method for cast aim oscillators and preview
  tickerUpdateCastAim() {
    if (!this.app || this.isDestroyed || !this.castAimOverlay) {
      return;
    }

    updateCastAimOverlay({
      app: this.app,
      castAimOverlay: this.castAimOverlay,
      castAimMask: this.castAimMask,
      gameStore: this.gameStore,
      sessionStore: this.sessionStore,
    });
  }

  // Ticker method for caustics + displacement animation
  tickerUpdateCaustics() {
    if (!this.app || this.isDestroyed || !this.environmentLayers) return;

    const dt = this.app.ticker.deltaMS / 1000;

    // Target values from store (may change instantly via UI or game events).
    // currentSpeed scales directional drift (1 = default, 2 = twice as fast).
    // choppiness scales displacement amplitude, sparkle density, caustic warp.
    const targetSpeed = this.environmentLayers.currentSpeed ?? 1;
    const targetChoppiness = this.environmentLayers.choppiness ?? 1;

    // Smooth-lerp toward targets using frame-rate-independent exponential
    // easing. Rate controls how fast the transition is — higher = snappier.
    // At rate=3, ~95% of the transition completes in ~1 second.
    const transitionRate = 3;
    const blend = 1 - Math.exp(-transitionRate * dt);

    // Initialise smoothed values on first frame
    if (this._smoothCurrentSpeed === undefined) {
      this._smoothCurrentSpeed = targetSpeed;
    }
    if (this._smoothChoppiness === undefined) {
      this._smoothChoppiness = targetChoppiness;
    }

    this._smoothCurrentSpeed += (targetSpeed - this._smoothCurrentSpeed) * blend;
    this._smoothChoppiness += (targetChoppiness - this._smoothChoppiness) * blend;

    const currentSpeed = this._smoothCurrentSpeed;
    const choppiness = this._smoothChoppiness;

    // Accumulate downstream flow distance at 24 FPS cadence.
    // Using accumulated distance instead of time*speed avoids discontinuities
    // when currentSpeed transitions — the phase just grows faster/slower.
    const FLOW_FPS_STEP = 1 / 24;
    this._flowAccumTime = (this._flowAccumTime || 0) + dt;
    if (this._flowAccumTime >= FLOW_FPS_STEP) {
      const steps = Math.floor(this._flowAccumTime / FLOW_FPS_STEP);
      this._flowAccumTime -= steps * FLOW_FPS_STEP;
      this._flowPhase = (this._flowPhase || 0) + steps * FLOW_FPS_STEP * currentSpeed;
    }
    const flowPhase = this._flowPhase || 0;

    // Animate caustics uTime (normal rate — drift uses flowPhase)
    const causticsFilter = this.environmentLayers.causticsFilter;
    if (causticsFilter) {
      const cu = causticsFilter.resources.causticsUniforms.uniforms;
      cu.uTime += dt;
      cu.uFlowPhase = flowPhase;
      cu.uChoppiness = choppiness;
    }

    // Animate water surface sparkles (drift uses flowPhase, no uTime needed)
    const waterSurfaceShader = this.environmentLayers.waterSurfaceShader;
    if (waterSurfaceShader) {
      const wu = waterSurfaceShader.resources.waterUniforms.uniforms;
      wu.uFlowPhase = flowPhase;
      wu.uChoppiness = choppiness;
    }

    // Apply choppiness to displacement filter scale.
    // Base scale is 4; choppiness multiplies it (1 = default, 2 = twice as wavy).
    const displacementFilter = this.environmentLayers.displacementFilter;
    if (displacementFilter) {
      const baseScale = 4;
      displacementFilter.scale.x = baseScale * choppiness;
      displacementFilter.scale.y = baseScale * choppiness;
    }

    // Scroll displacement sprite along isometric X axis for water flow.
    // Quantized to 24 FPS to match the pixel art animation cadence.
    // Uses the smoothed currentSpeed so flow acceleration is gradual.
    const sprite = this.environmentLayers.displacementSprite;
    if (sprite) {
      const baseFlowSpeed = 12; // pixels per second at currentSpeed=1
      const FPS_STEP = 1 / 24;
      this._displacementTime = (this._displacementTime || 0) + dt;
      if (this._displacementTime >= FPS_STEP) {
        const steps = Math.floor(this._displacementTime / FPS_STEP);
        this._displacementTime -= steps * FPS_STEP;
        const elapsed = steps * FPS_STEP;
        const dirX = this.environmentLayers.flowDirX || 0.894;
        const dirY = this.environmentLayers.flowDirY || 0.447;
        sprite.x += dirX * baseFlowSpeed * currentSpeed * elapsed;
        sprite.y += dirY * baseFlowSpeed * currentSpeed * elapsed;
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
    if (this.dragLineUnderwater) {
      if (this.dragLineUnderwater.parent) {
        this.dragLineUnderwater.parent.removeChild(this.dragLineUnderwater);
      }
      this.dragLineUnderwater.destroy();
      this.dragLineUnderwater = null;
    }
    if (this.dragLineDebug) {
      if (this.dragLineDebug.parent) {
        this.dragLineDebug.parent.removeChild(this.dragLineDebug);
      }
      this.dragLineDebug.destroy();
      this.dragLineDebug = null;
    }

    if (this.castAimOverlay) {
      if (this.castAimOverlay.parent) {
        this.castAimOverlay.parent.removeChild(this.castAimOverlay);
      }
      this.castAimOverlay.destroy();
      this.castAimOverlay = null;
    }

    // Clean up rope graphics
    if (this.dragLine) {
      if (this.dragLine.parent) {
        this.dragLine.parent.removeChild(this.dragLine);
      }
      this.dragLine.destroy();
      this.dragLine = null;
    }
    if (this.dragLineUnderwater) {
      if (this.dragLineUnderwater.parent) {
        this.dragLineUnderwater.parent.removeChild(this.dragLineUnderwater);
      }
      this.dragLineUnderwater.destroy();
      this.dragLineUnderwater = null;
    }
    if (this.dragLineDebug) {
      if (this.dragLineDebug.parent) {
        this.dragLineDebug.parent.removeChild(this.dragLineDebug);
      }
      this.dragLineDebug.destroy();
      this.dragLineDebug = null;
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

    if (this.gameStoreUnsubscribe) {
      this.gameStoreUnsubscribe();
      this.gameStoreUnsubscribe = null;
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

    if (this.spriteLayers) {
      this.spriteLayers.underwater.destroy({ children: true });
      this.spriteLayers.aboveWater.destroy({ children: true });
      this.spriteLayers.debug.destroy({ children: true });
      this.spriteLayers = null;
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
