import { handleDragFailure } from "./castSequence.js";
import { updateDragMechanics } from "./dragSequence.js";

export async function updateDragTicker({
  app,
  gameStore,
  sessionStore,
  inventoryStore,
  locationStore,
  debugOverlay,
  lastDragUpdateTime,
  dragStartTime,
  inputManager,
  dragLine,
  dragPlayerX,
  dragPlayerY,
  dragLineUnderwater,
  dragLineDebug,
}) {
  let nextDragLine = dragLine;
  let nextDragLineUnderwater = dragLineUnderwater;
  let nextDragLineDebug = dragLineDebug;

  const result = await updateDragMechanics(
    app,
    gameStore,
    sessionStore,
    inventoryStore,
    locationStore,
    debugOverlay,
    lastDragUpdateTime,
    dragStartTime,
    async (failureWorldPosition) => {
      inputManager?.resetInputState();
      await handleDragFailure(
        app,
        gameStore,
        sessionStore,
        locationStore,
        debugOverlay,
        failureWorldPosition,
        inputManager
          ? inputManager.getQuadrantFromPosition.bind(inputManager)
          : null,
        null,
        nextDragLine,
        dragPlayerX,
        dragPlayerY,
        nextDragLineUnderwater,
        nextDragLineDebug
      );
      nextDragLine = null;
      nextDragLineUnderwater = null;
      nextDragLineDebug = null;
    },
    () => {
      if (nextDragLine && nextDragLine.parent) {
        nextDragLine.parent.removeChild(nextDragLine);
        nextDragLine.destroy();
        nextDragLine = null;
      }
      if (nextDragLineUnderwater && nextDragLineUnderwater.parent) {
        nextDragLineUnderwater.parent.removeChild(nextDragLineUnderwater);
        nextDragLineUnderwater.destroy();
        nextDragLineUnderwater = null;
      }
      if (nextDragLineDebug && nextDragLineDebug.parent) {
        nextDragLineDebug.parent.removeChild(nextDragLineDebug);
        nextDragLineDebug.destroy();
        nextDragLineDebug = null;
      }

      if (sessionStore) {
        sessionStore.getState().setPhase("idle");
        sessionStore.getState().setPhaseProgress(0);
        sessionStore.getState().setCastPosition(null, null);
      }
      inputManager?.resetInputState();
    }
  );

  return {
    lastDragUpdateTime: result.lastDragUpdateTime,
    dragStartTime: result.dragStartTime,
    dragLine: nextDragLine,
    dragLineUnderwater: nextDragLineUnderwater,
    dragLineDebug: nextDragLineDebug,
  };
}
