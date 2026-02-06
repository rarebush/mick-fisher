export function cleanupDisplayObject(displayObject) {
  if (!displayObject) return;
  if (displayObject.parent) {
    displayObject.parent.removeChild(displayObject);
  }
  if (typeof displayObject.destroy === "function" && !displayObject.destroyed) {
    displayObject.destroy();
  }
}

export function cleanupDisplayObjects(...displayObjects) {
  displayObjects.forEach((displayObject) => {
    cleanupDisplayObject(displayObject);
  });
}
