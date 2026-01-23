/**
 * RopePhysics3D.js
 * 3D rope simulation using Verlet integration
 * Simulates rope with gravity and constraint-based physics
 *
 * COORDINATE SYSTEM:
 * All positions are in WORLD SPACE (abstract units):
 * - X: Horizontal position (screen X)
 * - Y: Depth into the scene (toward river, increases with distance)
 * - Z: Height/elevation (higher = above water, lower = underwater)
 *
 * The caller is responsible for projecting world coordinates to screen space
 * using the formula: screenY = (worldY - worldZ) * pixelsPerUnit + offset
 *
 * @see worldConstants.js for projection utilities
 */

/**
 * RopePoint3D - Individual point in the rope
 * Positions are in world space (X, Y depth, Z height)
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
    // Gravity is negative because lower Z = lower position
    // Value is in world units/s² - tuned for game feel
    const gravity = -200; // world units/s² (adjust for game feel)
    const gravityDelta = gravity * deltaTime * deltaTime;

    // Apply air resistance (damping) - lower = more rigid/less wobbly
    const damping = 0.92;

    // Update position
    this.pos.x += vx * damping;
    this.pos.y += vy * damping;
    this.pos.z += vz * damping + gravityDelta;
  }

  /**
   * Project 3D position to 2D screen coordinates
   * Higher Z = higher on screen (lower Y coordinate)
   *
   * DEPRECATED: Prefer using worldToScreen() from worldConstants.js
   * which applies proper pixelsPerUnit scaling.
   * This method assumes 1:1 mapping (pixelsPerUnit = 1).
   *
   * @returns {{x: number, y: number}}
   */
  toScreen() {
    // Simple projection: screenY = worldY - worldZ
    // Note: For proper scaling, use worldConstants.worldToScreen() instead
    return {
      x: this.pos.x,
      y: this.pos.y - this.pos.z, // Orthogonal projection
    };
  }
}

const MAX_SLACK_MULTIPLIER = 1.1;

/**
 * Rope3D - Complete rope simulation in world space
 * All positions and lengths are in abstract world units.
 * Use worldToScreen() from worldConstants.js to project to screen.
 */
export class Rope3D {
  /**
   * Create a new 3D rope
   * @param {number} segments - Number of rope segments
   * @param {{x: number, y: number, z: number}} startPos - Starting position in world space (avatar)
   * @param {{x: number, y: number, z: number}} endPos - Ending position in world space (magnet)
   */
  constructor(segments, startPos, endPos) {
    this.points = [];
    this.segmentLength = 10; // Desired rest length between points (world units)
    this.baseSegmentLength = 10; // Store the original for tension calculations
    this.tension = 0; // 0-100, affects slack amount

    // Calculate actual segment length based on distance
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dz = endPos.z - startPos.z;
    const totalDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.segmentLength = totalDistance / (segments - 1);
    this.baseSegmentLength = this.segmentLength; // Store for tension calculations

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
   * Set rope tension (0-100)
   * Higher tension = tighter rope with less slack
   * Lower tension = looser rope with more sag
   * @param {number} tension - Tension value 0-100
   */
  setTension(tension) {
    const oldTension = this.tension;
    this.tension = Math.max(0, Math.min(100, tension));

    // Calculate segment length based on tension
    // With ground collision, we need MORE slack for natural drape
    // At tension 0: use base length * 1.25 (25% extra slack - significant sag with ground contact)
    // At tension 50: use base length * 1.125 (12.5% extra slack - moderate drape)
    // At tension 100: use base length * 1.0 (taut, minimal sag)
    // Non-linear curve: more slack at low tension for natural catenary
    const tensionRatio = this.tension / 100;
    const slackMultiplier =
      1.0 + (1.0 - tensionRatio) * (MAX_SLACK_MULTIPLIER - 1.0); // 1.25 at 0%, 1.0 at 100%
    const oldLength = this.segmentLength;
    this.segmentLength = this.baseSegmentLength * slackMultiplier;

    // ENHANCED LOGGING - Always log for debugging
    const endpointDistance = this.getEndpointDistance();
    const actualLength = this.getTotalLength();
    const expectedLength =
      this.baseSegmentLength * (this.points.length - 1) * slackMultiplier;
    const slackAmount = actualLength - endpointDistance;
    const slackPercent = (slackAmount / endpointDistance) * 100;

    console.log(
      `[ROPE TENSION] ${oldTension.toFixed(0)}→${this.tension.toFixed(0)}% | Multiplier: ${slackMultiplier.toFixed(3)}x`,
    );
    console.log(
      `[ROPE LENGTH] Endpoint: ${endpointDistance.toFixed(1)} | Actual: ${actualLength.toFixed(1)} | Expected: ${expectedLength.toFixed(1)} | Segments: ${this.points.length}`,
    );
    console.log(
      `[ROPE SLACK] Amount: ${slackAmount.toFixed(1)} units (${slackPercent.toFixed(1)}% of straight line) | Segment: ${oldLength.toFixed(2)}→${this.segmentLength.toFixed(2)}`,
    );
  }

  /**
   * Update base segment length from a straight-line distance
   * Call this before setTension so segmentLength matches current distance.
   * @param {number} distance - Straight-line distance between endpoints
   */
  updateBaseSegmentLength(distance) {
    if (!Number.isFinite(distance) || distance <= 0) return;
    const minDistance = 0.001;
    const clampedDistance = Math.max(distance, minDistance);
    this.baseSegmentLength = clampedDistance / (this.points.length - 1);
  }

  /**
   * Get total actual length of rope (sum of all segment distances)
   */
  getTotalLength() {
    let total = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const dx = p2.pos.x - p1.pos.x;
      const dy = p2.pos.y - p1.pos.y;
      const dz = p2.pos.z - p1.pos.z;
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return total;
  }

  /**
   * Get direct distance between first and last point
   */
  getEndpointDistance() {
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    const dx = last.pos.x - first.pos.x;
    const dy = last.pos.y - first.pos.y;
    const dz = last.pos.z - first.pos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Update rope physics
   * @param {number} deltaTime - Time step in seconds
   * @param {{x: number, y: number, z: number}} avatarPos - Current avatar position in world space
   * @param {{x: number, y: number, z: number}} magnetPos - Current magnet position in world space
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

    // Calculate current endpoint distance for logging
    const dx = magnetPos.x - avatarPos.x;
    const dy = magnetPos.y - avatarPos.y;
    const dz = magnetPos.z - avatarPos.z;
    const endpointDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Physics update for unpinned points
    this.points.forEach((point) => point.update(deltaTime));

    // Clamp desired segment length to enforce max slack
    if (endpointDist > 0.001) {
      const maxLength = endpointDist * MAX_SLACK_MULTIPLIER;
      const maxSegmentLength = maxLength / (this.points.length - 1);
      if (this.segmentLength > maxSegmentLength) {
        this.segmentLength = maxSegmentLength;
      }
    }

    // Constraint solving (more iterations = stiffer rope)
    for (let iteration = 0; iteration < 8; iteration++) {
      this.applyConstraints();
      this.applyGroundCollision(); // Prevent rope from going below riverbed
    }

    // Enforce max length after constraints in case ground collision adds slack
    if (endpointDist > 0.001) {
      const maxLength = endpointDist * MAX_SLACK_MULTIPLIER;
      let actualLength = this.getTotalLength();

      if (actualLength > maxLength) {
        const overRatio = actualLength / maxLength;
        const extraIterations = Math.min(
          20,
          Math.ceil((overRatio - 1) * 20) + 4,
        );

        for (let iteration = 0; iteration < extraIterations; iteration++) {
          this.applyConstraints();
          this.applyGroundCollision();
        }

        actualLength = this.getTotalLength();
        if (actualLength > maxLength * 1.02) {
          // Reduce oscillations if we still exceed the cap
          for (let i = 1; i < this.points.length - 1; i++) {
            this.points[i].oldPos = { ...this.points[i].pos };
          }
        }
      }
    }

    // LOG: Rope state after physics (only every 10 frames to reduce spam)
    if (Math.random() < 0.1) {
      const actualLength = this.getTotalLength();
      const slackAmount = actualLength - endpointDist;
      const slackPercent = (slackAmount / endpointDist) * 100;

      console.log(
        `[ROPE STATE] Length: ${actualLength.toFixed(2)} | Endpoint: ${endpointDist.toFixed(2)} | dX:${dx.toFixed(2)} dY:${dy.toFixed(2)} dZ:${dz.toFixed(2)} | Slack: ${slackAmount.toFixed(2)} (${slackPercent.toFixed(1)}%) | BaseSegment: ${this.baseSegmentLength.toFixed(2)} | CurrentSegment: ${this.segmentLength.toFixed(2)} | Tension: ${this.tension}%`,
      );
    }

    // Clamp excessive velocities to prevent physics explosions
    const MAX_VELOCITY_PER_FRAME = 100; // world units per frame
    for (let i = 1; i < this.points.length - 1; i++) {
      // Skip pinned endpoints
      const point = this.points[i];
      const vx = point.pos.x - point.oldPos.x;
      const vy = point.pos.y - point.oldPos.y;
      const vz = point.pos.z - point.oldPos.z;
      const velocityMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (velocityMag > MAX_VELOCITY_PER_FRAME) {
        console.warn(
          `[ROPE PHYSICS] Clamping excessive velocity: ${velocityMag.toFixed(1)} -> ${MAX_VELOCITY_PER_FRAME} units/frame`,
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
   * Apply ground collision constraint
   * Prevents rope points from going below riverbed (Z=0)
   */
  applyGroundCollision() {
    const RIVERBED_Z = 0;
    const FRICTION = 0.5; // Friction coefficient when dragging on ground

    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];

      // Skip pinned endpoints (they're controlled by game state)
      if (point.pinned) continue;

      // Check if point is below ground
      if (point.pos.z < RIVERBED_Z) {
        // Clamp position to ground level
        point.pos.z = RIVERBED_Z;

        // Apply friction to horizontal velocity when in contact with ground
        // This prevents rope from sliding too much on the riverbed
        const vx = point.pos.x - point.oldPos.x;
        const vy = point.pos.y - point.oldPos.y;

        // Reduce horizontal velocity by friction factor
        point.oldPos.x = point.pos.x - vx * FRICTION;
        point.oldPos.y = point.pos.y - vy * FRICTION;

        // Zero out vertical velocity (no bouncing)
        point.oldPos.z = point.pos.z;
      }
    }
  }

  /**
   * Get screen coordinates for rendering
   *
   * DEPRECATED: Prefer using worldToScreen() from worldConstants.js
   * which applies proper pixelsPerUnit scaling.
   * This method assumes 1:1 mapping (pixelsPerUnit = 1).
   *
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
   * Recalculate segment length based on current endpoint positions
   * CRITICAL: Call this after rope creation when actual endpoint positions are known!
   * Fixes issue where rope was created with zero length (same start/end positions)
   * @param {number} slackFactor - How much longer the rope should be than straight-line distance (default: 1.15 for 15% slack)
   */
  recalculateSegmentLength(slackFactor = 1.15) {
    const startPoint = this.points[0];
    const endPoint = this.points[this.points.length - 1];

    const dx = endPoint.pos.x - startPoint.pos.x;
    const dy = endPoint.pos.y - startPoint.pos.y;
    const dz = endPoint.pos.z - startPoint.pos.z;
    const straightLineDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Only update if we have meaningful distance
    if (straightLineDistance > 10) {
      const totalRopeLength = straightLineDistance * slackFactor;
      this.segmentLength = totalRopeLength / (this.points.length - 1);

      console.log(
        `[ROPE] Recalculated: distance=${straightLineDistance.toFixed(0)} units, ropeLength=${totalRopeLength.toFixed(0)} units, segment=${this.segmentLength.toFixed(1)} units (${((slackFactor - 1) * 100).toFixed(0)}% slack)`,
      );
    }
  }

  /**
   * Update segment length dynamically (for stretching rope)
   * @param {number} newLength - New segment length
   */
  setSegmentLength(newLength) {
    this.segmentLength = newLength;
  }
}
