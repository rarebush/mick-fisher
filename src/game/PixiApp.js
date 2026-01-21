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
import { getItem } from "./data/itemDatabase.js";
import {
  createPlaceholderSprite,
  createMagnetSprite,
} from "./graphics/placeholderSprites.js";
import {
  loadSpriteSheet,
  createTiledBackground,
} from "./graphics/spriteLoader.js";
import {
  processTap,
  calculateTensionBuildRate,
  updateDragState,
} from "./mechanics/dragMechanics.js";
import { DebugOverlay } from "./graphics/debugOverlay.js";
import useLocationStore from "./state/locationStore.js";

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
        this.setupScene();
        this.setupInteraction();
        this.setupDebugOverlay();
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

  setupScene() {
    if (!this.app || this.isDestroyed) return;

    // Add ticker for continuous updates (sprites + drag mechanics)
    this.app.ticker.add(this.updateSprites, this);
    this.app.ticker.add(this.updateDragMechanics, this);

    // Track last update time for deltaTime calculation
    this.lastDragUpdateTime = null;
    this.dragStartTime = null;

    // Shore
    const shore = new PIXI.Graphics()
      .rect(0, 0, this.app.screen.width, 80)
      .fill(0x8b7355);
    this.app.stage.addChild(shore);

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

    // Load and setup water tiles (if available), then draw grid on top
    this.setupWaterBackground().then(() => {
      this.drawQuadrantGrid();
    });
  }

  /**
   * Setup animated water background
   * Falls back to solid color if sprite assets not available
   */
  async setupWaterBackground() {
    if (!this.app || this.isDestroyed) return;

    try {
      // Try to load water sprite sheet
      this.waterSpritesheet = await loadSpriteSheet(
        "/sprites/water.png",
        "/sprites/water.json",
      );

      // Get tile size from first frame
      const firstTexture = this.waterSpritesheet.animations.default[0];
      const tileWidth = firstTexture.width;
      const tileHeight = firstTexture.height;

      // Create water container to position below shore
      const waterContainer = new PIXI.Container();
      waterContainer.y = 80; // Start below shore area
      this.app.stage.addChild(waterContainer);

      // Create tiled background (only for the water area below shore)
      this.waterTiles = createTiledBackground(
        waterContainer,
        this.waterSpritesheet,
        this.app.screen.width,
        this.app.screen.height - 80, // Height minus shore area
        tileWidth,
        tileHeight,
        0.1, // Animation speed
        4, // Scale 4x (32px tiles become 128px)
      );

      console.log("Water tiles loaded successfully");
    } catch (error) {
      // Fallback to solid color if sprite not found
      console.log("Water sprites not found, using fallback color");
      const water = new PIXI.Graphics()
        .rect(0, 0, this.app.screen.width, this.app.screen.height)
        .fill(0x3a6c8e);
      this.app.stage.addChild(water);
    }
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

    // Track input state
    this.isDragging = false;
    this.lastTapTime = 0;
    this.isCasting = false;
    this.activePointerId = null; // Track which pointer is active

    // Sprite references
    this.itemSprite = null;
    this.magnetSprite = null;

    // Spritesheet references
    this.waterSpritesheet = null;
    this.waterTiles = [];

    // Pointer down handler
    this.app.stage.on("pointerdown", (event) => {
      // Ignore if we're already tracking a pointer
      if (
        this.activePointerId !== null &&
        this.activePointerId !== event.pointerId
      ) {
        return;
      }

      const { x, y } = event.global;
      if (y < 80) return; // Shore area, no interaction

      const gamePhase = this.gameStore?.getState().gamePhase;

      // Handle dragging phase
      if (gamePhase === "dragging") {
        this.activePointerId = event.pointerId;
        this.handleDragMouseDown();
        return;
      }

      // Only allow casting when idle
      if (gamePhase !== "idle") {
        return;
      }

      // Block casting while notification is showing
      const lastCompletedCast = this.gameStore?.getState().lastCompletedCast;
      if (lastCompletedCast) {
        return;
      }

      // Prevent duplicate casts
      if (this.isCasting) {
        return;
      }

      const quadrant = this.getQuadrantFromPosition(x, y);
      if (quadrant === null) return;

      // Check if quadrant is accessible
      const equipment = this.gameStore?.getState().equipment;
      if (!isQuadrantAccessible(quadrant, equipment?.lineLength || 8)) {
        this.showAccessMessage(x, y);
        return;
      }

      this.activePointerId = event.pointerId;
      this.isCasting = true;
      this.executeCastSequence(x, y, quadrant).finally(() => {
        this.isCasting = false;
        this.activePointerId = null;
      });
    });

    // Pointer up handler
    this.app.stage.on("pointerup", (event) => {
      // Only handle if this is our tracked pointer
      if (this.activePointerId !== event.pointerId) {
        return;
      }

      const gamePhase = this.gameStore?.getState().gamePhase;
      if (gamePhase === "dragging") {
        this.handleDragMouseUp();
      }

      this.activePointerId = null;
    });

    // Pointer up outside (when pointer leaves canvas while down)
    this.app.stage.on("pointerupoutside", (event) => {
      if (this.activePointerId !== event.pointerId) {
        return;
      }

      const gamePhase = this.gameStore?.getState().gamePhase;
      if (gamePhase === "dragging") {
        this.handleDragMouseUp();
      }

      this.activePointerId = null;
    });

    // Pointer cancel (important for touch devices)
    this.app.stage.on("pointercancel", (event) => {
      if (this.activePointerId !== event.pointerId) {
        return;
      }

      // Force cleanup on cancel
      this.resetInputState();
    });

    // Add keyboard support for dragging
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    // Ensure cleanup when losing focus
    window.addEventListener("blur", this.handleWindowBlur);
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

  handleKeyDown = (event) => {
    // Toggle debug overlay with 'D' key
    if (event.key.toLowerCase() === "d") {
      this.debugOverlay?.toggle();
      // Update engaged items display when toggling on
      if (this.debugOverlay?.visible) {
        const currentLocation =
          this.gameStore?.getState().currentLocation || "picturesque-river";
        this.debugOverlay.updateEngagedItems(currentLocation);
      }
      return;
    }

    // Clear engaged items with 'C' key (when debug overlay is visible)
    if (event.key.toLowerCase() === "c" && this.debugOverlay?.visible) {
      if (confirm("Clear all engaged items for this location?")) {
        const currentLocation =
          this.gameStore?.getState().currentLocation || "picturesque-river";
        this.locationStore.getState().clearLocation(currentLocation);
        this.debugOverlay.updateEngagedItems(currentLocation);
        console.log(`[DEBUG] Cleared all engaged items for ${currentLocation}`);
      }
      return;
    }

    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase !== "dragging") return;

    // Space or any key to drag
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (!this.isDragging) {
        this.handleDragMouseDown();
      }
    }
  };

  handleKeyUp = (event) => {
    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase !== "dragging") return;

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      this.handleDragMouseUp();
    }
  };

  handleWindowBlur = () => {
    // Reset all input state when window loses focus
    this.resetInputState();
  };

  resetInputState() {
    this.isDragging = false;
    this.activePointerId = null;

    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
  }

  handleDragMouseDown() {
    const now = performance.now();
    const timeSinceLastTap = now - this.lastTapTime;

    // Detect tap (quick press) vs hold
    if (timeSinceLastTap < 200) {
      // This is part of rapid tapping, don't set holding
      return;
    }

    this.lastTapTime = now;
    this.isDragging = true;

    // Update session store
    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: true });
    }
  }

  handleDragMouseUp() {
    if (!this.isDragging) return;

    const now = performance.now();
    const pressDuration = now - this.lastTapTime;

    // If released within 200ms, treat as tap
    if (pressDuration < 200) {
      const currentCast = this.gameStore?.getState().currentCast;
      const dragState = this.sessionStore?.getState().dragState;

      if (currentCast?.itemId && dragState) {
        const item = getItem(currentCast.itemId);

        if (item) {
          const newTension = processTap(dragState.tension);
          this.sessionStore.getState().updateDragTension(newTension);
        }
      }
    }

    this.isDragging = false;

    // Update session store
    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
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
    // Show spawn table for this quadrant in debug overlay
    const currentLocation =
      this.gameStore?.getState().currentLocation || "picturesque-river";
    this.debugOverlay?.showSpawnTable(quadrant, currentLocation);
    this.debugOverlay?.highlightQuadrant(quadrant, x, y);

    // Check for engaged item hit
    const hitItem = this.locationStore
      .getState()
      .checkForHit(currentLocation, x, y, quadrant);

    // Animate casting line
    await this.animateCastLine(x, y);

    // Visual feedback - ripple at landing point
    this.createRipple(x, y);

    // Create bubbles to show magnet sinking
    this.createBubbles(x, y, 500);

    // Execute cast mechanics (with hit detection)
    const castResult = executeCast(quadrant, currentLocation, x, y, hitItem);

    // Log spawn event to debug overlay
    if (castResult.success) {
      this.debugOverlay?.logSpawnEvent({
        quadrant,
        success: true,
        itemName: castResult.item.name,
        distance: castResult.distance,
        magnetPosition: castResult.magnetPosition,
        placement: castResult.placementQuality.label,
        isEngaged: castResult.isEngagedItem,
      });
    } else {
      this.debugOverlay?.logSpawnEvent({
        quadrant,
        success: false,
      });
    }

    // Update game state
    if (this.gameStore) {
      const { startCast, setCaughtItem, setGamePhase } =
        this.gameStore.getState();
      startCast(quadrant, castResult.distance, castResult.depth);

      // Simulate cast/sink animation
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (castResult.success) {
        // Item found!
        setCaughtItem(castResult.item.id);

        // Store cast metadata (including engaged item tracking)
        this.gameStore.setState((state) => ({
          currentCast: {
            ...state.currentCast,
            item: castResult.item, // Store the full item object
            placementQuality: castResult.placementQuality,
            itemInstanceId: castResult.itemInstanceId,
            isEngagedItem: castResult.isEngagedItem,
            itemPosition: castResult.itemPosition,
            itemSize: castResult.itemSize,
          },
        }));

        // For re-engaged items, update the engaged position
        // (For new items, wait until drag fails to engage them)
        if (castResult.isEngagedItem) {
          this.locationStore
            .getState()
            .engageItem(currentLocation, castResult.itemInstanceId, {
              item: castResult.item,
              x: castResult.itemPosition.x,
              y: castResult.itemPosition.y,
              size: castResult.itemSize,
              quadrant,
            });

          // Update debug overlay to show engaged item
          this.debugOverlay?.updateEngagedItems(currentLocation);
        }

        console.log(
          `[CAST] ${castResult.isEngagedItem ? "Re-engaged" : "New"} item: ${castResult.item.name} at (${castResult.itemPosition.x.toFixed(1)}, ${castResult.itemPosition.y.toFixed(1)})`,
        );

        // Calculate initial position based on distance
        // For new items, use cast location
        // For re-engaged items, use saved position for progressive retrieval
        const initialPosition = castResult.isEngagedItem
          ? castResult.itemPosition
          : { x, y };

        // Start drag phase with magnet position
        const { startDrag } = this.sessionStore.getState();
        startDrag(
          castResult.distance,
          castResult.magnetPosition,
          castResult.magnetContactWidth,
          initialPosition,
          quadrant,
        );
        setGamePhase("dragging");

        // Start periodic bubble animation during drag
        this.startDragBubbles();

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

  animateCastLine(targetX, targetY) {
    return new Promise((resolve) => {
      if (!this.app || this.isDestroyed) {
        resolve();
        return;
      }

      // Starting point - center of top edge (shore)
      const startX = this.app.screen.width / 2;
      const startY = 40; // Middle of shore area

      // Calculate arc control point (creates downward curve)
      const midX = (startX + targetX) / 2;
      const midY = (startY + targetY) / 2 - 50; // Raised up to create arc

      // Create graphics object for the line
      const line = new PIXI.Graphics();
      this.app.stage.addChild(line);

      // Animation parameters
      const duration = 400; // milliseconds
      const startTime = performance.now();

      const animate = (currentTime) => {
        if (this.isDestroyed || !this.app) {
          if (line.parent) {
            this.app.stage.removeChild(line);
          }
          line.destroy();
          resolve();
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out for more natural cast)
        const eased = 1 - Math.pow(1 - progress, 3);

        // Draw the curved line up to current progress
        line.clear();

        // Draw dotted/dashed line along the arc
        const segments = 20;
        const drawSegments = Math.floor(segments * eased);

        for (let i = 0; i <= drawSegments; i++) {
          const t = i / segments;

          // Quadratic bezier curve calculation
          const x =
            Math.pow(1 - t, 2) * startX +
            2 * (1 - t) * t * midX +
            Math.pow(t, 2) * targetX;
          const y =
            Math.pow(1 - t, 2) * startY +
            2 * (1 - t) * t * midY +
            Math.pow(t, 2) * targetY;

          // Draw small circles to create dotted line effect
          if (i % 2 === 0) {
            line.circle(x, y, 2).fill(0xffffff);
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Line animation complete, fade it out
          let alpha = 1;
          const fadeOut = () => {
            if (this.isDestroyed || !this.app) {
              if (line.parent) {
                this.app.stage.removeChild(line);
              }
              line.destroy();
              resolve();
              return;
            }

            alpha -= 0.1;
            line.alpha = alpha;

            if (alpha <= 0) {
              this.app.stage.removeChild(line);
              line.destroy();
              resolve();
            } else {
              requestAnimationFrame(fadeOut);
            }
          };
          fadeOut();
        }
      };

      requestAnimationFrame(animate);
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

  createBubbles(x, y, duration = 500) {
    if (!this.app || this.isDestroyed) return;

    const bubbleCount = 8;
    const bubbles = [];

    for (let i = 0; i < bubbleCount; i++) {
      // Stagger bubble creation
      setTimeout(
        () => {
          if (this.isDestroyed || !this.app) return;

          const bubble = new PIXI.Graphics()
            .circle(0, 0, 2 + Math.random() * 3)
            .fill(0xadd8e6);

          // Random horizontal offset from center
          bubble.x = x + (Math.random() - 0.5) * 30;
          bubble.y = y;
          bubble.alpha = 0.6 + Math.random() * 0.4;

          this.app.stage.addChild(bubble);
          bubbles.push(bubble);

          // Animate bubble rising
          const riseSpeed = 1 + Math.random() * 2;
          const drift = (Math.random() - 0.5) * 0.5;
          let bubbleAlpha = bubble.alpha;

          const animate = () => {
            if (this.isDestroyed || !this.app) {
              if (bubble.parent) {
                this.app.stage.removeChild(bubble);
              }
              bubble.destroy();
              return;
            }

            bubble.y -= riseSpeed;
            bubble.x += drift;
            bubbleAlpha -= 0.015;
            bubble.alpha = bubbleAlpha;

            // Remove when faded or reached surface (y < 80)
            if (bubbleAlpha <= 0 || bubble.y < 80) {
              if (bubble.parent) {
                this.app.stage.removeChild(bubble);
              }
              bubble.destroy();
            } else {
              requestAnimationFrame(animate);
            }
          };
          animate();
        },
        i * (duration / bubbleCount),
      );
    }
  }

  startDragBubbles() {
    // Clear any existing interval
    this.stopDragBubbles();

    // Create bubbles every 800ms while dragging
    this.dragBubbleInterval = setInterval(() => {
      if (this.isDestroyed || !this.app || !this.sessionStore) {
        this.stopDragBubbles();
        return;
      }

      const dragState = this.sessionStore.getState().dragState;
      const gamePhase = this.gameStore?.getState().gamePhase;

      // Stop if no longer dragging
      if (!dragState.active || gamePhase !== "dragging") {
        this.stopDragBubbles();
        return;
      }

      // Calculate current item position
      const itemPos = this.getItemPosition();
      if (itemPos) {
        // Create a small burst of bubbles (fewer than initial cast)
        this.createBubbles(itemPos.x, itemPos.y, 300);
      }
    }, 800);
  }

  stopDragBubbles() {
    if (this.dragBubbleInterval) {
      clearInterval(this.dragBubbleInterval);
      this.dragBubbleInterval = null;
    }
  }

  getItemPosition() {
    if (!this.app || !this.sessionStore) return null;

    const dragState = this.sessionStore.getState().dragState;
    if (!dragState.active) return null;

    const { castPosition, distance, totalDistance } = dragState;

    // Interpolate between cast position and shore bottom
    const shoreX = this.app.screen.width / 2;
    const shoreY = 80; // Bottom of shore area

    // Progress: 0 = at cast position, 1 = at shore
    const progress = 1 - distance / totalDistance;

    const currentX = castPosition.x + (shoreX - castPosition.x) * progress;
    const currentY = castPosition.y + (shoreY - castPosition.y) * progress;

    return { x: currentX, y: currentY };
  }

  /**
   * Calculate position for a specific distance value
   * Used when drag fails to determine where item stopped
   */
  calculatePositionAtDistance(distance, castPosition, totalDistance) {
    if (!this.app) return null;

    const shoreX = this.app.screen.width / 2;
    const shoreY = 80;
    const progress = 1 - distance / totalDistance;

    const x = castPosition.x + (shoreX - castPosition.x) * progress;
    const y = castPosition.y + (shoreY - castPosition.y) * progress;

    return { x, y };
  }

  /**
   * Handle drag failure - update engaged item position to where it stopped
   */
  handleDragFailure(failureDistance) {
    if (!this.gameStore || !this.sessionStore || !this.locationStore) return;

    const currentCast = this.gameStore.getState().currentCast;
    const dragState = this.sessionStore.getState().dragState;
    const currentLocation = this.gameStore.getState().currentLocation;

    if (!currentCast.itemInstanceId || !currentCast.item) return;

    // Calculate where item stopped based on remaining distance
    const stopPosition = this.calculatePositionAtDistance(
      failureDistance,
      dragState.castPosition,
      dragState.totalDistance,
    );

    if (!stopPosition) return;

    // Calculate which quadrant the item is actually in based on stop position
    const actualQuadrant = this.getQuadrantFromPosition(
      stopPosition.x,
      stopPosition.y,
    );

    // Update engaged item position
    this.locationStore
      .getState()
      .engageItem(currentLocation, currentCast.itemInstanceId, {
        item: currentCast.item,
        x: stopPosition.x,
        y: stopPosition.y,
        size: currentCast.itemSize,
        quadrant: actualQuadrant !== null ? actualQuadrant : dragState.quadrant, // Use actual quadrant or fallback
      });

    // Update debug overlay
    this.debugOverlay?.updateEngagedItems(currentLocation);
  }

  /**
   * Update sprite positions during drag phase (called by ticker)
   */
  updateSprites() {
    if (!this.app || this.isDestroyed) return;

    const gamePhase = this.gameStore.getState().gamePhase;
    const dragState = this.sessionStore.getState().dragState;
    const currentCast = this.gameStore.getState().currentCast;

    // Show sprites during dragging phase
    if (gamePhase === "dragging" && dragState.active) {
      const itemPos = this.getItemPosition();
      if (!itemPos) return;

      // Create item sprite if needed
      if (!this.itemSprite && currentCast.itemId) {
        const item = getItem(currentCast.itemId);
        if (item) {
          this.itemSprite = createPlaceholderSprite(item.category);
          this.itemSprite.scale.set(2); // Make it bigger for visibility
          this.app.stage.addChild(this.itemSprite);
        }
      }

      // Create magnet sprite if needed
      if (!this.magnetSprite) {
        this.magnetSprite = createMagnetSprite();
        this.magnetSprite.scale.set(2);
        this.app.stage.addChild(this.magnetSprite);
      }

      // Update positions
      if (this.itemSprite) {
        this.itemSprite.x = itemPos.x - this.itemSprite.width / 2;
        this.itemSprite.y = itemPos.y - this.itemSprite.height / 2;
      }

      if (this.magnetSprite) {
        // Magnet positioned above the item
        this.magnetSprite.x = itemPos.x - this.magnetSprite.width / 2;
        this.magnetSprite.y = itemPos.y - this.magnetSprite.height - 5;
      }
    } else {
      // Clean up sprites when not dragging
      this.clearSprites();
    }
  }

  /**
   * Remove item and magnet sprites
   */
  clearSprites() {
    if (this.itemSprite) {
      if (this.itemSprite.parent) {
        this.app.stage.removeChild(this.itemSprite);
      }
      this.itemSprite.destroy();
      this.itemSprite = null;
    }

    if (this.magnetSprite) {
      if (this.magnetSprite.parent) {
        this.app.stage.removeChild(this.magnetSprite);
      }
      this.magnetSprite.destroy();
      this.magnetSprite = null;
    }
  }

  /**
   * Update drag mechanics (called by ticker)
   * Handles tension, distance, slip calculations, and completion detection
   */
  updateDragMechanics() {
    if (!this.app || this.isDestroyed || !this.gameStore || !this.sessionStore)
      return;

    const gamePhase = this.gameStore.getState().gamePhase;
    const dragState = this.sessionStore.getState().dragState;
    const currentCast = this.gameStore.getState().currentCast;
    const isDragging = this.sessionStore.getState().isDragging;

    if (gamePhase !== "dragging" || !dragState.active) {
      this.lastDragUpdateTime = null;
      this.dragStartTime = null;
      return;
    }

    // Initialize timing on first frame
    const now = performance.now();
    if (!this.lastDragUpdateTime) {
      this.lastDragUpdateTime = now;
      this.dragStartTime = now;
      return;
    }

    const deltaTime = (now - this.lastDragUpdateTime) / 1000;
    this.lastDragUpdateTime = now;

    // Get current item
    const item = currentCast.itemId ? getItem(currentCast.itemId) : null;
    if (!item) {
      this.gameStore.getState().setGamePhase("idle");
      return;
    }

    // Calculate tension change
    const tensionChange = calculateTensionBuildRate(
      dragState.tension,
      item.weight,
      isDragging,
    );
    const newTension = dragState.tension + tensionChange * deltaTime;

    // Update drag progress with slip calculations (checks for failure)
    const result = updateDragState(
      {
        tension: newTension,
        distance: dragState.distance,
        magnetPosition: dragState.magnetPosition,
        magnetContactWidth: dragState.magnetContactWidth,
        slipDirection: dragState.slipDirection,
      },
      item,
      deltaTime,
    );

    // Only update tension if not failing (prevent decay after failure is detected)
    if (!result.failed && !result.complete) {
      this.sessionStore.getState().updateDragTension(newTension);
      this.sessionStore
        .getState()
        .updateDragProgress(result.distance, result.magnetPosition);
    }

    // Verbose logging (~2% of frames)
    if (Math.random() < 0.02) {
      const dragSpeed =
        result.distance !== dragState.distance
          ? (dragState.distance - result.distance) / deltaTime
          : 0;
      const magnetLeftEdge =
        result.magnetPosition - dragState.magnetContactWidth / 2;
      const magnetRightEdge =
        result.magnetPosition + dragState.magnetContactWidth / 2;
      console.log(
        `[DRAG] T:${newTension.toFixed(0)}% | Speed:${dragSpeed.toFixed(2)}m/s | Dist:${result.distance.toFixed(1)}/${dragState.totalDistance.toFixed(1)}m | MagPos:${result.magnetPosition.toFixed(1)} [${magnetLeftEdge.toFixed(1)}-${magnetRightEdge.toFixed(1)}] | ${item.name}(${item.weight}kg)`,
      );
    }

    // Handle completion
    if (result.complete) {
      const finalSlip = this.sessionStore.getState().completeDrag();
      const dragDuration = (now - this.dragStartTime) / 1000;

      console.log(
        `[DRAG COMPLETE] Duration:${dragDuration.toFixed(1)}s | Dist:${dragState.totalDistance.toFixed(1)}m | AvgSpeed:${(dragState.totalDistance / dragDuration).toFixed(2)}m/s | ${item.name} | Slip:${finalSlip.toFixed(1)}`,
      );

      // Add to inventory
      if (this.inventoryStore) {
        this.inventoryStore.getState().addItem(item);
        console.log("Added item to inventory:", item.name);
      }

      // Remove from engaged items
      if (currentCast.itemInstanceId) {
        const currentLocation = this.gameStore.getState().currentLocation;
        console.log(
          `[RETRIEVE] Removing engaged item: ${currentCast.itemInstanceId} from location: ${currentLocation}`,
        );
        this.locationStore
          .getState()
          .removeEngagedItem(currentLocation, currentCast.itemInstanceId);

        // Update debug overlay to remove marker
        this.debugOverlay?.updateEngagedItems(currentLocation);
      }

      // Complete cast
      this.gameStore.getState().completeCast(true);
      this.gameStore.getState().setGamePhase("idle");
    }
    // Handle failure
    else if (result.failed) {
      this.sessionStore.getState().completeDrag();

      console.log("Drag failed! Reason:", result.failReason);
      console.log(
        `[FAIL] Item remains engaged: ${currentCast.itemInstanceId} at location: ${this.gameStore.getState().currentLocation}`,
      );

      // Update item position to where it stopped
      this.handleDragFailure(result.distance);

      // Store failure reason
      this.gameStore.setState((state) => ({
        currentCast: {
          ...state.currentCast,
          failureReason: result.failReason,
        },
      }));

      // Complete cast as failure
      this.gameStore.getState().completeCast(false);

      // Return to idle after brief delay
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.gameStore.getState().setGamePhase("idle");
        }
      }, 1000);
    }
  }

  /**
   * Update sprite positions during drag phase (called by ticker)
   */
  updateSprites() {
    if (!this.app || this.isDestroyed) return;

    const gamePhase = this.gameStore.getState().gamePhase;
    const dragState = this.sessionStore.getState().dragState;
    const currentCast = this.gameStore.getState().currentCast;

    // Show sprites during dragging phase
    if (gamePhase === "dragging" && dragState.active) {
      const itemPos = this.getItemPosition();
      if (!itemPos) return;

      // Create item sprite if needed
      if (!this.itemSprite && currentCast.itemId) {
        const item = getItem(currentCast.itemId);
        if (item) {
          this.itemSprite = createPlaceholderSprite(item.category);
          this.itemSprite.scale.set(2); // Make it bigger for visibility
          this.app.stage.addChild(this.itemSprite);
        }
      }

      // Create magnet sprite if needed
      if (!this.magnetSprite) {
        this.magnetSprite = createMagnetSprite();
        this.magnetSprite.scale.set(2);
        this.app.stage.addChild(this.magnetSprite);
      }

      // Update positions
      if (this.itemSprite) {
        this.itemSprite.x = itemPos.x - this.itemSprite.width / 2;
        this.itemSprite.y = itemPos.y - this.itemSprite.height / 2;
      }

      if (this.magnetSprite) {
        // Magnet positioned above the item
        this.magnetSprite.x = itemPos.x - this.magnetSprite.width / 2;
        this.magnetSprite.y = itemPos.y - this.magnetSprite.height - 5;
      }
    } else {
      // Clean up sprites when not dragging
      this.clearSprites();
    }
  }

  /**
   * Remove item and magnet sprites
   */
  clearSprites() {
    if (this.itemSprite) {
      if (this.itemSprite.parent) {
        this.app.stage.removeChild(this.itemSprite);
      }
      this.itemSprite.destroy();
      this.itemSprite = null;
    }

    if (this.magnetSprite) {
      if (this.magnetSprite.parent) {
        this.app.stage.removeChild(this.magnetSprite);
      }
      this.magnetSprite.destroy();
      this.magnetSprite = null;
    }
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
    this.stopDragBubbles();

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

    // Clean up event listeners
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);

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
