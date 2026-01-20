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
import { processTap } from "./mechanics/dragMechanics.js";

export class PixiApp {
  constructor(canvas, width, height, gameStore, sessionStore) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.isDestroyed = false;
    this.isInitializing = false;
    this.gameStore = gameStore;
    this.sessionStore = sessionStore;
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
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
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

    // Track input state
    this.isDragging = false;
    this.lastTapTime = 0;
    this.isCasting = false;
    this.activePointerId = null; // Track which pointer is active

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

  handleKeyDown = (event) => {
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
    // Animate casting line
    await this.animateCastLine(x, y);

    // Visual feedback - ripple at landing point
    this.createRipple(x, y);

    // Create bubbles to show magnet sinking
    this.createBubbles(x, y, 500);

    // Execute cast mechanics
    const currentLocation =
      this.gameStore?.getState().currentLocation || "picturesque-river";
    const castResult = executeCast(quadrant, currentLocation);

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
          { x, y },
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

    if (this.isDestroyed) {
      console.log("PixiApp already destroyed, skipping");
      return;
    }

    this.isDestroyed = true;

    // Stop drag bubble animations
    this.stopDragBubbles();

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
