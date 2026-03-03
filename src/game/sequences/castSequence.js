/**
 * Cast Sequence
 * Orchestrates the casting sequence: animations, mechanics, state updates
 */

import {
  executeCast,
  getRandomDepth,
  getRandomDistance,
} from "../mechanics/castMechanics.js";
import {
  EQUIPMENT_CATEGORIES,
  getFishingEquipmentById,
} from "../data/fishingEquipmentDatabase.js";
import { getCastingEquipmentById } from "../data/castingEquipmentDatabase.js";
import {
  createMetallicTargetFromItem,
  getSpoolCapacity,
  initializeWaitPhase,
} from "../physics/physicsExports.js";
import { distance2D } from "../physics/vectorUtils.js";
import { cleanupDisplayObjects } from "../rendering/displayCleanup.js";
import { emitAudioEvent } from "../audio/audioEvents.js";
import { animateCastLine } from "../animations/castLineAnimation.js";
import { animateReelIn } from "../animations/reelInAnimation.js";
import {
  createRipple,
  createBubbles,
  startDragBubbles,
} from "../animations/particleEffects.js";
import { showNothingMessage } from "../animations/messageAnimations.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  screenToWorld,
  worldToScreen,
  getAvatarWorldPosition,
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

  const currentLocation =
    gameStore?.getState().currentLocation || "picturesque-river";
  const selectedCastingEquipmentId =
    gameStore?.getState().selectedCastingEquipmentId || "hand";
  const selectedCastingEquipment = getCastingEquipmentById(
    selectedCastingEquipmentId,
  );
  const fishingEquipmentState = gameStore?.getState().fishingEquipment ?? {
    type: "magnet",
    tierId: "magnet_basic",
  };
  const equipment = getFishingEquipmentById(
    fishingEquipmentState.type,
    fishingEquipmentState.tierId,
  );
  const equipmentCategory = EQUIPMENT_CATEGORIES[fishingEquipmentState.type];
  const resolvedEquipment =
    equipment || getFishingEquipmentById("magnet", "magnet_basic");

  if (!equipmentCategory?.requiresWait) {
    // Show spawn table for this quadrant in debug overlay
    debugOverlay?.showSpawnTable(quadrant, currentLocation);
    debugOverlay?.highlightQuadrant(
      quadrant,
      riverbedScreen.x,
      riverbedScreen.y,
    );
  }

  const hitItem =
    !equipmentCategory?.requiresWait && locationStore
      ? locationStore
          .getState()
          .checkForHit(
            currentLocation,
            riverbedScreen.x,
            riverbedScreen.y,
            quadrant,
          )
      : null;

  if (hitItem) {
    console.log(
      `[CAST] Found engaged item: ${hitItem.item.name} at (${hitItem.x.toFixed(
        1,
      )}, ${hitItem.y.toFixed(1)})`,
    );
  } else if (!equipmentCategory?.requiresWait) {
    console.log(
      `[CAST] No engaged item hit at (${x.toFixed(1)}, ${y.toFixed(
        1,
      )}) in quadrant ${quadrant}`,
    );
  }

  // Animate casting line and get graphics for continued rendering
  const {
    line,
    lineUnderwater,
    lineDebug,
    playerX,
    playerY,
    finalCastVelocityZ,
  } = await animateCastLine(
    app,
    x,
    y,
    gameStore,
    sessionStore,
    pixiApp
      ? {
          underwater:
            pixiApp.environmentLayers?.waterObjectsBelow ??
            pixiApp.spriteLayers?.underwater ??
            null,
          aboveWater: pixiApp.spriteLayers?.aboveWater ?? null,
          debug: pixiApp.spriteLayers?.debug ?? null,
        }
      : null,
    pixiApp?.handleMagnetLandingSplat
      ? pixiApp.handleMagnetLandingSplat.bind(pixiApp)
      : null,
    {
      skipSink: Boolean(equipmentCategory?.requiresWait),
    },
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
  const castScreenPosition = equipmentCategory?.requiresWait
    ? { x, y }
    : riverbedScreen;
  sessionStore
    .getState()
    .setCastPosition(castScreenPosition.x, castScreenPosition.y);

  // Visual feedback - ripple at landing point
  createRipple(app, x, y);

  // Create bubbles to show magnet sinking
  if (!equipmentCategory?.requiresWait) {
    createBubbles(app, waterWorld.x, waterWorld.y, 500);
  }

  const castResult = equipmentCategory?.requiresWait
    ? {
        success: false,
        item: null,
        distance: getRandomDistance(quadrant),
        depth: getRandomDepth(quadrant, currentLocation),
        magnetSurfacePosition: null,
        magnetContactWidth: 6,
      }
    : executeCast(quadrant, currentLocation, riverbedWorld, hitItem);

  if (!equipmentCategory?.requiresWait) {
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
  }

  // Update game state
  if (gameStore) {
    const { startCast, setCaughtItem, setGamePhase } = gameStore.getState();
    startCast(quadrant, castResult.distance, castResult.depth);

    if (!equipmentCategory?.requiresWait && castResult.success) {
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
        `[CAST] ${castResult.isEngagedItem ? "Re-engaged" : "New"} item: ${
          castResult.item.name
        } at (${itemPositionScreen.x.toFixed(
          1,
        )}, ${itemPositionScreen.y.toFixed(1)})`,
      );

      // Calculate initial position based on distance
      // For new items, use cast location
      // For re-engaged items, use saved position for progressive retrieval
      const initialPosition = castResult.isEngagedItem
        ? itemPositionScreen
        : { x: riverbedScreen.x, y: riverbedScreen.y };

      // Start drag phase with magnet position and final cast tension
      // Update cast position for drag path (re-engaged items may differ)
      sessionStore
        .getState()
        .setCastPosition(initialPosition.x, initialPosition.y);

      const avatarWorld = getAvatarWorldPosition();
      const targetWorld = castResult.itemPositionWorld;
      const rawLineLength = distance2D(targetWorld, avatarWorld);
      const spoolCapacity = getSpoolCapacity(resolvedEquipment);
      const lineLength = Math.min(rawLineLength, spoolCapacity);
      const spoolRemaining = Math.max(0, spoolCapacity - lineLength);

      const target = createMetallicTargetFromItem(castResult.item, targetWorld);

      sessionStore.getState().initializePhysicsState({
        mode: "dragging",
        targetType: "metallic",
        target,
        equipment: resolvedEquipment,
        tension: 0,
        lineLength,
        straightLineDistance: lineLength,
        slack: 0,
        lineTaut: true,
        lineCondition: 100,
        breakThreshold: resolvedEquipment?.lineStrength ?? 0,
        spoolRemaining,
        spoolCapacity,
        rpm: 0,
        objectState: "static",
      });

      const { startDrag } = sessionStore.getState();
      startDrag(lineLength, castResult.magnetSurfacePosition, 6, quadrant, 0);

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
        `(${castResult.item.weight ?? "?"}kg)`,
        "at",
        castResult.distance.toFixed(1),
        "m",
        "| Magnet position:",
        castResult.magnetSurfacePosition.toFixed(1),
        "|",
        castResult.placementQuality.label,
      );
      console.log("[CAST DEBUG] Full catch payload", {
        item: castResult.item,
        selectedCastingGear: {
          id: selectedCastingEquipmentId,
          data: selectedCastingEquipment,
        },
        selectedFishingGear: {
          type: fishingEquipmentState.type,
          tierId: fishingEquipmentState.tierId,
          category: equipmentCategory,
          data: resolvedEquipment,
        },
      });

      return { dragBubbleInterval, line, playerX, playerY };
    }

    if (equipmentCategory?.requiresWait) {
      sessionStore.getState().setPhase("waiting");
      sessionStore.getState().initializePhysicsState({
        mode: "waiting",
        equipment: resolvedEquipment,
        waitState: initializeWaitPhase(
          resolvedEquipment,
          waterWorld,
          finalCastVelocityZ ?? 0,
        ),
      });
      sessionStore.getState().setRopeTension(0);
      setGamePhase("waiting");
      emitAudioEvent({ type: "wait-start" });
      return { dragBubbleInterval: null, line, playerX, playerY };
    } else {
      // Nothing found - clean up graphics
      cleanupDisplayObjects(line, lineUnderwater, lineDebug);

      sessionStore.getState().setPhase("idle");
      sessionStore.getState().setPhaseProgress(0);
      sessionStore.getState().setCastPosition(null, null);
      sessionStore.getState().resetPhysicsState();

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
  failureWorldPosition,
  getQuadrantFromPosition,
  _rope = null,
  line = null,
  playerX = 0,
  playerY = 0,
  lineUnderwater = null,
  lineDebug = null,
) {
  void _rope;
  const cleanupRope = () => {
    cleanupDisplayObjects(line, lineUnderwater, lineDebug);
  };

  if (!gameStore || !sessionStore || !locationStore) {
    cleanupRope();
    return;
  }

  const currentCast = gameStore.getState().currentCast;
  const currentLocation = gameStore.getState().currentLocation;

  if (!currentCast.itemInstanceId || !currentCast.item) {
    cleanupRope();
    return;
  }

  if (!failureWorldPosition) {
    cleanupRope();
    return;
  }

  const stopViewport = createViewport(app.screen.width, app.screen.height);
  const stopPosition = worldToScreen(
    {
      x: failureWorldPosition.x,
      y: failureWorldPosition.y,
      z: WORLD_Z.RIVERBED,
    },
    stopViewport,
  );

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
        hideUnderwaterSegments: false,
        reelClipScreenY,
        lineUnderwater,
        lineDebug,
      },
    );
  }

  // Calculate which quadrant the item is actually in based on stop position
  const actualQuadrant = getQuadrantFromPosition(
    stopPosition.x,
    stopPosition.y,
    "riverbed",
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
      worldX: failureWorldPosition.x,
      worldY: failureWorldPosition.y,
      size: currentCast.itemSize,
      sizeWorld,
      quadrant: actualQuadrant !== null ? actualQuadrant : currentCast.quadrant,
    });

  console.log(
    `[DRAG FAILURE] Item engaged at (${stopPosition.x.toFixed(
      1,
    )}, ${stopPosition.y.toFixed(1)}) in quadrant ${
      actualQuadrant !== null ? actualQuadrant : currentCast.quadrant
    }`,
  );

  // Update debug overlay
  debugOverlay?.updateEngagedItems(currentLocation);
}
