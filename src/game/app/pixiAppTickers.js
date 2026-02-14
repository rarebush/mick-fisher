import { getProjectionMetrics } from "../mechanics/worldConstants.js";
import { updateCastAimOverlay } from "../rendering/castAimRenderer.js";
import { updateSpriteTicker } from "../rendering/spriteTicker.js";
import { updateRopeTicker } from "../rendering/ropeTicker.js";
import { updateDragTicker } from "../sequences/dragTicker.js";

export function tickerUpdateSprites(pixiApp) {
  updateSpriteTicker({
    spriteManager: pixiApp.spriteManager,
    sessionStore: pixiApp.sessionStore,
    gameStore: pixiApp.gameStore,
    app: pixiApp.app,
  });
}

export async function tickerUpdateDragMechanics(pixiApp) {
  const result = await updateDragTicker({
    app: pixiApp.app,
    gameStore: pixiApp.gameStore,
    sessionStore: pixiApp.sessionStore,
    inventoryStore: pixiApp.inventoryStore,
    locationStore: pixiApp.locationStore,
    debugOverlay: pixiApp.debugOverlay,
    lastDragUpdateTime: pixiApp.lastDragUpdateTime,
    dragStartTime: pixiApp.dragStartTime,
    inputManager: pixiApp.inputManager,
    dragLine: pixiApp.dragLine,
    dragPlayerX: pixiApp.dragPlayerX,
    dragPlayerY: pixiApp.dragPlayerY,
    dragLineUnderwater: pixiApp.dragLineUnderwater,
    dragLineDebug: pixiApp.dragLineDebug,
  });

  pixiApp.lastDragUpdateTime = result.lastDragUpdateTime;
  pixiApp.dragStartTime = result.dragStartTime;
  pixiApp.dragLine = result.dragLine;
  pixiApp.dragLineUnderwater = result.dragLineUnderwater;
  pixiApp.dragLineDebug = result.dragLineDebug;
}

export function tickerUpdateRope(pixiApp) {
  const result = updateRopeTicker({
    app: pixiApp.app,
    sessionStore: pixiApp.sessionStore,
    dragLine: pixiApp.dragLine,
    dragLineUnderwater: pixiApp.dragLineUnderwater,
    dragLineDebug: pixiApp.dragLineDebug,
    dragPlayerX: pixiApp.dragPlayerX,
    dragPlayerY: pixiApp.dragPlayerY,
    lastRopeUpdateTime: pixiApp.lastRopeUpdateTime,
  });
  pixiApp.lastRopeUpdateTime = result.lastRopeUpdateTime;
}

export function tickerUpdateCastAim(pixiApp) {
  if (!pixiApp.app || pixiApp.isDestroyed || !pixiApp.castAimOverlay) {
    return;
  }

  updateCastAimOverlay({
    app: pixiApp.app,
    castAimOverlay: pixiApp.castAimOverlay,
    castAimMask: pixiApp.castAimMask,
    gameStore: pixiApp.gameStore,
    sessionStore: pixiApp.sessionStore,
  });
}

export function tickerUpdateCaustics(pixiApp) {
  if (!pixiApp.app || pixiApp.isDestroyed || !pixiApp.environmentLayers) return;

  const dt = pixiApp.app.ticker.deltaMS / 1000;

  const targetSpeed = pixiApp.environmentLayers.currentSpeed ?? 1;
  const targetChoppiness = pixiApp.environmentLayers.choppiness ?? 1;
  const targetCloudCover = pixiApp.environmentLayers.cloudCover ?? 0.5;

  const transitionRate = 3;
  const blend = 1 - Math.exp(-transitionRate * dt);

  pixiApp._smoothCurrentSpeed +=
    (targetSpeed - pixiApp._smoothCurrentSpeed) * blend;
  pixiApp._smoothChoppiness +=
    (targetChoppiness - pixiApp._smoothChoppiness) * blend;
  pixiApp._smoothCloudCover +=
    (targetCloudCover - pixiApp._smoothCloudCover) * blend;

  const currentSpeed = pixiApp._smoothCurrentSpeed;
  const choppiness = pixiApp._smoothChoppiness;

  const FLOW_FPS_STEP = 1 / 24;
  pixiApp._flowAccumTime += dt;
  if (pixiApp._flowAccumTime >= FLOW_FPS_STEP) {
    const steps = Math.floor(pixiApp._flowAccumTime / FLOW_FPS_STEP);
    pixiApp._flowAccumTime -= steps * FLOW_FPS_STEP;
    pixiApp._flowPhase =
      (pixiApp._flowPhase + steps * FLOW_FPS_STEP * currentSpeed) % 1000;
    pixiApp._flowStepSpeed = currentSpeed;
  }
  const flowPhase = pixiApp._flowPhase;
  const flowStepSpeed = pixiApp._flowStepSpeed ?? currentSpeed;

  const causticsFilter = pixiApp.environmentLayers.causticsFilter;
  if (causticsFilter) {
    const cu = causticsFilter.resources.causticsUniforms.uniforms;
    cu.uTime = (cu.uTime + dt) % 1000;
    cu.uFlowPhase = flowPhase;
    cu.uChoppiness = choppiness;
  }

  const sparkleShader = pixiApp.environmentLayers.sparkleShader;
  if (sparkleShader) {
    const su = sparkleShader.resources.sparkleUniforms.uniforms;
    su.uFlowPhase = flowPhase;
    su.uChoppiness = choppiness;
  }

  const fluidFoamCoordinator = pixiApp.environmentLayers.fluidFoamCoordinator;
  if (fluidFoamCoordinator) {
    fluidFoamCoordinator.setFlowSpeed(flowStepSpeed);
    fluidFoamCoordinator.setChoppiness(choppiness);
    fluidFoamCoordinator.update(dt);

    const debugOverlay = pixiApp.environmentLayers.fluidFoamDebugOverlay;
    if (debugOverlay) {
      debugOverlay.update();
    }
  } else {
    if (!pixiApp._loggedMissingCoordinator) {
      console.warn("[FluidFoam] Coordinator not found in environmentLayers");
      pixiApp._loggedMissingCoordinator = true;
    }
  }

  const edgeFoamShader = pixiApp.environmentLayers.edgeFoamShader;
  if (edgeFoamShader) {
    const eu = edgeFoamShader.resources.edgeFoamUniforms.uniforms;
    eu.uFlowPhase = flowPhase;
    eu.uChoppiness = choppiness;
    eu.uCurrentSpeed = flowStepSpeed;
  }

  const reflectionShader = pixiApp.environmentLayers.reflectionShader;
  if (reflectionShader) {
    const ru = reflectionShader.resources.reflectionUniforms.uniforms;
    const baseCloudDrift = 0.033;
    ru.uTime =
      (ru.uTime +
        dt * baseCloudDrift * (pixiApp.environmentLayers.windSpeed ?? 1)) %
      1000;
    const wd = pixiApp.environmentLayers.windDir;
    if (wd) {
      ru.uWindDir[0] = wd[0];
      ru.uWindDir[1] = wd[1];
    }
    const cloudCover = pixiApp._smoothCloudCover;
    ru.uCloudThreshold = 0.25 - cloudCover * 0.4;

    const reflectionAlpha = pixiApp.gameStore.getState().reflectionAlpha;
    ru.uReflectionAlpha = reflectionAlpha;
  }

  const waterSurfaceShader = pixiApp.environmentLayers.waterSurfaceShader;
  if (waterSurfaceShader) {
    const wu = waterSurfaceShader.resources.waterUniforms.uniforms;
    const gameState = pixiApp.gameStore.getState();
    wu.uWaterAlpha = gameState.waterAlpha;
  }

  const displacementFilter = pixiApp.environmentLayers.displacementFilter;
  if (displacementFilter) {
    const baseScale = 4;
    displacementFilter.scale.x = baseScale * choppiness;
    displacementFilter.scale.y = baseScale * choppiness;
  }

  const sprite = pixiApp.environmentLayers.displacementSprite;
  if (sprite) {
    const baseFlowSpeed = 12;
    const FPS_STEP = 1 / 24;
    pixiApp._displacementTime += dt;
    if (pixiApp._displacementTime >= FPS_STEP) {
      const steps = Math.floor(pixiApp._displacementTime / FPS_STEP);
      pixiApp._displacementTime -= steps * FPS_STEP;
      const elapsed = steps * FPS_STEP;
      let dirX = pixiApp.environmentLayers.flowDirX;
      let dirY = pixiApp.environmentLayers.flowDirY;
      if (!Number.isFinite(dirX) || !Number.isFinite(dirY)) {
        const metrics = getProjectionMetrics(
          pixiApp.environmentLayers.viewport,
        );
        const isoXLen = Math.hypot(
          metrics.screenXPerWorldUnit,
          metrics.screenYPerWorldUnit,
        );
        dirX = metrics.screenXPerWorldUnit / isoXLen;
        dirY = metrics.screenYPerWorldUnit / isoXLen;
      }
      sprite.x += dirX * baseFlowSpeed * currentSpeed * elapsed;
      sprite.y += dirY * baseFlowSpeed * currentSpeed * elapsed;
    }
  }
}
