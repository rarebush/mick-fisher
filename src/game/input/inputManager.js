/**
 * Input Manager
 * Handles pointer and keyboard input for casting and dragging
 */

import * as PIXI from "pixi.js";
import { isQuadrantAccessible } from "../mechanics/castMechanics.js";
import {
  WORLD_Z,
  createViewport,
  getSurfaceScreenBounds,
} from "../mechanics/worldConstants.js";

export class InputManager {
  constructor(
    app,
    gameStore,
    sessionStore,
    locationStore,
    debugOverlay,
    callbacks,
  ) {
    this.app = app;
    this.gameStore = gameStore;
    this.sessionStore = sessionStore;
    this.locationStore = locationStore;
    this.debugOverlay = debugOverlay;
    this.onCast = callbacks?.onCast;
    this.onTap = callbacks?.onTap;

    // Track input state - improved tap/hold detection
    this.isPointerDown = false; // Physical pointer state
    this.isHoldingForDrag = false; // Logical drag hold state
    this.pointerDownTime = 0; // When pointer went down
    this.lastTapReleaseTime = 0; // When last tap was released
    this.holdDetectionTimeout = null; // Timer for hold detection
    this.isCasting = false;
    this.activePointerId = null; // Track which pointer is active

    // Bind event handlers
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerUpOutside = this.handlePointerUpOutside.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
  }

  /**
   * Setup pointer and keyboard interaction
   */
  setupInteraction() {
    if (!this.app) return;

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    // Pointer events
    this.app.stage.on("pointerdown", this.handlePointerDown);
    this.app.stage.on("pointerup", this.handlePointerUp);
    this.app.stage.on("pointerupoutside", this.handlePointerUpOutside);
    this.app.stage.on("pointercancel", this.handlePointerCancel);

    // Keyboard events
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
  }

  handlePointerDown(event) {
    // Ignore if we're already tracking a pointer
    if (
      this.activePointerId !== null &&
      this.activePointerId !== event.pointerId
    ) {
      return;
    }

    const { x, y } = event.global;
    // Block interaction in walkway area (derived from world coordinates)
    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);
    if (y < walkwayBounds.bottom) return; // Walkway area, no interaction

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
      // Show access message using messageAnimations
      this.showAccessMessageAtPosition(x, y);
      return;
    }

    this.activePointerId = event.pointerId;
    this.isCasting = true;
    if (this.onCast) {
      this.onCast(x, y, quadrant).finally(() => {
        this.isCasting = false;
        this.activePointerId = null;
      });
    } else {
      this.isCasting = false;
      this.activePointerId = null;
    }
  }

  handlePointerUp(event) {
    // Only handle if this is our tracked pointer
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase === "dragging") {
      this.handleDragMouseUp();
    }

    this.activePointerId = null;
  }

  handlePointerUpOutside(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase === "dragging") {
      this.handleDragMouseUp();
    }

    this.activePointerId = null;
  }

  handlePointerCancel(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    // Force cleanup on cancel
    this.resetInputState();
  }

  handleKeyDown(event) {
    const gamePhase = this.gameStore?.getState().gamePhase;

    // Debug commands (work in any phase)
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

    // Drag controls only work during dragging phase
    if (gamePhase !== "dragging") return;

    // Space to drag
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (!this.isPointerDown) {
        // Treat keyboard as immediate hold (no tap detection needed)
        this.isPointerDown = true;
        this.isHoldingForDrag = true;
        this.pointerDownTime = performance.now();
        if (this.sessionStore) {
          this.sessionStore.setState({ isDragging: true });
        }
      }
    }
  }

  handleKeyUp(event) {
    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase !== "dragging") return;

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      // For keyboard, just clear hold state directly (no tap processing)
      this.isPointerDown = false;
      this.isHoldingForDrag = false;
      if (this.sessionStore) {
        this.sessionStore.setState({ isDragging: false });
      }
    }
  }

  handleWindowBlur() {
    // Reset all input state when window loses focus
    this.resetInputState();
  }

  resetInputState() {
    // Clear hold detection timeout
    if (this.holdDetectionTimeout) {
      clearTimeout(this.holdDetectionTimeout);
      this.holdDetectionTimeout = null;
    }

    // Reset all input state
    this.isPointerDown = false;
    this.isHoldingForDrag = false;
    this.activePointerId = null;

    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
  }

  handleDragMouseDown() {
    const now = performance.now();

    // Clear any pending hold detection from previous input
    if (this.holdDetectionTimeout) {
      clearTimeout(this.holdDetectionTimeout);
      this.holdDetectionTimeout = null;
    }

    // Mark pointer as physically down
    this.isPointerDown = true;
    this.pointerDownTime = now;

    // Start hold detection with 100ms delay
    // If pointer is still down after delay, it's a hold, not a tap
    this.holdDetectionTimeout = setTimeout(() => {
      if (this.isPointerDown) {
        // Pointer still down after 100ms = definite hold
        this.isHoldingForDrag = true;
        if (this.sessionStore) {
          this.sessionStore.setState({ isDragging: true });
        }
      }
    }, 100);
  }

  handleDragMouseUp() {
    const now = performance.now();
    const pressDuration = now - this.pointerDownTime;

    // Clear hold detection timeout
    if (this.holdDetectionTimeout) {
      clearTimeout(this.holdDetectionTimeout);
      this.holdDetectionTimeout = null;
    }

    // Mark pointer as physically up
    this.isPointerDown = false;

    // If this was a tap (released before 100ms OR never triggered hold mode)
    if (pressDuration < 100 || !this.isHoldingForDrag) {
      // Delegate tap processing to orchestrator via callback
      this.onTap?.();
      this.lastTapReleaseTime = now;
    }

    // Always clear hold state when pointer released
    this.isHoldingForDrag = false;
    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
  }

  getQuadrantFromPosition(x, y) {
    // Quadrants only exist on the riverbed (derived from world coordinates)
    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

    // Per diagram: riverbed is at Z=0, from riverbedBounds.top to riverbedBounds.bottom
    const riverbedStartY = riverbedBounds.top;
    if (y < riverbedStartY) return null; // Above riverbed, no quadrants

    const riverbedHeight = riverbedBounds.bottom - riverbedBounds.top;
    const quadrantWidth = this.app.screen.width / 3;
    const quadrantHeight = riverbedHeight / 3;

    const col = Math.floor(x / quadrantWidth);
    const row = Math.floor((y - riverbedStartY) / quadrantHeight);

    if (col < 0 || col > 2 || row < 0 || row > 2) return null;

    // Map to quadrant numbers (1-9)
    return row * 3 + col + 1;
  }

  /**
   * Show "Need longer line!" message at position
   */
  showAccessMessageAtPosition(x, y) {
    if (!this.app) return;

    const text = new PIXI.Text({
      text: "Need longer line!",
      style: { fontSize: 24, fill: 0xffaa00 },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.app.stage.addChild(text);

    let alpha = 1.0;
    const fadeOut = () => {
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

  /**
   * Cleanup event listeners
   */
  destroy() {
    // Clear any pending hold detection timeout
    if (this.holdDetectionTimeout) {
      clearTimeout(this.holdDetectionTimeout);
      this.holdDetectionTimeout = null;
    }

    if (this.app && this.app.stage) {
      this.app.stage.off("pointerdown", this.handlePointerDown);
      this.app.stage.off("pointerup", this.handlePointerUp);
      this.app.stage.off("pointerupoutside", this.handlePointerUpOutside);
      this.app.stage.off("pointercancel", this.handlePointerCancel);
    }

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);

    this.app = null;
    this.gameStore = null;
    this.sessionStore = null;
    this.locationStore = null;
    this.debugOverlay = null;
    this.onCast = null;
  }
}
