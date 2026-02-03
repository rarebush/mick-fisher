import { getAvatarWorldPosition } from "../mechanics/worldConstants.js";
import {
  HEAT_CONSTANTS,
  SLIP_CONSTANTS,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
import {
  clamp,
  dotProduct,
  magnitude,
  normalize,
  subtract,
} from "./vectorUtils.js";

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

export function updateTensionValue(
  currentTension,
  deltaTime,
  isHolding,
  target,
  equipment,
  avatarPosition
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
    subtract(getAvatarWorldPosition(), fish.position)
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
