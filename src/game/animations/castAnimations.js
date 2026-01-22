/**
 * Cast Animations
 * Visual feedback animations for casting phase
 */

import * as PIXI from "pixi.js";
import { Rope3D } from "../physics/RopePhysics3D.js";
import {
  getAvatarPosition,
  getMagnetPosition,
  calculateRopeSegments,
} from "../mechanics/heightMechanics.js";

/**
 * Animate casting line from shore to target position with 3D rope physics
 * Shows magnet arc to water surface, splash, then sink to riverbed
 * Returns the graphics object to keep visible during drag
 * The 3D rope is stored in sessionStore for continuous use
 */
export function animateCastLine(
  app,
  targetX,
  targetY,
  gameStore,
  sessionStore,
) {
  return new Promise((resolve) => {
    if (!app) {
      resolve({ line: null, playerX: 0, playerY: 0, finalTension: 0 });
      return;
    }

    // Clean up any existing rope state before creating new one
    if (sessionStore) {
      const existingRope = sessionStore.getState().rope;
      if (existingRope) {
        console.log("[CAST] Cleaning up existing rope before new cast");
      }
      sessionStore.getState().setRope(null);
      sessionStore.getState().setPhase("idle");
      sessionStore.getState().setPhaseProgress(0);
      sessionStore.getState().setCastPosition(null, null);
    }

    // Starting point - center of walkway
    const startX = app.screen.width / 2;
    const startY = app.screen.height * 0.1; // Middle of walkway (10% from top)

    // Environment layout:
    // Riverbed: 40-100% from top (where user clicks)
    // Water: 30-90% from top (visual overlay)
    const riverbedStartY = app.screen.height * 0.4; // 40%
    const riverbedEndY = app.screen.height; // 100%
    const waterStartY = app.screen.height * 0.3; // 30%
    const waterEndY = app.screen.height * 0.9; // 90%

    // Create fresh 3D rope
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance2D = Math.sqrt(dx * dx + dy * dy);
    const segments = calculateRopeSegments(distance2D);

    const avatarPos = getAvatarPosition(startX, startY);
    const magnetPos = getMagnetPosition(startX, startY, "cast", 0); // Start at avatar position

    const rope3D = new Rope3D(segments, avatarPos, magnetPos);

    console.log(
      `[CAST] Created fresh Rope3D with ${segments} segments for cast to (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`,
    );

    // Store in sessionStore immediately
    if (sessionStore) {
      sessionStore.getState().setRope(rope3D);
      sessionStore.getState().setPhase("cast");
      sessionStore.getState().setPhaseProgress(0);
    }

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    app.stage.addChild(line);

    // Animation parameters
    const throwDuration = 500; // milliseconds for throw arc to water surface
    const sinkDuration = 600; // milliseconds for magnet to sink to riverbed
    const settleDuration = 400; // milliseconds for rope to settle
    const startTime = performance.now();

    // Calculate water surface position directly above the target riverbed position
    // Map targetY from riverbed space (40-100%) to water space (30-90%)
    const riverbedDepth =
      (targetY - riverbedStartY) / (riverbedEndY - riverbedStartY); // 0-1
    const waterHitX = targetX;
    const waterHitY = waterStartY + riverbedDepth * (waterEndY - waterStartY);

    // Calculate throw arc parameters
    const distance = Math.sqrt(
      (waterHitX - startX) ** 2 + (waterHitY - startY) ** 2,
    );
    const throwAngle = Math.atan2(waterHitY - startY, waterHitX - startX);

    let phase = "throwing"; // 'throwing' -> 'splashing' -> 'sinking' -> 'settling' -> 'done'
    let phaseStartTime = 0;
    let magnetX = startX;
    let magnetY = startY;
    let magnetZ = 100; // Start at avatar height

    // Tension animation: 40 (throw) -> 25 (surface) -> 15 (sinking) -> 10 (settled)
    let currentTension = 40;

    const deltaTime = 1 / 60; // Approximate frame time

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
        resolve({
          line: null,
          playerX: startX,
          playerY: startY,
          finalTension: 0,
        });
        return;
      }

      const elapsed = currentTime - startTime;

      if (phase === "throwing") {
        // PHASE 1: Throw magnet in arc from player to water surface
        const progress = Math.min(elapsed / throwDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease-out

        // Animate tension: 40 -> 25 as rope extends
        currentTension = 40 - 15 * progress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Calculate magnet position along parabolic arc to water surface
        magnetX = startX + (waterHitX - startX) * eased;
        magnetY =
          startY +
          (waterHitY - startY) * eased -
          Math.sin(progress * Math.PI) * 40; // Arc height
        magnetZ = 100 - 40 * progress; // Descend from 100 to 60 (water surface)

        // Update 3D rope physics
        const avatarPos3D = getAvatarPosition(startX, startY);
        const magnetPos3D = getMagnetPosition(
          magnetX,
          magnetY,
          "cast",
          progress * 0.5,
        ); // 0-0.5 for throwing phase
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render 3D rope
        render3DRope(
          line,
          rope3D,
          waterStartY + riverbedDepth * (waterEndY - waterStartY),
        );

        if (progress >= 1) {
          // Magnet hit water surface!
          phase = "splashing";
          phaseStartTime = currentTime;
          magnetX = waterHitX;
          magnetY = waterHitY;
          magnetZ = 60; // Water surface height

          console.log(
            `[CAST] Magnet hit water surface at (${magnetX.toFixed(0)}, ${magnetY.toFixed(0)})`,
          );
        }
      } else if (phase === "splashing") {
        // PHASE 2: Brief pause at water surface (visual impact)
        const splashElapsed = currentTime - phaseStartTime;
        const splashDuration = 100; // Quick splash

        if (splashElapsed >= splashDuration) {
          phase = "sinking";
          phaseStartTime = currentTime;
          console.log(`[CAST] Magnet sinking from water to riverbed...`);
        }

        // Keep magnet at water surface
        const avatarPos3D = getAvatarPosition(startX, startY);
        const magnetPos3D = getMagnetPosition(magnetX, magnetY, "cast", 0.5); // At water surface
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);
        const currentWaterSurfaceY =
          waterStartY + riverbedDepth * (waterEndY - waterStartY);
        render3DRope(line, rope3D, currentWaterSurfaceY);
      } else if (phase === "sinking") {
        // PHASE 3: Sink from water surface down to riverbed target
        const sinkElapsed = currentTime - phaseStartTime;
        const sinkProgress = Math.min(sinkElapsed / sinkDuration, 1);
        const eased = sinkProgress * sinkProgress; // Ease-in (accelerate as it sinks)

        // Animate tension: 25 -> 15 as magnet sinks
        currentTension = 25 - 10 * sinkProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Magnet sinks straight down from water surface to target on riverbed
        magnetX = waterHitX; // Stay at same X
        magnetY = waterHitY + (targetY - waterHitY) * eased; // Sink down
        magnetZ = 60 - 60 * sinkProgress; // Descend from 60 (water surface) to 0 (riverbed)

        // Update 3D rope physics
        const avatarPos3D = getAvatarPosition(startX, startY);
        const magnetPos3D = getMagnetPosition(
          magnetX,
          magnetY,
          "cast",
          0.5 + 0.5 * sinkProgress,
        ); // 0.5-1.0 for sinking phase
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render rope with underwater opacity
        const currentWaterSurfaceY =
          waterStartY + riverbedDepth * (waterEndY - waterStartY);
        render3DRope(line, rope3D, currentWaterSurfaceY);

        if (sinkProgress >= 1) {
          // Magnet reached riverbed!
          phase = "settling";
          phaseStartTime = currentTime;
          magnetX = targetX;
          magnetY = targetY;
          magnetZ = 0; // At riverbed

          console.log(
            `[CAST] Magnet reached riverbed at (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`,
          );
        }
      } else if (phase === "settling") {
        // PHASE 4: Rope settles at riverbed
        const settleElapsed = currentTime - phaseStartTime;
        const settleProgress = Math.min(settleElapsed / settleDuration, 1);

        // Animate tension: 15 -> 10 as rope settles
        currentTension = 15 - 5 * settleProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update 3D rope physics
        const avatarPos3D = getAvatarPosition(startX, startY);
        const magnetPos3D = getMagnetPosition(targetX, targetY, "cast", 1.0); // Fully at riverbed
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render rope
        const currentWaterSurfaceY =
          waterStartY + riverbedDepth * (waterEndY - waterStartY);
        render3DRope(line, rope3D, currentWaterSurfaceY);

        if (settleProgress >= 1) {
          // Done - return line to keep visible during drag
          console.log(
            `[CAST] Animation complete, tension: ${currentTension.toFixed(1)}`,
          );

          // Update phase progress in sessionStore
          if (sessionStore) {
            sessionStore.getState().setPhaseProgress(1.0);
          }

          resolve({
            line,
            playerX: startX,
            playerY: startY,
            finalTension: currentTension,
          });
          return; // Don't call requestAnimationFrame again
        }
      }

      // Only request next frame if we haven't completed
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Render 3D rope with underwater opacity
 * @param {PIXI.Graphics} line - Graphics object to draw rope on
 * @param {Rope3D} rope3D - 3D rope physics object
 * @param {number} waterSurfaceY - Y coordinate of water surface
 */
function render3DRope(line, rope3D, waterSurfaceY) {
  if (!line || !rope3D || line.destroyed) {
    return;
  }

  // Get screen-projected points from 3D rope
  const screenPoints = rope3D.getScreenPoints();

  console.log(
    `[RENDER] Rendering ${screenPoints.length} rope points, first: (${screenPoints[0]?.x.toFixed(1)}, ${screenPoints[0]?.y.toFixed(1)}), last: (${screenPoints[screenPoints.length - 1]?.x.toFixed(1)}, ${screenPoints[screenPoints.length - 1]?.y.toFixed(1)})`,
  );

  line.clear();

  if (screenPoints.length < 2) {
    console.warn("[RENDER] Not enough points to render rope");
    return;
  }

  // Draw rope as brown line
  line.setStrokeStyle({ width: 3, color: 0x8b4513 });

  // Start at first point
  line.moveTo(screenPoints[0].x, screenPoints[0].y);

  // Draw rest of rope
  for (let i = 1; i < screenPoints.length; i++) {
    const point = screenPoints[i];

    // Fade underwater portions
    if (point.y > waterSurfaceY) {
      line.setStrokeStyle({ width: 3, color: 0x8b4513, alpha: 0.6 }); // More transparent underwater
    }

    line.lineTo(point.x, point.y);
  }

  line.stroke();
}

/**
 * Animate rope reeling in after drag failure
 * Shows jerk back then gradual reel-in with 3D rope physics
 * Returns a promise that resolves when animation completes
 */
export function animateReelIn(
  app,
  rope,
  line,
  playerX,
  playerY,
  startX,
  startY,
  sessionStore,
) {
  return new Promise((resolve) => {
    if (!app || !line) {
      resolve();
      return;
    }

    const rope3D = sessionStore?.getState().rope;
    if (!rope3D) {
      // No 3D rope, just clean up
      if (line.parent) {
        line.parent.removeChild(line);
      }
      line.destroy();
      resolve();
      return;
    }

    // Reset rope physics state to prevent velocity carryover from drag
    if (rope3D.resetPhysicsState) {
      rope3D.resetPhysicsState();
      console.log("[REEL-IN] Reset rope physics state");
    }

    const jerkDuration = 100; // Quick jerk back
    const reelDuration = 600; // Slower gradual reel
    const totalDuration = jerkDuration + reelDuration;
    const startTime = performance.now();

    // Get initial magnet position from cast position
    const castPos = sessionStore.getState().castPosition;
    const initialMagnetX = castPos?.x || startX;
    const initialMagnetY = castPos?.y || startY;

    const deltaTime = 1 / 60; // Approximate frame time

    // Water surface for rendering
    const waterSurfaceY = app.screen.height * 0.3;

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
        resolve();
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      let magnetX, magnetY;

      if (elapsed < jerkDuration) {
        // PHASE 1: Quick jerk back towards player (10-20% of distance)
        const jerkProgress = elapsed / jerkDuration;
        const jerkEase = Math.sin(jerkProgress * Math.PI); // Smooth bump
        const jerkAmount = 0.15; // Jerk back 15% of distance

        magnetX =
          initialMagnetX + (playerX - initialMagnetX) * jerkAmount * jerkEase;
        magnetY =
          initialMagnetY + (playerY - initialMagnetY) * jerkAmount * jerkEase;
      } else {
        // PHASE 2: Gradual reel in from jerked position to player
        const reelProgress = (elapsed - jerkDuration) / reelDuration;
        const reelEase = 1 - Math.pow(1 - reelProgress, 3); // Ease-out

        const jerkEndX = initialMagnetX + (playerX - initialMagnetX) * 0.15;
        const jerkEndY = initialMagnetY + (playerY - initialMagnetY) * 0.15;

        magnetX = jerkEndX + (playerX - jerkEndX) * reelEase;
        magnetY = jerkEndY + (playerY - jerkEndY) * reelEase;
      }

      // Update 3D rope physics
      const avatarPos = getAvatarPosition(playerX, playerY);
      const magnetPos = getMagnetPosition(magnetX, magnetY, "drag", 0); // At surface during reel
      rope3D.update(deltaTime, avatarPos, magnetPos);

      // Render rope
      render3DRope(line, rope3D, waterSurfaceY);

      if (progress >= 1) {
        // Reel complete - clean up rope and graphics
        if (sessionStore) {
          sessionStore.getState().setRope(null);
          sessionStore.getState().setPhase("idle");
          sessionStore.getState().setPhaseProgress(0);
          sessionStore.getState().setCastPosition(null, null);
        }

        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();

        console.log("[REEL-IN] Complete, rope cleaned up");
        resolve();
      } else {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Render rope with water surface effects
 * Exported for use during drag phase
 */
export function renderRope(graphics, rope, waterSurfaceY) {
  // Guard against destroyed or null graphics during async cleanup
  if (!graphics || graphics.destroyed) return;

  graphics.clear();

  const points = rope.getPoints();
  if (points.length < 2) return;

  // Draw single continuous rope - simple and consistent
  graphics.moveTo(Math.round(points[0].x), Math.round(points[0].y));

  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(Math.round(points[i].x), Math.round(points[i].y));
  }

  graphics.stroke({ width: 2, color: 0xffffff, alpha: 1.0 });

  // Draw dots for pixel art look
  for (let i = 0; i < points.length; i += 2) {
    const p = points[i];
    graphics
      .circle(Math.round(p.x), Math.round(p.y), 2)
      .fill({ color: 0xffffff, alpha: 1.0 });
  }
}

/**
 * Create ripple effect at position
 * Shows splash when magnet hits water surface
 */
export function createRipple(app, x, y) {
  if (!app) return;

  const ripple = new PIXI.Graphics()
    .circle(0, 0, 10)
    .stroke({ width: 2, color: 0xffffff });
  ripple.x = x;
  ripple.y = y;
  app.stage.addChild(ripple);

  let scale = 1;
  let alpha = 1;

  const animate = () => {
    if (!app) return;

    scale += 0.15;
    alpha -= 0.08;
    ripple.scale.set(scale);
    ripple.alpha = alpha;

    if (alpha <= 0) {
      app.stage.removeChild(ripple);
      ripple.destroy();
    } else {
      requestAnimationFrame(animate);
    }
  };
  animate();
}

/**
 * Create bubbles rising from position to water surface
 * Used when magnet sinks through water
 */
export function createBubbles(app, x, y, duration = 500) {
  if (!app) return;

  const waterSurfaceY = app.screen.height * 0.3; // Water surface
  const bubbleCount = 8;
  const bubbles = [];

  for (let i = 0; i < bubbleCount; i++) {
    // Stagger bubble creation
    setTimeout(
      () => {
        if (!app) return;

        const bubble = new PIXI.Graphics()
          .circle(0, 0, 2 + Math.random() * 3)
          .fill(0xadd8e6);

        // Random horizontal offset from center
        bubble.x = x + (Math.random() - 0.5) * 30;
        bubble.y = y;
        bubble.alpha = 0.6 + Math.random() * 0.4;

        app.stage.addChild(bubble);
        bubbles.push(bubble);

        // Animate bubble rising to water surface
        const riseSpeed = 1 + Math.random() * 2;
        const drift = (Math.random() - 0.5) * 0.5;
        let bubbleAlpha = bubble.alpha;

        const animate = () => {
          if (!app) {
            if (bubble.parent) {
              bubble.parent.removeChild(bubble);
            }
            bubble.destroy();
            return;
          }

          bubble.y -= riseSpeed;
          bubble.x += drift;
          bubbleAlpha -= 0.015;
          bubble.alpha = bubbleAlpha;

          // Remove when faded or reached water surface
          if (bubbleAlpha <= 0 || bubble.y < waterSurfaceY) {
            if (bubble.parent) {
              bubble.parent.removeChild(bubble);
            }
            bubble.destroy();
          } else {
            requestAnimationFrame(animate);
          }
        };
        animate();
      },
      i * (duration / bubbleCount),
    );
  }
}

/**
 * Start periodic bubble animation during drag
 */
export function startDragBubbles(app, getItemPosition, isStillDragging) {
  // Create bubbles every 800ms while dragging
  const interval = setInterval(() => {
    if (!app || !isStillDragging()) {
      clearInterval(interval);
      return;
    }

    // Calculate current item position
    const itemPos = getItemPosition();
    if (itemPos) {
      // Create a small burst of bubbles (fewer than initial cast)
      createBubbles(app, itemPos.x, itemPos.y, 300);
    }
  }, 800);

  return interval;
}
