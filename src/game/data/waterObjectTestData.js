/**
 * Temporary test placement for water objects.
 * Logs are centered on the water surface (Z=1).
 * Water surface bounds: X[-8, 4] Y[0, 8]
 * Visual center: X=-2 (horizontal), Y=2 (not too far back)
 */

import { WORLD_Z } from "../mechanics/worldConstants.js";

export const WATER_OBJECT_TEST_LOGS = [
  {
    id: "test-log-center",
    position: { x: 0, y: 0, z: WORLD_Z.WATER_SURFACE },
    footprint: { shape: "ellipse", size: { x: 1.2, y: 0.6 }, rotation: 0.3 },
  },
  {
    id: "test-log-2",
    position: { x: 0, y: 2, z: WORLD_Z.WATER_SURFACE },
    footprint: { shape: "circle", size: { x: 0.5, y: 0.5 } },
  },
  {
    id: "test-log-3",
    position: { x: 2, y: 3, z: WORLD_Z.WATER_SURFACE },
    footprint: { shape: "rect", size: { x: 1.0, y: 0.5 }, rotation: -0.5 },
  },
  {
    id: "test-log-4",
    position: { x: -2, y: -3, z: WORLD_Z.WATER_SURFACE },
    footprint: { shape: "square", size: { x: 0.7, y: 0.7 } },
  },
];
