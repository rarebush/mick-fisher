/**
 * Cast Sequence
 * Orchestrates the casting sequence: animations, mechanics, state updates
 */

import { executeCast } from "../mechanics/castMechanics.js";
import { calculateSlipDirection } from "../mechanics/slipCalculations.js";
import {
  animateCastLine,
  createRipple,
  createBubbles,
  startDragBubbles,
  animateReelIn,
} from "../animations/castAnimations.js";
import { showNothingMessage } from "../animations/messageAnimations.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  getSurfaceScreenBounds,
  screenToWorld,
  worldToScreen,
} from "../mechanics/worldConstants.js";

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
  getItemWorldPosition,
  pixiApp = null, // PixiApp instance for immediate rope storage
) {
  const viewport = createViewport(app.screen.width, app.screen.height);
  const waterWorld = screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
  const riverbedWorld = {
    x: waterWorld.x,
    y: waterWorld.y,
    z: WORLD_Z.RIVERBED,
  };
  const riverbedScreen = worldToScreen(riverbedWorld, viewport);

  // Set game phase to casting IMMEDIATELY so tension bar shows
  if (gameStore) {
    gameStore.getState().setGamePhase("casting");
    // Initialize cast tension
    gameStore.setState((state) => ({
      currentCast: {
        ...state.currentCast,
        tension: 95,
        quadrant,
        distance: 0,
        depth: 0,
      },
    }));
  }

  // Show spawn table for this quadrant in debug overlay
  const currentLocation =
    gameStore?.getState().currentLocation || "picturesque-river";
  debugOverlay?.showSpawnTable(quadrant, currentLocation);
  debugOverlay?.highlightQuadrant(quadrant, riverbedScreen.x, riverbedScreen.y);

  // Check for engaged item hit
  const hitItem = locationStore
    .getState()
    .checkForHit(currentLocation, riverbedScreen.x, riverbedScreen.y, quadrant);

  if (hitItem) {
    console.log(
      `[CAST] Found engaged item: ${hitItem.item.name} at (${hitItem.x.toFixed(1)}, ${hitItem.y.toFixed(1)})`,
    );
  } else {
    console.log(
      `[CAST] No engaged item hit at (${x.toFixed(1)}, ${y.toFixed(1)}) in quadrant ${quadrant}`,
    );
  }

  // Animate casting line and get graphics for continued rendering
  const { line, lineUnderwater, lineDebug, playerX, playerY } =
    await animateCastLine(
      app,
      x,
      y,
      gameStore,
      sessionStore,
      pixiApp?.spriteLayers ?? null,
    );

  // Store line and player position on PixiApp instance for rendering
  if (pixiApp) {
    pixiApp.dragLine = line;
    pixiApp.dragLineUnderwater = lineUnderwater;
    pixiApp.dragLineDebug = lineDebug;
    pixiApp.dragPlayerX = playerX;
    pixiApp.dragPlayerY = playerY;
  }

  // Store cast position for rope rendering (before drag starts)
  sessionStore.getState().setCastPosition(riverbedScreen.x, riverbedScreen.y);

  // Visual feedback - ripple at landing point
  createRipple(app, x, y);

  // Create bubbles to show magnet sinking
  createBubbles(app, waterWorld.x, waterWorld.y, 500);

  // Execute cast mechanics (with hit detection)
  const castResult = executeCast(
    quadrant,
    currentLocation,
    riverbedWorld,
    hitItem,
  );

  // Log spawn event to debug overlay
  if (castResult.success) {
    debugOverlay?.logSpawnEvent({
      quadrant,
      success: true,
      itemName: castResult.item.name,
      distance: castResult.distance,
      magnetSurfacePosition: castResult.magnetSurfacePosition,
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
      const itemPositionScreen = worldToScreen(
        {
          x: castResult.itemPositionWorld.x,
          y: castResult.itemPositionWorld.y,
          z: WORLD_Z.RIVERBED,
        },
        viewport,
      );
      const itemSizeWorld = castResult.itemSize / viewport.pixelsPerUnit;
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
          itemPosition: itemPositionScreen,
          itemPositionWorld: castResult.itemPositionWorld,
          itemSize: castResult.itemSize,
          itemSizeWorld,
        },
      }));

      // For re-engaged items, update the engaged position
      // (For new items, wait until drag fails to engage them)
      if (castResult.isEngagedItem) {
        locationStore
          .getState()
          .engageItem(currentLocation, castResult.itemInstanceId, {
            item: castResult.item,
            x: itemPositionScreen.x,
            y: itemPositionScreen.y,
            worldX: castResult.itemPositionWorld.x,
            worldY: castResult.itemPositionWorld.y,
            size: castResult.itemSize,
            sizeWorld: itemSizeWorld,
            quadrant,
          });

        // Update debug overlay to show engaged item
        debugOverlay?.updateEngagedItems(currentLocation);
      }

      console.log(
        `[CAST] ${castResult.isEngagedItem ? "Re-engaged" : "New"} item: ${castResult.item.name} at (${itemPositionScreen.x.toFixed(1)}, ${itemPositionScreen.y.toFixed(1)})`,
      );

      // Calculate initial position based on distance
      // For new items, use cast location
      // For re-engaged items, use saved position for progressive retrieval
      const initialPosition = castResult.isEngagedItem
        ? itemPositionScreen
        : { x: riverbedScreen.x, y: riverbedScreen.y };

      // Calculate slip direction from magnet position (pure function)
      const slipDirection = calculateSlipDirection(
        castResult.magnetSurfacePosition,
      );

      // Start drag phase with magnet position and final cast tension
      // Update cast position for drag path (re-engaged items may differ)
      sessionStore
        .getState()
        .setCastPosition(initialPosition.x, initialPosition.y);

      const { startDrag } = sessionStore.getState();
      startDrag(
        castResult.distance,
        castResult.magnetSurfacePosition,
        castResult.magnetContactWidth,
        quadrant,
        slipDirection,
      );

      // Reset rope timer in PixiApp to prevent large deltaTime
      if (typeof window !== "undefined" && window.getPixiApp) {
        const pixiApp = window.getPixiApp();
        if (pixiApp) {
          pixiApp.lastRopeUpdateTime = performance.now();
          console.log("[CAST] Reset rope update timer for drag phase");
        }
      }

      setGamePhase("dragging");

      // Start periodic bubble animation during drag
      const isStillDragging = () => {
        const dragState = sessionStore.getState().dragState;
        const phase = gameStore.getState().gamePhase;
        return dragState.active && phase === "dragging";
      };

      const dragBubbleInterval = startDragBubbles(
        app,
        getItemWorldPosition,
        isStillDragging,
      );

      console.log(
        "Item caught:",
        castResult.item.name,
        "at",
        castResult.distance.toFixed(1),
        "m",
        "| Magnet position:",
        castResult.magnetSurfacePosition.toFixed(1),
        "|",
        castResult.placementQuality.label,
      );

      return { dragBubbleInterval, line, playerX, playerY };
    } else {
      // Nothing found - clean up graphics
      if (line && line.parent) {
        line.parent.removeChild(line);
        line.destroy();
      }
      if (lineUnderwater && lineUnderwater.parent) {
        lineUnderwater.parent.removeChild(lineUnderwater);
        lineUnderwater.destroy();
      }
      if (lineDebug && lineDebug.parent) {
        lineDebug.parent.removeChild(lineDebug);
        lineDebug.destroy();
      }

      sessionStore.getState().setPhase("idle");
      sessionStore.getState().setPhaseProgress(0);
      sessionStore.getState().setCastPosition(null, null);

      // Clear PixiApp references
      if (pixiApp) {
        pixiApp.dragLine = null;
        pixiApp.dragLineUnderwater = null;
        pixiApp.dragLineDebug = null;
        pixiApp.dragPlayerX = null;
        pixiApp.dragPlayerY = null;
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
  _rope = null,
  line = null,
  playerX = 0,
  playerY = 0,
) {
  void _rope;
  if (!gameStore || !sessionStore || !locationStore) return;

  const currentCast = gameStore.getState().currentCast;
  const dragState = sessionStore.getState().dragState;
  const currentLocation = gameStore.getState().currentLocation;

  if (!currentCast.itemInstanceId || !currentCast.item) return;

  // Calculate where item stopped based on remaining distance
  const stopPosition = calculatePositionAtDistance(
    app,
    failureDistance,
    sessionStore.getState().castPosition,
    dragState.totalDistance,
  );

  if (!stopPosition) return;

  // Animate rope reeling in from stop position back to player
  const reelViewport = createViewport(app.screen.width, app.screen.height);
  const reelClipScreenY = worldToScreen(
    { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
    reelViewport,
  ).y;

  if (line) {
    await animateReelIn(
      app,
      null, // No 2D rope
      line,
      playerX,
      playerY,
      stopPosition.x,
      stopPosition.y,
      sessionStore,
      {
        hideUnderwaterSegments:
          gameStore?.getState()?.waterSurfaceOpaque ?? false,
        reelClipScreenY,
      },
    );
  }

  // Calculate which quadrant the item is actually in based on stop position
  const actualQuadrant = getQuadrantFromPosition(
    stopPosition.x,
    stopPosition.y,
    "riverbed",
  );

  const stopViewport = createViewport(app.screen.width, app.screen.height);
  const stopWorld = screenToWorld(
    stopPosition.x,
    stopPosition.y,
    WORLD_Z.RIVERBED,
    stopViewport,
  );
  const sizeWorld =
    currentCast.itemSizeWorld ??
    currentCast.itemSize / stopViewport.pixelsPerUnit;

  // Update engaged item position
  locationStore
    .getState()
    .engageItem(currentLocation, currentCast.itemInstanceId, {
      item: currentCast.item,
      x: stopPosition.x,
      y: stopPosition.y,
      worldX: stopWorld.x,
      worldY: stopWorld.y,
      size: currentCast.itemSize,
      sizeWorld,
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
  if (!app || !castPosition) return null;

  // Get wall base position from world constants
  const viewport = createViewport(app.screen.width, app.screen.height);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);

  const wallBaseX = app.screen.width / 2;
  const wallBaseY = waterBounds.top;
  const progress = 1 - distance / totalDistance;

  const x = castPosition.x + (wallBaseX - castPosition.x) * progress;
  const y = castPosition.y + (wallBaseY - castPosition.y) * progress;

  return { x, y };
}
