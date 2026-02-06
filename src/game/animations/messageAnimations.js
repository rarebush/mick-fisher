/**
 * Message Animations
 * Floating text messages for player feedback
 */

import * as PIXI from "pixi.js";

/**
 * Show "Nothing here..." message
 */
export function showNothingMessage(app, x, y) {
  if (!app) return;

  const text = new PIXI.Text({
    text: "Nothing here...",
    style: { fontSize: 24, fill: 0xffffff, alpha: 0.8 },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  app.stage.addChild(text);

  // Fade out
  let alpha = 0.8;
  const fadeOut = () => {
    if (!app) return;
    alpha -= 0.02;
    text.alpha = alpha;
    if (alpha <= 0) {
      app.stage.removeChild(text);
      text.destroy();
    } else {
      requestAnimationFrame(fadeOut);
    }
  };
  setTimeout(fadeOut, 1000);
}

