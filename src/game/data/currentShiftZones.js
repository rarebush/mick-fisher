/**
 * Current shift zones catalogue.
 * World-space placement on the water surface (WORLD_Z.WATER_SURFACE).
 */

import { WORLD_Z } from "../mechanics/worldConstants.js";

export const CURRENT_SHIFT_ZONE_TYPES = {
  WHIRLPOOL: {
    id: "whirlpool",
    description: "Spins particles around a core while pulling inward.",
    defaults: {
      radiusWorld: 0.8,
      strength: 0.5,
      pullStrength: 0.35,
      tangentialStrength: 0.6,
      falloff: 1.8,
    },
  },
  REPEL: {
    id: "repel",
    description: "Gently pushes particles away from the center.",
    defaults: {
      radiusWorld: 0.6,
      strength: 0.25,
      falloff: 2.0,
    },
  },
  RAPID: {
    id: "rapid",
    description:
      "Drags particles along a flow direction with side-to-side wobble.",
    defaults: {
      radiusWorld: 1.2,
      strength: 0.6,
      lateralStrength: 0.2,
      lateralFrequency: 1.25,
      exitBoost: 0.2,
      flowDir: { x: 1, y: 0 },
    },
  },
};

export const CURRENT_SHIFT_ZONES = [
  {
    id: "whirlpool-test-1",
    type: "whirlpool",
    position: { x: -1.2, y: 3.4, z: WORLD_Z.WATER_SURFACE },
    radiusWorld: 0.9,
    strength: 0.55,
  },
  {
    id: "repel-test-1",
    type: "repel",
    position: { x: -3.0, y: 2.2, z: WORLD_Z.WATER_SURFACE },
    radiusWorld: 0.7,
    strength: 0.18,
  },
  {
    id: "rapid-test-1",
    type: "rapid",
    position: { x: 0.6, y: 5.2, z: WORLD_Z.WATER_SURFACE },
    radiusWorld: 1.4,
    strength: 0.7,
    flowDir: { x: 0.9, y: 0.2 },
  },
];
