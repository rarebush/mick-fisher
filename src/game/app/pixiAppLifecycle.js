import * as PIXI from "pixi.js";
import { DebugOverlay } from "../graphics/debugOverlay.js";
import { setupEnvironmentLayers } from "../rendering/sceneSetup.js";
import { SpriteManager } from "../rendering/spriteManager.js";
import { FloatManager } from "../rendering/floatManager.js";
import { clamp } from "../physics/vectorUtils.js";
import { handleDragFailure } from "../sequences/castSequence.js";
import { animateReelIn } from "../animations/reelInAnimation.js";
import { WORLD_Z } from "../mechanics/worldConstants.js";
import { isDebugEnabled } from "../utils/debugFlags.js";

export async function setupSceneInternal(pixiApp) {
  if (!pixiApp.app || pixiApp.isDestroyed) return;

  pixiApp.app.ticker.add(pixiApp.tickerUpdateDragMechanics, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateRope, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateSprites, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateFloat, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateScreenShake, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateCastAim, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateLayerVisibility, pixiApp);
  pixiApp.app.ticker.add(pixiApp.tickerUpdateWaterEffects, pixiApp);

  pixiApp.sceneContainer = new PIXI.Container();
  pixiApp.sceneContainer.y = 0;
  pixiApp.app.stage.addChild(pixiApp.sceneContainer);

  pixiApp.environmentLayers = await setupEnvironmentLayers(
    pixiApp.sceneContainer,
    pixiApp.app.screen.width,
    pixiApp.app.screen.height,
    pixiApp.app.renderer,
  );

  pixiApp.spriteLayers = {
    underwater: new PIXI.Container(),
    aboveWater: new PIXI.Container(),
    debug: new PIXI.Container(),
  };
  const waterIndex = pixiApp.sceneContainer.getChildIndex(
    pixiApp.environmentLayers.waterVolume,
  );
  pixiApp.sceneContainer.addChildAt(
    pixiApp.spriteLayers.underwater,
    waterIndex,
  );
  const walkwayIndex = pixiApp.sceneContainer.getChildIndex(
    pixiApp.environmentLayers.walkwayVolume,
  );
  pixiApp.sceneContainer.addChildAt(
    pixiApp.spriteLayers.aboveWater,
    walkwayIndex,
  );
  pixiApp.sceneContainer.addChild(pixiApp.spriteLayers.debug);

  pixiApp.spriteManager = new SpriteManager(pixiApp.app, pixiApp.spriteLayers);
  const floatLayerTargets = pixiApp.environmentLayers?.waterObjectsAbove
    ? {
        aboveWater: pixiApp.environmentLayers.waterObjectsAbove,
        underwater: pixiApp.environmentLayers.waterObjectsBelow,
      }
    : pixiApp.spriteLayers;
  pixiApp.floatManager = new FloatManager(pixiApp.app, floatLayerTargets);

  const initialRenderResolutionScale =
    pixiApp.gameStore?.getState()?.renderResolutionScale ?? 1;
  setRenderResolutionScale(pixiApp, initialRenderResolutionScale);
  if (pixiApp.gameStore && !pixiApp.gameStoreUnsubscribe) {
    const storeState = pixiApp.gameStore.getState();
    if (pixiApp.environmentLayers) {
      pixiApp.environmentLayers.currentSpeed = storeState.currentSpeed ?? 1;
      pixiApp.environmentLayers.choppiness = storeState.choppiness ?? 1;
      pixiApp.environmentLayers.cloudCover = storeState.cloudCover ?? 0.5;
      pixiApp.environmentLayers.windSpeed = storeState.windSpeed ?? 1;
      const windAngle = Number.isFinite(storeState.windDirAngle)
        ? storeState.windDirAngle
        : 0.5;
      const windRad = (0.25 + windAngle) * Math.PI * 2;
      pixiApp.environmentLayers.windDir = [
        Math.cos(windRad),
        Math.sin(windRad),
      ];
    }

    pixiApp.gameStoreUnsubscribe = pixiApp.gameStore.subscribe(
      (state, prevState) => {
        if (state.renderResolutionScale !== prevState.renderResolutionScale) {
          setRenderResolutionScale(pixiApp, state.renderResolutionScale);
        }
        if (state.currentSpeed !== prevState.currentSpeed) {
          if (pixiApp.environmentLayers) {
            pixiApp.environmentLayers.currentSpeed = state.currentSpeed;
          }
        }
        if (state.choppiness !== prevState.choppiness) {
          if (pixiApp.environmentLayers) {
            pixiApp.environmentLayers.choppiness = state.choppiness;
          }
        }
        if (state.cloudCover !== prevState.cloudCover) {
          if (pixiApp.environmentLayers) {
            pixiApp.environmentLayers.cloudCover = state.cloudCover;
          }
        }
        if (state.windSpeed !== prevState.windSpeed) {
          if (pixiApp.environmentLayers) {
            pixiApp.environmentLayers.windSpeed = state.windSpeed;
          }
        }
        if (state.windDirAngle !== prevState.windDirAngle) {
          if (pixiApp.environmentLayers) {
            const windAngle = Number.isFinite(state.windDirAngle)
              ? state.windDirAngle
              : 0.5;
            const windRad = (0.25 + windAngle) * Math.PI * 2;
            pixiApp.environmentLayers.windDir = [
              Math.cos(windRad),
              Math.sin(windRad),
            ];
          }
        }
      },
    );
  }

  console.log(`[SCENE] Environment layers created, filling full screen`);

  pixiApp.castAimOverlay = new PIXI.Graphics();
  pixiApp.castAimOverlay.zIndex = 10000;
  pixiApp.app.stage.addChild(pixiApp.castAimOverlay);

  pixiApp.castAimMask = new PIXI.Graphics();
  pixiApp.castAimMask.zIndex = 9999;
  pixiApp.app.stage.addChild(pixiApp.castAimMask);
  pixiApp.castAimOverlay.mask = pixiApp.castAimMask;
}

export function setupDebugOverlay(pixiApp) {
  if (!isDebugEnabled()) return;
  if (!pixiApp.app || pixiApp.isDestroyed) return;

  pixiApp.debugOverlay = new DebugOverlay(
    pixiApp.app,
    pixiApp.width,
    pixiApp.height,
    pixiApp.locationStore,
  );

  pixiApp.locationStoreUnsubscribe = pixiApp.locationStore.subscribe(
    (state) => state.engagedItems,
    () => {
      console.log(
        "[DEBUG] Location store subscription fired - updating markers",
      );
      if (pixiApp.debugOverlay && pixiApp.gameStore) {
        const currentLocation =
          pixiApp.gameStore.getState().currentLocation || "picturesque-river";
        pixiApp.debugOverlay.updateEngagedItems(currentLocation);
      }
    },
  );

  console.log("Debug overlay initialized. Press 'D' to toggle.");
}

export function setupManualFailureListener(pixiApp) {
  pixiApp.handleManualFailure = async () => {
    const gamePhase = pixiApp.gameStore?.getState().gamePhase;
    const physicsState = pixiApp.sessionStore?.getState().physicsState;

    if (gamePhase === "dragging" && physicsState?.active) {
      console.log("[MANUAL FAILURE] Player gave up");
      pixiApp.inputManager?.resetInputState();

      pixiApp.sessionStore.getState().deactivateDrag();
      pixiApp.sessionStore.getState().setPhase("reeling");

      const currentTarget = physicsState?.target?.position;
      if (pixiApp.dragLineUnderwater && pixiApp.dragLineUnderwater.parent) {
        pixiApp.dragLineUnderwater.parent.removeChild(
          pixiApp.dragLineUnderwater,
        );
        pixiApp.dragLineUnderwater.destroy();
      }
      pixiApp.dragLineUnderwater = null;
      if (pixiApp.dragLineDebug && pixiApp.dragLineDebug.parent) {
        pixiApp.dragLineDebug.parent.removeChild(pixiApp.dragLineDebug);
        pixiApp.dragLineDebug.destroy();
      }
      pixiApp.dragLineDebug = null;

      await handleDragFailure(
        pixiApp.app,
        pixiApp.gameStore,
        pixiApp.sessionStore,
        pixiApp.locationStore,
        pixiApp.debugOverlay,
        currentTarget,
        pixiApp.inputManager
          ? pixiApp.inputManager.getQuadrantFromPosition.bind(
              pixiApp.inputManager,
            )
          : null,
        null,
        pixiApp.dragLine,
        pixiApp.dragPlayerX,
        pixiApp.dragPlayerY,
      );

      pixiApp.sessionStore.getState().completeDrag();

      pixiApp.dragLine = null;
      if (pixiApp.dragLineDebug && pixiApp.dragLineDebug.parent) {
        pixiApp.dragLineDebug.parent.removeChild(pixiApp.dragLineDebug);
        pixiApp.dragLineDebug.destroy();
      }
      pixiApp.dragLineDebug = null;

      pixiApp.gameStore.setState((state) => ({
        currentCast: {
          ...state.currentCast,
          failureReason: "tension-overload",
        },
      }));

      pixiApp.gameStore.getState().completeCast(false);

      setTimeout(() => {
        if (pixiApp.app && !pixiApp.isDestroyed) {
          pixiApp.gameStore.getState().setGamePhase("idle");
        }
      }, 1000);
    }
  };

  window.addEventListener("manualDragFailure", pixiApp.handleManualFailure);

  pixiApp.handleManualWaitCancel = async () => {
    const gamePhase = pixiApp.gameStore?.getState().gamePhase;
    const sessionState = pixiApp.sessionStore?.getState();

    if (gamePhase !== "waiting" || !sessionState?.physicsState?.waitState) {
      return;
    }

    pixiApp.inputManager?.resetInputState();
    pixiApp.sessionStore.getState().setPhase("reeling");
    pixiApp.sessionStore.getState().clearStrike();

    const castPosition = sessionState.castPosition;
    if (pixiApp.dragLine && castPosition) {
      await animateReelIn(
        pixiApp.app,
        null,
        pixiApp.dragLine,
        pixiApp.dragPlayerX,
        pixiApp.dragPlayerY,
        castPosition.x,
        castPosition.y,
        pixiApp.sessionStore,
        {
          startZ: WORLD_Z.WATER_SURFACE,
          lineUnderwater: pixiApp.dragLineUnderwater,
          lineDebug: pixiApp.dragLineDebug,
        },
      );
    }

    pixiApp.dragLine = null;
    pixiApp.dragLineUnderwater = null;
    pixiApp.dragLineDebug = null;

    pixiApp.sessionStore.getState().setPhase("idle");
    pixiApp.sessionStore.getState().setPhaseProgress(0);
    pixiApp.sessionStore.getState().setCastPosition(null, null);
    pixiApp.sessionStore.getState().resetPhysicsState();
    pixiApp.gameStore.getState().setGamePhase("idle");
  };

  window.addEventListener("manualWaitCancel", pixiApp.handleManualWaitCancel);
}

export function setRenderResolutionScale(pixiApp, scale) {
  if (!pixiApp.app || pixiApp.isDestroyed) return;
  const nextScale = Number.isFinite(scale) ? clamp(scale, 1, 4) : 1;
  if (pixiApp.app.renderer.resolution === nextScale) return;

  try {
    pixiApp.app.renderer.resolution = nextScale;
    pixiApp.app.renderer.resize(pixiApp.width, pixiApp.height);
    if (pixiApp.debugOverlay) {
      pixiApp.debugOverlay.resize(pixiApp.width, pixiApp.height);
    }
  } catch (err) {
    console.warn("Error updating render resolution:", err);
  }
}

export function resize(pixiApp, width, height) {
  if (!pixiApp.app || pixiApp.isDestroyed) return;

  try {
    pixiApp.app.renderer.resize(width, height);
    pixiApp.width = width;
    pixiApp.height = height;

    if (pixiApp.debugOverlay) {
      pixiApp.debugOverlay.resize(width, height);
    }
  } catch (err) {
    console.warn("Error during resize:", err);
  }
}

export function destroy(pixiApp) {
  console.log("PixiApp.destroy() called");

  if (pixiApp.isDestroyed) {
    console.log("PixiApp already destroyed, skipping");
    return;
  }

  pixiApp.isDestroyed = true;

  if (pixiApp.dragBubbleInterval) {
    clearInterval(pixiApp.dragBubbleInterval);
    pixiApp.dragBubbleInterval = null;
  }

  if (pixiApp.dragLine) {
    if (pixiApp.dragLine.parent) {
      pixiApp.dragLine.parent.removeChild(pixiApp.dragLine);
    }
    pixiApp.dragLine.destroy();
    pixiApp.dragLine = null;
  }
  if (pixiApp.dragLineUnderwater) {
    if (pixiApp.dragLineUnderwater.parent) {
      pixiApp.dragLineUnderwater.parent.removeChild(pixiApp.dragLineUnderwater);
    }
    pixiApp.dragLineUnderwater.destroy();
    pixiApp.dragLineUnderwater = null;
  }
  if (pixiApp.dragLineDebug) {
    if (pixiApp.dragLineDebug.parent) {
      pixiApp.dragLineDebug.parent.removeChild(pixiApp.dragLineDebug);
    }
    pixiApp.dragLineDebug.destroy();
    pixiApp.dragLineDebug = null;
  }

  if (pixiApp.castAimOverlay) {
    if (pixiApp.castAimOverlay.parent) {
      pixiApp.castAimOverlay.parent.removeChild(pixiApp.castAimOverlay);
    }
    pixiApp.castAimOverlay.destroy();
    pixiApp.castAimOverlay = null;
  }

  if (pixiApp.handleManualFailure) {
    window.removeEventListener(
      "manualDragFailure",
      pixiApp.handleManualFailure,
    );
    pixiApp.handleManualFailure = null;
  }

  if (pixiApp.locationStoreUnsubscribe) {
    pixiApp.locationStoreUnsubscribe();
    pixiApp.locationStoreUnsubscribe = null;
  }

  if (pixiApp.gameStoreUnsubscribe) {
    pixiApp.gameStoreUnsubscribe();
    pixiApp.gameStoreUnsubscribe = null;
  }

  if (pixiApp.debugOverlay) {
    pixiApp.debugOverlay.destroy();
    pixiApp.debugOverlay = null;
  }

  if (pixiApp.spriteManager) {
    pixiApp.spriteManager.clearSprites();
    pixiApp.spriteManager = null;
  }

  if (pixiApp.spriteLayers) {
    pixiApp.spriteLayers.underwater.destroy({ children: true });
    pixiApp.spriteLayers.aboveWater.destroy({ children: true });
    pixiApp.spriteLayers.debug.destroy({ children: true });
    pixiApp.spriteLayers = null;
  }

  if (pixiApp.inputManager) {
    pixiApp.inputManager.destroy();
    pixiApp.inputManager = null;
  }

  if (pixiApp.app) {
    try {
      if (import.meta.env.DEV && globalThis.__PIXI_APP__ === pixiApp.app) {
        globalThis.__PIXI_APP__ = null;
      }

      pixiApp.app.destroy(true, { children: true, texture: true });
      console.log("PixiJS app destroyed successfully");
    } catch (err) {
      console.warn("Error during PixiJS destroy:", err);
    }
    pixiApp.app = null;
  }
}
