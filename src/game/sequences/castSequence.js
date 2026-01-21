/**
 * Cast Sequence
 * Orchestrates the casting sequence: animations, mechanics, state updates
 */

import { executeCast } from "../mechanics/castMechanics.js";
import {
  animateCastLine,
  createRipple,
  createBubbles,
  startDragBubbles,
  renderRope as animationRenderRope,
  animateReelIn,
} from "../animations/castAnimations.js";

// Re-export renderRope for use by PixiApp
export { animationRenderRope as renderRope };
import { showNothingMessage } from "../animations/messageAnimations.js";

/**
 * Execute complete cast sequence
 */
export async function executeCastSequence(
  app,
  gameStore,
  sessionStore,
  locationStore,
  debugOverlay,
  x,
  y,
  quadrant,
  getItemPosition,
  pixiApp = null, // PixiApp instance for immediate rope storage
) {
  // Show spawn table for this quadrant in debug overlay
  const currentLocation =
    gameStore?.getState().currentLocation || "picturesque-river";
  debugOverlay?.showSpawnTable(quadrant, currentLocation);
  debugOverlay?.highlightQuadrant(quadrant, x, y);

  // Check for engaged item hit
  const hitItem = locationStore
    .getState()
    .checkForHit(currentLocation, x, y, quadrant);

  if (hitItem) {
    console.log(
      `[CAST] Found engaged item: ${hitItem.item.name} at (${hitItem.x.toFixed(1)}, ${hitItem.y.toFixed(1)})`,
    );
  } else {
    console.log(
      `[CAST] No engaged item hit at (${x.toFixed(1)}, ${y.toFixed(1)}) in quadrant ${quadrant}`,
    );
  }

  // Animate casting line and get rope for continued rendering
  const { rope, line, playerX, playerY, finalTension } = await animateCastLine(
    app,
    x,
    y,
    gameStore,
  );

  // Store rope on PixiApp instance immediately for ticker updates
  if (pixiApp) {
    pixiApp.dragRope = rope;
    pixiApp.dragLine = line;
    pixiApp.dragPlayerX = playerX;
    pixiApp.dragPlayerY = playerY;
  }

  // Visual feedback - ripple at landing point
  createRipple(app, x, y);

  // Create bubbles to show magnet sinking
  createBubbles(app, x, y, 500);

  // Execute cast mechanics (with hit detection)
  const castResult = executeCast(quadrant, currentLocation, x, y, hitItem);

  // Log spawn event to debug overlay
  if (castResult.success) {
    debugOverlay?.logSpawnEvent({
      quadrant,
      success: true,
      itemName: castResult.item.name,
      distance: castResult.distance,
      magnetPosition: castResult.magnetPosition,
      placement: castResult.placementQuality.label,
      isEngaged: castResult.isEngagedItem,
    });
  } else {
    debugOverlay?.logSpawnEvent({
      quadrant,
      success: false,
    });
  }

  // Update game state
  if (gameStore) {
    const { startCast, setCaughtItem, setGamePhase } = gameStore.getState();
    startCast(quadrant, castResult.distance, castResult.depth);

    if (castResult.success) {
      // Item found!
      setCaughtItem(castResult.item.id);

      // Store cast metadata (including engaged item tracking)
      gameStore.setState((state) => ({
        currentCast: {
          ...state.currentCast,
          item: castResult.item, // Store the full item object
          placementQuality: castResult.placementQuality,
          itemInstanceId: castResult.itemInstanceId,
          isEngagedItem: castResult.isEngagedItem,
          itemPosition: castResult.itemPosition,
          itemSize: castResult.itemSize,
        },
      }));

      // For re-engaged items, update the engaged position
      // (For new items, wait until drag fails to engage them)
      if (castResult.isEngagedItem) {
        locationStore
          .getState()
          .engageItem(currentLocation, castResult.itemInstanceId, {
            item: castResult.item,
            x: castResult.itemPosition.x,
            y: castResult.itemPosition.y,
            size: castResult.itemSize,
            quadrant,
          });

        // Update debug overlay to show engaged item
        debugOverlay?.updateEngagedItems(currentLocation);
      }

      console.log(
        `[CAST] ${castResult.isEngagedItem ? "Re-engaged" : "New"} item: ${castResult.item.name} at (${castResult.itemPosition.x.toFixed(1)}, ${castResult.itemPosition.y.toFixed(1)})`,
      );

      // Calculate initial position based on distance
      // For new items, use cast location
      // For re-engaged items, use saved position for progressive retrieval
      const initialPosition = castResult.isEngagedItem
        ? castResult.itemPosition
        : { x, y };

      // Start drag phase with magnet position and final cast tension
      const { startDrag } = sessionStore.getState();
      startDrag(
        castResult.distance,
        castResult.magnetPosition,
        castResult.magnetContactWidth,
        initialPosition,
        quadrant,
        finalTension || 10, // Use final cast tension or default to 10
      );
      setGamePhase("dragging");

      // Start periodic bubble animation during drag
      const isStillDragging = () => {
        const dragState = sessionStore.getState().dragState;
        const phase = gameStore.getState().gamePhase;
        return dragState.active && phase === "dragging";
      };

      const dragBubbleInterval = startDragBubbles(
        app,
        getItemPosition,
        isStillDragging,
      );

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

      return { dragBubbleInterval, rope, line, playerX, playerY };
    } else {
      // Nothing found - clean up rope
      if (line && line.parent) {
        line.parent.removeChild(line);
        line.destroy();
      }

      showNothingMessage(app, x, y);

      // Return to idle after showing message
      setTimeout(() => {
        setGamePhase("idle");
      }, 2000);

      return null;
    }
  }

  return null;
}

/**
 * Handle drag failure - update engaged item position to where it stopped
 * Animate rope reeling in
 */
export async function handleDragFailure(
  app,
  gameStore,
  sessionStore,
  locationStore,
  debugOverlay,
  failureDistance,
  getQuadrantFromPosition,
  rope = null,
  line = null,
  playerX = 0,
  playerY = 0,
) {
  if (!gameStore || !sessionStore || !locationStore) return;

  const currentCast = gameStore.getState().currentCast;
  const dragState = sessionStore.getState().dragState;
  const currentLocation = gameStore.getState().currentLocation;

  if (!currentCast.itemInstanceId || !currentCast.item) return;

  // Calculate where item stopped based on remaining distance
  const stopPosition = calculatePositionAtDistance(
    app,
    failureDistance,
    dragState.castPosition,
    dragState.totalDistance,
  );

  if (!stopPosition) return;

  // Animate rope reeling in from stop position back to player
  if (rope && line) {
    await animateReelIn(
      app,
      rope,
      line,
      playerX,
      playerY,
      stopPosition.x,
      stopPosition.y,
    );
  }

  // Calculate which quadrant the item is actually in based on stop position
  const actualQuadrant = getQuadrantFromPosition(
    stopPosition.x,
    stopPosition.y,
  );

  // Update engaged item position
  locationStore
    .getState()
    .engageItem(currentLocation, currentCast.itemInstanceId, {
      item: currentCast.item,
      x: stopPosition.x,
      y: stopPosition.y,
      size: currentCast.itemSize,
      quadrant: actualQuadrant !== null ? actualQuadrant : dragState.quadrant, // Use actual quadrant or fallback
    });

  console.log(
    `[DRAG FAILURE] Item engaged at (${stopPosition.x.toFixed(1)}, ${stopPosition.y.toFixed(1)}) in quadrant ${actualQuadrant !== null ? actualQuadrant : dragState.quadrant}`,
  );

  // Update debug overlay
  debugOverlay?.updateEngagedItems(currentLocation);
}

/**
 * Calculate position for a specific distance value
 * Used when drag fails to determine where item stopped
 */
function calculatePositionAtDistance(
  app,
  distance,
  castPosition,
  totalDistance,
) {
  if (!app) return null;

  const shoreX = app.screen.width / 2;
  const shoreY = 80;
  const progress = 1 - distance / totalDistance;

  const x = castPosition.x + (shoreX - castPosition.x) * progress;
  const y = castPosition.y + (shoreY - castPosition.y) * progress;

  return { x, y };
}
