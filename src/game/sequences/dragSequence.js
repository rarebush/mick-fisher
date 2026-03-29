/**
 * Drag Sequence
 * Handles drag mechanics ticker - tension, distance, slip calculations
 *
 * All positions are calculated in WORLD SPACE, then projected to screen space.
 */

import { getItem } from "../data/itemDatabase.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  worldToScreen,
  screenToWorld,
  getAvatarHandWorldPosition,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import useMagnetStore from "../state/magnetStore.js";
import {
  updateDragPhysics,
  updateWaitPhase,
  createFishTarget,
  LINE_CONDITION_CONSTANTS,
  STRIKE_CONSTANTS,
  getSpoolCapacity,
} from "../physics/physicsExports.js";
import { magnitude, speedFromDelta, subtract } from "../physics/vectorUtils.js";
import { rollFishSize } from "../data/fishDatabase.js";
import { getFishTableForLocation } from "../data/locationDatabase.js";
import { emitAudioEvent } from "../audio/audioEvents.js";

const MAX_DRAG_PHYSICS_DELTA_TIME = 0.067;

/**
 * Calculate current item WORLD position during drag
 * Item moves along the riverbed (Z=0) from cast position toward avatar
 * @returns {{x: number, y: number, z: number, screenX: number, screenY: number} | null}
 */
export function getItemWorldPosition(app, sessionStore) {
  if (!app || !sessionStore) return null;

  const physicsState = sessionStore.getState().physicsState;
  if (!physicsState.active || !physicsState.target) return null;

  // Create viewport for projection
  const viewport = createViewport(app.screen.width, app.screen.height);

  const targetZ =
    physicsState.targetType === "fish"
      ? WORLD_Z.WATER_SURFACE - 0.2
      : WORLD_Z.RIVERBED;

  const itemWorld = {
    x: physicsState.target.position.x,
    y: physicsState.target.position.y,
    z: targetZ,
  };

  // Clamp item so it doesn't move past the riverwall while dragging.
  // Offset scales by cast landing X so it fades as x -> 0.
  const maxWallOffset = 0.1;
  const maxAbsX = Math.max(Math.abs(itemWorld.x), 1e-4);
  const wallOffset =
    maxWallOffset * Math.min(1, Math.abs(itemWorld.x) / maxAbsX);
  itemWorld.y = Math.max(itemWorld.y, WORLD_Y.WALKWAY_FRONT + wallOffset);

  // Update magnet store with current position
  const magnetStore = useMagnetStore.getState();
  magnetStore.updateMagnetPosition(itemWorld.x, itemWorld.y, itemWorld.z);
  magnetStore.setMagnetPhase("dragging");

  // Also provide screen coordinates for rendering
  const itemScreen = worldToScreen(itemWorld, viewport);

  return {
    ...itemWorld,
    screenX: itemScreen.x,
    screenY: itemScreen.y,
    viewport, // Include viewport for other calculations
  };
}

/**
 * Get rope render state for current frame (no physics).
 * @param {number} tension - Current tension value (0-100)
 */
export function updateRopePhysics(
  app,
  sessionStore,
  _deltaTime,
  _playerX,
  _playerY,
  _tension = 50, // Default to medium tension
) {
  void _tension;
  const phase = sessionStore.getState().phase;

  // Skip updates during cast animation or reel-in - those are controlled by animations
  if (
    phase === "throwing" ||
    phase === "splashing" ||
    phase === "sinking" ||
    phase === "settling" ||
    phase === "reeling"
  ) {
    return null;
  }

  // Create viewport for this frame
  const viewport = createViewport(app.screen.width, app.screen.height);

  const castOrigin = getAvatarHandWorldPosition();

  // Get magnet/item world position based on game state
  const physicsState = sessionStore.getState().physicsState;
  const castPosition = sessionStore.getState().castPosition;
  const magnetStore = useMagnetStore.getState();
  let magnetWorld;

  if (physicsState.active && physicsState.target) {
    // During drag, use centralized magnet world position when available
    const trackedMagnetWorld = magnetStore.getMagnetWorld();
    if (trackedMagnetWorld) {
      magnetWorld = trackedMagnetWorld;
    } else {
      // Fallback: compute from current drag state
      const itemWorld = getItemWorldPosition(app, sessionStore);
      if (itemWorld) {
        magnetWorld = {
          x: itemWorld.x,
          y: itemWorld.y,
          z: itemWorld.z,
        };
      }
    }
  } else if (castPosition) {
    // During cast/settle/wait phases, use stored cast position
    const castPlaneZ =
      phase === "waiting" ? WORLD_Z.WATER_SURFACE : WORLD_Z.RIVERBED;
    const castWorld = screenToWorld(
      castPosition.x,
      castPosition.y,
      castPlaneZ,
      viewport,
    );
    magnetWorld = castWorld;
  }

  if (!magnetWorld) return null;

  return {
    castOrigin,
    magnetWorld,
  };
}

/**
 * Update drag mechanics (called by ticker)
 * Handles tension, distance, slip calculations, and completion detection
 */
export async function updateDragMechanics(
  app,
  gameStore,
  sessionStore,
  inventoryStore,
  locationStore,
  debugOverlay,
  lastDragUpdateTime,
  dragStartTime,
  onDragFailure,
  onDragSuccess,
) {
  if (!app || !gameStore || !sessionStore) {
    return { lastDragUpdateTime: null, dragStartTime: null };
  }

  const gamePhase = gameStore.getState().gamePhase;
  const physicsState = sessionStore.getState().physicsState;
  const currentCast = gameStore.getState().currentCast;
  const isDragging = sessionStore.getState().isDragging;

  // Initialize timing on first frame
  const now = performance.now();
  if (!lastDragUpdateTime) {
    return { lastDragUpdateTime: now, dragStartTime: now };
  }

  const deltaTime = (now - lastDragUpdateTime) / 1000;
  const newLastDragUpdateTime = now;

  if (gamePhase === "waiting" && physicsState.waitState) {
    const strikeQueued = sessionStore.getState().strikeQueued;
    const waitResult = updateWaitPhase(
      physicsState.waitState,
      deltaTime,
      strikeQueued,
    );
    if (strikeQueued) {
      sessionStore.getState().clearStrike();
    }
    sessionStore
      .getState()
      .setPhysicsState({ waitState: waitResult.waitState });
    if (waitResult.events.nibble) {
      emitAudioEvent({ type: "fish-nibble" });
    }
    if (waitResult.events.bite) {
      emitAudioEvent({ type: "fish-bite" });
    }
    if (waitResult.events.strikeStart) {
      emitAudioEvent({ type: "fish-strike-alert" });
      sessionStore
        .getState()
        .triggerScreenShake(
          STRIKE_CONSTANTS.SCREEN_SHAKE_INTENSITY,
          STRIKE_CONSTANTS.SCREEN_SHAKE_DURATION,
        );
    }
    if (waitResult.events.strike) {
      emitAudioEvent({ type: "fish-strike" });
      const locationId = gameStore.getState().currentLocation;
      const fishTable = getFishTableForLocation(
        locationId,
        currentCast.quadrant ?? 0,
      );
      const species = selectRandomFish(fishTable);
      const size = rollFishSize(physicsState.equipment);
      const fish = createFishTarget(
        species,
        size,
        waitResult.waitState.castPosition,
      );
      if (fish) {
        const fishId = `fish_${species}_${size}`;
        const avatarWorld = getAvatarWorldPosition();
        const rawLineLength = magnitude(subtract(fish.position, avatarWorld));
        const spoolCapacity = getSpoolCapacity(physicsState.equipment);
        const straightLineLength = Math.min(rawLineLength, spoolCapacity);
        const visualSlack = Math.max(
          0,
          sessionStore.getState().ropeVisualSlack ?? 0,
        );
        const seededSlack = Math.min(
          visualSlack,
          Math.max(0, spoolCapacity - straightLineLength),
        );
        const lineLength = straightLineLength + seededSlack;
        const spoolRemaining = Math.max(0, spoolCapacity - lineLength);
        sessionStore.getState().setPhysicsState({
          active: true,
          mode: "dragging",
          targetType: "fish",
          target: fish,
          tension: 0,
          lastTension: 0,
          objectState: "kinetic",
          lineLength,
          straightLineDistance: straightLineLength,
          slack: seededSlack,
          lineTaut: seededSlack <= 0,
          spoolCapacity,
          spoolRemaining,
          breakThreshold: physicsState.equipment?.lineStrength ?? 0,
          waitState: null,
        });
        sessionStore.getState().setRopeTension(0);
        sessionStore.getState().setPhase("drag");
        sessionStore.getState().setPhaseProgress(0);
        gameStore.getState().setGamePhase("dragging");
        gameStore.getState().setCaughtItem(fishId);
        gameStore.setState((state) => ({
          currentCast: {
            ...state.currentCast,
            item: {
              id: fishId,
              name: `${size} ${species}`,
              weight: Math.round(fish.mass * 10) / 10,
              value: Math.round(fish.baseValue),
              category: fish.category,
              icon: "🐟",
            },
          },
        }));
      } else {
        gameStore.getState().setGamePhase("idle");
      }
    }
    if (waitResult.events.strikeMissed) {
      emitAudioEvent({ type: "fish-strike-missed" });
      if (onDragSuccess) {
        onDragSuccess();
      }
      sessionStore.getState().setPhase("idle");
      sessionStore.getState().setPhaseProgress(0);
      sessionStore.getState().setCastPosition(null, null);
      gameStore.getState().setGamePhase("idle");
      sessionStore.getState().resetPhysicsState();
      return { lastDragUpdateTime: null, dragStartTime: null };
    }
    return {
      lastDragUpdateTime: newLastDragUpdateTime,
      dragStartTime: waitResult.events.strike ? now : dragStartTime,
    };
  }

  if (gamePhase !== "dragging" || !physicsState.active) {
    return { lastDragUpdateTime: null, dragStartTime: null };
  }

  const prevTargetPos = physicsState.target
    ? { x: physicsState.target.position.x, y: physicsState.target.position.y }
    : null;

  const safeDeltaTime = Math.min(deltaTime, MAX_DRAG_PHYSICS_DELTA_TIME);
  const dragResult = updateDragPhysics(safeDeltaTime, isDragging, physicsState);
  sessionStore.getState().setPhysicsState(dragResult.state);
  sessionStore.getState().setRopeTension(dragResult.state.tension);
  getItemWorldPosition(app, sessionStore);

  if (prevTargetPos && dragResult.state.target) {
    const dx = dragResult.state.target.position.x - prevTargetPos.x;
    const dy = dragResult.state.target.position.y - prevTargetPos.y;
    const speed = speedFromDelta(dx, dy, safeDeltaTime);
    if (speed > 0.01 && typeof window !== "undefined" && window.getPixiApp) {
      const pixiApp = window.getPixiApp();
      pixiApp?.handleMagnetDragSplat(
        dragResult.state.target.position.x,
        dragResult.state.target.position.y,
        speed,
      );
    }
  }

  const prevZone = getTensionZone(
    physicsState.tension,
    physicsState.dragThresholdCurrent,
  );
  const nextZone = getTensionZone(
    dragResult.state.tension,
    dragResult.state.dragThresholdCurrent,
  );
  if (prevZone !== nextZone) {
    emitAudioEvent({ type: "tension-zone-change", zone: nextZone });
  }
  if (
    physicsState.slip?.percent < 0.8 &&
    dragResult.state.slip?.percent >= 0.8
  ) {
    emitAudioEvent({ type: "slip-warning" });
  }

  if (dragResult.events.reachedShore) {
    sessionStore.getState().completeDrag();

    // Add to inventory
    if (inventoryStore) {
      const item = currentCast?.item || getItem(currentCast.itemId);
      if (item) {
        inventoryStore.getState().addItem(item);
      }
    }

    // Remove from engaged items
    if (currentCast.itemInstanceId) {
      const currentLocation = gameStore.getState().currentLocation;
      locationStore
        .getState()
        .removeEngagedItem(currentLocation, currentCast.itemInstanceId);

      // Update debug overlay to remove marker
      debugOverlay?.updateEngagedItems(currentLocation);
    }

    // Clean up rope on success
    if (onDragSuccess) {
      onDragSuccess();
    }

    // Complete cast
    gameStore.getState().completeCast(true);
    gameStore.getState().setGamePhase("idle");
  }
  // Handle failure
  else if (
    dragResult.events.detached ||
    dragResult.events.lineSnapped ||
    dragResult.events.spoolEmpty
  ) {
    const reason = dragResult.events.detached
      ? "slip-failure"
      : dragResult.events.lineSnapped
        ? "line-snapped"
        : "spool-empty";

    // Immediately deactivate drag to prevent re-triggering failure on next frame
    sessionStore.getState().deactivateDrag();

    // Set phase to prevent ticker from updating rope visuals during reel-in
    sessionStore.getState().setPhase("reeling");

    // Update item position to where it stopped (includes reel-in animation)
    await onDragFailure(dragResult.state.target?.position);

    // Complete drag session AFTER reel-in animation
    sessionStore.getState().completeDrag();

    // Store failure reason
    gameStore.setState((state) => ({
      currentCast: {
        ...state.currentCast,
        failureReason: reason,
      },
    }));

    // Complete cast as failure
    gameStore.getState().completeCast(false);

    // Return to idle after brief delay
    setTimeout(() => {
      if (app) {
        gameStore.getState().setGamePhase("idle");
      }
    }, 1000);
  }

  return {
    lastDragUpdateTime: newLastDragUpdateTime,
    dragStartTime: dragStartTime,
  };
}

function selectRandomFish(fishTable) {
  if (!fishTable) return "carp";
  const entries = Object.entries(fishTable);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  for (const [species, weight] of entries) {
    cumulative += weight;
    if (roll <= cumulative) return species;
  }
  return entries[0]?.[0] || "carp";
}

function getTensionZone(tension, dragThresholdCurrent = 0) {
  if (tension >= LINE_CONDITION_CONSTANTS.HOT_ZONE_THRESHOLD) return "redline";
  if (tension >= dragThresholdCurrent) return "working";
  return "low";
}
