/**
 * Input Manager
 * Handles pointer and keyboard input for casting and dragging
 */

import * as PIXI from "pixi.js";
import { getItem } from "../data/itemDatabase.js";
import { processTap } from "../mechanics/dragMechanics.js";
import { isQuadrantAccessible } from "../mechanics/castMechanics.js";

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

    // Track input state
    this.isDragging = false;
    this.lastTapTime = 0;
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
    if (gamePhase !== "dragging") return;

    // Space or any key to drag
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (!this.isDragging) {
        this.handleDragMouseDown();
      }
    }
  }

  handleKeyUp(event) {
    const gamePhase = this.gameStore?.getState().gamePhase;
    if (gamePhase !== "dragging") return;

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      this.handleDragMouseUp();
    }
  }

  handleWindowBlur() {
    // Reset all input state when window loses focus
    this.resetInputState();
  }

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
    this.onCast = null;
    this.showAccessMessage = null;
  }
}
