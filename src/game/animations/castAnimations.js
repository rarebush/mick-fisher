/**
 * Cast Animations
 * Visual feedback animations for casting phase
 */

import * as PIXI from "pixi.js";
import { VerletRope } from "../physics/VerletRope.js";

/**
 * Animate casting line from shore to target position with rope physics
 * Returns the rope and graphics object to keep visible during drag
 */
export function animateCastLine(app, targetX, targetY, gameStore) {
  return new Promise((resolve) => {
    if (!app) {
      resolve({ rope: null, line: null });
      return;
    }

    // Starting point - center of top edge (shore)
    const startX = app.screen.width / 2;
    const startY = 40; // Middle of shore area

    // Create Verlet rope (starts at player position)
    // 30 segments of 10px each = twice as dense as 15 segments of 20px
    const rope = new VerletRope(startX, startY, 30, 10);

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    app.stage.addChild(line);

    // Animation parameters
    const throwDuration = 600; // milliseconds for throw arc
    const sinkDuration = 800; // milliseconds for rope to settle underwater
    const startTime = performance.now();

    // Calculate throw arc parameters
    const distance = Math.sqrt(
      (targetX - startX) ** 2 + (targetY - startY) ** 2,
    );
    const throwAngle = Math.atan2(targetY - startY, targetX - startX);
    const throwSpeed = distance / (throwDuration / 1000); // pixels per second

    // Initial velocity for magnet
    const vx = (Math.cos(throwAngle) * throwSpeed) / 60; // per frame at 60fps
    const vy = (Math.sin(throwAngle) * throwSpeed) / 60;

    let phase = "throwing"; // 'throwing' -> 'sinking' -> 'done'
    let sinkStartTime = 0;

    // Tension animation: 40 (throw) -> 20 (extending) -> 10 (settled)
    let currentTension = 40;

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
        resolve({ rope: null, line: null });
        return;
      }

      const elapsed = currentTime - startTime;

      if (phase === "throwing") {
        const progress = Math.min(elapsed / throwDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease-out

        // Animate tension: 40 -> 20 as rope extends
        currentTension = 40 - 20 * progress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Calculate magnet position along parabolic arc
        const magnetX = startX + (targetX - startX) * eased;
        const magnetY =
          startY +
          (targetY - startY) * eased -
          Math.sin(progress * Math.PI) * 50; // Arc height

        // Adjust rope slack based on current tension
        rope.adjustLengthToDistance(
          startX,
          startY,
          magnetX,
          magnetY,
          currentTension,
        );

        // Update rope physics
        rope.setMagnetPosition(magnetX, magnetY);
        rope.setPlayerPosition(startX, startY);
        rope.update(currentTension);

        // Render rope
        renderRope(line, rope, 80); // 80 = water surface Y

        if (progress >= 1) {
          // Magnet reached target, keep it pinned there (don't release)
          phase = "sinking";
          sinkStartTime = currentTime;
          rope.setMagnetPosition(targetX, targetY); // Pin at target
          rope.setDamping(0.95); // More damping in water
        }
      } else if (phase === "sinking") {
        const sinkElapsed = currentTime - sinkStartTime;
        const sinkProgress = Math.min(sinkElapsed / sinkDuration, 1);

        // Animate tension: 20 -> 10 as rope settles with overshoot
        currentTension = 20 - 10 * sinkProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Keep magnet pinned at target, keep player pinned
        rope.setMagnetPosition(targetX, targetY);
        rope.setPlayerPosition(startX, startY);

        // Adjust rope slack based on current tension
        rope.adjustLengthToDistance(
          startX,
          startY,
          targetX,
          targetY,
          currentTension,
        );

        // Continue physics simulation as rope settles underwater
        rope.update(currentTension);

        // Render rope with underwater opacity
        renderRope(line, rope, 80);

        if (sinkProgress >= 1) {
          // Done - return rope and line to keep visible during drag
          // Tension ends at ~10, which will be used to initialize drag
          resolve({
            rope,
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
 * Animate rope reeling in after drag failure
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
) {
  return new Promise((resolve) => {
    if (!app || !rope || !line) {
      resolve();
      return;
    }

    const reelDuration = 400; // milliseconds
    const startTime = performance.now();

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
      const progress = Math.min(elapsed / reelDuration, 1);
      const eased = progress * progress; // Ease-in for snappy reel

      // Move magnet back to player
      const magnetX = startX + (playerX - startX) * eased;
      const magnetY = startY + (playerY - startY) * eased;

      rope.setMagnetPosition(magnetX, magnetY);
      rope.setPlayerPosition(playerX, playerY);
      rope.update(0); // No tension during reel-in (slack rope)

      renderRope(line, rope, 80);

      if (progress >= 1) {
        // Reel complete - clean up
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
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
 * Create bubbles rising from position
 */
export function createBubbles(app, x, y, duration = 500) {
  if (!app) return;

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

        // Animate bubble rising
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

          // Remove when faded or reached surface (y < 80)
          if (bubbleAlpha <= 0 || bubble.y < 80) {
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
