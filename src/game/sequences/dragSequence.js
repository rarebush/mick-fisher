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

  const { castPosition, distance, totalDistance } = dragState;
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
  const avatarWorld = {
    x: 0, // Avatar at world center
    y: WORLD_Y.AVATAR,
    z: WORLD_Z.RIVERBED, // Item approaches at riverbed level
  };

  // Progress: 0 = at cast position, 1 = at avatar (wall base)
  const progress = 1 - distance / totalDistance;

  // Interpolate world position
  const itemWorld = {
    x: lerp(castWorld.x, avatarWorld.x, progress),
    y: lerp(castWorld.y, avatarWorld.y, progress),
    z: WORLD_Z.RIVERBED, // Always on riverbed during drag
  };

  // Clamp item so it doesn't move past the riverwall while dragging.
  itemWorld.y = Math.max(itemWorld.y, WORLD_Y.WALKWAY_FRONT);

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
 * Update 3D rope physics
 * Called from ticker to simulate rope with gravity
 * @param {number} tension - Current tension value (0-100)
 */
export function updateRopePhysics(
  app,
  sessionStore,
  deltaTime,
  playerX,
  playerY,
  tension = 50, // Default to medium tension
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

  // Create viewport for this frame
  const viewport = createViewport(app.screen.width, app.screen.height);

  console.log(
    `[ROPE] Physics update in phase: ${phase}, deltaTime: ${deltaTime.toFixed(3)}s`,
  );

  // Rope anchor world position (cast origin at avatar hand)
  const avatarWorld = {
    x: 0, // Avatar at world center
    y: WORLD_Y.AVATAR,
    z: WORLD_Z.AVATAR_HAND,
  };

  // Get magnet/item world position based on game state
  const dragState = sessionStore.getState().dragState;
  const castPosition = sessionStore.getState().castPosition;
  let magnetWorld;

  if (dragState.active) {
    // During drag, get moving item world position
    const itemWorld = getItemWorldPosition(app, sessionStore);
    if (itemWorld) {
      magnetWorld = {
        x: itemWorld.x,
        y: itemWorld.y,
        z: itemWorld.z,
      };
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

  // Calculate 3D distance for validation
  const dx = magnetWorld.x - avatarWorld.x;
  const dy = magnetWorld.y - avatarWorld.y;
  const dz = magnetWorld.z - avatarWorld.z;
  const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const distanceXY = Math.sqrt(dx * dx + dy * dy); // Horizontal distance
  const distanceZ = Math.abs(dz); // Vertical distance

  // Update rope length based on current 3D distance before tension is applied
  // As we reel in, the rope gets shorter
  rope.updateBaseSegmentLength(distance3D);

  console.log(
    `[ROPE DRAG] 3D Distance: ${distance3D.toFixed(2)} | dX:${dx.toFixed(2)} dY:${dy.toFixed(2)} dZ:${dz.toFixed(2)} | Horizontal (XY): ${distanceXY.toFixed(2)} | Vertical (Z): ${distanceZ.toFixed(2)} | BaseSegment: ${rope.baseSegmentLength.toFixed(3)}`,
  );

  // Update rope tension - this will recalculate segmentLength from baseSegmentLength
  rope.setTension(tension);

  // VALIDATION: Log expected length vs actual (unbiased slack multiplier)
  const actualRopeLength = rope.getTotalLength();
  const slackMultiplier = rope.getSlackMultiplierForTension(tension);
  const expectedAtTension = distance3D * slackMultiplier;

  console.log(
    `[ROPE VALIDATION] Tension: ${tension.toFixed(1)}% | Multiplier: ${slackMultiplier.toFixed(3)}x | 3D Dist: ${distance3D.toFixed(2)} | Expected: ${expectedAtTension.toFixed(2)} | Actual: ${actualRopeLength.toFixed(2)}`,
  );

  // Project magnet world position to screen for logging
  const magnetScreen = worldToScreen(magnetWorld, viewport);

  console.log(
    `[ROPE] Magnet world: (${magnetWorld.x.toFixed(1)}, ${magnetWorld.y.toFixed(1)}, ${magnetWorld.z.toFixed(1)}), Screen: (${magnetScreen.x.toFixed(1)}, ${magnetScreen.y.toFixed(1)})`,
  );

  // Update rope physics in world space
  rope.update(deltaTime, avatarWorld, magnetWorld);

  // Get screen coordinates for rendering
  // The rope points are in world space, so we need to project them
  const worldPoints = rope.points.map((p) => p.pos);
  const screenPoints = worldPoints.map((p) => worldToScreen(p, viewport));

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
