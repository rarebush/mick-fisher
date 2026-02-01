const listeners = new Set();

export function emitAudioEvent(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.warn("[AUDIO] Listener error:", error);
    }
  }
}

export function onAudioEvent(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}
