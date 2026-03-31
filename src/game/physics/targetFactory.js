/**
 * Target construction for drag phase.
 *
 * Owns runtime object creation for:
 * - Metallic targets (mass/drag/slip profile derivation)
 * - Fish targets (species-size resolved fight initialization)
 */

import { getFishSpecies } from "../data/fishDatabase.js";
import {
  FISH_TARGET_CONSTANTS,
  FISH_FIGHT_CONSTANTS,
  METALLIC_TARGET_CONSTANTS,
  PHYSICS_CONSTANTS,
  SLIP_CONSTANTS,
  TEMPERAMENT_ALIASES,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
import { WORLD_Y } from "../mechanics/worldDimensions.js";
import { clamp } from "./vectorUtils.js";

function rollAttachmentPoint() {
  const roll = Math.random();
  if (roll < METALLIC_TARGET_CONSTANTS.ATTACHMENT_ROLL_CENTER_MAX) {
    return "center";
  }
  if (roll < METALLIC_TARGET_CONSTANTS.ATTACHMENT_ROLL_EDGE_MAX) return "edge";
  return "corner";
}

function calculateSlipLimit(baseLimit, attachmentPoint) {
  return Math.floor(
    baseLimit * SLIP_CONSTANTS.ATTACHMENT_MULTIPLIERS[attachmentPoint],
  );
}

function deriveMetallicProfile(item) {
  const weight = item?.weight ?? METALLIC_TARGET_CONSTANTS.DEFAULT_WEIGHT;
  const dragFactor = clamp(
    item?.dragFactor ??
      METALLIC_TARGET_CONSTANTS.DRAG_FACTOR_BASE +
        (weight / METALLIC_TARGET_CONSTANTS.DRAG_FACTOR_WEIGHT_DIVISOR) *
          METALLIC_TARGET_CONSTANTS.DRAG_FACTOR_WEIGHT_SCALE,
    METALLIC_TARGET_CONSTANTS.DRAG_FACTOR_MIN,
    METALLIC_TARGET_CONSTANTS.DRAG_FACTOR_MAX,
  );
  const magneticStrength = clamp(
    item?.magneticStrength ??
      METALLIC_TARGET_CONSTANTS.MAGNETIC_STRENGTH_BASE -
        (item?.slipRate ??
          METALLIC_TARGET_CONSTANTS.MAGNETIC_STRENGTH_DEFAULT_SLIP_RATE) *
          METALLIC_TARGET_CONSTANTS.MAGNETIC_STRENGTH_SLIP_SCALE,
    METALLIC_TARGET_CONSTANTS.MAGNETIC_STRENGTH_MIN,
    METALLIC_TARGET_CONSTANTS.MAGNETIC_STRENGTH_MAX,
  );
  const baseSlipLimit = clamp(
    item?.baseSlipLimit ??
      Math.round(
        METALLIC_TARGET_CONSTANTS.BASE_SLIP_LIMIT_START -
          weight * METALLIC_TARGET_CONSTANTS.BASE_SLIP_LIMIT_WEIGHT_SCALE,
      ),
    METALLIC_TARGET_CONSTANTS.BASE_SLIP_LIMIT_MIN,
    METALLIC_TARGET_CONSTANTS.BASE_SLIP_LIMIT_MAX,
  );
  return { dragFactor, magneticStrength, baseSlipLimit };
}

export function createMetallicTargetFromItem(item, position) {
  const profile = deriveMetallicProfile(item);
  const attachmentPoint = rollAttachmentPoint();
  const slipLimit = calculateSlipLimit(profile.baseSlipLimit, attachmentPoint);
  const mass = item?.weight ?? METALLIC_TARGET_CONSTANTS.DEFAULT_WEIGHT;
  return {
    id: item?.id ?? `item_${Date.now()}`,
    type: item?.id ?? "unknown",
    category: item?.category ?? "common-junk",
    mass,
    dragFactor: profile.dragFactor,
    staticFrictionThreshold:
      mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT,
    kineticDragCoefficient:
      profile.dragFactor * PHYSICS_CONSTANTS.KINETIC_DRAG_BASE,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    currentForce: { x: 0, y: 0 },
    isMoving: false,
    includesDragInClutchLoad: false,
    hasStaticFriction: true,
    hasFriction: true,
    simBoundsType: "world",
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
  const resolvedSize = template.sizes[size]
    ? size
    : FISH_TARGET_CONSTANTS.DEFAULT_SIZE;
  const sizeData = template.sizes[resolvedSize];
  const resolvedTemperament =
    TEMPERAMENT_ALIASES[template.temperament] ?? template.temperament;
  const temperament =
    TEMPERAMENT_MODIFIERS[resolvedTemperament] ?? TEMPERAMENT_MODIFIERS.normal;
  const runRange = FISH_FIGHT_CONSTANTS.RUN_DURATION_RANGE;
  const restRange = FISH_FIGHT_CONSTANTS.REST_DURATION_RANGE;
  const runDuration =
    (runRange.min + Math.random() * (runRange.max - runRange.min)) *
    (temperament.runDurationMultiplier ?? 1);
  const restDuration =
    (restRange.min + Math.random() * (restRange.max - restRange.min)) *
    (temperament.restDurationMultiplier ?? 1);
  const energyMultiplier =
    sizeData.energyMultiplier ?? sizeData.massMultiplier ?? 1;
  const maxEnergy = template.maxEnergy * energyMultiplier;
  const mass = template.mass * sizeData.massMultiplier;
  const energyRegen = (template.energyRegen ?? 0) * energyMultiplier;
  const spawnPosition = {
    x: hookPosition?.x ?? FISH_TARGET_CONSTANTS.SPAWN_X_FALLBACK,
    y: Math.max(
      WORLD_Y.WATER_NEAR + FISH_TARGET_CONSTANTS.SPAWN_Y_WALL_BUFFER,
      hookPosition?.y ??
        WORLD_Y.WATER_NEAR + FISH_TARGET_CONSTANTS.SPAWN_Y_FALLBACK_OFFSET,
    ),
  };
  return {
    id: `fish_${Date.now()}`,
    species,
    size: resolvedSize,
    category: template.category,
    mass,
    dragFactor: template.dragFactor,
    kineticDragCoefficient:
      template.dragFactor * PHYSICS_CONSTANTS.KINETIC_DRAG_BASE,
    position: spawnPosition,
    velocity: { x: 0, y: 0 },
    isMoving: true,
    includesDragInClutchLoad: true,
    hasStaticFriction: false,
    hasFriction: false,
    simBoundsType: "fish",
    baseStrength: template.baseStrength * sizeData.strengthMultiplier,
    maxEnergy,
    energyRegen,
    temperament: resolvedTemperament,
    panicThreshold: template.panicThreshold,
    state: "hooked",
    energy: maxEnergy,
    panicLevel: 0,
    targetDirection: { x: 0, y: 1 },
    directionChangeTimer: template.directionChangeFrequency,
    directionChangeFrequency: template.directionChangeFrequency,
    fightPhase: "run",
    fightPhaseTimer: runDuration,
    fightRunDurationBase: runDuration,
    fightRestDurationBase: restDuration,
    currentForce: { x: 0, y: 0 },
    lineStress: 0,
    baseValue: template.baseValue * sizeData.valueMultiplier,
    attached: true,
  };
}
