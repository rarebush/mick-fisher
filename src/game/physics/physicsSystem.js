import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import { getFishSpecies } from "../data/fishDatabase.js";

export const PHYSICS_CONSTANTS = {
  WATER_DENSITY: 1.0,
  BASELINE_WATER_RESISTANCE: 2.0,
  TURBULENCE_FACTOR: 0.05,
  LINE_DRAG_PER_METER: 0.02,
  REEL_EFFICIENCY_FALLOFF: 0.1,
  STATIC_FRICTION_COEFFICIENT: 0.8,
  KINETIC_FRICTION_COEFFICIENT: 0.2,
  ROPE_SYSTEM_INERTIA: 50,
  TENSION_DECAY_BASE: 30,
  REACHED_SHORE_DISTANCE: 0.35,
};

export const HEAT_CONSTANTS = {
  BUILD_RATE: 25,
  DECAY_RATE: 15,
  REDLINE_THRESHOLD: 75,
  FAILURE_THRESHOLD: 100,
};

export const TENSION_ZONES = {
  LOW_MAX: 40,
  WORKING_MAX: 75,
  REDLINE_MAX: 100,
};

export const SLIP_CONSTANTS = {
  MASTER_MULTIPLIER: 0.1,
  SURFACE_MULTIPLIERS: {
    clean: 1.0,
    rusty: 1.5,
    sludge: 2.5,
  },
  ATTACHMENT_MULTIPLIERS: {
    center: 1.2,
    edge: 1.0,
    corner: 0.7,
  },
};

export const TEMPERAMENT_MODIFIERS = {
  calm: {
    panicBuildRate: 0.7,
    panicDecayRate: 1.3,
    energyDrainRate: 0.8,
    directionChangeMod: 1.5,
    strengthWhenCalm: 0.3,
    strengthWhenPanicked: 0.9,
  },
  skittish: {
    panicBuildRate: 1.5,
    panicDecayRate: 0.8,
    energyDrainRate: 1.2,
    directionChangeMod: 0.6,
    strengthWhenCalm: 0.5,
    strengthWhenPanicked: 1.0,
  },
  aggressive: {
    panicBuildRate: 1.0,
    panicDecayRate: 0.5,
    energyDrainRate: 1.0,
    directionChangeMod: 0.8,
    strengthWhenCalm: 0.7,
    strengthWhenPanicked: 1.2,
  },
};

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

export function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v) {
  const mag = magnitude(v);
  if (mag < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rollAttachmentPoint() {
  const roll = Math.random();
  if (roll < 0.3) return "center";
  if (roll < 0.7) return "edge";
  return "corner";
}

function calculateSlipLimit(baseLimit, attachmentPoint) {
  return Math.floor(
    baseLimit * SLIP_CONSTANTS.ATTACHMENT_MULTIPLIERS[attachmentPoint],
  );
}

function deriveMetallicProfile(item) {
  const weight = item?.weight ?? 5;
  const dragFactor = clamp(
    item?.dragFactor ?? 0.2 + (weight / 60) * 1.4,
    0.2,
    2.4,
  );
  const magneticStrength = clamp(
    item?.magneticStrength ?? 1.2 - (item?.slipRate ?? 1) * 0.35,
    0.2,
    1.3,
  );
  const baseSlipLimit = clamp(
    item?.baseSlipLimit ?? Math.round(120 - weight * 0.8),
    30,
    140,
  );
  return { dragFactor, magneticStrength, baseSlipLimit };
}

export function createMetallicTargetFromItem(item, position) {
  const profile = deriveMetallicProfile(item);
  const attachmentPoint = rollAttachmentPoint();
  const slipLimit = calculateSlipLimit(profile.baseSlipLimit, attachmentPoint);
  return {
    id: item?.id ?? `item_${Date.now()}`,
    type: item?.id ?? "unknown",
    category: item?.category ?? "common-junk",
    mass: item?.weight ?? 5,
    dragFactor: profile.dragFactor,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    isMoving: false,
    magneticStrength: profile.magneticStrength,
    surfaceCondition: item?.surfaceCondition ?? "rusty",
    attachmentPoint,
    slipAccumulation: 0,
    slipLimit,
    attached: true,
    dropCount: 0,
    quality: 100,
  };
}

export function createFishTarget(species, size, hookPosition) {
  const template = getFishSpecies(species);
  if (!template) return null;
  const sizeData = template.sizes[size];
  const temperament = TEMPERAMENT_MODIFIERS[template.temperament];
  return {
    id: `fish_${Date.now()}`,
    species,
    size,
    category: template.category,
    mass: template.mass * sizeData.massMultiplier,
    dragFactor: template.dragFactor,
    position: { x: hookPosition.x, y: hookPosition.y },
    velocity: { x: 0, y: 0 },
    isMoving: true,
    baseStrength: template.baseStrength * sizeData.strengthMultiplier,
    maxEnergy: template.maxEnergy,
    temperament: template.temperament,
    panicThreshold: template.panicThreshold,
    state: "hooked",
    energy: template.maxEnergy,
    panicLevel: 0,
    targetDirection: { x: 0, y: 1 },
    directionChangeTimer:
      template.directionChangeFrequency * temperament.directionChangeMod,
    directionChangeFrequency:
      template.directionChangeFrequency * temperament.directionChangeMod,
    currentForce: { x: 0, y: 0 },
    lineStress: 0,
    baseValue: template.baseValue * sizeData.valueMultiplier,
    attached: true,
  };
}

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

export function getEngineTorque(tension, equipment) {
  const normalizedTension = tension / 100;
  let torqueMultiplier;
  if (normalizedTension < 0.4) {
    torqueMultiplier = Math.pow(normalizedTension / 0.4, 2) * 0.1;
  } else if (normalizedTension < 0.75) {
    const zoneProgress = (normalizedTension - 0.4) / 0.35;
    torqueMultiplier = 0.1 + zoneProgress * 0.5;
  } else {
    const zoneProgress = (normalizedTension - 0.75) / 0.25;
    torqueMultiplier = 0.6 + zoneProgress * 0.4;
  }
  return (equipment?.maxPullForce ?? 0) * torqueMultiplier;
}

export function calculateLoadResistance(target, avatarPosition) {
  const pullDirection = normalize(subtract(avatarPosition, target.position));
  const speed = magnitude(target.velocity);
  let alignment = 0;
  if (speed > 0.01) {
    alignment = dotProduct(normalize(target.velocity), pullDirection);
  }
  const speedFactor = Math.max(0.3, 1 - speed * 0.3);
  const alignmentFactor = 1 - alignment * 0.5;
  return target.mass * speedFactor * alignmentFactor * 0.5;
}

export function updateTensionValue(
  currentTension,
  deltaTime,
  isHolding,
  target,
  equipment,
  avatarPosition,
) {
  let tension = currentTension;
  const speed = magnitude(target.velocity);
  if (isHolding) {
    const BASE_CLIMB_RATE = 40;
    const loadFactor = calculateLoadFactor(target, avatarPosition);
    const climbRate = BASE_CLIMB_RATE * (1 - loadFactor * 0.8);
    const effectiveClimbRate = Math.max(climbRate, 5);
    tension += effectiveClimbRate * deltaTime;
  } else {
    const BASE_DECAY_RATE = 30;
    const pullbackEffect = Math.min(speed * 3, 15);
    const decayRate = BASE_DECAY_RATE - pullbackEffect;
    tension -= decayRate * deltaTime;
  }
  return clamp(tension, 0, 100);
}

function calculateLoadFactor(target, avatarPosition) {
  const speed = magnitude(target.velocity);
  const speedFactor = 1 / (1 + speed * 0.5);
  const massFactor = Math.min(target.mass / 50, 1);
  const pullDirection = normalize(subtract(avatarPosition, target.position));
  let alignment = 1;
  if (speed > 0.01) {
    alignment = dotProduct(normalize(target.velocity), pullDirection);
  }
  const alignmentPenalty = clamp(1 - alignment * 0.5, 0.5, 1.5);
  return clamp(speedFactor * (0.5 + massFactor * 0.5) * alignmentPenalty, 0, 1);
}

export function getPullForce(tension, equipment, target, avatarPosition) {
  const speed = magnitude(target.velocity);
  const basePull = getEngineTorque(tension, equipment);
  const efficiency =
    1 / (1 + speed * PHYSICS_CONSTANTS.REEL_EFFICIENCY_FALLOFF);
  const pullMagnitude = basePull * efficiency;
  const direction = normalize(subtract(avatarPosition, target.position));
  return {
    x: direction.x * pullMagnitude,
    y: direction.y * pullMagnitude,
  };
}

export function getWaterDrag(target, velocity, lineLength) {
  const speed = magnitude(velocity);
  if (speed < 0.001) return { x: 0, y: 0 };
  const direction = { x: -velocity.x / speed, y: -velocity.y / speed };
  const itemDrag =
    target.dragFactor * PHYSICS_CONSTANTS.WATER_DENSITY * speed * speed;
  const baselineDrag = PHYSICS_CONSTANTS.BASELINE_WATER_RESISTANCE * speed;
  const turbulenceDrag =
    PHYSICS_CONSTANTS.TURBULENCE_FACTOR * speed * speed * speed;
  const lineDrag = PHYSICS_CONSTANTS.LINE_DRAG_PER_METER * lineLength * speed;
  const totalDrag = itemDrag + baselineDrag + turbulenceDrag + lineDrag;
  return {
    x: direction.x * totalDrag,
    y: direction.y * totalDrag,
  };
}

export function getCurrentForce(target, currentEnvironment) {
  if (!currentEnvironment || currentEnvironment.strength === 0) {
    return { x: 0, y: 0 };
  }
  const effectiveStrength = currentEnvironment.strength * target.dragFactor;
  const dir = normalize(currentEnvironment.direction);
  return {
    x: dir.x * effectiveStrength,
    y: dir.y * effectiveStrength,
  };
}

export function getFriction(target, velocity, isMoving) {
  const speed = magnitude(velocity);
  if (!isMoving) {
    return {
      type: "static",
      threshold: target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT,
    };
  }
  if (speed < 0.01) return { x: 0, y: 0 };
  const frictionMagnitude =
    target.mass * PHYSICS_CONSTANTS.KINETIC_FRICTION_COEFFICIENT;
  return {
    x: (-velocity.x / speed) * frictionMagnitude,
    y: (-velocity.y / speed) * frictionMagnitude,
  };
}

export function updateSlip(item, tension, equipment, lastTension) {
  let slipAccumulation = item.slipAccumulation || 0;
  if (tension > lastTension) {
    const tensionIncrease = tension - lastTension;
    const tensionPenalty = 1 - (tension / 100) * 0.5;
    const surfaceMultiplier =
      SLIP_CONSTANTS.SURFACE_MULTIPLIERS[item.surfaceCondition] || 1;
    const resistanceBonus = equipment?.slipResistance || 1.0;
    const slipGain =
      (tensionIncrease *
        tensionPenalty *
        surfaceMultiplier *
        SLIP_CONSTANTS.MASTER_MULTIPLIER) /
      resistanceBonus;
    slipAccumulation += slipGain;
  }
  const slipLimit = item.slipLimit || 1;
  const detached = slipAccumulation >= slipLimit;
  return {
    slipAccumulation,
    slipLimit,
    detached,
    slipPercent: clamp(slipAccumulation / slipLimit, 0, 1),
  };
}

export function updateLineStress(fish, tension, equipment, deltaTime) {
  const pullForce = (tension / 100) * (equipment?.maxPullForce ?? 0);
  const fishForce = magnitude(fish.currentForce || { x: 0, y: 0 });
  const pullDirection = normalize(
    subtract(getAvatarWorldPosition(), fish.position),
  );
  const fishDirection = normalize(fish.currentForce || { x: 0, y: 0 });
  const opposition = -dotProduct(pullDirection, fishDirection);
  let lineStress = fish.lineStress || 0;
  if (opposition > 0) {
    const combinedForce = pullForce + fishForce * opposition;
    const stressGain =
      (combinedForce / (equipment?.lineStrength ?? 1)) * 10 * deltaTime;
    lineStress += stressGain;
  } else {
    lineStress -= 5 * deltaTime;
  }
  lineStress = Math.max(0, lineStress);
  const lineSnapped = lineStress >= 100;
  return {
    lineStress,
    lineSnapped,
    stressPercent: clamp(lineStress / 100, 0, 1),
  };
}

export function updateHeat(deltaTime, tension, heat) {
  let nextHeat = heat;
  if (tension >= HEAT_CONSTANTS.REDLINE_THRESHOLD) {
    const redlineDepth =
      (tension - HEAT_CONSTANTS.REDLINE_THRESHOLD) /
      (100 - HEAT_CONSTANTS.REDLINE_THRESHOLD);
    nextHeat += HEAT_CONSTANTS.BUILD_RATE * redlineDepth * deltaTime;
  } else {
    nextHeat -= HEAT_CONSTANTS.DECAY_RATE * deltaTime;
  }
  nextHeat = clamp(nextHeat, 0, HEAT_CONSTANTS.FAILURE_THRESHOLD);
  return {
    heat: nextHeat,
    overheated: nextHeat >= HEAT_CONSTANTS.FAILURE_THRESHOLD,
    heatPercent: nextHeat / HEAT_CONSTANTS.FAILURE_THRESHOLD,
  };
}

export function updateFishAI(fish, tension, deltaTime) {
  const temperament = TEMPERAMENT_MODIFIERS[fish.temperament];
  if (fish.state === "tired") {
    fish.currentForce = { x: 0, y: 0 };
    return;
  }
  if (tension > fish.panicThreshold) {
    const panicIncrease =
      (tension - fish.panicThreshold) * temperament.panicBuildRate * deltaTime;
    fish.panicLevel += panicIncrease;
  } else {
    const panicDecrease = temperament.panicDecayRate * 20 * deltaTime;
    fish.panicLevel -= panicDecrease;
  }
  fish.panicLevel = clamp(fish.panicLevel, 0, 100);

  if (fish.panicLevel > 50 && fish.state === "hooked") {
    fish.state = "fighting";
  } else if (fish.panicLevel < 20 && fish.state === "fighting") {
    fish.state = "hooked";
  }

  fish.directionChangeTimer -= deltaTime;
  if (fish.directionChangeTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    fish.targetDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    const panicFrequencyMod = 1 - (fish.panicLevel / 100) * 0.7;
    fish.directionChangeTimer =
      fish.directionChangeFrequency * panicFrequencyMod + Math.random() * 0.5;
  }

  const energyFactor = fish.energy / fish.maxEnergy;
  const panicFactor = fish.panicLevel / 100;
  const strengthWhenCalm = temperament.strengthWhenCalm;
  const strengthWhenPanicked = temperament.strengthWhenPanicked;
  const strengthFactor =
    strengthWhenCalm + (strengthWhenPanicked - strengthWhenCalm) * panicFactor;
  const forceMagnitude = fish.baseStrength * energyFactor * strengthFactor;

  fish.currentForce = {
    x: fish.targetDirection.x * forceMagnitude,
    y: fish.targetDirection.y * forceMagnitude,
  };

  if (fish.state === "fighting") {
    fish.energy -= temperament.energyDrainRate * 5 * deltaTime;
  }

  if (fish.energy <= 0) {
    fish.energy = 0;
    fish.state = "tired";
    fish.currentForce = { x: 0, y: 0 };
  }
}

function clampTargetToWorld(target) {
  target.position.x = clamp(target.position.x, WORLD_X.MIN, WORLD_X.MAX);
  target.position.y = clamp(
    target.position.y,
    WORLD_Y.WATER_NEAR,
    WORLD_Y.WATER_FAR,
  );
}

export function updateDragPhysics(deltaTime, isHolding, physicsState) {
  const state = { ...physicsState };
  const events = {};
  if (!state.target || !state.equipment) {
    return { state, events };
  }

  const avatarWorld = getAvatarWorldPosition();
  const avatar2D = { x: avatarWorld.x, y: avatarWorld.y };
  const shoreAnchor = { x: 0, y: WORLD_Y.WALKWAY_FRONT };

  state.tension = updateTensionValue(
    state.tension,
    deltaTime,
    isHolding,
    state.target,
    state.equipment,
    avatar2D,
  );

  const lineLength = magnitude(subtract(avatar2D, state.target.position));
  state.lineLength = lineLength;
  state.distanceToShore = magnitude(
    subtract(shoreAnchor, state.target.position),
  );

  if (!state.target.isMoving && state.targetType === "metallic") {
    const staticFriction =
      state.target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT;
    const pullForce = getPullForce(
      state.tension,
      state.equipment,
      state.target,
      avatar2D,
    );
    const pullMagnitude = magnitude(pullForce);
    if (pullMagnitude > staticFriction) {
      state.target.isMoving = true;
    } else {
      state.forces.pull = pullForce;
      state.forces.net = pullForce;
      state.lastTension = state.tension;
      return { state, events };
    }
  }

  if (state.targetType === "fish") {
    updateFishAI(state.target, state.tension, deltaTime);
  }

  const pullForce = getPullForce(
    state.tension,
    state.equipment,
    state.target,
    avatar2D,
  );
  const waterDrag = getWaterDrag(
    state.target,
    state.target.velocity,
    lineLength,
  );
  const currentForce = getCurrentForce(
    state.target,
    state.environment?.current,
  );
  const friction = getFriction(
    state.target,
    state.target.velocity,
    state.target.isMoving,
  );
  const additionalForce =
    state.targetType === "fish" && state.target.currentForce
      ? state.target.currentForce
      : { x: 0, y: 0 };

  const netForce = {
    x:
      pullForce.x +
      waterDrag.x +
      currentForce.x +
      (friction.x || 0) +
      additionalForce.x,
    y:
      pullForce.y +
      waterDrag.y +
      currentForce.y +
      (friction.y || 0) +
      additionalForce.y,
  };

  const acceleration = {
    x: netForce.x / state.target.mass,
    y: netForce.y / state.target.mass,
  };

  state.target.velocity.x += acceleration.x * deltaTime;
  state.target.velocity.y += acceleration.y * deltaTime;
  state.target.position.x += state.target.velocity.x * deltaTime;
  state.target.position.y += state.target.velocity.y * deltaTime;

  clampTargetToWorld(state.target);

  state.forces = {
    pull: pullForce,
    waterDrag,
    current: currentForce,
    friction: friction.type ? { x: 0, y: 0 } : friction,
    additional: additionalForce,
    net: netForce,
  };

  const heatResult = updateHeat(deltaTime, state.tension, state.heat);
  state.heat = heatResult.heat;
  if (heatResult.overheated) {
    events.overheated = true;
  }

  if (state.targetType === "metallic") {
    const slip = updateSlip(
      state.target,
      state.tension,
      state.equipment,
      state.lastTension,
    );
    state.target.slipAccumulation = slip.slipAccumulation;
    state.slip = {
      accumulation: slip.slipAccumulation,
      limit: slip.slipLimit,
      percent: slip.slipPercent,
    };
    if (slip.detached) {
      events.detached = true;
    }
  } else if (state.targetType === "fish") {
    const stress = updateLineStress(
      state.target,
      state.tension,
      state.equipment,
      deltaTime,
    );
    state.target.lineStress = stress.lineStress;
    state.lineStress = {
      value: stress.lineStress,
      percent: stress.stressPercent,
    };
    if (stress.lineSnapped) {
      events.lineSnapped = true;
    }
  }

  state.fishStatus = {
    energy: state.targetType === "fish" ? state.target.energy : 0,
    panic: state.targetType === "fish" ? state.target.panicLevel : 0,
    state: state.targetType === "fish" ? state.target.state : null,
  };

  const newLineLength = magnitude(subtract(avatar2D, state.target.position));
  state.lineLength = newLineLength;
  const newDistanceToShore = magnitude(
    subtract(shoreAnchor, state.target.position),
  );
  state.distanceToShore = newDistanceToShore;
  if (newDistanceToShore <= PHYSICS_CONSTANTS.REACHED_SHORE_DISTANCE) {
    events.reachedShore = true;
  }

  state.lastTension = state.tension;
  return { state, events };
}

export function clampMagnetWorldZ(target) {
  if (!target) return WORLD_Z.RIVERBED;
  return clamp(
    target.position.z ?? WORLD_Z.RIVERBED,
    WORLD_Z.RIVERBED,
    WORLD_Z.WATER_SURFACE,
  );
}
