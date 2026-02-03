import { renderProjectedRope } from "../animations/projectedRopeRenderer.js";
import { updateRopePhysics } from "../sequences/dragSequence.js";
import { createViewport } from "../mechanics/worldConstants.js";

export function updateRopeTicker({
  app,
  sessionStore,
  dragLine,
  dragLineUnderwater,
  dragLineDebug,
  dragPlayerX,
  dragPlayerY,
  lastRopeUpdateTime,
}) {
  if (!app || !dragLine) {
    return { lastRopeUpdateTime };
  }

  const phase = sessionStore?.getState().phase;
  if (phase === "reeling") {
    return { lastRopeUpdateTime };
  }

  const now = performance.now();
  const deltaTime = lastRopeUpdateTime
    ? (now - lastRopeUpdateTime) / 1000
    : 1 / 60;

  if (deltaTime > 0.1) {
    console.warn(
      `[TICKER] Large deltaTime in rope ticker: ${deltaTime.toFixed(3)}s (${(
        now - lastRopeUpdateTime
      ).toFixed(0)}ms)`
    );
  }

  const nextRopeUpdateTime = now;
  const tension = sessionStore?.getState().ropeTension ?? 50;
  const ropeState = updateRopePhysics(
    app,
    sessionStore,
    deltaTime,
    dragPlayerX,
    dragPlayerY,
    tension
  );

  if (ropeState && dragLine) {
    const viewport = createViewport(app.screen.width, app.screen.height);
    renderProjectedRope(
      dragLine,
      viewport,
      ropeState.castOrigin,
      ropeState.magnetWorld,
      {
        tension,
        lineUnderwater: dragLineUnderwater,
        lineDebug: dragLineDebug,
      }
    );
  }

  return { lastRopeUpdateTime: nextRopeUpdateTime };
}
