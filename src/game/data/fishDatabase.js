export const FISH_DATABASE = {
  carp: {
    species: "carp",
    mass: 2,
    dragFactor: 0.4,
    baseStrength: 20,
    maxEnergy: 80,
    temperament: "calm",
    panicThreshold: 70,
    directionChangeFrequency: 2.5,
    baseValue: 15,
    category: "common-fish",
    sizes: {
      small: {
        massMultiplier: 0.6,
        strengthMultiplier: 0.6,
        valueMultiplier: 0.5,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.5,
        strengthMultiplier: 1.4,
        valueMultiplier: 2.0,
      },
      trophy: {
        massMultiplier: 2.5,
        strengthMultiplier: 2.0,
        valueMultiplier: 5.0,
      },
    },
  },
  bass: {
    species: "bass",
    mass: 3,
    dragFactor: 0.35,
    baseStrength: 35,
    maxEnergy: 100,
    temperament: "skittish",
    panicThreshold: 50,
    directionChangeFrequency: 1.5,
    baseValue: 25,
    category: "valuable-fish",
    sizes: {
      small: {
        massMultiplier: 0.5,
        strengthMultiplier: 0.5,
        valueMultiplier: 0.4,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.6,
        strengthMultiplier: 1.5,
        valueMultiplier: 2.5,
      },
      trophy: {
        massMultiplier: 2.8,
        strengthMultiplier: 2.2,
        valueMultiplier: 6.0,
      },
    },
  },
  pike: {
    species: "pike",
    mass: 5,
    dragFactor: 0.3,
    baseStrength: 50,
    maxEnergy: 120,
    temperament: "aggressive",
    panicThreshold: 40,
    directionChangeFrequency: 0.8,
    baseValue: 40,
    category: "rare-fish",
    sizes: {
      small: {
        massMultiplier: 0.6,
        strengthMultiplier: 0.6,
        valueMultiplier: 0.5,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.8,
        strengthMultiplier: 1.7,
        valueMultiplier: 3.0,
      },
      trophy: {
        massMultiplier: 3.0,
        strengthMultiplier: 2.5,
        valueMultiplier: 8.0,
      },
    },
  },
  catfish: {
    species: "catfish",
    mass: 8,
    dragFactor: 0.5,
    baseStrength: 40,
    maxEnergy: 150,
    temperament: "calm",
    panicThreshold: 60,
    directionChangeFrequency: 2.0,
    baseValue: 35,
    category: "common-fish",
    sizes: {
      small: {
        massMultiplier: 0.5,
        strengthMultiplier: 0.5,
        valueMultiplier: 0.4,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 2.0,
        strengthMultiplier: 1.8,
        valueMultiplier: 3.5,
      },
      trophy: {
        massMultiplier: 3.5,
        strengthMultiplier: 2.8,
        valueMultiplier: 10.0,
      },
    },
  },
  sturgeon: {
    species: "sturgeon",
    mass: 25,
    dragFactor: 0.6,
    baseStrength: 80,
    maxEnergy: 200,
    temperament: "aggressive",
    panicThreshold: 50,
    directionChangeFrequency: 1.2,
    baseValue: 100,
    category: "rare-fish",
    sizes: {
      small: {
        massMultiplier: 0.4,
        strengthMultiplier: 0.4,
        valueMultiplier: 0.3,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 2.0,
        strengthMultiplier: 1.8,
        valueMultiplier: 4.0,
      },
      trophy: {
        massMultiplier: 4.0,
        strengthMultiplier: 3.0,
        valueMultiplier: 15.0,
      },
    },
  },
};

export function getFishSpecies(species) {
  return FISH_DATABASE[species] || null;
}

export function getAllFishSpecies() {
  return Object.values(FISH_DATABASE);
}

export function rollFishSize(equipment) {
  const roll = Math.random();
  const tierBonus = Math.max(0, (equipment?.tier ?? 1) - 1) * 0.02;
  if (roll < 0.5) return "small";
  if (roll < 0.8) return "medium";
  if (roll < 0.95 - tierBonus) return "large";
  return "trophy";
}
