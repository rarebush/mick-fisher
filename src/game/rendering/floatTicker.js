import { WORLD_Z } from "../mechanics/worldConstants.js";

export function updateFloatTicker({
  floatManager,
  sessionStore,
  gameStore,
  app,
}) {
  if (!floatManager || !app || !sessionStore || !gameStore) return;

  const gamePhase = gameStore.getState().gamePhase;
  const physicsState = sessionStore.getState().physicsState;

  if (gamePhase !== "waiting" || !physicsState?.waitState) {
    floatManager.clear();
    return;
  }

  const waitState = physicsState.waitState;
  if (!waitState.castPosition) {
    floatManager.clear();
    return;
  }

  // Ensure the float stays on the surface plane (no sinking).
  if (waitState.castPosition.z !== WORLD_Z.WATER_SURFACE) {
    waitState.castPosition = {
      ...waitState.castPosition,
      z: WORLD_Z.WATER_SURFACE,
    };
  }

  const timeSeconds = (app.ticker?.lastTime ?? performance.now()) / 1000;
  floatManager.update(waitState, timeSeconds);

  const screenPos = floatManager.lastScreenPosition;
  if (screenPos) {
    sessionStore.getState().setCastPosition(screenPos.x, screenPos.y);
  }
}
