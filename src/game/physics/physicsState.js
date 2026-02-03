export function createInitialPhysicsState() {
  return {
    active: false,
    mode: "idle",
    targetType: null,
    target: null,
    equipment: null,
    tension: 0,
    lastTension: 0,
    heat: 0,
    lineLength: 0,
    distanceToShore: 0,
    forces: {
      pull: { x: 0, y: 0 },
      waterDrag: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
      friction: { x: 0, y: 0 },
      additional: { x: 0, y: 0 },
      net: { x: 0, y: 0 },
    },
    slip: {
      accumulation: 0,
      limit: 0,
      percent: 0,
    },
    lineStress: {
      value: 0,
      percent: 0,
    },
    fishStatus: {
      energy: 0,
      panic: 0,
      state: null,
    },
    waitState: null,
    events: {},
    environment: {
      current: { strength: 0, direction: { x: 1, y: 0 } },
    },
  };
}
