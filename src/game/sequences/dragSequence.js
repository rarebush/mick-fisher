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
} from "../mechanics/worldConstants.js";
import useMagnetStore from "../state/magnetStore.js";
import {
  updateDragPhysics,
  updateWaitPhase,
  createFishTarget,
  HEAT_CONSTANTS,
} from "../physics/physicsSystem.js";
import { magnitude, speedFromDelta } from "../physics/vectorUtils.js";
import { rollFishSize } from "../data/fishDatabase.js";
import { getFishTableForLocation } from "../data/locationDatabase.js";
import { emitAudioEvent } from "../audio/audioEvents.js";

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
  const phaseProgress = sessionStore.getState().phaseProgress;

  // Skip updates during cast animation or reel-in - those are controlled by animations
  if (
    phase === "throwing" ||
    phase === "splashing" ||
    phase === "sinking" ||
    phase === "settling" ||
    phase === "reeling"
  ) {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) {
      console.log(
        `[ROPE] Skipping physics update during ${phase} phase (progress: ${(phaseProgress * 100).toFixed(0)}%) - animation controls the rope`,
      );
    }
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
    // During cast/settle phase, use stored cast position
    const castWorld = screenToWorld(
      castPosition.x,
      castPosition.y,
      WORLD_Z.RIVERBED,
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
    const waitResult = updateWaitPhase(physicsState.waitState, deltaTime);
    sessionStore
      .getState()
      .setPhysicsState({ waitState: waitResult.waitState });
    if (waitResult.events.nibble) {
      emitAudioEvent({ type: "fish-nibble" });
    }
    if (waitResult.events.bite) {
      emitAudioEvent({ type: "fish-bite" });
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
        sessionStore.getState().setPhysicsState({
          active: true,
          mode: "dragging",
          targetType: "fish",
          target: fish,
          tension: 0,
          lastTension: 0,
          waitState: null,
        });
        sessionStore.getState().setRopeTension(0);
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
    if (waitResult.events.timeout) {
      emitAudioEvent({ type: "fish-timeout" });
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
      dragStartTime: waitResult.events.bite ? now : dragStartTime,
    };
  }

  if (gamePhase !== "dragging" || !physicsState.active) {
    return { lastDragUpdateTime: null, dragStartTime: null };
  }

  const prevTargetPos = physicsState.target
    ? { x: physicsState.target.position.x, y: physicsState.target.position.y }
    : null;

  const dragResult = updateDragPhysics(deltaTime, isDragging, physicsState);
  sessionStore.getState().setPhysicsState(dragResult.state);
  sessionStore.getState().setRopeTension(dragResult.state.tension);
  getItemWorldPosition(app, sessionStore);

  if (prevTargetPos && dragResult.state.target) {
    const dx = dragResult.state.target.position.x - prevTargetPos.x;
    const dy = dragResult.state.target.position.y - prevTargetPos.y;
    const speed = speedFromDelta(dx, dy, deltaTime);
    if (speed > 0.01 && typeof window !== "undefined" && window.getPixiApp) {
      const pixiApp = window.getPixiApp();
      pixiApp?.handleMagnetDragSplat(
        dragResult.state.target.position.x,
        dragResult.state.target.position.y,
        speed,
      );
    }
  }

  const prevZone = getTensionZone(physicsState.tension);
  const nextZone = getTensionZone(dragResult.state.tension);
  if (prevZone !== nextZone) {
    emitAudioEvent({ type: "tension-zone-change", zone: nextZone });
  }
  if (physicsState.heat <= 0 && dragResult.state.heat > 0) {
    emitAudioEvent({ type: "heat-start" });
  }
  if (
    dragResult.state.heat >= HEAT_CONSTANTS.REDLINE_THRESHOLD &&
    physicsState.heat < HEAT_CONSTANTS.REDLINE_THRESHOLD
  ) {
    emitAudioEvent({ type: "heat-redline" });
  }
  if (
    physicsState.slip?.percent < 0.8 &&
    dragResult.state.slip?.percent >= 0.8
  ) {
    emitAudioEvent({ type: "slip-warning" });
  }
  if (
    physicsState.lineStress?.percent < 0.8 &&
    dragResult.state.lineStress?.percent >= 0.8
  ) {
    emitAudioEvent({ type: "line-stress-warning" });
  }

  if (Math.random() < 0.02) {
    console.log(
      `[DRAG] T:${dragResult.state.tension.toFixed(0)}% | Speed:${magnitudeOrZero(
        dragResult.state.target?.velocity,
      ).toFixed(
        2,
      )} | Dist:${dragResult.state.distanceToShore.toFixed(2)} | Type:${dragResult.state.targetType}`,
    );
  }

  if (dragResult.events.reachedShore) {
    const finalSlip = sessionStore.getState().completeDrag();
    const dragDuration = (now - dragStartTime) / 1000;

    console.log(
      `[DRAG COMPLETE] Duration:${dragDuration.toFixed(1)}s | AvgSpeed:${(dragResult.state.distanceToShore / Math.max(0.01, dragDuration)).toFixed(2)}m/s | Slip:${finalSlip.toFixed(1)}`,
    );

    // Add to inventory
    if (inventoryStore) {
      const item = currentCast?.item || getItem(currentCast.itemId);
      if (item) {
        inventoryStore.getState().addItem(item);
        console.log("Added item to inventory:", item.name);
      }
    }

    // Remove from engaged items
    if (currentCast.itemInstanceId) {
      const currentLocation = gameStore.getState().currentLocation;
      console.log(
        `[RETRIEVE] Removing engaged item: ${currentCast.itemInstanceId} from location: ${currentLocation}`,
      );
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
    dragResult.events.overheated
  ) {
    const reason = dragResult.events.detached
      ? "slip-failure"
      : dragResult.events.lineSnapped
        ? "line-snapped"
        : "tension-overload";
    console.log("Drag failed! Reason:", reason);

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

function magnitudeOrZero(vector) {
  if (!vector) return 0;
  return magnitude({ x: vector.x || 0, y: vector.y || 0 });
}

function getTensionZone(tension) {
  if (tension >= 75) return "redline";
  if (tension >= 40) return "working";
  return "low";
}
