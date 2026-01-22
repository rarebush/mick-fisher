/**
 * RopePhysics3D.js
 * 3D rope simulation using Verlet integration
 * Simulates rope with gravity and constraint-based physics
 */

/**
 * RopePoint3D - Individual point in the rope
 */
export class RopePoint3D {
  constructor(x, y, z) {
    this.pos = { x, y, z };
    this.oldPos = { x, y, z };
    this.pinned = false; // true for avatar and magnet endpoints
  }

  /**
   * Update point position using Verlet integration
   * @param {number} deltaTime - Time step in seconds
   */
  update(deltaTime) {
    if (this.pinned) return;

    // Calculate velocity from previous position
    const vx = this.pos.x - this.oldPos.x;
    const vy = this.pos.y - this.oldPos.y;
    const vz = this.pos.z - this.oldPos.z;

    // Store old position
    this.oldPos = { ...this.pos };

    // Apply gravity (only affects Z axis - height)
    // Gravity is negative because lower Z = lower on screen
    const gravity = -980; // pixels/s² (adjust for game feel)
    const gravityDelta = gravity * deltaTime * deltaTime;

    // Apply air resistance (damping)
    const damping = 0.99;

    // Update position
    this.pos.x += vx * damping;
    this.pos.y += vy * damping;
    this.pos.z += vz * damping + gravityDelta;
  }

  /**
   * Project 3D position to 2D screen coordinates
   * Higher Z = higher on screen (lower Y coordinate)
   * @returns {{x: number, y: number}}
   */
  toScreen() {
    return {
      x: this.pos.x,
      y: this.pos.y - this.pos.z, // Higher Z appears higher on screen
    };
  }
}

/**
 * Rope3D - Complete rope simulation
 */
export class Rope3D {
  /**
   * Create a new 3D rope
   * @param {number} segments - Number of rope segments
   * @param {{x: number, y: number, z: number}} startPos - Starting position (avatar)
   * @param {{x: number, y: number, z: number}} endPos - Ending position (magnet)
   */
  constructor(segments, startPos, endPos) {
    this.points = [];
    this.segmentLength = 10; // Desired rest length between points (pixels)

    // Calculate actual segment length based on distance
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dz = endPos.z - startPos.z;
    const totalDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.segmentLength = totalDistance / (segments - 1);

    // Create rope points linearly interpolated in 3D space
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const point = new RopePoint3D(
        startPos.x + t * (endPos.x - startPos.x),
        startPos.y + t * (endPos.y - startPos.y),
        startPos.z + t * (endPos.z - startPos.z),
      );

      // Pin endpoints
      if (i === 0) point.pinned = true; // Avatar end
      if (i === segments - 1) point.pinned = true; // Magnet end

      this.points.push(point);
    }
  }

  /**
   * Update rope physics
   * @param {number} deltaTime - Time step in seconds
   * @param {{x: number, y: number, z: number}} avatarPos - Current avatar position
   * @param {{x: number, y: number, z: number}} magnetPos - Current magnet position
   */
  update(deltaTime, avatarPos, magnetPos) {
    // Log if deltaTime is unusual
    if (deltaTime > 0.1) {
      console.warn(`[ROPE PHYSICS] Large deltaTime: ${deltaTime.toFixed(3)}s`);
    }

    // Update pinned endpoint positions
    this.points[0].pos = { ...avatarPos };
    this.points[0].oldPos = { ...avatarPos };

    const lastIdx = this.points.length - 1;
    this.points[lastIdx].pos = { ...magnetPos };
    this.points[lastIdx].oldPos = { ...magnetPos };

    // Physics update for unpinned points
    this.points.forEach((point) => point.update(deltaTime));

    // Constraint solving (multiple iterations for stability)
    for (let iteration = 0; iteration < 3; iteration++) {
      this.applyConstraints();
    }

    // Clamp excessive velocities to prevent physics explosions
    const MAX_VELOCITY_PER_FRAME = 100; // pixels per frame
    for (let i = 1; i < this.points.length - 1; i++) {
      // Skip pinned endpoints
      const point = this.points[i];
      const vx = point.pos.x - point.oldPos.x;
      const vy = point.pos.y - point.oldPos.y;
      const vz = point.pos.z - point.oldPos.z;
      const velocityMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (velocityMag > MAX_VELOCITY_PER_FRAME) {
        console.warn(
          `[ROPE PHYSICS] Clamping excessive velocity: ${velocityMag.toFixed(1)} -> ${MAX_VELOCITY_PER_FRAME} px/frame`,
        );
        // Clamp velocity by adjusting oldPos
        const scale = MAX_VELOCITY_PER_FRAME / velocityMag;
        point.oldPos.x = point.pos.x - vx * scale;
        point.oldPos.y = point.pos.y - vy * scale;
        point.oldPos.z = point.pos.z - vz * scale;
      }
    }
  }

  /**
   * Apply distance constraints between consecutive points
   * Keeps rope segments at desired length
   */
  applyConstraints() {
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      const dx = p2.pos.x - p1.pos.x;
      const dy = p2.pos.y - p1.pos.y;
      const dz = p2.pos.z - p1.pos.z;

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Avoid division by zero
      if (distance < 0.001) continue;

      const difference = (distance - this.segmentLength) / distance;

      const offsetX = dx * difference * 0.5;
      const offsetY = dy * difference * 0.5;
      const offsetZ = dz * difference * 0.5;

      // Move points to maintain constraint
      if (!p1.pinned) {
        p1.pos.x += offsetX;
        p1.pos.y += offsetY;
        p1.pos.z += offsetZ;
      }

      if (!p2.pinned) {
        p2.pos.x -= offsetX;
        p2.pos.y -= offsetY;
        p2.pos.z -= offsetZ;
      }
    }
  }

  /**
   * Get screen coordinates for rendering
   * @returns {Array<{x: number, y: number}>}
   */
  getScreenPoints() {
    return this.points.map((point) => point.toScreen());
  }

  /**
   * Reset physics state - zeros out all velocities
   * Call this when transitioning from animation to physics simulation
   * to prevent Verlet integration from interpreting animated positions as velocity
   */
  resetPhysicsState() {
    console.log("[ROPE PHYSICS] Resetting physics state - zeroing velocities");
    this.points.forEach((point) => {
      point.oldPos = { ...point.pos }; // Set oldPos = pos to zero velocity
    });
  }

  /**
   * Update segment length dynamically (for stretching rope)
   * @param {number} newLength - New segment length
   */
  setSegmentLength(newLength) {
    this.segmentLength = newLength;
  }

  /**
   * Get current total rope length
   * @returns {number} Total length in pixels
   */
  getTotalLength() {
    let length = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const dx = p2.pos.x - p1.pos.x;
      const dy = p2.pos.y - p1.pos.y;
      const dz = p2.pos.z - p1.pos.z;
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return length;
  }
}
