/**
 * Location Database
 * Fishing locations with spawn tables and properties
 *
 * Properties:
 * - id: unique identifier
 * - name: display name
 * - description: flavor text
 * - theme: visual theme
 * - spawnTable: weighted item spawn probabilities by quadrant zone
 * - depthMultiplier: affects lift phase duration
 * - ambience: audio theme
 */

import { ITEMS } from "./itemDatabase.js";

export const LOCATIONS = {
  "picturesque-river": {
    id: "picturesque-river",
    name: "Picturesque River",
    description:
      "A scenic river popular with walkers and cyclists. Surprisingly clean water, but plenty of litter accumulates near the banks.",
    theme: "nature",
    unlocked: true,
    depthMultiplier: 1.0,
    ambience: "gentle-water",

    // Spawn tables by quadrant zone
    spawnTables: {
      // Edge zone (Q0) - 0-2m - mostly light trash
      edge: {
        items: {
          "glass-bottle": 40,
          "tin-can": 50,
          "old-boot": 30,
          "traffic-cone": 20,
          "street-sign": 10,
        },
        nothingWeight: 50, // 50% chance of nothing
      },

      // Near zone (Q1-Q3) - 2-8m - mix of light and medium items
      near: {
        items: {
          "glass-bottle": 30,
          "tin-can": 35,
          "old-boot": 25,
          bicycle: 20,
          "shopping-cart": 15,
          "traffic-cone": 25,
          "metal-chair": 10,
          "street-sign": 15,
        },
        nothingWeight: 40,
      },

      // Mid zone (Q4-Q6) - 8-15m - medium items, some rare
      mid: {
        items: {
          bicycle: 30,
          "shopping-cart": 25,
          "traffic-cone": 20,
          "metal-toolbox": 15,
          "car-wheel": 12,
          "metal-chair": 20,
          "antique-lamp": 8,
          "vintage-radio": 6,
          "street-sign": 18,
        },
        nothingWeight: 30,
      },

      // Far zone (Q7-Q9) - 15-25m - heavy items, highest rare chance
      far: {
        items: {
          "metal-toolbox": 25,
          "car-wheel": 20,
          "metal-chair": 15,
          "safe-small": 5,
          "antique-lamp": 12,
          "vintage-radio": 10,
          "engine-block": 8,
          anchor: 8,
          bicycle: 15,
        },
        nothingWeight: 20,
      },
    },
  },

  "city-river": {
    id: "city-river",
    name: "City River",
    description:
      "A murky river cutting through the industrial district. Heavily polluted with urban runoff and discarded items.",
    theme: "urban",
    unlocked: true,
    depthMultiplier: 1.1, // Slightly deeper
    ambience: "industrial-water",

    spawnTables: {
      edge: {
        items: {
          "tin-can": 60,
          "glass-bottle": 50,
          "old-boot": 40,
          "shopping-cart": 20,
        },
        nothingWeight: 40,
      },

      near: {
        items: {
          "tin-can": 40,
          "glass-bottle": 35,
          "old-boot": 30,
          "shopping-cart": 30,
          bicycle: 25,
          "metal-chair": 20,
          "traffic-cone": 15,
        },
        nothingWeight: 35,
      },

      mid: {
        items: {
          "shopping-cart": 35,
          bicycle: 30,
          "metal-chair": 25,
          "car-wheel": 20,
          "metal-toolbox": 18,
          "engine-block": 10,
          "street-sign": 20,
        },
        nothingWeight: 25,
      },

      far: {
        items: {
          "car-wheel": 30,
          "metal-toolbox": 25,
          "engine-block": 18,
          "safe-small": 8,
          anchor: 12,
          "vintage-radio": 10,
          "metal-chair": 15,
        },
        nothingWeight: 15,
      },
    },
  },
};

// Quadrant zone mapping
export const QUADRANT_ZONES = {
  0: "edge",
  1: "near",
  2: "near",
  3: "near",
  4: "mid",
  5: "mid",
  6: "mid",
  7: "far",
  8: "far",
  9: "far",
};

// Quadrant distance ranges (meters from shore)
export const QUADRANT_DISTANCES = {
  0: { min: 0, max: 2 },
  1: { min: 2, max: 8 },
  2: { min: 2, max: 8 },
  3: { min: 2, max: 8 },
  4: { min: 8, max: 15 },
  5: { min: 8, max: 15 },
  6: { min: 8, max: 15 },
  7: { min: 15, max: 25 },
  8: { min: 15, max: 25 },
  9: { min: 15, max: 25 },
};

export const MAX_QUADRANT_DISTANCE = Math.max(
  ...Object.values(QUADRANT_DISTANCES).map((range) => range.max),
);

// Quadrant depth ranges (meters underwater)
export const QUADRANT_DEPTHS = {
  0: { min: 0.5, max: 1.5 },
  1: { min: 2, max: 4 },
  2: { min: 2, max: 4 },
  3: { min: 2, max: 4 },
  4: { min: 5, max: 8 },
  5: { min: 5, max: 8 },
  6: { min: 5, max: 8 },
  7: { min: 8, max: 12 },
  8: { min: 8, max: 12 },
  9: { min: 8, max: 12 },
};

// Helper functions
export const getLocation = (locationId) => LOCATIONS[locationId];

export const getAllLocations = () => Object.values(LOCATIONS);

export const getUnlockedLocations = () => {
  return Object.values(LOCATIONS).filter((loc) => loc.unlocked);
};

export const getQuadrantZone = (quadrant) => QUADRANT_ZONES[quadrant];

export const getQuadrantDistance = (quadrant) => QUADRANT_DISTANCES[quadrant];

export const getQuadrantDepth = (quadrant) => QUADRANT_DEPTHS[quadrant];
