import { InputManager } from "../input/inputManager.js";
import { executeCastSequence } from "../sequences/castSequence.js";
import { getItemWorldPosition } from "../sequences/dragSequence.js";
import { clamp } from "../physics/vectorUtils.js";

export function setupInteraction(pixiApp) {
  if (!pixiApp.app || pixiApp.isDestroyed) return;

  pixiApp.inputManager = new InputManager(
    pixiApp.app,
    pixiApp.gameStore,
    pixiApp.sessionStore,
    pixiApp.locationStore,
    pixiApp.debugOverlay,
    {
      onCast: pixiApp.handleCast.bind(pixiApp),
      onFluidSplat: pixiApp.handleFluidSplat.bind(pixiApp),
    },
  );

  pixiApp.inputManager.setupInteraction();
}

export async function handleCast(pixiApp, x, y, quadrant) {
  const result = await executeCastSequence(
    pixiApp.app,
    pixiApp.gameStore,
    pixiApp.sessionStore,
    pixiApp.locationStore,
    pixiApp.debugOverlay,
    x,
    y,
    quadrant,
    () => getItemWorldPosition(pixiApp.app, pixiApp.sessionStore),
    pixiApp,
  );

  if (result) {
    pixiApp.dragBubbleInterval = result.dragBubbleInterval;
    pixiApp.dragLine = result.line;
    pixiApp.dragPlayerX = result.playerX;
    pixiApp.dragPlayerY = result.playerY;
  }
}

export function handleFluidSplat(
  pixiApp,
  worldX,
  worldY,
  deltaWorldX,
  deltaWorldY,
) {
  withFoamCoordinator(pixiApp, (fluidFoamCoordinator) => {
    const preset = pixiApp._foamSplatPresets.input;
    fluidFoamCoordinator.applyInputSplat(
      worldX,
      worldY,
      deltaWorldX,
      deltaWorldY,
      preset,
    );
  });
}

export function handleMagnetLandingSplat(pixiApp, worldX, worldY) {
  withFoamCoordinator(pixiApp, (fluidFoamCoordinator) => {
    const preset = pixiApp._foamSplatPresets.landing;
    fluidFoamCoordinator.applyLandingSplat(worldX, worldY, preset);
  });
}

export function handleMagnetDragSplat(pixiApp, worldX, worldY, speed) {
  withFoamCoordinator(pixiApp, (fluidFoamCoordinator) => {
    const preset = pixiApp._foamSplatPresets.magnetDrag;
    const scaledStrength = clamp(speed * preset.scale, preset.min, preset.max);
    fluidFoamCoordinator.applyDragRepel(worldX, worldY, {
      radiusWorld: preset.radiusWorld,
      strength: scaledStrength,
    });
  });
}

export function handleRopeWaterSplat(pixiApp, worldX, worldY, speed) {
  withFoamCoordinator(pixiApp, (fluidFoamCoordinator) => {
    const preset = pixiApp._foamSplatPresets.rope;
    const scaledStrength = clamp(speed * preset.scale, preset.min, preset.max);
    fluidFoamCoordinator.applyDragRepel(worldX, worldY, {
      radiusWorld: preset.radiusWorld,
      strength: scaledStrength,
    });
  });
}

export function withFoamCoordinator(pixiApp, callback) {
  const fluidFoamCoordinator = pixiApp.environmentLayers?.fluidFoamCoordinator;
  if (!fluidFoamCoordinator || typeof callback !== "function") {
    return;
  }

  callback(fluidFoamCoordinator);
}
