/**
 * Drag Sequence
 * Handles drag mechanics ticker - tension, distance, slip calculations
 */

import { getItem } from "../data/itemDatabase.js";
import {
  calculateTensionBuildRate,
  updateDragState,
} from "../mechanics/dragMechanics.js";
import {
  getAvatarPosition,
  getMagnetPosition,
} from "../mechanics/heightMechanics.js";

/**
 * Calculate current item position during drag
 */
export function getItemPosition(app, sessionStore) {
  if (!app || !sessionStore) return null;

  const dragState = sessionStore.getState().dragState;
  if (!dragState.active) return null;

  const { castPosition, distance, totalDistance } = dragState;

  // Interpolate between cast position (on riverbed) and wall base
  // The item moves along the riverbed surface toward the wall base
  const wallBaseX = app.screen.width / 2; // Center of screen
  const wallBaseY = app.screen.height * 0.4; // Wall base (40% from top - top edge of riverbed)

  // Progress: 0 = at cast position, 1 = at wall base
  const progress = 1 - distance / totalDistance;

  // Item moves both horizontally and vertically toward wall base
  const currentX = castPosition.x + (wallBaseX - castPosition.x) * progress;
  const currentY = castPosition.y + (wallBaseY - castPosition.y) * progress;

  return { x: currentX, y: currentY };
}

/**
 * Update 3D rope physics
 * Called from ticker to simulate rope with gravity
 */
export function updateRopePhysics(
  app,
  sessionStore,
  deltaTime,
  playerX,
  playerY,
) {
  const rope = sessionStore.getState().rope;
  if (!rope) return null;

  const phase = sessionStore.getState().phase;
  const phaseProgress = sessionStore.getState().phaseProgress;

  // Don't update rope physics during cast animation or reel-in - those are controlled by animations
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
    return rope.getScreenPoints(); // Just return current points for rendering
  }

  console.log(
    `[ROPE] Physics update in phase: ${phase}, deltaTime: ${deltaTime.toFixed(3)}s`,
  );

  // Get avatar position (always at pier height)
  const avatarPos = getAvatarPosition(playerX, playerY);

  // Get magnet position based on game state
  const dragState = sessionStore.getState().dragState;
  const castPosition = sessionStore.getState().castPosition;
  let itemPos;

  if (dragState.active) {
    // During drag, get moving item position
    itemPos = getItemPosition(app, sessionStore);
  } else if (castPosition) {
    // During cast/settle phase, use stored cast position
    itemPos = { x: castPosition.x, y: castPosition.y };
  }

  if (!itemPos) return null;

  // Get magnet height based on phase
  const magnetPos = getMagnetPosition(
    itemPos.x,
    itemPos.y,
    phase,
    phaseProgress,
  );

  console.log(
    `[ROPE] Item at (${itemPos.x.toFixed(1)}, ${itemPos.y.toFixed(1)}), Magnet 3D: (${magnetPos.x.toFixed(1)}, ${magnetPos.y.toFixed(1)}, ${magnetPos.z}), Screen: (${magnetPos.x.toFixed(1)}, ${(magnetPos.y - magnetPos.z).toFixed(1)})`,
  );

  // Update rope physics
  rope.update(deltaTime, avatarPos, magnetPos);

  // Get screen coordinates for rendering
  const screenPoints = rope.getScreenPoints();

  return screenPoints;
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
      velocity: dragState.velocity,
      accelerationTime: dragState.accelerationTime,
    },
    item,
    deltaTime,
  );

  // Only update tension if not failing (prevent decay after failure is detected)
  if (!result.failed && !result.complete) {
    sessionStore.getState().updateDragTension(newTension);
    sessionStore
      .getState()
      .updateDragProgress(
        result.distance,
        result.magnetPosition,
        result.velocity,
        result.accelerationTime,
      );
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
    sessionStore.setState((state) => ({
      dragState: {
        ...state.dragState,
        active: false,
      },
    }));

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
