import { getItemWorldPosition } from "../sequences/dragSequence.js";

export function updateSpriteTicker({
  spriteManager,
  sessionStore,
  gameStore,
  app,
}) {
  if (!spriteManager) return;

  const physicsState = sessionStore?.getState().physicsState;
  const gamePhase = gameStore?.getState().gamePhase;

  if (gamePhase !== "dragging" || !physicsState?.active) {
    spriteManager.clearSprites();
    return;
  }

  const currentCast = gameStore?.getState().currentCast;
  const item = currentCast?.item;

  if (!item) {
    spriteManager.clearSprites();
    return;
  }

  const itemWorld = getItemWorldPosition(app, sessionStore);
  spriteManager.updateSprites(item, itemWorld, physicsState);
}
