/**
 * Rope Physics Debug Utilities
 * Helper functions for testing and debugging the 3D rope system
 */

import { HEIGHTS } from "../mechanics/heightMechanics.js";

/**
 * Log detailed rope state to console
 * @param {Rope3D} rope - Rope instance
 * @param {Object} sessionStore - Session store
 */
export function logRopeState(rope, sessionStore) {
  if (!rope) {
    console.log("[ROPE DEBUG] No rope instance");
    return;
  }

  const state = sessionStore?.getState();
  const phase = state?.phase || "unknown";
  const progress = state?.phaseProgress || 0;

  console.group(
    `[ROPE DEBUG] State - Phase: ${phase}, Progress: ${(progress * 100).toFixed(1)}%`,
  );

  console.log(`Segments: ${rope.points.length}`);
  console.log(`Segment Length: ${rope.segmentLength.toFixed(2)}px`);
  console.log(`Total Length: ${rope.getTotalLength().toFixed(2)}px`);

  // Log endpoints
  const start = rope.points[0];
  const end = rope.points[rope.points.length - 1];
  console.log(
    `Start (Avatar): (${start.pos.x.toFixed(1)}, ${start.pos.y.toFixed(1)}, ${start.pos.z.toFixed(1)})`,
  );
  console.log(
    `End (Magnet): (${end.pos.x.toFixed(1)}, ${end.pos.y.toFixed(1)}, ${end.pos.z.toFixed(1)})`,
  );

  // Calculate max sag
  const maxSag = calculateMaxSag(rope);
  console.log(`Max Sag: ${maxSag.toFixed(2)}px at point ${maxSag.index}`);

  console.groupEnd();
}

/**
 * Calculate maximum sag in the rope
 * @param {Rope3D} rope - Rope instance
 * @returns {{value: number, index: number}} Max sag and point index
 */
export function calculateMaxSag(rope) {
  if (!rope || rope.points.length < 3) {
    return { value: 0, index: -1 };
  }

  let maxSag = 0;
  let maxSagIndex = -1;

  const start = rope.points[0];
  const end = rope.points[rope.points.length - 1];

  // Calculate line from start to end
  const dx = end.pos.x - start.pos.x;
  const dy = end.pos.y - start.pos.y;
  const dz = end.pos.z - start.pos.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length < 0.001) return { value: 0, index: -1 };

  // Check each point's distance from the straight line
  for (let i = 1; i < rope.points.length - 1; i++) {
    const point = rope.points[i];

    // Project point onto line
    const t = i / (rope.points.length - 1);
    const lineX = start.pos.x + t * dx;
    const lineY = start.pos.y + t * dy;
    const lineZ = start.pos.z + t * dz;

    // Calculate perpendicular distance
    const distX = point.pos.x - lineX;
    const distY = point.pos.y - lineY;
    const distZ = point.pos.z - lineZ;
    const dist = Math.sqrt(distX * distX + distY * distY + distZ * distZ);

    if (dist > maxSag) {
      maxSag = dist;
      maxSagIndex = i;
    }
  }

  return { value: maxSag, index: maxSagIndex };
}

/**
 * Visualize rope points as debug graphics
 * @param {PIXI.Graphics} graphics - Graphics object to draw on
 * @param {Rope3D} rope - Rope instance
 * @param {string} color - Hex color for debug visualization
 */
export function visualizeRopePoints(graphics, rope, color = 0xff0000) {
  if (!graphics || !rope) return;

  graphics.clear();

  // Draw rope line
  const screenPoints = rope.getScreenPoints();
  if (screenPoints.length > 0) {
    graphics.lineStyle(2, color, 0.5);
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);

    for (let i = 1; i < screenPoints.length; i++) {
      graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
  }

  // Draw points
  screenPoints.forEach((point, index) => {
    const isPinned = rope.points[index].pinned;
    graphics.beginFill(isPinned ? 0x00ff00 : color, isPinned ? 1.0 : 0.5);
    graphics.drawCircle(point.x, point.y, isPinned ? 5 : 3);
    graphics.endFill();
  });
}

/**
 * Create test rope for debugging
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @returns {Promise<Rope3D>} Test rope
 */
export async function createTestRope(x1, y1, x2, y2) {
  const { Rope3D } = await import("../physics/RopePhysics3D.js");
  const { getAvatarPosition, getMagnetPosition } =
    await import("../mechanics/heightMechanics.js");

  const startPos = getAvatarPosition(x1, y1);
  const endPos = getMagnetPosition(x2, y2, "drag", 0);

  return new Rope3D(20, startPos, endPos);
}

/**
 * Log phase transition for debugging
 * @param {string} oldPhase - Previous phase
 * @param {string} newPhase - New phase
 * @param {number} progress - Current progress
 */
export function logPhaseTransition(oldPhase, newPhase, progress = 0) {
  console.log(
    `[PHASE TRANSITION] ${oldPhase} → ${newPhase} (Progress: ${(progress * 100).toFixed(1)}%)`,
  );
}

/**
 * Check if rope is underwater
 * @param {Rope3D} rope - Rope instance
 * @returns {{underwater: number, aboveWater: number, percentUnderwater: number}}
 */
export function getRopeWaterStatus(rope) {
  if (!rope) return { underwater: 0, aboveWater: 0, percentUnderwater: 0 };

  let underwater = 0;
  let aboveWater = 0;

  rope.points.forEach((point) => {
    if (point.pos.z < HEIGHTS.WATER_SURFACE) {
      underwater++;
    } else {
      aboveWater++;
    }
  });

  const total = rope.points.length;
  const percentUnderwater = (underwater / total) * 100;

  return { underwater, aboveWater, percentUnderwater };
}

/**
 * Calculate rope casting angle
 * Useful for understanding sag visibility
 * @param {Rope3D} rope - Rope instance
 * @returns {{angleXY: number, angleXZ: number, angleYZ: number}}
 */
export function getRopeCastingAngles(rope) {
  if (!rope) return { angleXY: 0, angleXZ: 0, angleYZ: 0 };

  const start = rope.points[0];
  const end = rope.points[rope.points.length - 1];

  const dx = end.pos.x - start.pos.x;
  const dy = end.pos.y - start.pos.y;
  const dz = end.pos.z - start.pos.z;

  // Angle in XY plane (casting direction on ground)
  const angleXY = Math.atan2(dy, dx) * (180 / Math.PI);

  // Angle in XZ plane (East/West with height)
  const angleXZ = Math.atan2(dz, dx) * (180 / Math.PI);

  // Angle in YZ plane (North/South with height)
  const angleYZ = Math.atan2(dz, dy) * (180 / Math.PI);

  return { angleXY, angleXZ, angleYZ };
}

/**
 * Performance monitoring for rope physics
 */
export class RopePerformanceMonitor {
  constructor() {
    this.updateTimes = [];
    this.maxSamples = 60; // Monitor last 60 frames
  }

  /**
   * Record an update duration
   * @param {number} duration - Update duration in milliseconds
   */
  recordUpdate(duration) {
    this.updateTimes.push(duration);
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes.shift();
    }
  }

  /**
   * Get performance statistics
   * @returns {{avg: number, min: number, max: number, fps: number}}
   */
  getStats() {
    if (this.updateTimes.length === 0) {
      return { avg: 0, min: 0, max: 0, fps: 0 };
    }

    const avg =
      this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
    const min = Math.min(...this.updateTimes);
    const max = Math.max(...this.updateTimes);
    const fps = avg > 0 ? 1000 / avg : 0;

    return { avg, min, max, fps };
  }

  /**
   * Log performance statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log(
      `[ROPE PERF] Avg: ${stats.avg.toFixed(2)}ms | Min: ${stats.min.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms | FPS: ${stats.fps.toFixed(1)}`,
    );
  }

  /**
   * Reset monitoring
   */
  reset() {
    this.updateTimes = [];
  }
}

/**
 * Automated test suite for rope physics
 */
export class RopePhysicsTests {
  /**
   * Test rope creation
   */
  static async testRopeCreation() {
    console.group("[TEST] Rope Creation");

    try {
      const rope = await createTestRope(100, 100, 400, 400);
      console.assert(rope !== null, "Rope should be created");
      console.assert(rope.points.length > 0, "Rope should have points");
      console.assert(
        rope.points[0].pinned === true,
        "First point should be pinned",
      );
      console.assert(
        rope.points[rope.points.length - 1].pinned === true,
        "Last point should be pinned",
      );
      console.log("✅ Rope creation test passed");
    } catch (error) {
      console.error("❌ Rope creation test failed:", error);
    }

    console.groupEnd();
  }

  /**
   * Test gravity application
   */
  static async testGravity() {
    console.group("[TEST] Gravity");

    try {
      const rope = await createTestRope(100, 100, 400, 100); // Horizontal cast
      const initialZ = rope.points[Math.floor(rope.points.length / 2)].pos.z;

      // Update several times
      const avatarPos = { x: 100, y: 100, z: HEIGHTS.AVATAR };
      const magnetPos = { x: 400, y: 100, z: HEIGHTS.RIVERBED };

      for (let i = 0; i < 10; i++) {
        rope.update(1 / 60, avatarPos, magnetPos);
      }

      const finalZ = rope.points[Math.floor(rope.points.length / 2)].pos.z;

      console.assert(
        finalZ < initialZ,
        `Gravity should pull rope down (initial: ${initialZ}, final: ${finalZ})`,
      );
      console.log("✅ Gravity test passed");
    } catch (error) {
      console.error("❌ Gravity test failed:", error);
    }

    console.groupEnd();
  }

  /**
   * Run all tests
   */
  static async runAll() {
    console.group("[ROPE PHYSICS TESTS]");
    await this.testRopeCreation();
    await this.testGravity();
    console.log("All tests completed");
    console.groupEnd();
  }
}
