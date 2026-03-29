import { renderProjectedRope } from "../animations/projectedRopeRenderer.js";
import { updateRopePhysics } from "../sequences/dragSequence.js";
import { createViewport, worldToScreen } from "../mechanics/worldConstants.js";
import { speedFromDelta } from "../physics/vectorUtils.js";

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
      ).toFixed(0)}ms)`,
    );
  }

  const nextRopeUpdateTime = now;
  const sessionState = sessionStore?.getState?.();
  const tension = sessionState?.ropeTension ?? 50;
  const physicsState = sessionState?.physicsState;
  const visualSlack = Math.max(0, sessionState?.ropeVisualSlack ?? 0);
  const draggingWithPhysics = phase === "drag" && Boolean(physicsState?.active);
  const physicsSlack = Math.max(0, physicsState?.slack ?? 0);
  const slack = draggingWithPhysics ? physicsSlack : visualSlack;
  const breakThreshold = Math.max(0, physicsState?.breakThreshold ?? 0);

  if (draggingWithPhysics && sessionState?.setRopeVisualSlack) {
    sessionState.setRopeVisualSlack(physicsSlack, 1e-4);
  }

  const ropeState = updateRopePhysics(
    app,
    sessionStore,
    deltaTime,
    dragPlayerX,
    dragPlayerY,
    tension,
  );

  if (ropeState && dragLine) {
    const viewport = createViewport(app.screen.width, app.screen.height);
    const ropeRenderResult = renderProjectedRope(
      dragLine,
      viewport,
      ropeState.castOrigin,
      ropeState.magnetWorld,
      {
        tension,
        slack,
        breakThreshold,
        timeSeconds: now / 1000,
        lineUnderwater: dragLineUnderwater,
        lineDebug: dragLineDebug,
      },
    );

    const waterHitWorld = ropeRenderResult?.waterHitWorld ?? null;
    const prevWaterHit = sessionStore?.getState?.().ropeWaterHitWorld;
    if (dragLineDebug && waterHitWorld) {
      const hitScreen = worldToScreen(waterHitWorld, viewport);
      dragLineDebug
        .circle(hitScreen.x, hitScreen.y, 3)
        .fill({ color: 0x22ff88, alpha: 0.8 });
    }
    if (sessionStore?.getState?.().setRopeWaterHitWorld) {
      sessionStore.getState().setRopeWaterHitWorld(waterHitWorld);
    }
    if (waterHitWorld && prevWaterHit && typeof window !== "undefined") {
      const dx = waterHitWorld.x - prevWaterHit.x;
      const dy = waterHitWorld.y - prevWaterHit.y;
      const speed = speedFromDelta(dx, dy, deltaTime);
      const pixiApp = window.getPixiApp ? window.getPixiApp() : null;
      pixiApp?.handleRopeWaterSplat?.(waterHitWorld.x, waterHitWorld.y, speed);
    }
  }

  return { lastRopeUpdateTime: nextRopeUpdateTime };
}
