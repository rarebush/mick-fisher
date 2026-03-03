import { STRIKE_CONSTANTS } from "./physicsConstants.js";

const BOB_SPRING_FREQUENCY = 8.0; // Radians/sec
const BOB_SPRING_DAMPING = 0.85; // 0-1, higher = faster settle

export function initializeWaitPhase(
  equipment,
  castPosition,
  initialBobVelocity = 0,
) {
  return {
    isWaiting: true,
    mode: "waiting",
    waitTime: 0,
    maxWaitTime: null,
    biteChancePerSecond: equipment.biteChancePerSecond,
    castPosition: { ...castPosition },
    nibbleTimer: 2 + Math.random() * 3,
    nibbleCount: 0,
    biteOccurred: false,
    result: null,
    bobOffset: 0,
    bobVelocity: initialBobVelocity,
    strikeTimeRemaining: 0,
    strikeWindowSeconds: STRIKE_CONSTANTS.WINDOW_SECONDS,
  };
}

export function updateWaitPhase(waitState, deltaTime, strikeQueued = false) {
  if (!waitState?.isWaiting) return { waitState, events: {} };
  const next = { ...waitState };
  next.waitTime += deltaTime;
  const events = {};

  if (Number.isFinite(next.bobOffset) && Number.isFinite(next.bobVelocity)) {
    const w = BOB_SPRING_FREQUENCY;
    const damping = BOB_SPRING_DAMPING;
    const accel = -2 * damping * w * next.bobVelocity - w * w * next.bobOffset;
    next.bobVelocity += accel * deltaTime;
    next.bobOffset += next.bobVelocity * deltaTime;
  }

  // Strike window timing per Game Mechanics - Casting System.md.
  if (next.mode === "strike") {
    next.strikeTimeRemaining -= deltaTime;
    if (strikeQueued) {
      next.isWaiting = false;
      next.result = "strike";
      events.strike = true;
      return { waitState: next, events };
    }
    if (next.strikeTimeRemaining <= 0) {
      next.isWaiting = false;
      next.result = "strike-missed";
      events.strikeMissed = true;
      return { waitState: next, events };
    }
    return { waitState: next, events };
  }

  next.nibbleTimer -= deltaTime;
  if (next.nibbleTimer <= 0 && next.nibbleCount < 3) {
    next.nibbleCount += 1;
    next.nibbleTimer = 1 + Math.random() * 2;
    events.nibble = true;
  }

  if (next.nibbleCount > 0) {
    if (Math.random() < next.biteChancePerSecond * deltaTime) {
      next.biteOccurred = true;
      next.mode = "strike";
      next.result = "bite";
      next.strikeTimeRemaining = STRIKE_CONSTANTS.WINDOW_SECONDS;
      events.bite = true;
      events.strikeStart = true;
    }
  }

  return { waitState: next, events };
}
