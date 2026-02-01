/**
 * Input Manager
 * Handles pointer and keyboard input for casting and dragging
 */

import * as PIXI from "pixi.js";
import { isQuadrantAccessible } from "../mechanics/castMechanics.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  getSurfaceScreenBounds,
  screenToWorld,
  worldToScreen,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import {
  computeCastTargetScreen,
  metersToWorldRange,
} from "../mechanics/castAimUtils.js";
import {
  getCastingEquipmentById,
  getCastingEquipmentMaxRange,
} from "../data/castingEquipmentDatabase.js";

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

    // Track input state - hold detection for drag
    this.isPointerDown = false; // Physical pointer state
    this.isHoldingForDrag = false; // Logical drag hold state
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

    const castMode = this.sessionStore?.getState().castInputMode || "click";
    if (castMode === "direction_power") {
      this.activePointerId = event.pointerId;
      this.handleCastAimClick();
      this.activePointerId = null;
      return;
    }
    if (castMode === "donut") {
      this.activePointerId = event.pointerId;
      this.handleDonutAimClick(x, y);
      this.activePointerId = null;
      return;
    }

    const quadrant = this.getCastQuadrantIfAccessible(x, y);
    if (quadrant === null) return;

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

    if (event.key.toLowerCase() === "m") {
      const sessionState = this.sessionStore?.getState();
      const currentMode = sessionState?.castInputMode || "click";
      const nextMode =
        currentMode === "click"
          ? "direction_power"
          : currentMode === "direction_power"
            ? "donut"
            : "click";
      this.sessionStore?.getState().setCastInputMode(nextMode);
      this.sessionStore?.getState().resetCastAim();
      this.sessionStore?.getState().resetDonutAim();
      console.log(`[CAST MODE] Set to ${nextMode}`);
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
        // Treat keyboard as immediate hold
        this.isPointerDown = true;
        this.isHoldingForDrag = true;
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
      // For keyboard, just clear hold state directly
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
    // Reset all input state
    this.isPointerDown = false;
    this.isHoldingForDrag = false;
    this.isCasting = false;
    this.activePointerId = null;

    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
  }

  handleDragMouseDown() {
    // Mark pointer as physically down
    this.isPointerDown = true;
    this.isHoldingForDrag = true;
    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: true });
    }
  }

  handleDragMouseUp() {
    // Mark pointer as physically up
    this.isPointerDown = false;

    // Always clear hold state when pointer released
    this.isHoldingForDrag = false;
    if (this.sessionStore) {
      this.sessionStore.setState({ isDragging: false });
    }
  }

  handleCastAimClick() {
    const sessionState = this.sessionStore?.getState();
    if (!sessionState) return;

    const aimState = sessionState.castAimState;
    if (aimState.phase === "idle") {
      sessionState.startCastAimAngle();
      return;
    }

    if (aimState.phase === "angle") {
      sessionState.lockCastAimAngle();
      return;
    }

    if (aimState.phase === "power") {
      if (this.isCasting) return;

      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      const targetScreen = computeCastTargetScreen(
        aimState.angle,
        aimState.power,
        viewport,
        maxRangeMeters,
      );
      const quadrant = this.getCastQuadrantIfAccessible(
        targetScreen.x,
        targetScreen.y,
      );
      if (quadrant === null) {
        sessionState.resetCastAim();
        return;
      }

      this.isCasting = true;
      if (this.onCast) {
        this.onCast(targetScreen.x, targetScreen.y, quadrant).finally(() => {
          this.isCasting = false;
          this.activePointerId = null;
        });
      } else {
        this.isCasting = false;
        this.activePointerId = null;
      }
      sessionState.resetCastAim();
    }
  }

  handleDonutAimClick(x, y) {
    const sessionState = this.sessionStore?.getState();
    if (!sessionState) return;

    const donutAimState = sessionState.donutAimState;
    if (donutAimState.phase === "idle") {
      if (!this.isWithinWaterSurface(x, y)) {
        return;
      }
      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      if (!this.isWithinCastRange(x, y, maxRangeMeters)) {
        this.showAccessMessageAtPosition(x, y);
        return;
      }
      const equipment = getCastingEquipmentById(equipmentId);
      sessionState.startDonutAim(
        { x, y },
        equipment.minAccuracyRadius,
        equipment.maxAccuracyRadius,
        equipment.aspectRatioX,
        equipment.aspectRatioY,
      );
      return;
    }

    if (donutAimState.phase === "target") {
      if (!this.isWithinWaterSurface(x, y)) {
        return;
      }
      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      if (!this.isWithinCastRange(x, y, maxRangeMeters)) {
        this.showAccessMessageAtPosition(x, y);
        return;
      }
      sessionState.startDonutOscillation();
      return;
    }

    if (donutAimState.phase === "oscillate") {
      if (this.isCasting) return;

      const target = donutAimState.target;
      if (!target) {
        sessionState.resetDonutAim();
        return;
      }
      if (!this.isWithinWaterSurface(target.x, target.y)) {
        sessionState.resetDonutAim();
        return;
      }
      const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
      const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
      if (!this.isWithinCastRange(target.x, target.y, maxRangeMeters)) {
        this.showAccessMessageAtPosition(target.x, target.y);
        sessionState.resetDonutAim();
        return;
      }

      const minRadius = donutAimState.minRadius;
      const maxRadius = Math.max(
        donutAimState.currentRadius,
        donutAimState.minRadius,
      );
      const aspectRatioX = donutAimState.aspectRatioX ?? 1;
      const aspectRatioY = donutAimState.aspectRatioY ?? 1;
      const viewport = createViewport(
        this.app.screen.width,
        this.app.screen.height,
      );
      const avatarWorld = getAvatarWorldPosition();
      const targetWorld = screenToWorld(
        target.x,
        target.y,
        WORLD_Z.WATER_SURFACE,
        viewport,
      );
      const deltaX = targetWorld.x - avatarWorld.x;
      const deltaY = targetWorld.y - avatarWorld.y;
      const distance = Math.hypot(deltaX, deltaY);
      const forward =
        distance > 0
          ? { x: deltaX / distance, y: deltaY / distance }
          : { x: 0, y: 1 };
      const right = { x: -forward.y, y: forward.x };
      const minRadiusWorld = minRadius / viewport.pixelsPerUnit;
      const maxRadiusWorld = maxRadius / viewport.pixelsPerUnit;
      let targetX = null;
      let targetY = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(
          Math.random() * (maxRadiusWorld ** 2 - minRadiusWorld ** 2) +
            minRadiusWorld ** 2,
        );
        const localX = radius * Math.cos(angle) * aspectRatioX;
        const localY = radius * Math.sin(angle) * aspectRatioY;
        const worldPoint = {
          x: targetWorld.x + forward.x * localX + right.x * localY,
          y: targetWorld.y + forward.y * localX + right.y * localY,
          z: WORLD_Z.WATER_SURFACE,
        };
        const screenPoint = worldToScreen(worldPoint, viewport);
        const candidateX = screenPoint.x;
        const candidateY = screenPoint.y;
        if (this.isWithinWaterSurface(candidateX, candidateY)) {
          targetX = candidateX;
          targetY = candidateY;
          break;
        }
      }
      if (targetX === null || targetY === null) {
        sessionState.resetDonutAim();
        return;
      }
      const quadrant = this.getCastQuadrantIfAccessible(targetX, targetY);
      if (quadrant === null) {
        sessionState.resetDonutAim();
        return;
      }

      sessionState.lockDonutAim();
      sessionState.resetDonutAim();
      this.isCasting = true;
      if (this.onCast) {
        this.onCast(targetX, targetY, quadrant).finally(() => {
          this.isCasting = false;
          this.activePointerId = null;
        });
      } else {
        this.isCasting = false;
        this.activePointerId = null;
      }
    }
  }

  isWithinWaterSurface(x, y) {
    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
    const worldPos = screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
    return (
      worldPos.x >= viewport.worldXMin &&
      worldPos.x <= viewport.worldXMax &&
      worldPos.y >= WORLD_Y.WATER_NEAR &&
      worldPos.y <= WORLD_Y.WATER_FAR &&
      y >= waterBounds.top &&
      y <= waterBounds.bottom
    );
  }

  isWithinCastRange(x, y, maxRangeMeters) {
    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const worldTarget = screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
    const origin = getAvatarWorldPosition();
    const worldDistance = Math.hypot(
      worldTarget.x - origin.x,
      worldTarget.y - origin.y,
    );
    const maxRangeWorld = metersToWorldRange(maxRangeMeters);
    return worldDistance <= maxRangeWorld;
  }

  getCastQuadrantIfAccessible(x, y) {
    const quadrant = this.getQuadrantFromPosition(x, y);
    if (quadrant === null) return null;

    const equipmentId = this.gameStore?.getState().selectedCastingEquipmentId;
    const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
    if (!this.isWithinCastRange(x, y, maxRangeMeters)) {
      this.showAccessMessageAtPosition(x, y);
      return null;
    }
    if (!isQuadrantAccessible(quadrant, maxRangeMeters)) {
      this.showAccessMessageAtPosition(x, y);
      return null;
    }

    return quadrant;
  }

  getQuadrantFromPosition(x, y, inputPlane = "waterSurface") {
    // Quadrants only exist on the riverbed (derived from world coordinates)
    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );
    const worldPos =
      inputPlane === "riverbed"
        ? screenToWorld(x, y, WORLD_Z.RIVERBED, viewport)
        : screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
    const worldXMin = viewport.worldXMin;
    const worldXMax = viewport.worldXMax;
    const worldYMin = WORLD_Y.RIVERBED_NEAR;
    const worldYMax = WORLD_Y.RIVERBED_FAR;

    if (
      worldPos.x < worldXMin ||
      worldPos.x > worldXMax ||
      worldPos.y < worldYMin ||
      worldPos.y > worldYMax
    ) {
      return null;
    }

    const quadrantWidth = (worldXMax - worldXMin) / 3;
    const quadrantHeight = (worldYMax - worldYMin) / 3;

    const col = Math.min(
      2,
      Math.floor((worldPos.x - worldXMin) / quadrantWidth),
    );
    const row = Math.min(
      2,
      Math.floor((worldPos.y - worldYMin) / quadrantHeight),
    );

    // Map to quadrant numbers (1-9)
    return row * 3 + col + 1;
  }

  getRiverbedScreenFromWaterScreen(x, y, viewport = null) {
    const resolvedViewport =
      viewport || createViewport(this.app.screen.width, this.app.screen.height);
    const waterWorld = screenToWorld(
      x,
      y,
      WORLD_Z.WATER_SURFACE,
      resolvedViewport,
    );
    return worldToScreen(
      { x: waterWorld.x, y: waterWorld.y, z: WORLD_Z.RIVERBED },
      resolvedViewport,
    );
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
    this.locationStore = null;
    this.debugOverlay = null;
    this.onCast = null;
  }
}
