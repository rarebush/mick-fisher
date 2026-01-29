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
import { processTap } from "./mechanics/dragMechanics.js";

// Import new modules
import {
  setupScene,
  setupWaterBackground,
  drawQuadrantGrid,
  setupEnvironmentLayers,
  drawWaterSurface,
} from "./rendering/sceneSetup.js";
import { SpriteManager } from "./rendering/spriteManager.js";
import { InputManager } from "./input/inputManager.js";
import {
  executeCastSequence,
  handleDragFailure,
  renderRope,
} from "./sequences/castSequence.js";
import { render3DRopeWithViewport } from "./animations/castAnimations.js";
import {
  getItemPosition,
  getItemWorldPosition,
  updateDragMechanics,
  updateRopePhysics,
} from "./sequences/dragSequence.js";
import {
  createViewport,
  getWorldDirectionScreenAngle,
  getSurfaceScreenBounds,
  screenToWorld,
  worldToScreen,
  WORLD_Y,
  WORLD_Z,
} from "./mechanics/worldConstants.js";
import {
  computeCastTargetWorld,
  getAvatarCastOrigin,
  getMaxCastRange,
  metersToWorldRange,
} from "./mechanics/castAimUtils.js";
import { getCastingEquipmentMaxRange } from "./data/castingEquipmentDatabase.js";

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
    this.lastRopeUpdateTime = null; // For 3D rope physics timing

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

    // Setup tickers for continuous updates
    this.app.ticker.add(this.tickerUpdateSprites, this);
    this.app.ticker.add(this.tickerUpdateDragMechanics, this);
    this.app.ticker.add(this.tickerUpdateRope, this);
    this.app.ticker.add(this.tickerUpdateCastAim, this);

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

    this.spriteLayers = {
      underwater: new PIXI.Container(),
      aboveWater: new PIXI.Container(),
      debug: new PIXI.Container(),
    };
    const waterIndex = this.sceneContainer.getChildIndex(
      this.environmentLayers.water,
    );
    this.sceneContainer.addChildAt(this.spriteLayers.underwater, waterIndex);
    const gridIndex = this.sceneContainer.getChildIndex(
      this.environmentLayers.gridLines,
    );
    this.sceneContainer.addChildAt(this.spriteLayers.aboveWater, gridIndex);
    this.sceneContainer.addChild(this.spriteLayers.debug);

    // Initialize managers
    this.spriteManager = new SpriteManager(this.app, this.spriteLayers);

    const initialWaterOpaque =
      this.gameStore?.getState()?.waterSurfaceOpaque ?? false;
    this.applyWaterSurfaceOpacity(initialWaterOpaque);
    if (this.gameStore && !this.gameStoreUnsubscribe) {
      this.gameStoreUnsubscribe = this.gameStore.subscribe(
        (state, prevState) => {
          if (state.waterSurfaceOpaque !== prevState.waterSurfaceOpaque) {
            this.applyWaterSurfaceOpacity(state.waterSurfaceOpaque);
          }
        },
      );
    }

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
        onTap: this.handleTap.bind(this),
      },
    );

    // Setup event listeners
    this.inputManager.setupInteraction();
  }

  applyWaterSurfaceOpacity(isOpaque) {
    if (!this.app || !this.environmentLayers?.water) return;
    const waterSurface = this.environmentLayers.waterSurface;
    if (!waterSurface) return;
    drawWaterSurface(this.environmentLayers.water, {
      width: this.app.screen.width,
      height: this.app.screen.height,
      waterY: waterSurface.y,
      waterHeight: waterSurface.height,
      opaque: isOpaque,
    });
  }

  // Tap callback invoked by InputManager during drag phase
  handleTap() {
    const dragState = this.sessionStore?.getState().dragState;
    if (!dragState) return;

    const newTension = processTap(dragState.tension);
    this.sessionStore.getState().updateDragTension(newTension);
    console.log(
      `[TAP] Tension: ${dragState.tension.toFixed(0)}% → ${newTension.toFixed(0)}% (+10%)`,
    );
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
      const dragState = this.sessionStore?.getState().dragState;

      // Only allow during active dragging
      if (gamePhase === "dragging" && dragState?.active) {
        console.log("[MANUAL FAILURE] Player gave up");

        // Immediately deactivate drag and set reeling phase to stop ticker physics
        this.sessionStore.getState().deactivateDrag();
        this.sessionStore.getState().setPhase("reeling");

        // Trigger failure at current distance (with rope reel-in animation)
        const currentDistance = event.detail.distance || dragState.distance;
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
        if (this.dragLineUnderwater && this.dragLineUnderwater.parent) {
          this.dragLineUnderwater.parent.removeChild(this.dragLineUnderwater);
          this.dragLineUnderwater.destroy();
          this.dragLineUnderwater = null;
        }
        if (this.dragLineDebug && this.dragLineDebug.parent) {
          this.dragLineDebug.parent.removeChild(this.dragLineDebug);
          this.dragLineDebug.destroy();
          this.dragLineDebug = null;
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

    const phase = this.sessionStore?.getState().phase;
    if (phase === "reeling") {
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
    const dragState = this.sessionStore?.getState().dragState;
    const tension = dragState?.tension ?? 50; // Default to medium tension
    updateRopePhysics(
      this.app,
      this.sessionStore,
      deltaTime,
      this.dragPlayerX,
      this.dragPlayerY,
      tension,
    );

    const rope = this.sessionStore?.getState().rope;
    if (rope && this.dragLine) {
      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      const waterSurfaceScreenY = worldToScreen(
        { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
        viewport,
      ).y;
      const hideUnderwaterSegments =
        this.gameStore?.getState()?.waterSurfaceOpaque ?? false;
      render3DRopeWithViewport(
        this.dragLine,
        rope,
        viewport,
        waterSurfaceScreenY,
        {
          tension,
          hideUnderwaterSegments,
          lineUnderwater: this.dragLineUnderwater,
          lineDebug: this.dragLineDebug,
        },
      );
    }
  }

  // Ticker method for cast aim oscillators and preview
  tickerUpdateCastAim() {
    if (!this.app || this.isDestroyed || !this.castAimOverlay) {
      return;
    }

    const sessionState = this.sessionStore?.getState();
    if (!sessionState) return;

    const gamePhase = this.gameStore?.getState().gamePhase;
    const aimState = sessionState.castAimState;
    const donutAimState = sessionState.donutAimState;
    const castMode = sessionState.castInputMode;

    const drawCastRangeRing = (viewport) => {
      const waterBounds = getSurfaceScreenBounds(
        WORLD_Z.WATER_SURFACE,
        viewport,
      );
      this.castAimMask.clear();
      this.castAimMask
        .rect(
          0,
          waterBounds.top,
          this.app.screen.width,
          waterBounds.bottom - waterBounds.top,
        )
        .fill({ color: 0xffffff });

      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      const maxRangeWorld = metersToWorldRange(maxRangeMeters);
      const rangeWorld = Math.max(0, maxRangeWorld);
      if (!Number.isFinite(rangeWorld) || rangeWorld <= 0) return;

      const origin = getAvatarCastOrigin();
      const originScreen = worldToScreen(
        { x: origin.x, y: origin.y, z: WORLD_Z.WATER_SURFACE },
        viewport,
      );
      const edgeScreen = worldToScreen(
        { x: origin.x + rangeWorld, y: origin.y, z: WORLD_Z.WATER_SURFACE },
        viewport,
      );
      const radius = Math.abs(edgeScreen.x - originScreen.x);

      this.castAimOverlay
        .circle(originScreen.x, originScreen.y, radius)
        .fill({ color: 0x00c2ff, alpha: 0.15 })
        .stroke({ width: 2, color: 0x00c2ff, alpha: 0.6 });
    };

    if (gamePhase !== "idle") {
      if (aimState && aimState.phase !== "idle") {
        sessionState.resetCastAim();
      }
      if (donutAimState && donutAimState.phase !== "idle") {
        sessionState.resetDonutAim();
      }
      this.castAimOverlay.clear();
      return;
    }

    if (castMode === "direction_power") {
      if (!aimState || aimState.phase === "idle") {
        this.castAimOverlay.clear();
        const viewport = createViewport(
          this.app.screen.width,
          this.app.screen.height,
        );
        drawCastRangeRing(viewport);
        return;
      }

      const now = performance.now();
      const deltaTime = aimState.lastUpdate
        ? (now - aimState.lastUpdate) / 1000
        : 0;
      if (deltaTime > 0) {
        sessionState.updateCastAim(deltaTime);
      }

      const updatedAim = this.sessionStore.getState().castAimState;
      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      const previewPower = updatedAim.phase === "angle" ? 1 : updatedAim.power;
      const targetWorld = computeCastTargetWorld(
        updatedAim.angle,
        previewPower,
        viewport,
        maxRangeMeters,
      );
      const targetScreen = worldToScreen(targetWorld, viewport);
      const avatarScreen = worldToScreen(
        { x: 0, y: WORLD_Y.AVATAR, z: WORLD_Z.AVATAR_HAND },
        viewport,
      );

      this.castAimOverlay.clear();
      drawCastRangeRing(viewport);

      // Preview line and marker
      this.castAimOverlay.setStrokeStyle({
        width: 2,
        color: 0x00c2ff,
        alpha: 0.8,
      });
      this.castAimOverlay.moveTo(avatarScreen.x, avatarScreen.y);
      this.castAimOverlay.lineTo(targetScreen.x, targetScreen.y);
      this.castAimOverlay.stroke();
      this.castAimOverlay
        .circle(targetScreen.x, targetScreen.y, 5)
        .stroke({ width: 2, color: 0x00c2ff });

      const barWidth = 220;
      const barHeight = 6;
      const centerX = this.app.screen.width / 2;
      const angleBarY = this.app.screen.height - 70;
      const powerBarY = this.app.screen.height - 45;

      // Angle bar
      this.castAimOverlay
        .rect(centerX - barWidth / 2, angleBarY, barWidth, barHeight)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
      const angleNorm = (updatedAim.angle + 90) / 180;
      const angleX = centerX - barWidth / 2 + angleNorm * barWidth;
      this.castAimOverlay
        .circle(angleX, angleBarY + barHeight / 2, 4)
        .fill({ color: 0xffd700 });

      // Power bar (only when selecting power)
      if (updatedAim.phase === "power") {
        this.castAimOverlay
          .rect(centerX - barWidth / 2, powerBarY, barWidth, barHeight)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
        const powerX = centerX - barWidth / 2 + updatedAim.power * barWidth;
        this.castAimOverlay
          .circle(powerX, powerBarY + barHeight / 2, 4)
          .fill({ color: 0x00ff7f });
      }
      return;
    }

    if (castMode === "donut") {
      if (!donutAimState || donutAimState.phase === "idle") {
        this.castAimOverlay.clear();
        const viewport = createViewport(
          this.app.screen.width,
          this.app.screen.height,
        );
        drawCastRangeRing(viewport);
        return;
      }

      const now = performance.now();
      const deltaTime = donutAimState.lastUpdate
        ? (now - donutAimState.lastUpdate) / 1000
        : 0;
      if (deltaTime > 0) {
        sessionState.updateDonutAim(deltaTime);
      }

      const updatedDonut = this.sessionStore.getState().donutAimState;
      if (!updatedDonut.target) {
        this.castAimOverlay.clear();
        return;
      }

      this.castAimOverlay.clear();

      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      drawCastRangeRing(viewport);
      const avatarWorld = { x: 0, y: WORLD_Y.AVATAR };
      const targetWorld = screenToWorld(
        updatedDonut.target.x,
        updatedDonut.target.y,
        WORLD_Z.WATER_SURFACE,
        viewport,
      );
      const orientation = getWorldDirectionScreenAngle(
        avatarWorld,
        targetWorld,
        WORLD_Z.WATER_SURFACE,
        viewport,
      );

      const drawOrientedEllipse = (centerX, centerY, radiusX, radiusY) => {
        const steps = 72;
        const cosOrientation = Math.cos(orientation);
        const sinOrientation = Math.sin(orientation);
        for (let i = 0; i <= steps; i += 1) {
          const angle = (i / steps) * Math.PI * 2;
          const localX = Math.cos(angle) * radiusX;
          const localY = Math.sin(angle) * radiusY;
          const rotatedX = localX * cosOrientation - localY * sinOrientation;
          const rotatedY = localX * sinOrientation + localY * cosOrientation;
          const x = centerX + rotatedX;
          const y = centerY + rotatedY;
          if (i === 0) {
            this.castAimOverlay.moveTo(x, y);
          } else {
            this.castAimOverlay.lineTo(x, y);
          }
        }
        this.castAimOverlay.stroke();
      };

      // Min and max accuracy rings
      this.castAimOverlay.setStrokeStyle({
        width: 2,
        color: 0x6bdcff,
        alpha: 0.8,
      });
      drawOrientedEllipse(
        updatedDonut.target.x,
        updatedDonut.target.y,
        updatedDonut.minRadiusX,
        updatedDonut.minRadiusY,
      );
      drawOrientedEllipse(
        updatedDonut.target.x,
        updatedDonut.target.y,
        updatedDonut.maxRadiusX,
        updatedDonut.maxRadiusY,
      );

      // Target marker
      this.castAimOverlay
        .circle(updatedDonut.target.x, updatedDonut.target.y, 3)
        .fill({ color: 0xffffff });

      if (updatedDonut.phase === "oscillate") {
        this.castAimOverlay.setStrokeStyle({
          width: 2,
          color: 0xffd700,
          alpha: 0.9,
        });
        drawOrientedEllipse(
          updatedDonut.target.x,
          updatedDonut.target.y,
          updatedDonut.currentRadiusX,
          updatedDonut.currentRadiusY,
        );
      }
      return;
    }

    if (aimState && aimState.phase !== "idle") {
      sessionState.resetCastAim();
    }
    if (donutAimState && donutAimState.phase !== "idle") {
      sessionState.resetDonutAim();
    }
    this.castAimOverlay.clear();

    if (castMode === "click") {
      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      drawCastRangeRing(viewport);
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
