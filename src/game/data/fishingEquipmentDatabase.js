export const EQUIPMENT_CATEGORIES = {
  magnet: {
    catches: ["metallic"],
    attachmentType: "magnetic",
    failureMode: "slip",
    dragBehavior: "passive",
    requiresWait: false,
  },
  rod: {
    catches: ["fish"],
    attachmentType: "bite",
    failureMode: "escape",
    dragBehavior: "active",
    requiresWait: true,
  },
};

export const EQUIPMENT_DATABASE = {
  magnet: {
    tier1: {
      id: "magnet_basic",
      name: "Basic Magnet",
      tier: 1,
      maxPullForce: 50,
      slipResistance: 1.0,
      effectiveMassRange: { min: 0.5, max: 30 },
      struggleMassRange: { min: 30, max: 50 },
      lineStrength: 80,
      cost: 0,
      description: "A basic neodymium magnet. Good for light to medium items.",
    },
    tier2: {
      id: "magnet_heavy",
      name: "Heavy Duty Magnet",
      tier: 2,
      maxPullForce: 80,
      slipResistance: 1.15,
      effectiveMassRange: { min: 5, max: 50 },
      struggleMassRange: { min: 50, max: 80 },
      lineStrength: 120,
      cost: 500,
      description:
        "Reinforced magnet with stronger pull. Handles heavier salvage.",
    },
    tier3: {
      id: "magnet_industrial",
      name: "Industrial Magnet",
      tier: 3,
      maxPullForce: 120,
      slipResistance: 1.3,
      effectiveMassRange: { min: 15, max: 80 },
      struggleMassRange: { min: 80, max: 120 },
      lineStrength: 180,
      cost: 1500,
      description:
        "Industrial-grade electromagnet. For serious salvage operations.",
    },
  },
  rod: {
    tier1: {
      id: "rod_basic",
      name: "Basic Fishing Rod",
      tier: 1,
      maxPullForce: 30,
      lineStrength: 50,
      effectiveMassRange: { min: 0.5, max: 5 },
      struggleMassRange: { min: 5, max: 10 },
      waitTimeRange: { min: 5, max: 15 },
      biteChancePerSecond: 0.1,
      cost: 0,
      description: "A simple fishing rod. Good for small fish.",
    },
    tier2: {
      id: "rod_sport",
      name: "Sport Fishing Rod",
      tier: 2,
      maxPullForce: 50,
      lineStrength: 80,
      effectiveMassRange: { min: 2, max: 12 },
      struggleMassRange: { min: 12, max: 20 },
      waitTimeRange: { min: 4, max: 12 },
      biteChancePerSecond: 0.12,
      cost: 800,
      description: "Quality rod with better line. Handles fighting fish.",
    },
    tier3: {
      id: "rod_deep",
      name: "Deep Water Rod",
      tier: 3,
      maxPullForce: 100,
      lineStrength: 150,
      effectiveMassRange: { min: 5, max: 30 },
      struggleMassRange: { min: 30, max: 50 },
      waitTimeRange: { min: 6, max: 20 },
      biteChancePerSecond: 0.08,
      cost: 2000,
      description: "Heavy-duty rod for trophy fish. Built for the big ones.",
    },
  },
};

export function getFishingEquipment(type, tierKey) {
  const category = EQUIPMENT_DATABASE[type];
  if (!category) return null;
  return category[tierKey] || null;
}

export function getFishingEquipmentById(type, tierId) {
  const category = EQUIPMENT_DATABASE[type];
  if (!category) return null;
  const tierKey = Object.keys(category).find(
    (key) => category[key].id === tierId,
  );
  return tierKey ? category[tierKey] : null;
}

export function getDefaultFishingEquipment() {
  return { type: "magnet", tierId: "magnet_basic" };
}
