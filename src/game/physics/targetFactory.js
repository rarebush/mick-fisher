import { getFishSpecies } from "../data/fishDatabase.js";
import { SLIP_CONSTANTS, TEMPERAMENT_MODIFIERS } from "./physicsConstants.js";
import { clamp } from "./vectorUtils.js";

function rollAttachmentPoint() {
  const roll = Math.random();
  if (roll < 0.3) return "center";
  if (roll < 0.7) return "edge";
  return "corner";
}

function calculateSlipLimit(baseLimit, attachmentPoint) {
  return Math.floor(
    baseLimit * SLIP_CONSTANTS.ATTACHMENT_MULTIPLIERS[attachmentPoint]
  );
}

function deriveMetallicProfile(item) {
  const weight = item?.weight ?? 5;
  const dragFactor = clamp(
    item?.dragFactor ?? 0.2 + (weight / 60) * 1.4,
    0.2,
    2.4
  );
  const magneticStrength = clamp(
    item?.magneticStrength ?? 1.2 - (item?.slipRate ?? 1) * 0.35,
    0.2,
    1.3
  );
  const baseSlipLimit = clamp(
    item?.baseSlipLimit ?? Math.round(120 - weight * 0.8),
    30,
    140
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
