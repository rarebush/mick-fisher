import { getFishSpecies } from "../data/fishDatabase.js";
import {
  FISH_FIGHT_CONSTANTS,
  PHYSICS_CONSTANTS,
  SLIP_CONSTANTS,
  TEMPERAMENT_ALIASES,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
import { WORLD_Y } from "../mechanics/worldDimensions.js";
import { clamp } from "./vectorUtils.js";

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
  const mass = item?.weight ?? 5;
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
  const resolvedSize = template.sizes[size] ? size : "medium";
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
    x: hookPosition?.x ?? 0,
    y: Math.max(
      WORLD_Y.WATER_NEAR + 0.05,
      hookPosition?.y ?? WORLD_Y.WATER_NEAR + 1.5,
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
