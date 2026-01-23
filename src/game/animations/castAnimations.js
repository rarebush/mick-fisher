/**
 * Cast Animations
 * Visual feedback animations for casting phase
 */

import * as PIXI from "pixi.js";
import { Rope3D } from "../physics/RopePhysics3D.js";
import {
  getAvatarPosition,
  getMagnetPosition,
  calculateRopeSegments,
} from "../mechanics/heightMechanics.js";
import { createMagnetSprite } from "../graphics/placeholderSprites.js";

/**
 * Animate casting line from shore to target position with 3D rope physics
 * Shows magnet arc to water surface, splash, then sink to riverbed
 * Returns the graphics object to keep visible during drag
 * The 3D rope is stored in sessionStore for continuous use
 */
export function animateCastLine(
  app,
  targetX,
  targetY,
  gameStore,
  sessionStore,
) {
  return new Promise((resolve) => {
    if (!app) {
      resolve({ line: null, playerX: 0, playerY: 0, finalTension: 0 });
      return;
    }

    // Clean up any existing rope state before creating new one
    if (sessionStore) {
      const existingRope = sessionStore.getState().rope;
      if (existingRope) {
        console.log("[CAST] Cleaning up existing rope before new cast");
      }
      sessionStore.getState().setRope(null);
      sessionStore.getState().setPhase("idle");
      sessionStore.getState().setPhaseProgress(0);
      sessionStore.getState().setCastPosition(null, null);
    }

    // Starting point - center of walkway
    const startX = app.screen.width / 2;
    const startY = app.screen.height * 0.1; // Middle of walkway (10% from top)

    // ===========================================
    // SIMPLIFIED DEPTH MODEL
    // ===========================================
    // The riverbed is where user clicks (real ground, Z=0)
    // Water surface is WATER_DEPTH pixels above the riverbed visually
    // Screen Y = World Y - Z (orthogonal projection)
    //
    // So for an object at position (worldY, Z):
    //   screenY = worldY - Z
    //
    // Water surface: Z = WATER_DEPTH, screenY = riverbedY - WATER_DEPTH
    // Riverbed:      Z = 0,           screenY = riverbedY
    // ===========================================

    const riverbedStartY = app.screen.height * 0.4; // Riverbed begins at 40% from top
    const waterSurfaceScreenY = app.screen.height * 0.3; // Water surface at 30% from top
    const WATER_DEPTH = riverbedStartY - waterSurfaceScreenY; // Z units = pixel difference
    const AVATAR_HEIGHT = WATER_DEPTH * 3; // Fixed avatar Z height (~290px if depth is 97px)
    const waterSurfaceY = waterSurfaceScreenY; // Where water surface appears on screen

    // ===========================================
    // VISUAL DEBUG: Draw horizontal lines showing layer boundaries
    // ===========================================
    const debugLines = new PIXI.Graphics();
    debugLines.zIndex = 9999;
    app.stage.addChild(debugLines);

    // RED = where castAnimations thinks water surface is
    debugLines.moveTo(0, waterSurfaceY);
    debugLines.lineTo(app.screen.width, waterSurfaceY);
    debugLines.stroke({ width: 3, color: 0xff0000 });

    // GREEN = where castAnimations thinks riverbed starts
    debugLines.moveTo(0, riverbedStartY);
    debugLines.lineTo(app.screen.width, riverbedStartY);
    debugLines.stroke({ width: 3, color: 0x00ff00 });

    // BLUE = walkway/avatar start position
    debugLines.moveTo(0, startY);
    debugLines.lineTo(app.screen.width, startY);
    debugLines.stroke({ width: 3, color: 0x0000ff });

    // Add labels
    const style = { fontSize: 14, fill: 0xffffff };
    const labelWater = new PIXI.Text({
      text: `WATER SURFACE (${waterSurfaceY.toFixed(0)}px, 30%)`,
      style,
    });
    labelWater.x = 10;
    labelWater.y = waterSurfaceY - 20;
    debugLines.addChild(labelWater);

    const labelRiverbed = new PIXI.Text({
      text: `RIVERBED START (${riverbedStartY.toFixed(0)}px, 40%)`,
      style,
    });
    labelRiverbed.x = 10;
    labelRiverbed.y = riverbedStartY + 5;
    debugLines.addChild(labelRiverbed);

    const labelAvatar = new PIXI.Text({
      text: `AVATAR/START (${startY.toFixed(0)}px, 10%)`,
      style,
    });
    labelAvatar.x = 10;
    labelAvatar.y = startY + 5;
    debugLines.addChild(labelAvatar);

    const labelDepth = new PIXI.Text({
      text: `WATER_DEPTH = ${WATER_DEPTH.toFixed(0)}px`,
      style,
    });
    labelDepth.x = 10;
    labelDepth.y = (waterSurfaceY + riverbedStartY) / 2;
    debugLines.addChild(labelDepth);

    console.log(
      `[CAST DEBUG] Water: ${waterSurfaceY.toFixed(0)}px | Riverbed: ${riverbedStartY.toFixed(0)}px | Depth: ${WATER_DEPTH.toFixed(0)}px | Target: ${targetY.toFixed(0)}px`,
    );

    // Create fresh 3D rope with proper 3D positions
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance2D = Math.sqrt(dx * dx + dy * dy);
    const segments = calculateRopeSegments(distance2D);

    // Avatar 3D position (fixed at pier)
    const avatarWorldY = startY + AVATAR_HEIGHT;
    const avatarPos3D = { x: startX, y: avatarWorldY, z: AVATAR_HEIGHT };

    // Magnet final position - at riverbed
    const riverbedPos3D = { x: targetX, y: targetY, z: 0 };

    // Create rope from avatar to riverbed (final position)
    // This initializes points spread out along the full path
    const rope3D = new Rope3D(segments, avatarPos3D, riverbedPos3D);

    // Calculate the rope length when magnet is at RIVERBED (final resting position)
    // This is the TAUT length (no slack) - tension will add slack on top
    const riverbedDistance = Math.sqrt(
      (targetX - startX) ** 2 +
        (targetY - avatarWorldY) ** 2 +
        (0 - AVATAR_HEIGHT) ** 2,
    );
    const tautSegmentLength = riverbedDistance / (segments - 1);

    // Set rope length - this is the base taut length
    // Tension will multiply this by slack factor (1.0 to 1.1)
    rope3D.segmentLength = tautSegmentLength;
    rope3D.baseSegmentLength = tautSegmentLength;

    console.log(
      `[CAST] Rope: avatar(${startX.toFixed(0)}, ${avatarWorldY.toFixed(0)}, ${AVATAR_HEIGHT.toFixed(0)}) to riverbed(${targetX.toFixed(0)}, ${targetY.toFixed(0)}, 0) = ${riverbedDistance.toFixed(0)}px (taut)`,
    );

    console.log(
      `[CAST] Created fresh Rope3D with ${segments} segments for cast to (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`,
    );

    // Store in sessionStore immediately
    if (sessionStore) {
      sessionStore.getState().setRope(rope3D);
      sessionStore.getState().setPhase("cast");
      sessionStore.getState().setPhaseProgress(0);
    }

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    app.stage.addChild(line);

    // Create magnet sprite immediately so it's visible during throw
    const magnetSprite = createMagnetSprite();
    magnetSprite.scale.set(2);
    // Graphics don't have anchor, so we'll offset position when rendering
    app.stage.addChild(magnetSprite);

    // Calculate water surface hit position
    // ===========================================
    // CORRECTED MODEL:
    // - User clicks at targetY (riverbed, Z=0) - this is both world Y and screen Y
    // - Magnet's WORLD Y stays at targetY throughout the entire cast & sink
    // - Only Z changes: starts high (avatar), hits water (Z=WATER_DEPTH), sinks to riverbed (Z=0)
    // - Screen Y = worldY - Z (orthographic projection)
    // ===========================================
    const waterHitX = targetX;
    const waterHitY = targetY; // World Y is always the click position!
    const waterHitScreenY = targetY - WATER_DEPTH; // Screen position when Z=WATER_DEPTH

    // ===========================================
    // VISUAL DEBUG: Show key magnet positions
    // ===========================================
    // Avatar has a FIXED height - it doesn't change based on where you click
    // The pier/walkway is at a fixed Z above the water
    // AVATAR_HEIGHT = WATER_DEPTH * 3 (~290px if depth is 97px)
    const avatarScreenY = targetY - AVATAR_HEIGHT; // Screen Y at avatar's Z height

    // GREEN circle = avatar HEIGHT projected onto the target column
    // Shows where Z=AVATAR_HEIGHT would appear on screen at the target's X position
    const debugMarkerAvatar = new PIXI.Graphics();
    debugMarkerAvatar.circle(0, 0, 12).stroke({ width: 3, color: 0x00ff00 });
    debugMarkerAvatar.circle(0, 0, 3).fill({ color: 0x00ff00 });
    debugMarkerAvatar.x = targetX; // Same column as target!
    debugMarkerAvatar.y = avatarScreenY; // Screen Y at avatar's Z height
    debugMarkerAvatar.zIndex = 9998;
    app.stage.addChild(debugMarkerAvatar);

    // YELLOW circle = where magnet appears on SCREEN when hitting water surface
    const debugMarkerWaterHit = new PIXI.Graphics();
    debugMarkerWaterHit.circle(0, 0, 15).stroke({ width: 3, color: 0xffff00 });
    debugMarkerWaterHit.circle(0, 0, 3).fill({ color: 0xffff00 });
    debugMarkerWaterHit.x = waterHitX;
    debugMarkerWaterHit.y = waterHitScreenY; // Screen Y when at water surface
    debugMarkerWaterHit.zIndex = 9998;
    app.stage.addChild(debugMarkerWaterHit);

    // MAGENTA circle = target riverbed position (where click was, Z=0)
    const debugMarkerTarget = new PIXI.Graphics();
    debugMarkerTarget.circle(0, 0, 10).stroke({ width: 3, color: 0xff00ff });
    debugMarkerTarget.circle(0, 0, 3).fill({ color: 0xff00ff });
    debugMarkerTarget.x = targetX;
    debugMarkerTarget.y = targetY;
    debugMarkerTarget.zIndex = 9998;
    app.stage.addChild(debugMarkerTarget);

    console.log(
      `[CAST DEBUG] AVATAR_HEIGHT=${AVATAR_HEIGHT.toFixed(0)}, WATER_DEPTH=${WATER_DEPTH.toFixed(0)}, targetY=${targetY.toFixed(0)}`,
    );

    const debugLabelStyle = { fontSize: 12, fill: 0xffffff };

    const labelGreen = new PIXI.Text({
      text: `AVATAR (Z=${AVATAR_HEIGHT.toFixed(0)})`,
      style: debugLabelStyle,
    });
    labelGreen.x = startX + 20;
    labelGreen.y = avatarScreenY - 10;
    debugMarkerAvatar.addChild(labelGreen);

    const labelYellow = new PIXI.Text({
      text: `WATER SURFACE (Z=${WATER_DEPTH.toFixed(0)})`,
      style: debugLabelStyle,
    });
    labelYellow.x = waterHitX + 20;
    labelYellow.y = waterHitScreenY - 10;
    debugMarkerWaterHit.addChild(labelYellow);

    const labelMagenta = new PIXI.Text({
      text: `RIVERBED (Z=0)`,
      style: debugLabelStyle,
    });
    labelMagenta.x = targetX + 20;
    labelMagenta.y = targetY - 10;
    debugMarkerTarget.addChild(labelMagenta);

    // Calculate throw arc parameters
    const distance = Math.sqrt(
      (waterHitX - startX) ** 2 + (waterHitY - startY) ** 2,
    );
    const throwAngle = Math.atan2(waterHitY - startY, waterHitX - startX);

    // Animation parameters - throw duration scales with distance
    // Faster, snappier throws that feel more like real physics
    // Short throw (~200px): ~500ms, Long throw (~600px): ~900ms
    const throwDuration = Math.max(400, 350 + distance * 0.9);

    // Sink duration scales with water depth (distance from water surface to riverbed)
    const waterDepth = targetY - waterHitY;
    const sinkDuration = Math.max(400, 300 + waterDepth * 2); // 400-800ms based on depth

    const settleDuration = 100; // Brief settle for rope physics (was 400ms - too long)
    const startTime = performance.now();

    let phase = "throwing"; // 'throwing' -> 'sinking' -> 'settling' -> 'done'
    let phaseStartTime = 0;
    let magnetX = startX;
    let magnetY = startY;
    let magnetZ = WATER_DEPTH + 50; // Start at avatar height (above water surface)

    // Track previous position for velocity calculation
    let prevMagnetY = magnetY;
    let prevMagnetZ = magnetZ;
    let prevTime = startTime;

    // Sinking physics state (set when entering water)
    let sinkVelocityY = 0;
    let sinkVelocityZ = 0;

    // Tension animation: 40 (throw) -> 25 (surface) -> 15 (sinking) -> 10 (settled)
    let currentTension = 40;

    const deltaTime = 1 / 60; // Approximate frame time

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
        if (magnetSprite.parent) {
          magnetSprite.parent.removeChild(magnetSprite);
        }
        magnetSprite.destroy();
        resolve({
          line: null,
          playerX: startX,
          playerY: startY,
          finalTension: 0,
        });
        return;
      }

      const elapsed = currentTime - startTime;

      if (phase === "throwing") {
        // PHASE 1: Throw magnet in arc from player to water surface
        const progress = Math.min(elapsed / throwDuration, 1);

        // Animate tension: 95 -> 15 as rope extends (high tension during throw, settling as it lands)
        currentTension = 95 - 80 * progress; // 95 at start, 15 at water surface
        currentTension = 95 - 80 * progress; // 95 at start, 15 at water surface
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // PROJECTILE MOTION for natural throw feel
        // The throw goes from avatar (screen position) to water surface (screen position)
        // Water surface screen position = targetY - WATER_DEPTH

        const throwEndScreenY = waterHitScreenY; // Where magnet appears when hitting water

        // Horizontal: mostly constant velocity with slight ease-out (air resistance)
        const horizontalEase = 1 - Math.pow(1 - progress, 1.5); // Gentle ease-out
        magnetX = startX + (waterHitX - startX) * horizontalEase;

        // For Y during throw, interpolate screen position from avatar to water surface
        const screenY = startY + (throwEndScreenY - startY) * horizontalEase;

        // Vertical (Z): True parabolic arc using projectile motion
        // Arc peaks around 30-40% through the throw (asymmetric - faster fall)
        const peakTime = 0.35; // Where in the throw the arc peaks
        const arcHeight = Math.min(100, 30 + distance * 0.12); // Height scales with distance

        // Parabolic arc: z = -4h(t - peak)² + h, normalized so it's 0 at start and end
        // This creates steeper descent (gravity effect) than ascent
        const normalizedT = progress;
        const parabola =
          -4 * arcHeight * Math.pow(normalizedT - peakTime, 2) +
          arcHeight * (1 - Math.pow(peakTime * 2, 2)); // Offset to start at 0

        // Simpler approach: use a skewed sine wave that peaks earlier
        // sin(π * t^0.7) peaks around t=0.35 instead of t=0.5
        const skewedProgress = Math.pow(progress, 0.7);
        const arcOffset = Math.sin(skewedProgress * Math.PI) * arcHeight;

        // Apply arc offset to screen Y (negative because arc goes UP, which is lower screen Y)
        const finalScreenY = screenY - arcOffset;

        // Convert screen position back to world coordinates for physics
        // Avatar is at fixed Z = AVATAR_HEIGHT
        // Magnet starts at avatar (Z = AVATAR_HEIGHT), ends at water surface (Z = WATER_DEPTH)
        magnetZ = AVATAR_HEIGHT + (WATER_DEPTH - AVATAR_HEIGHT) * progress; // Interpolate from AVATAR_HEIGHT to WATER_DEPTH
        magnetY = finalScreenY + magnetZ; // worldY = screenY + Z

        // Rope length is fixed (set at cast start) - tension controls slack
        rope3D.setTension(currentTension);

        // Update 3D rope physics
        const avatarWorldY = startY + AVATAR_HEIGHT;
        const avatarPos3D = { x: startX, y: avatarWorldY, z: AVATAR_HEIGHT };
        const magnetPos3D = { x: magnetX, y: magnetY, z: magnetZ };
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render the rope
        render3DRope(line, rope3D, waterSurfaceScreenY);

        // Update magnet sprite position (use finalScreenY directly)
        // Offset by half width/height to center (Graphics has no anchor)
        magnetSprite.x = magnetX - magnetSprite.width / 2;
        magnetSprite.y = finalScreenY - magnetSprite.height / 2;

        // Track velocity for water entry
        const dt = (currentTime - prevTime) / 1000; // seconds
        if (dt > 0) {
          sinkVelocityY = (magnetY - prevMagnetY) / dt;
          sinkVelocityZ = (magnetZ - prevMagnetZ) / dt;
        }
        prevMagnetY = magnetY;
        prevMagnetZ = magnetZ;
        prevTime = currentTime;

        if (progress >= 1) {
          // Magnet hit water surface - transition to sinking
          // Log actual vs expected distance for debugging
          const actualDist = rope3D.getEndpointDistance();
          const ropeLen = rope3D.getTotalLength();
          console.log(`[CAST] Throw complete - Endpoint: ${actualDist.toFixed(0)}px, Rope: ${ropeLen.toFixed(0)}px, Tension: ${currentTension.toFixed(0)}`);
          
          phase = "sinking";
          phaseStartTime = currentTime;
          magnetX = waterHitX;
          magnetY = targetY; // World Y = click position (constant during sink)
          magnetZ = WATER_DEPTH; // At water surface

          // SPLASH EFFECT: Ensure entry velocity is HIGHER than terminal velocity
          // so the magnet visibly decelerates when hitting water (the "plop" effect)
          const splashEntryZ = -300; // Fast sinking entry (terminal = -80)
          sinkVelocityZ = Math.min(sinkVelocityZ, splashEntryZ); // More negative = faster

          // Log entry velocity for debugging
          console.log(
            `[CAST] Magnet hit water at screenY=${(targetY - WATER_DEPTH).toFixed(0)} | Entry Z velocity: ${sinkVelocityZ.toFixed(0)} px/s`,
          );
        }
      }

      if (phase === "sinking") {
        // PHASE 2: Sink from water surface to riverbed
        // With the corrected model, worldY stays constant at targetY
        // Only Z changes from WATER_DEPTH to 0
        const dt = Math.min((currentTime - prevTime) / 1000, 0.05); // Cap at 50ms to prevent explosions

        // Debug: log velocities
        console.log(
          `[SINK] dt=${(dt * 1000).toFixed(1)}ms | velZ=${sinkVelocityZ.toFixed(0)} | posZ=${magnetZ.toFixed(0)} | screenY=${(magnetY - magnetZ).toFixed(0)}`,
        );

        // Water drag - aggressively slows incoming velocity
        // Higher = faster deceleration to terminal velocity
        const dragCoeff = 40;

        // Fixed terminal velocity for Z (sinking speed)
        const terminalVelocityZ = -80; // pixels/sec falling (negative Z = down in height)

        // Apply drag: velocity approaches terminal velocity
        sinkVelocityZ += (terminalVelocityZ - sinkVelocityZ) * dragCoeff * dt;

        // Update Z position using velocity (Y stays constant at targetY)
        magnetZ += sinkVelocityZ * dt;
        magnetX = waterHitX; // Stay at same X
        magnetY = targetY; // World Y is always target

        // Clamp Z to riverbed (Z=0)
        magnetZ = Math.max(magnetZ, 0);

        prevTime = currentTime;

        // Calculate progress for tension (Z goes from WATER_DEPTH to 0)
        const sinkProgress = Math.min((WATER_DEPTH - magnetZ) / WATER_DEPTH, 1);

        // Animate tension: 25 -> 15 as magnet sinks
        currentTension = 25 - 10 * sinkProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update 3D rope physics - pass 3D coordinates directly
        // Avatar world position: screenY = startY, so worldY = startY + AVATAR_HEIGHT
        const avatarWorldY = startY + AVATAR_HEIGHT;
        const avatarPos3D = { x: startX, y: avatarWorldY, z: AVATAR_HEIGHT };
        const magnetPos3D = { x: magnetX, y: magnetY, z: magnetZ };
        rope3D.setTension(currentTension); // Slack responds to tension
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render rope with underwater opacity
        render3DRope(line, rope3D, waterSurfaceY);

        // Update magnet sprite position (screen Y = worldY - Z = targetY - Z)
        magnetSprite.x = magnetX - magnetSprite.width / 2;
        magnetSprite.y = targetY - magnetZ - magnetSprite.height / 2;

        if (magnetZ <= 0) {
          // Magnet reached riverbed!
          phase = "settling";
          phaseStartTime = currentTime;
          magnetX = targetX;
          magnetY = targetY;
          magnetZ = 0; // At riverbed

          console.log(
            `[CAST] Magnet reached riverbed at (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`,
          );
          // Fall through to settling phase immediately (no frame delay)
        }
      }

      if (phase === "settling") {
        // PHASE 3: Rope settles at riverbed
        const settleElapsed = currentTime - phaseStartTime;
        const settleProgress = Math.min(settleElapsed / settleDuration, 1);

        // Animate tension: 15 -> 10 as rope settles
        currentTension = 15 - 5 * settleProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update 3D rope physics - magnet at riverbed (Z=0)
        // Avatar world position: screenY = startY, so worldY = startY + AVATAR_HEIGHT
        const avatarWorldY = startY + AVATAR_HEIGHT;
        const avatarPos3D = { x: startX, y: avatarWorldY, z: AVATAR_HEIGHT };
        const magnetPos3D = { x: targetX, y: targetY, z: 0 };
        rope3D.setTension(currentTension); // Slack responds to tension
        rope3D.update(deltaTime, avatarPos3D, magnetPos3D);

        // Render rope
        render3DRope(line, rope3D, waterSurfaceY);

        // Update magnet sprite position (screen Y = worldY - Z)
        magnetSprite.x = magnetX - magnetSprite.width / 2;
        magnetSprite.y = magnetY - magnetZ - magnetSprite.height / 2;

        if (settleProgress >= 1) {
          // Done - clean up cast magnet sprite (drag phase has its own)
          if (magnetSprite.parent) {
            app.stage.removeChild(magnetSprite);
          }
          magnetSprite.destroy();

          console.log(
            `[CAST] Animation complete, tension: ${currentTension.toFixed(1)}`,
          );

          // Update phase progress in sessionStore
          if (sessionStore) {
            sessionStore.getState().setPhaseProgress(1.0);
          }

          resolve({
            line,
            playerX: startX,
            playerY: startY,
            finalTension: currentTension,
          });
          return; // Don't call requestAnimationFrame again
        }
      }

      // Only request next frame if we haven't completed
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Render 3D rope with underwater opacity
 * @param {PIXI.Graphics} line - Graphics object to draw rope on
 * @param {Rope3D} rope3D - 3D rope physics object
 * @param {number} waterSurfaceY - Y coordinate of water surface
 */
function render3DRope(line, rope3D, waterSurfaceY) {
  if (!line || !rope3D || line.destroyed) {
    return;
  }

  // Get screen-projected points from 3D rope
  const screenPoints = rope3D.getScreenPoints();

  console.log(
    `[RENDER] Rendering ${screenPoints.length} rope points, first: (${screenPoints[0]?.x.toFixed(1)}, ${screenPoints[0]?.y.toFixed(1)}), last: (${screenPoints[screenPoints.length - 1]?.x.toFixed(1)}, ${screenPoints[screenPoints.length - 1]?.y.toFixed(1)})`,
  );

  line.clear();

  if (screenPoints.length < 2) {
    console.warn("[RENDER] Not enough points to render rope");
    return;
  }

  // Draw rope as brown line
  line.setStrokeStyle({ width: 3, color: 0x8b4513 });

  // Start at first point
  line.moveTo(screenPoints[0].x, screenPoints[0].y);

  // Draw rest of rope
  for (let i = 1; i < screenPoints.length; i++) {
    const point = screenPoints[i];

    // Fade underwater portions
    if (point.y > waterSurfaceY) {
      line.setStrokeStyle({ width: 3, color: 0x8b4513, alpha: 0.6 }); // More transparent underwater
    }

    line.lineTo(point.x, point.y);
  }

  line.stroke();
}

/**
 * Animate rope reeling in after drag failure
 * Shows jerk back then gradual reel-in with 3D rope physics
 * Returns a promise that resolves when animation completes
 */
export function animateReelIn(
  app,
  rope,
  line,
  playerX,
  playerY,
  startX,
  startY,
  sessionStore,
) {
  return new Promise((resolve) => {
    if (!app || !line) {
      resolve();
      return;
    }

    const rope3D = sessionStore?.getState().rope;
    if (!rope3D) {
      // No 3D rope, just clean up
      if (line.parent) {
        line.parent.removeChild(line);
      }
      line.destroy();
      resolve();
      return;
    }

    // Reset rope physics state to prevent velocity carryover from drag
    if (rope3D.resetPhysicsState) {
      rope3D.resetPhysicsState();
      console.log("[REEL-IN] Reset rope physics state");
    }

    const jerkDuration = 100; // Quick jerk back
    const reelDuration = 600; // Slower gradual reel
    const totalDuration = jerkDuration + reelDuration;
    const startTime = performance.now();

    // Get initial magnet position from cast position
    const castPos = sessionStore.getState().castPosition;
    const initialMagnetX = castPos?.x || startX;
    const initialMagnetY = castPos?.y || startY;

    const deltaTime = 1 / 60; // Approximate frame time

    // Water surface for rendering
    const waterSurfaceY = app.screen.height * 0.3;

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();
        resolve();
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      let magnetX, magnetY;

      if (elapsed < jerkDuration) {
        // PHASE 1: Quick jerk back towards player (10-20% of distance)
        const jerkProgress = elapsed / jerkDuration;
        const jerkEase = Math.sin(jerkProgress * Math.PI); // Smooth bump
        const jerkAmount = 0.15; // Jerk back 15% of distance

        magnetX =
          initialMagnetX + (playerX - initialMagnetX) * jerkAmount * jerkEase;
        magnetY =
          initialMagnetY + (playerY - initialMagnetY) * jerkAmount * jerkEase;
      } else {
        // PHASE 2: Gradual reel in from jerked position to player
        const reelProgress = (elapsed - jerkDuration) / reelDuration;
        const reelEase = 1 - Math.pow(1 - reelProgress, 3); // Ease-out

        const jerkEndX = initialMagnetX + (playerX - initialMagnetX) * 0.15;
        const jerkEndY = initialMagnetY + (playerY - initialMagnetY) * 0.15;

        magnetX = jerkEndX + (playerX - jerkEndX) * reelEase;
        magnetY = jerkEndY + (playerY - jerkEndY) * reelEase;
      }

      // Update 3D rope physics
      const avatarPos = getAvatarPosition(playerX, playerY);
      const magnetPos = getMagnetPosition(magnetX, magnetY, "drag", 0); // At surface during reel
      rope3D.setTension(80); // High tension during reel (taut rope)
      rope3D.update(deltaTime, avatarPos, magnetPos);

      // Render rope
      render3DRope(line, rope3D, waterSurfaceY);

      if (progress >= 1) {
        // Reel complete - clean up rope and graphics
        if (sessionStore) {
          sessionStore.getState().setRope(null);
          sessionStore.getState().setPhase("idle");
          sessionStore.getState().setPhaseProgress(0);
          sessionStore.getState().setCastPosition(null, null);
        }

        if (line.parent) {
          line.parent.removeChild(line);
        }
        line.destroy();

        console.log("[REEL-IN] Complete, rope cleaned up");
        resolve();
      } else {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Render rope with water surface effects
 * Exported for use during drag phase
 */
export function renderRope(graphics, rope, waterSurfaceY) {
  // Guard against destroyed or null graphics during async cleanup
  if (!graphics || graphics.destroyed) return;

  graphics.clear();

  const points = rope.getPoints();
  if (points.length < 2) return;

  // Draw single continuous rope - simple and consistent
  graphics.moveTo(Math.round(points[0].x), Math.round(points[0].y));

  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(Math.round(points[i].x), Math.round(points[i].y));
  }

  graphics.stroke({ width: 2, color: 0xffffff, alpha: 1.0 });

  // Draw dots for pixel art look
  for (let i = 0; i < points.length; i += 2) {
    const p = points[i];
    graphics
      .circle(Math.round(p.x), Math.round(p.y), 2)
      .fill({ color: 0xffffff, alpha: 1.0 });
  }
}

/**
 * Create ripple effect at position
 * Shows splash when magnet hits water surface
 */
export function createRipple(app, x, y) {
  if (!app) return;

  const ripple = new PIXI.Graphics()
    .circle(0, 0, 10)
    .stroke({ width: 2, color: 0xffffff });
  ripple.x = x;
  ripple.y = y;
  app.stage.addChild(ripple);

  let scale = 1;
  let alpha = 1;

  const animate = () => {
    if (!app) return;

    scale += 0.15;
    alpha -= 0.08;
    ripple.scale.set(scale);
    ripple.alpha = alpha;

    if (alpha <= 0) {
      app.stage.removeChild(ripple);
      ripple.destroy();
    } else {
      requestAnimationFrame(animate);
    }
  };
  animate();
}

/**
 * Create bubbles rising from position to water surface
 * Used when magnet sinks through water
 */
export function createBubbles(app, x, y, duration = 500) {
  if (!app) return;

  const waterSurfaceY = app.screen.height * 0.3; // Water surface
  const bubbleCount = 8;
  const bubbles = [];

  for (let i = 0; i < bubbleCount; i++) {
    // Stagger bubble creation
    setTimeout(
      () => {
        if (!app) return;

        const bubble = new PIXI.Graphics()
          .circle(0, 0, 2 + Math.random() * 3)
          .fill(0xadd8e6);

        // Random horizontal offset from center
        bubble.x = x + (Math.random() - 0.5) * 30;
        bubble.y = y;
        bubble.alpha = 0.6 + Math.random() * 0.4;

        app.stage.addChild(bubble);
        bubbles.push(bubble);

        // Animate bubble rising to water surface
        const riseSpeed = 1 + Math.random() * 2;
        const drift = (Math.random() - 0.5) * 0.5;
        let bubbleAlpha = bubble.alpha;

        const animate = () => {
          if (!app) {
            if (bubble.parent) {
              bubble.parent.removeChild(bubble);
            }
            bubble.destroy();
            return;
          }

          bubble.y -= riseSpeed;
          bubble.x += drift;
          bubbleAlpha -= 0.015;
          bubble.alpha = bubbleAlpha;

          // Remove when faded or reached water surface
          if (bubbleAlpha <= 0 || bubble.y < waterSurfaceY) {
            if (bubble.parent) {
              bubble.parent.removeChild(bubble);
            }
            bubble.destroy();
          } else {
            requestAnimationFrame(animate);
          }
        };
        animate();
      },
      i * (duration / bubbleCount),
    );
  }
}

/**
 * Start periodic bubble animation during drag
 */
export function startDragBubbles(app, getItemPosition, isStillDragging) {
  // Create bubbles every 800ms while dragging
  const interval = setInterval(() => {
    if (!app || !isStillDragging()) {
      clearInterval(interval);
      return;
    }

    // Calculate current item position
    const itemPos = getItemPosition();
    if (itemPos) {
      // Create a small burst of bubbles (fewer than initial cast)
      createBubbles(app, itemPos.x, itemPos.y, 300);
    }
  }, 800);

  return interval;
}
