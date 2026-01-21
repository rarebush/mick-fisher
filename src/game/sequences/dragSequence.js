/**
 * Drag Sequence
 * Handles drag mechanics ticker - tension, distance, slip calculations
 */

import { getItem } from "../data/itemDatabase.js";
import {
  calculateTensionBuildRate,
  updateDragState,
} from "../mechanics/dragMechanics.js";

/**
 * Calculate current item position during drag
 */
export function getItemPosition(app, sessionStore) {
  if (!app || !sessionStore) return null;

  const dragState = sessionStore.getState().dragState;
  if (!dragState.active) return null;

  const { castPosition, distance, totalDistance } = dragState;

  // Interpolate between cast position and shore bottom
  const shoreX = app.screen.width / 2;
  const shoreY = 80; // Bottom of shore area

  // Progress: 0 = at cast position, 1 = at shore
  const progress = 1 - distance / totalDistance;

  const currentX = castPosition.x + (shoreX - castPosition.x) * progress;
  const currentY = castPosition.y + (shoreY - castPosition.y) * progress;

  return { x: currentX, y: currentY };
}

/**
 * Update drag mechanics (called by ticker)
 * Handles tension, distance, slip calculations, and completion detection
 */
export function updateDragMechanics(
  app,
  gameStore,
  sessionStore,
  inventoryStore,
  locationStore,
  debugOverlay,
  lastDragUpdateTime,
  dragStartTime,
  onDragFailure,
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
    },
    item,
    deltaTime,
  );

  // Only update tension if not failing (prevent decay after failure is detected)
  if (!result.failed && !result.complete) {
    sessionStore.getState().updateDragTension(newTension);
    sessionStore
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

    // Complete cast
    gameStore.getState().completeCast(true);
    gameStore.getState().setGamePhase("idle");
  }
  // Handle failure
  else if (result.failed) {
    sessionStore.getState().completeDrag();

    console.log("Drag failed! Reason:", result.failReason);
    console.log(
      `[FAIL] Item remains engaged: ${currentCast.itemInstanceId} at location: ${gameStore.getState().currentLocation}`,
    );

    // Update item position to where it stopped
    onDragFailure(result.distance);

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
