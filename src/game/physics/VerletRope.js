/**
 * Verlet Rope Physics
 * Lightweight rope simulation using Verlet integration
 * Perfect for pixel art - deterministic and lightweight
 */

export class VerletRope {
  constructor(startX, startY, numSegments = 15, segmentLength = 20) {
    this.numSegments = numSegments;
    this.segmentLength = segmentLength;
    this.gravity = 0.3; // Pixels per frame squared
    this.damping = 0.99; // Air resistance (0.99 = very little damping)

    // Initialize points (current and previous positions)
    this.points = [];
    this.prevPoints = [];

    for (let i = 0; i < numSegments; i++) {
      this.points.push({ x: startX, y: startY });
      this.prevPoints.push({ x: startX, y: startY });
    }

    // Pin positions (null = free, {x,y} = pinned)
    this.pinStart = { x: startX, y: startY }; // Magnet end (will move)
    this.pinEnd = { x: startX, y: startY }; // Player end (fixed)
  }

  /**
   * Update physics simulation (call once per frame)
   * @param {number} tension - Current tension (0-100), reduces gravity at high values
   */
  update(tension = 0) {
    // Calculate gravity direction perpendicular to rope line
    // Scaled by how horizontal the rope is (for top-down view perspective)
    let gravityX = 0;
    let gravityY = 0;

    if (this.pinStart && this.pinEnd) {
      // Vector from player to magnet
      const dx = this.pinStart.x - this.pinEnd.x;
      const dy = this.pinStart.y - this.pinEnd.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0.01) {
        // Calculate how "horizontal" the rope is (0 = vertical, 1 = horizontal)
        // More horizontal = more visible sag
        const horizontalness = Math.abs(dx) / length;

        // Scale gravity by horizontalness (vertical ropes have minimal visible sag)
        let effectiveGravity = this.gravity * horizontalness;

        // Reduce gravity at high tension (tight rope should be straight)
        // At 0% tension: full gravity sag
        // At 100% tension: no gravity (perfectly straight)
        const tensionRatio = tension / 100;
        effectiveGravity *= 1 - tensionRatio * 0.9; // Reduce up to 90% at max tension

        // Perpendicular vector (rotated 90 degrees)
        const perpX = -dy / length;
        const perpY = dx / length;

        // Choose the perpendicular direction that has a positive Y component (points down)
        if (perpY < 0) {
          gravityX = -perpX * effectiveGravity;
          gravityY = -perpY * effectiveGravity;
        } else {
          gravityX = perpX * effectiveGravity;
          gravityY = perpY * effectiveGravity;
        }
      }
    }

    // Verlet integration - calculate new positions based on velocity and gravity
    for (let i = 0; i < this.numSegments; i++) {
      const point = this.points[i];
      const prev = this.prevPoints[i];

      // Calculate velocity (current - previous position)
      const vx = (point.x - prev.x) * this.damping;
      const vy = (point.y - prev.y) * this.damping;

      // Store current position before updating
      prev.x = point.x;
      prev.y = point.y;

      // Update position: new = current + velocity + acceleration (perpendicular gravity)
      point.x += vx + gravityX;
      point.y += vy + gravityY;
    }

    // Apply constraints multiple times for stability (relaxation iterations)
    for (let iteration = 0; iteration < 10; iteration++) {
      this.applyConstraints();
    }
  }

  /**
   * Apply distance and pin constraints
   */
  applyConstraints() {
    // Pin first point to magnet position
    if (this.pinStart) {
      this.points[0].x = this.pinStart.x;
      this.points[0].y = this.pinStart.y;
    }

    // Pin last point to player position
    if (this.pinEnd) {
      const lastIdx = this.numSegments - 1;
      this.points[lastIdx].x = this.pinEnd.x;
      this.points[lastIdx].y = this.pinEnd.y;
    }

    // Constrain distances between adjacent points
    for (let i = 0; i < this.numSegments - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Skip if distance is too small (prevents division by zero)
      if (distance < 0.01) continue;

      // Calculate how much to move each point
      const difference = (this.segmentLength - distance) / distance;
      const offsetX = dx * difference * 0.5;
      const offsetY = dy * difference * 0.5;

      // Move points to maintain distance
      // If point is pinned, don't move it
      if (i !== 0 || !this.pinStart) {
        p1.x -= offsetX;
        p1.y -= offsetY;
      }

      if (i !== this.numSegments - 2 || !this.pinEnd) {
        p2.x += offsetX;
        p2.y += offsetY;
      }
    }
  }

  /**
   * Set magnet position (first point)
   */
  setMagnetPosition(x, y) {
    this.pinStart = { x, y };
  }

  /**
   * Set player position (last point)
   */
  setPlayerPosition(x, y) {
    this.pinEnd = { x, y };
  }

  /**
   * Release magnet (let it fall with gravity)
   */
  releaseMagnet() {
    this.pinStart = null;
  }

  /**
   * Get all points for rendering
   */
  getPoints() {
    return this.points;
  }

  /**
   * Apply initial velocity to magnet end (for throw effect)
   */
  applyThrowVelocity(vx, vy) {
    // Set velocity by manipulating previous position
    this.prevPoints[0].x = this.points[0].x - vx;
    this.prevPoints[0].y = this.points[0].y - vy;
  }

  /**
   * Increase damping (for underwater effect)
   */
  setDamping(damping) {
    this.damping = damping;
  }

  /**
   * Set gravity strength
   */
  setGravity(gravity) {
    this.gravity = gravity;
  }

  /**
   * Reset rope to straight line between two points
   */
  reset(startX, startY, endX, endY) {
    const dx = (endX - startX) / (this.numSegments - 1);
    const dy = (endY - startY) / (this.numSegments - 1);

    for (let i = 0; i < this.numSegments; i++) {
      const x = startX + dx * i;
      const y = startY + dy * i;
      this.points[i] = { x, y };
      this.prevPoints[i] = { x, y };
    }

    this.pinStart = { x: startX, y: startY };
    this.pinEnd = { x: endX, y: endY };
  }

  /**
   * Adjust segment length based on actual distance between endpoints
   * Keeps rope taut as item gets closer during drag
   */
  adjustLengthToDistance(startX, startY, endX, endY, tension = 0) {
    const actualDistance = Math.sqrt(
      (endX - startX) ** 2 + (endY - startY) ** 2,
    );

    // Calculate slack based on tension (0-100)
    // At 0% tension: rope is 1.5% longer (very minimal slack)
    // At 100% tension: rope matches actual distance (perfectly taut)
    const tensionRatio = tension / 100;
    const slackMultiplier = 1.015 - 0.015 * tensionRatio; // 1.015 at 0%, 1.0 at 100%

    const ropeLength = actualDistance * slackMultiplier;

    // Divide rope length by number of segments to get segment length
    this.segmentLength = Math.max(1, ropeLength / (this.numSegments - 1));

    // Debug logging
    if (!this.lastDistanceLog || Date.now() - this.lastDistanceLog > 500) {
      const totalRopeLength = this.segmentLength * (this.numSegments - 1);
      console.log(
        "[ROPE] Straight distance:",
        actualDistance.toFixed(1),
        "| Rope length:",
        totalRopeLength.toFixed(1),
        "| Slack:",
        ((totalRopeLength / actualDistance - 1) * 100).toFixed(1) + "%",
        "| Tension:",
        tension.toFixed(0) + "%",
      );
      this.lastDistanceLog = Date.now();
    }
  }

  /**
   * Clean up rope resources
   */
  destroy() {
    // Clear all point arrays
    this.points = [];
    this.prevPoints = [];
    this.pinStart = null;
    this.pinEnd = null;
  }
}
