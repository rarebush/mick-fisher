export function initializeWaitPhase(equipment, castPosition) {
  const waitRange = equipment.waitTimeRange;
  const maxWait =
    waitRange.min + Math.random() * (waitRange.max - waitRange.min);
  return {
    isWaiting: true,
    waitTime: 0,
    maxWaitTime: maxWait,
    biteChancePerSecond: equipment.biteChancePerSecond,
    castPosition: { ...castPosition },
    nibbleTimer: 2 + Math.random() * 3,
    nibbleCount: 0,
    biteOccurred: false,
    result: null,
  };
}

export function updateWaitPhase(waitState, deltaTime) {
  if (!waitState?.isWaiting) return { waitState, events: {} };
  const next = { ...waitState };
  next.waitTime += deltaTime;
  const events = {};

  if (next.waitTime >= next.maxWaitTime) {
    next.isWaiting = false;
    next.result = "timeout";
    events.timeout = true;
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
      next.isWaiting = false;
      next.biteOccurred = true;
      next.result = "bite";
      events.bite = true;
    }
  }

  return { waitState: next, events };
}
