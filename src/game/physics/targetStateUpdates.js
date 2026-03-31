/**
 * Per-tick state transforms for drag targets.
 *
 * Owns:
 * - Metallic slip accumulation updates
 * - Fish behavior state machine (panic, phase, direction, force intent)
 */

import {
  FISH_FIGHT_CONSTANTS,
  SLIP_CONSTANTS,
  TEMPERAMENT_ALIASES,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
import { WORLD_Y } from "../mechanics/worldDimensions.js";
import { clamp, normalize } from "./vectorUtils.js";

export function updateSlip(item, tension, equipment, deltaTime) {
  let slipAccumulation = item.slipAccumulation || 0;
  const surfaceMultiplier =
    SLIP_CONSTANTS.SURFACE_MULTIPLIERS[item.surfaceCondition] || 1;
  const resistanceBonus = equipment?.slipResistance || 1.0;
  const tensionFactor = clamp(
    tension / SLIP_CONSTANTS.TENSION_NORMALIZATION_MAX,
    0,
    1,
  );
  const slipRate =
    SLIP_CONSTANTS.MASTER_MULTIPLIER *
    surfaceMultiplier *
    (SLIP_CONSTANTS.BASE_RATE_OFFSET + tensionFactor);
  slipAccumulation +=
    (slipRate * deltaTime * SLIP_CONSTANTS.ACCUMULATION_SCALE) /
    resistanceBonus;
  const slipLimit = item.slipLimit || 1;
  const detached = slipAccumulation >= slipLimit;
  return {
    slipAccumulation,
    slipLimit,
    detached,
    slipPercent: clamp(slipAccumulation / slipLimit, 0, 1),
  };
}

function randomRange(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function getTemperament(temperamentName) {
  const resolvedName = TEMPERAMENT_ALIASES[temperamentName] ?? temperamentName;
  return TEMPERAMENT_MODIFIERS[resolvedName] ?? TEMPERAMENT_MODIFIERS.normal;
}

function getAwayVector(fish, avatarPosition) {
  if (!avatarPosition) return null;
  const away = normalize({
    x: fish.position.x - avatarPosition.x,
    y: fish.position.y - avatarPosition.y,
  });
  if (
    Math.abs(away.x) <= FISH_FIGHT_CONSTANTS.ZERO_VECTOR_EPSILON &&
    Math.abs(away.y) <= FISH_FIGHT_CONSTANTS.ZERO_VECTOR_EPSILON
  ) {
    return null;
  }
  return away;
}

function applyWallAvoidance(direction, fishPosition) {
  if (FISH_FIGHT_CONSTANTS.DISABLE_WALL_AVOIDANCE_BIAS === true) {
    return direction;
  }
  if (!fishPosition) return direction;
  const distanceToWall = fishPosition.y - WORLD_Y.WALL_EDGE;
  const avoidDistance = FISH_FIGHT_CONSTANTS.WALL_AVOIDANCE_DISTANCE;
  if (distanceToWall >= avoidDistance) {
    return direction;
  }
  const proximity = clamp(
    (avoidDistance - distanceToWall) / avoidDistance,
    0,
    1,
  );
  const avoidWeight = clamp(
    proximity * FISH_FIGHT_CONSTANTS.WALL_AVOIDANCE_WEIGHT,
    0,
    1,
  );
  return normalize({
    x: direction.x * (1 - avoidWeight),
    y: direction.y * (1 - avoidWeight) + avoidWeight,
  });
}

function applyAwayBias(direction, awayVector, biasWeight) {
  if (!awayVector || biasWeight <= 0) {
    return direction;
  }
  const clampedWeight = clamp(biasWeight, 0, 1);
  return normalize({
    x: direction.x * (1 - clampedWeight) + awayVector.x * clampedWeight,
    y: direction.y * (1 - clampedWeight) + awayVector.y * clampedWeight,
  });
}

function getPhaseDuration(
  nextPhase,
  fish,
  temperament,
  panicFactor,
  energyRatio,
) {
  const runBase =
    fish.fightRunDurationBase ??
    randomRange(
      FISH_FIGHT_CONSTANTS.RUN_DURATION_RANGE.min,
      FISH_FIGHT_CONSTANTS.RUN_DURATION_RANGE.max,
    );
  const restBase =
    fish.fightRestDurationBase ??
    randomRange(
      FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.min,
      FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE.max,
    );

  if (nextPhase === "run") {
    const scaled =
      runBase *
      (temperament.runDurationMultiplier ?? 1) *
      (0.75 + panicFactor * 0.35) *
      (0.7 + energyRatio * 0.6);
    return Math.max(FISH_FIGHT_CONSTANTS.MIN_RUN_DURATION, scaled);
  }

  const scaled =
    restBase *
    (temperament.restDurationMultiplier ?? 1) *
    (1.05 - panicFactor * 0.55) *
    (0.65 + (1 - energyRatio) * 0.9);
  return Math.max(FISH_FIGHT_CONSTANTS.MIN_REST_DURATION, scaled);
}

export function updateFishAI(fish, tension, deltaTime, avatarPosition) {
  const nextFish = { ...fish };
  const temperament = getTemperament(fish.temperament);
  const regenRate = fish.energyRegen ?? 0;
  const maxEnergy = Math.max(0, fish.maxEnergy || 0);
  const resumeThreshold =
    maxEnergy * FISH_FIGHT_CONSTANTS.ENERGY_RESUME_THRESHOLD;
  const awayFromAvatar = getAwayVector(fish, avatarPosition);

  if (fish.state === "tired") {
    nextFish.currentForce = { x: 0, y: 0 };
    if (regenRate > 0 && maxEnergy > 0) {
      nextFish.energy = Math.min(
        maxEnergy,
        fish.energy + regenRate * deltaTime,
      );
      if (nextFish.energy >= resumeThreshold) {
        nextFish.state = "hooked";
        nextFish.fightPhase = "rest";
        const recoveredEnergyRatio = clamp(nextFish.energy / maxEnergy, 0, 1);
        nextFish.fightPhaseTimer = getPhaseDuration(
          "rest",
          nextFish,
          temperament,
          clamp((nextFish.panicLevel ?? 0) / 100, 0, 1),
          recoveredEnergyRatio,
        );
      }
    }
    return nextFish;
  }

  if (!fish.fightPhase || fish.fightPhaseTimer === undefined) {
    nextFish.fightPhase = "run";
    nextFish.fightPhaseTimer = getPhaseDuration(
      "run",
      nextFish,
      temperament,
      0,
      1,
    );
  }

  const panicThreshold = Math.max(1, fish.panicThreshold ?? 50);
  if (tension > 0) {
    // Any line load should raise panic. Species threshold and temperament shape
    // the growth curve: lower threshold/faster temperament => faster panic gain.
    const normalizedLoad = tension / panicThreshold;
    const overload = Math.max(0, normalizedLoad - 1);
    const panicIncrease =
      (normalizedLoad * FISH_FIGHT_CONSTANTS.PANIC_INCREASE_BASE +
        overload * FISH_FIGHT_CONSTANTS.PANIC_OVERLOAD_BONUS) *
      (temperament.panicBuildRate ?? 1) *
      deltaTime;
    nextFish.panicLevel = (fish.panicLevel ?? 0) + panicIncrease;
  } else {
    const panicDecrease =
      (temperament.panicDecayRate ?? 1) *
      FISH_FIGHT_CONSTANTS.PANIC_DECAY_BASE *
      deltaTime;
    nextFish.panicLevel = (fish.panicLevel ?? 0) - panicDecrease;
  }
  nextFish.panicLevel = clamp(nextFish.panicLevel ?? 0, 0, 100);

  if (
    nextFish.panicLevel > FISH_FIGHT_CONSTANTS.FIGHTING_ENTER_THRESHOLD &&
    fish.state === "hooked"
  ) {
    nextFish.state = "fighting";
  } else if (
    nextFish.panicLevel < FISH_FIGHT_CONSTANTS.FIGHTING_EXIT_THRESHOLD &&
    fish.state === "fighting"
  ) {
    nextFish.state = "hooked";
  }

  const panicFactor = clamp(nextFish.panicLevel / 100, 0, 1);
  const currentEnergy = clamp(fish.energy ?? 0, 0, maxEnergy || 0);
  const energyRatio =
    maxEnergy > 0 ? clamp(currentEnergy / maxEnergy, 0, 1) : 0;

  nextFish.fightPhaseTimer = (fish.fightPhaseTimer ?? 0) - deltaTime;
  if (nextFish.fightPhaseTimer <= 0) {
    const desiredNextPhase = fish.fightPhase === "rest" ? "run" : "rest";
    const mustRecover =
      desiredNextPhase === "run" &&
      energyRatio < FISH_FIGHT_CONSTANTS.ENERGY_RESUME_THRESHOLD;
    const resolvedNextPhase = mustRecover ? "rest" : desiredNextPhase;
    nextFish.fightPhase = resolvedNextPhase;
    nextFish.fightPhaseTimer = getPhaseDuration(
      resolvedNextPhase,
      nextFish,
      temperament,
      panicFactor,
      energyRatio,
    );
  }

  const phaseDirectionRate =
    nextFish.fightPhase === "run"
      ? FISH_FIGHT_CONSTANTS.RUN_DIRECTION_CHANGE_RATE
      : FISH_FIGHT_CONSTANTS.REST_DIRECTION_CHANGE_RATE;
  const directionRateFromPanic =
    1 - panicFactor * FISH_FIGHT_CONSTANTS.DIRECTION_RATE_PANIC_REDUCTION;
  const directionChangeRate =
    (fish.directionChangeFrequency ?? 1) *
    (temperament.directionChangeRateMultiplier ?? 1) *
    phaseDirectionRate *
    directionRateFromPanic;
  const randomDirectionDebug =
    FISH_FIGHT_CONSTANTS.DEBUG_RANDOM_DIRECTION_ONLY === true;

  nextFish.directionChangeTimer = (fish.directionChangeTimer ?? 0) - deltaTime;
  if (nextFish.directionChangeTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    const randomDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    if (randomDirectionDebug) {
      nextFish.targetDirection = randomDirection;
      nextFish.directionChangeTimer = Math.max(
        FISH_FIGHT_CONSTANTS.DEBUG_RANDOM_DIRECTION_MIN_INTERVAL,
        FISH_FIGHT_CONSTANTS.DEBUG_RANDOM_DIRECTION_INTERVAL,
      );
    } else {
      const priorTarget = fish.targetDirection || { x: 0, y: 1 };

      const phaseVolatility =
        nextFish.fightPhase === "run"
          ? FISH_FIGHT_CONSTANTS.RUN_DIRECTION_VOLATILITY
          : FISH_FIGHT_CONSTANTS.REST_DIRECTION_VOLATILITY;
      const volatility = clamp(
        phaseVolatility *
          (temperament.directionVolatilityMultiplier ?? 1) *
          (0.25 + panicFactor * FISH_FIGHT_CONSTANTS.PANIC_DIRECTION_BONUS),
        0,
        1,
      );

      let candidateDirection = normalize({
        x: priorTarget.x * (1 - volatility) + randomDirection.x * volatility,
        y: priorTarget.y * (1 - volatility) + randomDirection.y * volatility,
      });

      const tensionActive =
        tension > FISH_FIGHT_CONSTANTS.TENSION_ACTIVE_EPSILON;
      const awayBiasDisabled =
        FISH_FIGHT_CONSTANTS.DISABLE_AWAY_FROM_PLAYER_BIAS === true;
      const awayBiasWeight = tensionActive
        ? awayBiasDisabled
          ? 0
          : FISH_FIGHT_CONSTANTS.DIRECTION_AWAY_FROM_AVATAR_BIAS +
            (temperament.awayBiasBonus ?? 0) +
            panicFactor * FISH_FIGHT_CONSTANTS.PANIC_AWAY_BIAS_BONUS
        : 0;

      candidateDirection = applyAwayBias(
        candidateDirection,
        awayFromAvatar,
        awayBiasWeight,
      );
      candidateDirection = applyWallAvoidance(
        candidateDirection,
        fish.position,
      );
      nextFish.targetDirection = candidateDirection;
      nextFish.directionChangeTimer = Math.max(
        FISH_FIGHT_CONSTANTS.DIRECTION_CHANGE_MIN_INTERVAL,
        directionChangeRate +
          Math.random() * FISH_FIGHT_CONSTANTS.DIRECTION_CHANGE_RANDOM_JITTER,
      );
    }
  }

  let targetDirection = nextFish.targetDirection ||
    fish.targetDirection || { x: 0, y: 1 };
  // Keep away-from-player bias on retarget events only. Applying it every
  // frame can over-reinforce outward headings between direction changes.
  if (!randomDirectionDebug) {
    targetDirection = applyWallAvoidance(targetDirection, fish.position);
  }
  nextFish.targetDirection = targetDirection;

  const blendedDirection = randomDirectionDebug
    ? targetDirection
    : normalize({
        x:
          (fish.currentDirection || targetDirection).x +
          (targetDirection.x - (fish.currentDirection || targetDirection).x) *
            (1 -
              Math.exp(-FISH_FIGHT_CONSTANTS.DIRECTION_BLEND_RATE * deltaTime)),
        y:
          (fish.currentDirection || targetDirection).y +
          (targetDirection.y - (fish.currentDirection || targetDirection).y) *
            (1 -
              Math.exp(-FISH_FIGHT_CONSTANTS.DIRECTION_BLEND_RATE * deltaTime)),
      });

  const phaseMultiplier =
    nextFish.fightPhase === "run"
      ? FISH_FIGHT_CONSTANTS.RUN_FORCE_MULTIPLIER
      : FISH_FIGHT_CONSTANTS.REST_FORCE_MULTIPLIER;
  const temperamentForce =
    (temperament.baseForceMultiplier ?? 1) +
    panicFactor * (temperament.panicForceBonus ?? 0);
  const energyFactor =
    maxEnergy > 0 ? clamp(currentEnergy / maxEnergy, 0, 1) : 0;
  const forceMagnitude =
    (fish.baseStrength ?? 0) *
    phaseMultiplier *
    temperamentForce *
    energyFactor;

  const desiredForce = {
    x: blendedDirection.x * forceMagnitude,
    y: blendedDirection.y * forceMagnitude,
  };
  const priorForce = fish.currentForce || { x: 0, y: 0 };
  const forceBlendAlpha =
    1 - Math.exp(-FISH_FIGHT_CONSTANTS.FORCE_BLEND_RATE * deltaTime);

  nextFish.currentDirection = blendedDirection;
  nextFish.currentForce = {
    x: priorForce.x + (desiredForce.x - priorForce.x) * forceBlendAlpha,
    y: priorForce.y + (desiredForce.y - priorForce.y) * forceBlendAlpha,
  };

  if (nextFish.fightPhase === "run") {
    nextFish.energy =
      currentEnergy -
      (temperament.energyDrainRate ?? 1) *
        FISH_FIGHT_CONSTANTS.RUN_ENERGY_DRAIN_RATE *
        deltaTime;
  } else {
    nextFish.energy =
      currentEnergy -
      (temperament.energyDrainRate ?? 1) *
        FISH_FIGHT_CONSTANTS.REST_ENERGY_DRAIN_RATE *
        deltaTime;
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
