import {
  FISH_FIGHT_CONSTANTS,
  SLIP_CONSTANTS,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
import { clamp } from "./vectorUtils.js";

export function updateSlip(item, tension, equipment, deltaTime) {
  let slipAccumulation = item.slipAccumulation || 0;
  const surfaceMultiplier =
    SLIP_CONSTANTS.SURFACE_MULTIPLIERS[item.surfaceCondition] || 1;
  const resistanceBonus = equipment?.slipResistance || 1.0;
  const tensionFactor = clamp(tension / 100, 0, 1);
  const slipRate =
    SLIP_CONSTANTS.MASTER_MULTIPLIER *
    surfaceMultiplier *
    (0.25 + tensionFactor);
  slipAccumulation += (slipRate * deltaTime * 100) / resistanceBonus;
  const slipLimit = item.slipLimit || 1;
  const detached = slipAccumulation >= slipLimit;
  return {
    slipAccumulation,
    slipLimit,
    detached,
    slipPercent: clamp(slipAccumulation / slipLimit, 0, 1),
  };
}

export function updateFishAI(fish, tension, deltaTime, avatarPosition) {
  const nextFish = { ...fish };
  const temperament = TEMPERAMENT_MODIFIERS[fish.temperament];
  const regenRate = fish.energyRegen ?? 0;
  const maxEnergy = Math.max(0, fish.maxEnergy || 0);
  const resumeThreshold =
    maxEnergy * FISH_FIGHT_CONSTANTS.ENERGY_RESUME_THRESHOLD;
  if (fish.state === "tired") {
    nextFish.currentForce = { x: 0, y: 0 };
    if (regenRate > 0 && fish.maxEnergy > 0) {
      nextFish.energy = Math.min(
        fish.maxEnergy,
        fish.energy + regenRate * deltaTime,
      );
      if (nextFish.energy >= resumeThreshold) {
        nextFish.state = "hooked";
        nextFish.fightPhase = "rest";
        nextFish.fightPhaseTimer = fish.fightRestDuration
          ? fish.fightRestDuration
          : FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.min +
            Math.random() *
              (FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.max -
                FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.min);
      }
    }
    return nextFish;
  }
  void avatarPosition;

  // Fight cadence: alternate run bursts with rest windows (Game Mechanics - Horizontal Drag Phase.md).
  if (!fish.fightPhase || fish.fightPhaseTimer === undefined) {
    nextFish.fightPhase = "run";
    const runRange = FISH_FIGHT_CONSTANTS.RUN_DURATION_RANGE;
    nextFish.fightPhaseTimer =
      runRange.min + Math.random() * (runRange.max - runRange.min);
  }
  const energyRatio = maxEnergy > 0 ? fish.energy / maxEnergy : 0;
  nextFish.fightPhaseTimer = (fish.fightPhaseTimer ?? 0) - deltaTime;
  if (nextFish.fightPhaseTimer <= 0) {
    const wantsRun = fish.fightPhase === "rest";
    if (
      wantsRun &&
      energyRatio < FISH_FIGHT_CONSTANTS.ENERGY_RESUME_THRESHOLD
    ) {
      nextFish.fightPhase = "rest";
      nextFish.fightPhaseTimer =
        FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.min +
        Math.random() *
          (FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.max -
            FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.min);
    } else {
      const range = wantsRun
        ? FISH_FIGHT_CONSTANTS.RUN_DURATION_RANGE
        : FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE;
      nextFish.fightPhase = wantsRun ? "run" : "rest";
      nextFish.fightPhaseTimer =
        range.min + Math.random() * (range.max - range.min);
    }
  }
  if (tension > fish.panicThreshold) {
    const panicIncrease =
      (tension - fish.panicThreshold) * temperament.panicBuildRate * deltaTime;
    nextFish.panicLevel = fish.panicLevel + panicIncrease;
  } else {
    const panicDecrease = temperament.panicDecayRate * 20 * deltaTime;
    nextFish.panicLevel = fish.panicLevel - panicDecrease;
  }
  nextFish.panicLevel = clamp(nextFish.panicLevel ?? 0, 0, 100);

  if (nextFish.panicLevel > 50 && fish.state === "hooked") {
    nextFish.state = "fighting";
  } else if (nextFish.panicLevel < 20 && fish.state === "fighting") {
    nextFish.state = "hooked";
  }

  nextFish.directionChangeTimer = (fish.directionChangeTimer ?? 0) - deltaTime;
  if (nextFish.directionChangeTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    nextFish.targetDirection = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
    const panicFrequencyMod = 1 - (fish.panicLevel / 100) * 0.7;
    nextFish.directionChangeTimer =
      fish.directionChangeFrequency * panicFrequencyMod + Math.random() * 0.5;
  }

  const energyFactor = fish.energy / fish.maxEnergy;
  const panicFactor = nextFish.panicLevel / 100;
  const strengthWhenCalm = temperament.strengthWhenCalm;
  const strengthWhenPanicked = temperament.strengthWhenPanicked;
  const strengthFactor =
    strengthWhenCalm + (strengthWhenPanicked - strengthWhenCalm) * panicFactor;
  const phaseMultiplier =
    nextFish.fightPhase === "run"
      ? FISH_FIGHT_CONSTANTS.RUN_FORCE_MULTIPLIER
      : FISH_FIGHT_CONSTANTS.REST_FORCE_MULTIPLIER;
  const forceMagnitude =
    fish.baseStrength * energyFactor * strengthFactor * phaseMultiplier;

  const safeDirection = nextFish.targetDirection ||
    fish.targetDirection || {
      x: 0,
      y: 1,
    };
  nextFish.currentForce = {
    x: safeDirection.x * forceMagnitude,
    y: safeDirection.y * forceMagnitude,
  };

  if (nextFish.fightPhase === "run") {
    nextFish.energy = fish.energy - temperament.energyDrainRate * 6 * deltaTime;
  } else {
    nextFish.energy =
      fish.energy - temperament.energyDrainRate * 1.8 * deltaTime;
  }

  if (nextFish.fightPhase === "rest" && regenRate > 0) {
    nextFish.energy += regenRate * deltaTime;
  }

  if (maxEnergy > 0) {
    nextFish.energy = clamp(nextFish.energy, 0, maxEnergy);
  }

  if (nextFish.energy <= 0) {
    nextFish.energy = 0;
    nextFish.state = "tired";
    nextFish.currentForce = { x: 0, y: 0 };
  }

  return nextFish;
}
