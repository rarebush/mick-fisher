/**
 * Cast Animations
 * Visual feedback animations for casting phase
 *
 * All positions are calculated in WORLD SPACE first, then projected to screen space.
 * World coordinates: {x: horizontal, y: depth, z: height}
 * Projection: screenX = worldX, screenY = (worldY - worldZ) * pixelsPerUnit + offset
 */

import * as PIXI from "pixi.js";
import { Rope3D } from "../physics/RopePhysics3D.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  worldToScreen,
  screenToWorld,
  lerp,
} from "../mechanics/worldConstants.js";
import { calculateRopeSegments } from "../mechanics/heightMechanics.js";
import { createMagnetSprite } from "../graphics/placeholderSprites.js";
import useMagnetStore from "../state/magnetStore.js";

/**
 * Animate casting line from shore to target position with 3D rope physics
 * Shows magnet arc to water surface, splash, then sink to riverbed
 * Returns the graphics object to keep visible during drag
 * The 3D rope is stored in sessionStore for continuous use
 *
 * ALL POSITIONS ARE IN WORLD SPACE:
 * - World X: horizontal position (same as screen X)
 * - World Y: depth into the scene (0 = avatar, increases toward back)
 * - World Z: height (0 = riverbed, increases upward)
 *
 * Projection to screen: screenY = (worldY - worldZ) * pixelsPerUnit + offset
 */
export function animateCastLine(
  app,
  targetScreenX,
  targetScreenY,
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

    // ===========================================
    // CREATE VIEWPORT - maps world units to screen pixels
    // ===========================================
    const viewport = createViewport(app.screen.width, app.screen.height);

    console.log(
      `[CAST] Viewport: ${viewport.pixelsPerUnit.toFixed(1)} px/unit, offset: ${viewport.screenYOffset.toFixed(1)}`,
    );
    console.log(
      `[CAST] World bounds: X [${viewport.worldXMin.toFixed(2)}, ${viewport.worldXMax.toFixed(2)}] (${viewport.worldXWidth.toFixed(2)} units), Y [${viewport.worldYMin}, ${viewport.worldYMax}], Z [${viewport.worldZMin}, ${viewport.worldZMax}]`,
    );

    // ===========================================
    // AVATAR POSITION (fixed in world space)
    // ===========================================
    const avatarWorld = {
      x: 0, // Avatar at world center
      y: WORLD_Y.AVATAR, // Front of scene (Y=0)
      z: WORLD_Z.AVATAR_HAND, // Hand height (Z=4.2)
    };
    const avatarScreen = worldToScreen(avatarWorld, viewport);

    // ===========================================
    // TARGET POSITION (where user clicked = riverbed)
    // Convert screen click to world coordinates on riverbed (Z=0)
    // ===========================================
    const targetWorld = screenToWorld(
      targetScreenX,
      targetScreenY,
      WORLD_Z.RIVERBED,
      viewport,
    );

    console.log(
      `[CAST] Click at screen (${targetScreenX.toFixed(0)}, ${targetScreenY.toFixed(0)}) -> world (${targetWorld.x.toFixed(2)}, ${targetWorld.y.toFixed(2)}, ${targetWorld.z})`,
    );

    // ===========================================
    // WATER SURFACE POSITION (same world Y as target, but at water Z)
    // ===========================================
    const waterHitWorld = {
      x: targetWorld.x,
      y: targetWorld.y, // Same depth as final target
      z: WORLD_Z.WATER_SURFACE, // At water surface height
    };
    const waterHitScreen = worldToScreen(waterHitWorld, viewport);

    // ===========================================
    // VISUAL DEBUG: Draw horizontal lines showing layer boundaries
    // ===========================================
    const debugLines = new PIXI.Graphics();
    debugLines.zIndex = 9999;
    app.stage.addChild(debugLines);

    // Draw layer boundaries using world-to-screen projection
    const waterNearScreen = worldToScreen(
      { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
      viewport,
    );
    const riverbedFarScreen = worldToScreen(
      { x: 0, y: WORLD_Y.RIVERBED_FAR, z: WORLD_Z.RIVERBED },
      viewport,
    );

    // RED = water surface (near edge)
    debugLines.moveTo(0, waterNearScreen.y);
    debugLines.lineTo(app.screen.width, waterNearScreen.y);
    debugLines.stroke({ width: 2, color: 0xff0000 });

    // GREEN = riverbed far edge
    debugLines.moveTo(0, riverbedFarScreen.y);
    debugLines.lineTo(app.screen.width, riverbedFarScreen.y);
    debugLines.stroke({ width: 2, color: 0x00ff00 });

    // BLUE = avatar position
    debugLines.moveTo(0, avatarScreen.y);
    debugLines.lineTo(app.screen.width, avatarScreen.y);
    debugLines.stroke({ width: 2, color: 0x0000ff });

    // YELLOW = water hit position for this cast
    debugLines.circle(waterHitScreen.x, waterHitScreen.y, 8);
    debugLines.stroke({ width: 2, color: 0xffff00 });

    // MAGENTA = target riverbed position
    debugLines.circle(targetScreenX, targetScreenY, 10);
    debugLines.stroke({ width: 2, color: 0xff00ff });

    // Add labels
    const style = { fontSize: 12, fill: 0xffffff };
    const labelWater = new PIXI.Text({
      text: `Water (Z=${WORLD_Z.WATER_SURFACE})`,
      style,
    });
    labelWater.x = 10;
    labelWater.y = waterNearScreen.y - 18;
    debugLines.addChild(labelWater);

    const labelAvatar = new PIXI.Text({
      text: `Avatar (Z=${WORLD_Z.AVATAR_HAND})`,
      style,
    });
    labelAvatar.x = 10;
    labelAvatar.y = avatarScreen.y + 2;
    debugLines.addChild(labelAvatar);

    const labelViewport = new PIXI.Text({
      text: `Viewport: ${viewport.pixelsPerUnit.toFixed(1)} px/unit`,
      style,
    });
    labelViewport.x = 10;
    labelViewport.y = 10;
    debugLines.addChild(labelViewport);

    console.log(
      `[CAST DEBUG] Avatar screen: ${avatarScreen.y.toFixed(0)}px | Water hit screen: ${waterHitScreen.y.toFixed(0)}px | Target: ${targetScreenY.toFixed(0)}px`,
    );

    // ===========================================
    // CREATE 3D ROPE
    // ===========================================
    // Calculate 3D distance from avatar to target for segment count
    const dx = targetWorld.x - avatarWorld.x;
    const dy = targetWorld.y - avatarWorld.y;
    const dz = targetWorld.z - avatarWorld.z;
    const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // For throw timing, use horizontal distance (XY plane) - more visually relevant
    const horizontalDistance = Math.sqrt(dx * dx + dy * dy);

    const segments = calculateRopeSegments(distance3D, viewport);

    // Create rope from avatar to target (final position) with correct length
    const rope3D = new Rope3D(segments, avatarWorld, targetWorld);

    // Set base segment length for the full throw distance
    const tautSegmentLength = distance3D / (segments - 1);
    rope3D.segmentLength = tautSegmentLength;
    rope3D.baseSegmentLength = tautSegmentLength;

    console.log(
      `[CAST] Rope: ${segments} segments, distance: ${distance3D.toFixed(2)} units, segment: ${tautSegmentLength.toFixed(2)}`,
    );
    console.log(
      `[CAST] Horizontal distance: ${horizontalDistance.toFixed(2)} units, throw duration will be: ${Math.max(300, 250 + horizontalDistance * 0.5).toFixed(0)}ms`,
    );

    // Store in sessionStore immediately
    if (sessionStore) {
      sessionStore.getState().setRope(rope3D);
      sessionStore.getState().setPhase("throwing");
      sessionStore.getState().setPhaseProgress(0);
    }

    // Spawn magnet in magnet store
    const magnetStore = useMagnetStore.getState();
    magnetStore.spawnMagnet(avatarWorld.x);

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    app.stage.addChild(line);

    // Create magnet sprite
    const magnetSprite = createMagnetSprite();
    magnetSprite.scale.set(2);
    app.stage.addChild(magnetSprite);

    // Create debug text for magnet world coordinates
    const magnetDebugText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 12,
        fill: 0xffff00,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    magnetDebugText.zIndex = 10000;
    app.stage.addChild(magnetDebugText);

    // ===========================================
    // ANIMATION PARAMETERS
    // ===========================================
    // Throw timing: slow, deliberate lob for realistic fishing cast
    // Base 800ms + 1.5ms per world unit of horizontal distance
    // Example: 100 units = 950ms, 200 units = 1100ms, 400 units = 1400ms
    const throwDuration = Math.max(800, 800 + horizontalDistance * 1.5);
    const settleDuration = 200;
    const startTime = performance.now();

    let phase = "throwing"; // 'throwing' -> 'sinking' -> 'settling' -> 'done'
    let phaseStartTime = 0;

    // Current magnet position in world space
    let magnetWorld = { ...avatarWorld };

    // Sinking physics state
    let sinkVelocityZ = 0;
    let prevTime = startTime;

    // Tension animation: 95 (throw start) -> 15 (water) -> 10 (settled)
    let currentTension = 95;
    const deltaTime = 1 / 60;

    // Water surface screen Y for rendering effects
    const waterSurfaceScreenY = worldToScreen(
      { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
      viewport,
    ).y;

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) line.parent.removeChild(line);
        line.destroy();
        if (magnetSprite.parent) magnetSprite.parent.removeChild(magnetSprite);
        magnetSprite.destroy();
        if (magnetDebugText.parent)
          magnetDebugText.parent.removeChild(magnetDebugText);
        magnetDebugText.destroy();
        resolve({ line: null, playerX: 0, playerY: 0, finalTension: 0 });
        return;
      }

      const elapsed = currentTime - startTime;

      if (phase === "throwing") {
        // PHASE 1: Throw magnet in arc from avatar to water surface
        const progress = Math.min(elapsed / throwDuration, 1);

        // Animate tension: 95 -> 15 as rope extends
        currentTension = 95 - 80 * progress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update session phase progress
        if (sessionStore) {
          sessionStore.getState().setPhaseProgress(progress * 0.5); // 0-50% during throw
        }

        // Interpolate world position from avatar to water hit point
        // X and Y interpolate linearly, Z follows arc
        const throwProgress = 1 - Math.pow(1 - progress, 1.5); // Ease-out

        magnetWorld.x = lerp(avatarWorld.x, waterHitWorld.x, throwProgress);
        magnetWorld.y = lerp(avatarWorld.y, waterHitWorld.y, throwProgress);

        // Z: arc from avatar hand to water surface
        // Add parabolic arc for natural lob feel - goes UP first before descending
        const baseZ = lerp(avatarWorld.z, waterHitWorld.z, progress);
        const arcHeight = 2.0; // Arc height in world units (increased for visible lob)
        const arcOffset = Math.sin(progress * Math.PI) * arcHeight;
        magnetWorld.z = baseZ + arcOffset;

        // Update magnet store with current position (automatically tracks peaks)
        magnetStore.updateMagnetPosition(
          magnetWorld.x,
          magnetWorld.y,
          magnetWorld.z,
        );

        // Calculate actual 3D distance for validation
        const dx = magnetWorld.x - avatarWorld.x;
        const dy = magnetWorld.y - avatarWorld.y;
        const dz = magnetWorld.z - avatarWorld.z;
        const currentDist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Update rope length from current distance before tension is applied
        rope3D.updateBaseSegmentLength(currentDist3D);

        // Update rope physics - tension controls slack
        rope3D.setTension(currentTension);
        rope3D.update(deltaTime, avatarWorld, magnetWorld);

        // VALIDATION: Log rope length vs 3D distance (sample 10% of frames)
        if (Math.random() < 0.1) {
          const actualRopeLength = rope3D.getTotalLength();
          const slackMultiplier =
            rope3D.baseSegmentLength > 0
              ? rope3D.segmentLength / rope3D.baseSegmentLength
              : 1.0;
          const expectedLength =
            rope3D.baseSegmentLength * (rope3D.points.length - 1);
          console.log(
            `[CAST ROPE] 3D Dist: ${currentDist3D.toFixed(2)} | dX:${dx.toFixed(2)} dY:${dy.toFixed(2)} dZ:${dz.toFixed(2)} | Base: ${expectedLength.toFixed(2)} | Actual: ${actualRopeLength.toFixed(2)} | Expected@${currentTension.toFixed(0)}%: ${(expectedLength * slackMultiplier).toFixed(2)} | Ratio: ${(actualRopeLength / expectedLength).toFixed(2)}x`,
          );
        }

        // Render rope
        render3DRopeWithViewport(line, rope3D, viewport, waterSurfaceScreenY);

        // Update magnet sprite screen position
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (max: ${peaks.maxX.toFixed(2)})
Y: ${magnetWorld.y.toFixed(2)} (max: ${peaks.maxY.toFixed(2)})
Z: ${magnetWorld.z.toFixed(2)} (max: ${peaks.maxZ.toFixed(2)})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        // Track velocity for water entry
        const dt = (currentTime - prevTime) / 1000;
        if (dt > 0) {
          sinkVelocityZ = -2; // Initial sink velocity (world units/sec)
        }
        prevTime = currentTime;

        if (progress >= 1) {
          // Magnet hit water surface
          console.log(
            `[CAST] Magnet hit water at world (${magnetWorld.x.toFixed(2)}, ${magnetWorld.y.toFixed(2)}, ${magnetWorld.z.toFixed(2)})`,
          );
          phase = "sinking";
          phaseStartTime = currentTime;
          magnetWorld.z = WORLD_Z.WATER_SURFACE;
          sinkVelocityZ = -3; // Fast initial sink (world units/sec)
        }
      }

      if (phase === "sinking") {
        // PHASE 2: Sink from water surface to riverbed
        const dt = Math.min((currentTime - prevTime) / 1000, 0.05);
        prevTime = currentTime;

        // Water drag slows sinking
        const terminalVelocityZ = -0.8; // Terminal velocity (world units/sec)
        const dragCoeff = 8;
        sinkVelocityZ += (terminalVelocityZ - sinkVelocityZ) * dragCoeff * dt;

        // Update Z position
        magnetWorld.z += sinkVelocityZ * dt;
        magnetWorld.z = Math.max(magnetWorld.z, WORLD_Z.RIVERBED);

        // X and Y stay at target
        magnetWorld.x = targetWorld.x;
        magnetWorld.y = targetWorld.y;

        // Update magnet store with current position (automatically tracks peaks)
        magnetStore.updateMagnetPosition(
          magnetWorld.x,
          magnetWorld.y,
          magnetWorld.z,
        );

        // Calculate progress for tension
        const sinkProgress =
          1 -
          (magnetWorld.z - WORLD_Z.RIVERBED) /
            (WORLD_Z.WATER_SURFACE - WORLD_Z.RIVERBED);

        // Animate tension: 15 -> 10 as magnet sinks
        currentTension = 15 - 5 * sinkProgress;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update session phase progress
        if (sessionStore) {
          sessionStore.getState().setPhaseProgress(0.5 + sinkProgress * 0.4); // 50-90%
        }

        // Update rope length from current distance before tension is applied
        const dx = magnetWorld.x - avatarWorld.x;
        const dy = magnetWorld.y - avatarWorld.y;
        const dz = magnetWorld.z - avatarWorld.z;
        const currentDist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        rope3D.updateBaseSegmentLength(currentDist3D);

        // Update rope physics
        rope3D.setTension(currentTension);
        rope3D.update(deltaTime, avatarWorld, magnetWorld);

        // Render rope
        render3DRopeWithViewport(line, rope3D, viewport, waterSurfaceScreenY);

        // Update magnet sprite
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (max: ${peaks.maxX.toFixed(2)})
Y: ${magnetWorld.y.toFixed(2)} (max: ${peaks.maxY.toFixed(2)})
Z: ${magnetWorld.z.toFixed(2)} (max: ${peaks.maxZ.toFixed(2)})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        if (magnetWorld.z <= WORLD_Z.RIVERBED) {
          console.log(
            `[CAST] Magnet reached riverbed at world (${magnetWorld.x.toFixed(2)}, ${magnetWorld.y.toFixed(2)}, ${magnetWorld.z.toFixed(2)})`,
          );
          phase = "settling";
          phaseStartTime = currentTime;
          magnetWorld.z = WORLD_Z.RIVERBED;
          magnetStore.setMagnetPhase("settling");
          magnetStore.updateMagnetPosition(
            magnetWorld.x,
            magnetWorld.y,
            magnetWorld.z,
          );
        }
      }

      if (phase === "settling") {
        // PHASE 3: Rope settles at riverbed
        const settleElapsed = currentTime - phaseStartTime;
        const settleProgress = Math.min(settleElapsed / settleDuration, 1);

        // Final tension settling
        currentTension = 10;
        if (gameStore) {
          gameStore.getState().updateCastTension(currentTension);
        }

        // Update session phase progress
        if (sessionStore) {
          sessionStore.getState().setPhaseProgress(0.9 + settleProgress * 0.1); // 90-100%
        }

        // Update rope length from current distance before tension is applied
        const dx = magnetWorld.x - avatarWorld.x;
        const dy = magnetWorld.y - avatarWorld.y;
        const dz = magnetWorld.z - avatarWorld.z;
        const currentDist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        rope3D.updateBaseSegmentLength(currentDist3D);

        // Update rope physics
        rope3D.setTension(currentTension);
        rope3D.update(deltaTime, avatarWorld, magnetWorld);

        // Render rope
        render3DRopeWithViewport(line, rope3D, viewport, waterSurfaceScreenY);

        // Update magnet sprite
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (max: ${peaks.maxX.toFixed(2)})
Y: ${magnetWorld.y.toFixed(2)} (max: ${peaks.maxY.toFixed(2)})
Z: ${magnetWorld.z.toFixed(2)} (max: ${peaks.maxZ.toFixed(2)})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        if (settleProgress >= 1) {
          // Done - clean up cast magnet sprite (drag phase has its own)
          if (magnetSprite.parent) {
            app.stage.removeChild(magnetSprite);
          }
          magnetSprite.destroy();

          // Clean up debug text
          if (magnetDebugText.parent) {
            app.stage.removeChild(magnetDebugText);
          }
          magnetDebugText.destroy();

          // Clean up debug graphics
          if (debugLines.parent) {
            app.stage.removeChild(debugLines);
          }
          debugLines.destroy();

          console.log(
            `[CAST] Animation complete, tension: ${currentTension.toFixed(1)}`,
          );

          // Store the avatar screen position for rope rendering during drag
          const avatarScreenPos = worldToScreen(avatarWorld, viewport);

          resolve({
            line,
            playerX: avatarScreenPos.x,
            playerY: avatarScreenPos.y,
            finalTension: currentTension,
            viewport, // Pass viewport for drag phase
            avatarWorld, // Pass avatar world position
            targetWorld, // Pass target world position
          });
          return;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Render 3D rope with viewport projection and underwater opacity
 * @param {PIXI.Graphics} line - Graphics object to draw rope on
 * @param {Rope3D} rope3D - 3D rope physics object
 * @param {Object} viewport - Viewport configuration
 * @param {number} waterSurfaceScreenY - Screen Y coordinate of water surface
 */
function render3DRopeWithViewport(line, rope3D, viewport, waterSurfaceScreenY) {
  if (!line || !rope3D || line.destroyed) {
    return;
  }

  // Get world-space points from rope
  const worldPoints = rope3D.points;

  // Project each point to screen space
  const screenPoints = worldPoints.map((point) =>
    worldToScreen(point.pos, viewport),
  );

  if (screenPoints.length < 2) {
    return;
  }

  line.clear();
  line.setStrokeStyle({ width: 3, color: 0x8b4513 });
  line.moveTo(screenPoints[0].x, screenPoints[0].y);

  for (let i = 1; i < screenPoints.length; i++) {
    const point = screenPoints[i];

    // Fade underwater portions
    if (point.y > waterSurfaceScreenY) {
      line.setStrokeStyle({ width: 3, color: 0x8b4513, alpha: 0.6 });
    }

    line.lineTo(point.x, point.y);
  }

  line.stroke();
}

/**
 * Render 3D rope with underwater opacity (legacy - uses rope's built-in projection)
 * @deprecated Use render3DRopeWithViewport instead
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

  line.clear();

  if (screenPoints.length < 2) {
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
      line.setStrokeStyle({ width: 3, color: 0x8b4513, alpha: 0.6 });
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

    // Water surface from world constants
    const viewport = createViewport(app.screen.width, app.screen.height);
    const waterSurfaceY = worldToScreen(
      { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
      viewport,
    ).y;

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

      // Update 3D rope physics using world coordinates
      // For reel-in, we use the legacy functions since we're working with screen positions
      // TODO: Refactor reel-in to use world coordinates properly
      const avatarWorld = {
        x: playerX,
        y: WORLD_Y.AVATAR,
        z: WORLD_Z.AVATAR_HAND,
      };
      const magnetWorld = {
        x: magnetX,
        y: magnetY, // This is still in screen-ish space - needs proper refactoring
        z: WORLD_Z.RIVERBED, // Assume on riverbed during reel
      };
      const dx = magnetWorld.x - avatarWorld.x;
      const dy = magnetWorld.y - avatarWorld.y;
      const dz = magnetWorld.z - avatarWorld.z;
      const currentDist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
      rope3D.updateBaseSegmentLength(currentDist3D);
      rope3D.setTension(80); // High tension during reel (taut rope)
      rope3D.update(deltaTime, avatarWorld, magnetWorld);

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
export function renderRope(graphics, rope) {
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

  // Water surface from world constants
  const viewport = createViewport(app.screen.width, app.screen.height);
  const waterSurfaceY = worldToScreen(
    { x: 0, y: WORLD_Y.WATER_NEAR, z: WORLD_Z.WATER_SURFACE },
    viewport,
  ).y;
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
