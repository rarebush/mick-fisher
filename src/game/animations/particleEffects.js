import * as PIXI from "pixi.js";
import {
  WORLD_Z,
  createViewport,
  worldToScreen,
} from "../mechanics/worldConstants.js";

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
 * Create bubbles popping on the water surface above a world position
 * Used when magnet sinks through water
 */
export function createBubbles(app, worldX, worldY, duration = 500) {
  if (!app) return;

  const viewport = createViewport(app.screen.width, app.screen.height);
  const surfaceScreen = worldToScreen(
    { x: worldX, y: worldY, z: WORLD_Z.WATER_SURFACE },
    viewport
  );
  const bubbleCount = 6;

  for (let i = 0; i < bubbleCount; i += 1) {
    setTimeout(() => {
      if (!app) return;

      const baseRadius = 2 + Math.random() * 2;
      const bubble = new PIXI.Graphics();
      bubble
        .circle(0, 0, baseRadius)
        .stroke({ width: 2, color: 0xcdf5ff, alpha: 0.9 });

      bubble.x = surfaceScreen.x + (Math.random() - 0.5) * 24;
      bubble.y = surfaceScreen.y + (Math.random() - 0.5) * 6;
      bubble.alpha = 0.6 + Math.random() * 0.3;

      app.stage.addChild(bubble);

      let bubbleAlpha = bubble.alpha;
      let scale = 1;
      const scaleSpeed = 0.06 + Math.random() * 0.05;

      const animate = () => {
        if (!app) {
          if (bubble.parent) {
            bubble.parent.removeChild(bubble);
          }
          bubble.destroy();
          return;
        }

        scale += scaleSpeed;
        bubble.scale.set(scale);
        bubbleAlpha -= 0.04;
        bubble.alpha = bubbleAlpha;

        if (bubbleAlpha <= 0) {
          if (bubble.parent) {
            bubble.parent.removeChild(bubble);
          }
          bubble.destroy();
        } else {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, i * (duration / bubbleCount));
  }
}

/**
 * Start periodic bubble animation during drag
 */
export function startDragBubbles(app, getItemWorldPosition, isStillDragging) {
  const interval = setInterval(() => {
    if (!app || !isStillDragging()) {
      clearInterval(interval);
      return;
    }

    const itemPos = getItemWorldPosition();
    if (itemPos) {
      createBubbles(app, itemPos.x, itemPos.y, 300);
    }
  }, 800);

  return interval;
}
