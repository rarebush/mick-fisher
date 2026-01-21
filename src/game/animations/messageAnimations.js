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

/**
 * Show "Need longer line!" message
 */
export function showAccessMessage(app, x, y) {
  if (!app) return;

  const text = new PIXI.Text({
    text: "Need longer line!",
    style: { fontSize: 20, fill: 0xff0000 },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  app.stage.addChild(text);

  setTimeout(() => {
    if (!app) return;
    app.stage.removeChild(text);
    text.destroy();
  }, 1500);
}

/**
 * Show success message (currently unused, kept for future use)
 */
export function showSuccessMessage(app, itemName) {
  if (!app) return;

  const text = new PIXI.Text({
    text: `Caught: ${itemName}!`,
    style: { fontSize: 28, fill: 0x4caf50, fontWeight: "bold" },
  });
  text.anchor.set(0.5);
  text.x = app.screen.width / 2;
  text.y = app.screen.height / 2 - 50;
  app.stage.addChild(text);

  // Fade out
  let alpha = 1;
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
  setTimeout(fadeOut, 1500);
}

/**
 * Show failure message
 */
export function showFailureMessage(app, reason) {
  if (!app) return;

  const messages = {
    "tension-overload": "Line snapped! Too much tension!",
    "slip-failure": "It slipped off!",
  };

  const text = new PIXI.Text({
    text: messages[reason] || "Lost the item!",
    style: { fontSize: 24, fill: 0xf44336, fontWeight: "bold" },
  });
  text.anchor.set(0.5);
  text.x = app.screen.width / 2;
  text.y = app.screen.height / 2 - 50;
  app.stage.addChild(text);

  // Fade out
  let alpha = 1;
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
  setTimeout(fadeOut, 1500);
}
