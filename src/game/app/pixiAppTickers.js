import { getProjectionMetrics } from "../mechanics/worldConstants.js";
import { updateCastAimOverlay } from "../rendering/castAimRenderer.js";
import { updateSpriteTicker } from "../rendering/spriteTicker.js";
import { updateRopeTicker } from "../rendering/ropeTicker.js";
import { updateFloatTicker } from "../rendering/floatTicker.js";
import { updateDragTicker } from "../sequences/dragTicker.js";

export function tickerUpdateScreenShake(pixiApp) {
  if (!pixiApp.app || !pixiApp.sceneContainer || !pixiApp.sessionStore) {
    return;
  }

  const sessionState = pixiApp.sessionStore.getState();
  const requestId = sessionState.screenShakeRequestId || 0;
  const request = sessionState.screenShakeRequest;
  if (requestId !== pixiApp._screenShakeRequestId && request) {
    pixiApp._screenShakeRequestId = requestId;
    pixiApp._screenShakeRemaining = request.duration;
    pixiApp._screenShakeDuration = request.duration;
    pixiApp._screenShakeIntensity = request.intensity;
    pixiApp._screenShakeFrequency = request.frequency || 30;
    pixiApp._screenShakeSampleTimer = 0;
  }

  if (
    pixiApp._screenShakeRemaining <= 0 ||
    pixiApp._screenShakeIntensity <= 0
  ) {
    if (pixiApp._screenShakeActive) {
      pixiApp.sceneContainer.x = 0;
      pixiApp.sceneContainer.y = 0;
      pixiApp._screenShakeActive = false;
    }
    return;
  }

  const deltaSeconds = pixiApp.app.ticker.deltaMS / 1000;
  const progress =
    pixiApp._screenShakeDuration > 0
      ? pixiApp._screenShakeRemaining / pixiApp._screenShakeDuration
      : 0;
  const amplitude = pixiApp._screenShakeIntensity * Math.max(0, progress);

  const sampleInterval = 1 / Math.max(1, pixiApp._screenShakeFrequency || 30);
  pixiApp._screenShakeSampleTimer -= deltaSeconds;
  if (pixiApp._screenShakeSampleTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    pixiApp._screenShakeOffset = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
    pixiApp._screenShakeSampleTimer = sampleInterval;
  }

  pixiApp._screenShakeActive = true;
  pixiApp.sceneContainer.x = pixiApp._screenShakeOffset.x * amplitude;
  pixiApp.sceneContainer.y = pixiApp._screenShakeOffset.y * amplitude;

  pixiApp._screenShakeRemaining -= deltaSeconds;
  if (pixiApp._screenShakeRemaining <= 0) {
    pixiApp.sceneContainer.x = 0;
    pixiApp.sceneContainer.y = 0;
    pixiApp._screenShakeActive = false;
  }
}

export function tickerUpdateSprites(pixiApp) {
  updateSpriteTicker({
    spriteManager: pixiApp.spriteManager,
    sessionStore: pixiApp.sessionStore,
    gameStore: pixiApp.gameStore,
    app: pixiApp.app,
  });
}

export function tickerUpdateFloat(pixiApp) {
  updateFloatTicker({
    floatManager: pixiApp.floatManager,
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

// Updates all water-related visuals (caustics, foam, sparkle, reflections).
export function tickerUpdateWaterEffects(pixiApp) {
  if (!pixiApp.app || pixiApp.isDestroyed || !pixiApp.environmentLayers) return;

  const deltaSeconds = pixiApp.app.ticker.deltaMS / 1000;

  const targetCurrentSpeed = pixiApp.environmentLayers.currentSpeed ?? 1;
  const targetChoppiness = pixiApp.environmentLayers.choppiness ?? 1;
  const targetCloudCover = pixiApp.environmentLayers.cloudCover ?? 0.5;

  const smoothingRate = 3;
  const smoothingBlend = 1 - Math.exp(-smoothingRate * deltaSeconds);

  pixiApp._smoothCurrentSpeed +=
    (targetCurrentSpeed - pixiApp._smoothCurrentSpeed) * smoothingBlend;
  pixiApp._smoothChoppiness +=
    (targetChoppiness - pixiApp._smoothChoppiness) * smoothingBlend;
  pixiApp._smoothCloudCover +=
    (targetCloudCover - pixiApp._smoothCloudCover) * smoothingBlend;

  const smoothedCurrentSpeed = pixiApp._smoothCurrentSpeed;
  const smoothedChoppiness = pixiApp._smoothChoppiness;

  const FLOW_STEP_SECONDS = 1 / 24;
  pixiApp._flowAccumTime += deltaSeconds;
  if (pixiApp._flowAccumTime >= FLOW_STEP_SECONDS) {
    const steps = Math.floor(pixiApp._flowAccumTime / FLOW_STEP_SECONDS);
    pixiApp._flowAccumTime -= steps * FLOW_STEP_SECONDS;
    pixiApp._flowPhase =
      (pixiApp._flowPhase + steps * FLOW_STEP_SECONDS * smoothedCurrentSpeed) %
      1000;
    pixiApp._flowStepSpeed = smoothedCurrentSpeed;
  }
  const flowPhase = pixiApp._flowPhase;
  const flowStepSpeed = pixiApp._flowStepSpeed ?? smoothedCurrentSpeed;

  const causticsFilter = pixiApp.environmentLayers.causticsFilter;
  if (causticsFilter) {
    const causticsUniforms = causticsFilter.resources.causticsUniforms.uniforms;
    causticsUniforms.uTime = (causticsUniforms.uTime + deltaSeconds) % 1000;
    causticsUniforms.uFlowPhase = flowPhase;
    causticsUniforms.uChoppiness = smoothedChoppiness;
  }

  const sparkleShader = pixiApp.environmentLayers.sparkleShader;
  if (sparkleShader) {
    const sparkleUniforms = sparkleShader.resources.sparkleUniforms.uniforms;
    sparkleUniforms.uFlowPhase = flowPhase;
    sparkleUniforms.uChoppiness = smoothedChoppiness;
  }

  const sparkleBloomShader = pixiApp.environmentLayers.sparkleBloomShader;
  if (sparkleBloomShader) {
    const sparkleBloomUniforms =
      sparkleBloomShader.resources.sparkleUniforms.uniforms;
    sparkleBloomUniforms.uFlowPhase = flowPhase;
    sparkleBloomUniforms.uChoppiness = smoothedChoppiness;
  }

  const fluidFoamCoordinator = pixiApp.environmentLayers.fluidFoamCoordinator;
  if (fluidFoamCoordinator) {
    fluidFoamCoordinator.setFlowSpeed(flowStepSpeed);
    fluidFoamCoordinator.setChoppiness(smoothedChoppiness);
    fluidFoamCoordinator.update(deltaSeconds);

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
    const edgeFoamUniforms = edgeFoamShader.resources.edgeFoamUniforms.uniforms;
    edgeFoamUniforms.uFlowPhase = flowPhase;
    edgeFoamUniforms.uChoppiness = smoothedChoppiness;
    edgeFoamUniforms.uCurrentSpeed = flowStepSpeed;
  }

  const reflectionShader = pixiApp.environmentLayers.reflectionShader;
  if (reflectionShader) {
    const reflectionUniforms =
      reflectionShader.resources.reflectionUniforms.uniforms;
    const baseCloudDrift = 0.033;
    reflectionUniforms.uTime =
      (reflectionUniforms.uTime +
        deltaSeconds *
          baseCloudDrift *
          (pixiApp.environmentLayers.windSpeed ?? 1)) %
      1000;
    const baseCloudMorph = 0.0003;
    const morphSpeed = pixiApp.environmentLayers.cloudMorphSpeed ?? 1;
    reflectionUniforms.uMorphTime =
      (reflectionUniforms.uMorphTime +
        deltaSeconds * baseCloudMorph * morphSpeed) %
      1000;
    const windDir = pixiApp.environmentLayers.windDir;
    if (windDir) {
      reflectionUniforms.uWindDir[0] = windDir[0];
      reflectionUniforms.uWindDir[1] = windDir[1];
    }
    const cloudCover = pixiApp._smoothCloudCover;
    reflectionUniforms.uCloudCover = cloudCover;
    const lightDir = pixiApp.environmentLayers.cloudLightDir;
    if (lightDir) {
      reflectionUniforms.uLightDir[0] = lightDir[0];
      reflectionUniforms.uLightDir[1] = lightDir[1];
    }
    if (Number.isFinite(pixiApp.environmentLayers.cloudLightOffset)) {
      reflectionUniforms.uLightOffset =
        pixiApp.environmentLayers.cloudLightOffset;
    }
    if (Number.isFinite(pixiApp.environmentLayers.cloudLightStrength)) {
      reflectionUniforms.uLightStrength =
        pixiApp.environmentLayers.cloudLightStrength;
    }
    if (Number.isFinite(pixiApp.environmentLayers.cloudSoftEdges)) {
      reflectionUniforms.uSoftEdges = pixiApp.environmentLayers.cloudSoftEdges;
    }
    if (Number.isFinite(pixiApp.environmentLayers.cloudSoftLight)) {
      reflectionUniforms.uSoftLight = pixiApp.environmentLayers.cloudSoftLight;
    }

    const reflectionAlpha = pixiApp.gameStore.getState().reflectionAlpha;
    reflectionUniforms.uReflectionAlpha = reflectionAlpha;
  }

  const waterSurfaceShader = pixiApp.environmentLayers.waterSurfaceShader;
  if (waterSurfaceShader) {
    const waterUniforms = waterSurfaceShader.resources.waterUniforms.uniforms;
    const gameState = pixiApp.gameStore.getState();
    waterUniforms.uWaterAlpha = gameState.waterAlpha;
  }

  const displacementFilter = pixiApp.environmentLayers.displacementFilter;
  if (displacementFilter) {
    const baseScale = 4;
    displacementFilter.scale.x = baseScale * smoothedChoppiness;
    displacementFilter.scale.y = baseScale * smoothedChoppiness;
  }

  const displacementSprite = pixiApp.environmentLayers.displacementSprite;
  if (displacementSprite) {
    const displacementBaseSpeed = 12;
    const DISPLACEMENT_STEP_SECONDS = 1 / 24;
    pixiApp._displacementTime += deltaSeconds;
    if (pixiApp._displacementTime >= DISPLACEMENT_STEP_SECONDS) {
      const steps = Math.floor(
        pixiApp._displacementTime / DISPLACEMENT_STEP_SECONDS,
      );
      pixiApp._displacementTime -= steps * DISPLACEMENT_STEP_SECONDS;
      const elapsed = steps * DISPLACEMENT_STEP_SECONDS;
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
      displacementSprite.x +=
        dirX * displacementBaseSpeed * smoothedCurrentSpeed * elapsed;
      displacementSprite.y +=
        dirY * displacementBaseSpeed * smoothedCurrentSpeed * elapsed;
    }
  }
}
