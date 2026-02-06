import * as PIXI from "pixi.js";
import {
  WORLD_Z,
  createViewport,
  screenToWorld,
  worldToScreen,
  lerp,
  getAvatarHandWorldPosition,
} from "../mechanics/worldConstants.js";
import { createMagnetSprite } from "../graphics/placeholderSprites.js";
import useMagnetStore from "../state/magnetStore.js";
import { renderProjectedRope } from "./projectedRopeRenderer.js";
import { cleanupDisplayObjects } from "../rendering/displayCleanup.js";

/**
 * Animate rope reeling in after drag failure.
 * Uses projected rope rendering (no physics dependency).
 */
export function animateReelIn(
  app,
  _rope,
  line,
  _playerX,
  _playerY,
  startX,
  startY,
  sessionStore,
  options = {}
) {
  return new Promise((resolve) => {
    if (!app || !line) {
      resolve();
      return;
    }

    const magnetStore = useMagnetStore.getState();
    magnetStore?.despawnMagnet?.();

    const retractDuration = 500;
    const startTime = performance.now();
    const viewport = createViewport(app.screen.width, app.screen.height);
    const castOrigin = getAvatarHandWorldPosition();
    const startWorld = screenToWorld(
      startX,
      startY,
      WORLD_Z.RIVERBED,
      viewport
    );

    const reelMagnetSprite = createMagnetSprite();
    reelMagnetSprite.scale.set(2);
    reelMagnetSprite.pivot.set(
      reelMagnetSprite.width / 2,
      reelMagnetSprite.height / 2
    );
    (line.parent || app.stage).addChild(reelMagnetSprite);

    const animate = (currentTime) => {
      if (!app) {
        cleanupDisplayObjects(
          line,
          options.lineUnderwater,
          options.lineDebug,
          reelMagnetSprite
        );
        resolve();
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / retractDuration, 1);
      const magnetWorld = {
        x: lerp(startWorld.x, castOrigin.x, progress),
        y: lerp(startWorld.y, castOrigin.y, progress),
        z: lerp(startWorld.z, castOrigin.z, progress),
      };

      renderProjectedRope(line, viewport, castOrigin, magnetWorld, {
        tension: sessionStore?.getState().ropeTension,
        lineUnderwater: options.lineUnderwater ?? null,
        lineDebug: options.lineDebug ?? null,
      });

      const magnetScreen = worldToScreen(magnetWorld, viewport);
      reelMagnetSprite.x = magnetScreen.x;
      reelMagnetSprite.y = magnetScreen.y;

      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }

      if (sessionStore) {
        sessionStore.getState().setPhase("idle");
        sessionStore.getState().setPhaseProgress(0);
        sessionStore.getState().setCastPosition(null, null);
      }

      cleanupDisplayObjects(
        line,
        options.lineUnderwater,
        options.lineDebug,
        reelMagnetSprite
      );

      console.log("[REEL-IN] Complete");
      resolve();
    };

    requestAnimationFrame(animate);
  });
}
