/**
 * Temporary test placement for water objects.
 * Logs are centered on the water surface (Z=1).
 */

import { WORLD_Z } from "../mechanics/worldConstants.js";

export const WATER_OBJECT_TEST_LOGS = [
  { id: "test-log-1", position: { x: 0, y: 1, z: WORLD_Z.WATER_SURFACE } },
  { id: "test-log-2", position: { x: 0, y: 2, z: WORLD_Z.WATER_SURFACE } },
  { id: "test-log-3", position: { x: 2, y: 3, z: WORLD_Z.WATER_SURFACE } },
];
