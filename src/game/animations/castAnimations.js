/**
 * Cast Animations
 * Visual feedback animations for casting phase
 */

import * as PIXI from "pixi.js";

/**
 * Animate casting line from shore to target position
 */
export function animateCastLine(app, targetX, targetY) {
  return new Promise((resolve) => {
    if (!app) {
      resolve();
      return;
    }

    // Starting point - center of top edge (shore)
    const startX = app.screen.width / 2;
    const startY = 40; // Middle of shore area

    // Calculate arc control point (creates downward curve)
    const midX = (startX + targetX) / 2;
    const midY = (startY + targetY) / 2 - 50; // Raised up to create arc

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    app.stage.addChild(line);

    // Animation parameters
    const duration = 400; // milliseconds
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
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out for more natural cast)
      const eased = 1 - Math.pow(1 - progress, 3);

      // Draw the curved line up to current progress
      line.clear();

      // Draw dotted/dashed line along the arc
      const segments = 20;
      const drawSegments = Math.floor(segments * eased);

      for (let i = 0; i <= drawSegments; i++) {
        const t = i / segments;

        // Quadratic bezier curve calculation
        const x =
          Math.pow(1 - t, 2) * startX +
          2 * (1 - t) * t * midX +
          Math.pow(t, 2) * targetX;
        const y =
          Math.pow(1 - t, 2) * startY +
          2 * (1 - t) * t * midY +
          Math.pow(t, 2) * targetY;

        // Draw small circles to create dotted line effect
        if (i % 2 === 0) {
          line.circle(x, y, 2).fill(0xffffff);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Line animation complete, fade it out
        let alpha = 1;
        const fadeOut = () => {
          if (!app) {
            if (line.parent) {
              line.parent.removeChild(line);
            }
            line.destroy();
            resolve();
            return;
          }

          alpha -= 0.1;
          line.alpha = alpha;

          if (alpha <= 0) {
            app.stage.removeChild(line);
            line.destroy();
            resolve();
          } else {
            requestAnimationFrame(fadeOut);
          }
        };
        fadeOut();
      }
    };

    requestAnimationFrame(animate);
  });
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
