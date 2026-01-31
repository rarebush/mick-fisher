/**
 * Drag Sequence
 * Handles drag mechanics ticker - tension, distance, slip calculations
 *
 * All positions are calculated in WORLD SPACE, then projected to screen space.
 */

import { getItem } from "../data/itemDatabase.js";
import {
  calculateTensionBuildRate,
  updateDragState,
} from "../mechanics/dragMechanics.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  worldToScreen,
  screenToWorld,
  lerp,
  getAvatarWorldPosition,
  getAvatarHandWorldPosition,
} from "../mechanics/worldConstants.js";
import useMagnetStore from "../state/magnetStore.js";

/**
 * Calculate current item WORLD position during drag
 * Item moves along the riverbed (Z=0) from cast position toward avatar
 * @returns {{x: number, y: number, z: number, screenX: number, screenY: number} | null}
 */
export function getItemWorldPosition(app, sessionStore) {
  if (!app || !sessionStore) return null;

  const dragState = sessionStore.getState().dragState;
  if (!dragState.active) return null;

  const { distance, totalDistance } = dragState;
  const castPosition = sessionStore.getState().castPosition;
  if (!castPosition) return null;

  // Create viewport for projection
  const viewport = createViewport(app.screen.width, app.screen.height);

  // Cast position is in screen coordinates - convert to world on riverbed
  const castWorld = screenToWorld(
    castPosition.x,
    castPosition.y,
    WORLD_Z.RIVERBED,
    viewport,
  );

  // Avatar position (where item is dragged toward)
  const avatarWorld = getAvatarWorldPosition();
  const targetWorld = {
    x: avatarWorld.x,
    y: avatarWorld.y,
    z: WORLD_Z.RIVERBED, // Item approaches at riverbed level
  };

  // Progress: 0 = at cast position, 1 = at avatar (wall base)
  const progress = 1 - distance / totalDistance;

  // Interpolate world position
  const itemWorld = {
    x: lerp(castWorld.x, targetWorld.x, progress),
    y: lerp(castWorld.y, targetWorld.y, progress),
    z: WORLD_Z.RIVERBED, // Always on riverbed during drag
  };

  // Clamp item so it doesn't move past the riverwall while dragging.
  // Offset scales by cast landing X so it fades as x -> 0.
  const maxWallOffset = 0.1;
  const maxAbsX = Math.max(Math.abs(castWorld.x), 1e-4);
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
 * Calculate current item position during drag (legacy - returns screen coordinates)
 * @deprecated Use getItemWorldPosition instead
 */
export function getItemPosition(app, sessionStore) {
  const worldPos = getItemWorldPosition(app, sessionStore);
  if (!worldPos) return null;

  return { x: worldPos.screenX, y: worldPos.screenY };
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
  const dragState = sessionStore.getState().dragState;
  const castPosition = sessionStore.getState().castPosition;
  const magnetStore = useMagnetStore.getState();
  let magnetWorld;

  if (dragState.active) {
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
  const dragState = sessionStore.getState().dragState;
  const currentCast = gameStore.getState().currentCast;
  const isDragging = sessionStore.getState().isDragging;

  if (gamePhase !== "dragging" || !dragState.active) {
    return { lastDragUpdateTime: null, dragStartTime: null };
  }

  // Initialize timing on first frame
  const now = performance.now();
  if (!lastDragUpdateTime) {
    return { lastDragUpdateTime: now, dragStartTime: now };
  }

  const deltaTime = (now - lastDragUpdateTime) / 1000;
  const newLastDragUpdateTime = now;

  // Get current item
  const item = currentCast.itemId ? getItem(currentCast.itemId) : null;
  if (!item) {
    gameStore.getState().setGamePhase("idle");
    return { lastDragUpdateTime: null, dragStartTime: null };
  }

  // Calculate tension change
  const currentTension = sessionStore.getState().ropeTension;
  const tensionChange = calculateTensionBuildRate(
    currentTension,
    item.weight,
    isDragging,
  );
  const newTension = currentTension + tensionChange * deltaTime;

  // Update drag progress with slip calculations (checks for failure)
  const result = updateDragState(
    {
      tension: newTension,
      distance: dragState.distance,
      magnetSurfacePosition: dragState.magnetSurfacePosition,
      magnetContactWidth: dragState.magnetContactWidth,
      slipDirection: dragState.slipDirection,
      velocity: dragState.velocity,
      accelerationTime: dragState.accelerationTime,
      overloadTimer: dragState.overloadTimer,
    },
    item,
    deltaTime,
    {
      previousTension: currentTension,
      isHolding: isDragging,
    },
  );

  // Only update tension if not failing (prevent decay after failure is detected)
  if (!result.failed && !result.complete) {
    sessionStore.getState().updateDragTension(newTension);
    sessionStore
      .getState()
      .updateDragProgress(
        result.distance,
        result.magnetSurfacePosition,
        result.velocity,
        result.accelerationTime,
        result.overloadTimer,
      );
    // Keep magnet world position in sync for this frame
    getItemWorldPosition(app, sessionStore);
  }

  // Verbose logging (~2% of frames)
  if (Math.random() < 0.02) {
    const dragSpeed =
      result.distance !== dragState.distance
        ? (dragState.distance - result.distance) / deltaTime
        : 0;
    const magnetLeftEdge =
      result.magnetSurfacePosition - dragState.magnetContactWidth / 2;
    const magnetRightEdge =
      result.magnetSurfacePosition + dragState.magnetContactWidth / 2;
    console.log(
      `[DRAG] T:${newTension.toFixed(0)}% | Speed:${dragSpeed.toFixed(2)}m/s | Dist:${result.distance.toFixed(1)}/${dragState.totalDistance.toFixed(1)}m | MagPos:${result.magnetSurfacePosition.toFixed(1)} [${magnetLeftEdge.toFixed(1)}-${magnetRightEdge.toFixed(1)}] | ${item.name}(${item.weight}kg)`,
    );
  }

  // Handle completion
  if (result.complete) {
    const finalSlip = sessionStore.getState().completeDrag();
    const dragDuration = (now - dragStartTime) / 1000;

    console.log(
      `[DRAG COMPLETE] Duration:${dragDuration.toFixed(1)}s | Dist:${dragState.totalDistance.toFixed(1)}m | AvgSpeed:${(dragState.totalDistance / dragDuration).toFixed(2)}m/s | ${item.name} | Slip:${finalSlip.toFixed(1)}`,
    );

    // Add to inventory
    if (inventoryStore) {
      inventoryStore.getState().addItem(item);
      console.log("Added item to inventory:", item.name);
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
  else if (result.failed) {
    console.log("Drag failed! Reason:", result.failReason);
    console.log(
      `[FAIL] Item remains engaged: ${currentCast.itemInstanceId} at location: ${gameStore.getState().currentLocation}`,
    );

    // Immediately deactivate drag to prevent re-triggering failure on next frame
    sessionStore.getState().deactivateDrag();

    // Set phase to prevent ticker from updating rope physics during reel-in
    sessionStore.getState().setPhase("reeling");

    // Update item position to where it stopped (includes reel-in animation)
    await onDragFailure(result.distance);

    // Complete drag session AFTER reel-in animation
    sessionStore.getState().completeDrag();

    // Store failure reason
    gameStore.setState((state) => ({
      currentCast: {
        ...state.currentCast,
        failureReason: result.failReason,
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
