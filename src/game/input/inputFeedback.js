import * as PIXI from "pixi.js";

/**
 * Show "Need longer line!" message at position
 */
export function showAccessMessageAtPosition(app, x, y) {
  if (!app) return;

  const text = new PIXI.Text({
    text: "Need longer line!",
    style: { fontSize: 24, fill: 0xffaa00 },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  app.stage.addChild(text);

  let alpha = 1.0;
  const fadeOut = () => {
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
