/**
 * Cast Animations
 * Visual feedback animations for casting phase
 *
 * All positions are calculated in WORLD SPACE first, then projected to screen space.
 * World coordinates: {x: horizontal, y: depth, z: height}
 * Projection: use worldToScreen() from worldConstants (isometric).
 */

import * as PIXI from "pixi.js";
import {
  WORLD_Z,
  WORLD_Y,
  createViewport,
  worldToScreen,
  screenToWorld,
  lerp,
  getAvatarHandWorldPosition,
} from "../mechanics/worldConstants.js";
import { createMagnetSprite } from "../graphics/placeholderSprites.js";
import useMagnetStore from "../state/magnetStore.js";
import { renderProjectedRope } from "./projectedRopeRenderer.js";

/**
 * Animate casting line from shore to target position
 * Shows magnet arc to water surface, splash, then sink to riverbed
 * Returns the graphics object to keep visible during drag
 * Rope visuals are driven by projected rope rendering
 *
 * ALL POSITIONS ARE IN WORLD SPACE:
 * - World X: horizontal position (left/right)
 * - World Y: depth into the scene (0 = avatar, increases toward back)
 * - World Z: height (0 = riverbed, increases upward)
 *
 * Projection to screen is handled by worldToScreen().
 */
export function animateCastLine(
  app,
  targetScreenX,
  targetScreenY,
  gameStore,
  sessionStore,
  layerContainers = null,
) {
  return new Promise((resolve) => {
    if (!app) {
      resolve({
        line: null,
        lineUnderwater: null,
        lineDebug: null,
        playerX: 0,
        playerY: 0,
        finalTension: 0,
      });
      return;
    }

    if (sessionStore) {
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
    // AVATAR POSITION (fixed in world space, used for magnet throw)
    // ===========================================
    const avatarWorld = getAvatarHandWorldPosition();
    const avatarScreen = worldToScreen(avatarWorld, viewport);

    // Rope anchor starts at cast origin (avatar hand)
    const ropeAnchorWorld = getAvatarHandWorldPosition();

    // ===========================================
    // CLICK POSITION (where user clicked = water surface)
    // Convert screen click to world coordinates on water surface (Z=1)
    // ===========================================
    const waterSurfaceWorld = screenToWorld(
      targetScreenX,
      targetScreenY,
      WORLD_Z.WATER_SURFACE,
      viewport,
    );

    console.log(
      `[CAST] Click at screen (${targetScreenX.toFixed(0)}, ${targetScreenY.toFixed(0)}) -> water world (${waterSurfaceWorld.x.toFixed(2)}, ${waterSurfaceWorld.y.toFixed(2)}, ${waterSurfaceWorld.z})`,
    );

    // ===========================================
    // TARGET POSITION (riverbed directly below click)
    // ===========================================
    const targetWorld = {
      x: waterSurfaceWorld.x,
      y: waterSurfaceWorld.y,
      z: WORLD_Z.RIVERBED,
    };
    const targetScreen = worldToScreen(targetWorld, viewport);

    // ===========================================
    // WATER SURFACE POSITION (same world Y as target, at water Z)
    // ===========================================
    const waterHitWorld = {
      x: waterSurfaceWorld.x,
      y: waterSurfaceWorld.y,
      z: WORLD_Z.WATER_SURFACE,
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
    debugLines.circle(targetScreen.x, targetScreen.y, 10);
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
      `[CAST DEBUG] Avatar screen: ${avatarScreen.y.toFixed(0)}px | Water hit screen: ${waterHitScreen.y.toFixed(0)}px | Target: ${targetScreen.y.toFixed(0)}px`,
    );

    // ===========================================
    // CAST TIMING (no physics rope)
    // ===========================================
    const dx = targetWorld.x - ropeAnchorWorld.x;
    const dy = targetWorld.y - ropeAnchorWorld.y;
    const dz = targetWorld.z - ropeAnchorWorld.z;
    const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const horizontalDistance = Math.sqrt(dx * dx + dy * dy);

    console.log(
      `[CAST] Distance: ${distance3D.toFixed(2)} units | Horizontal: ${horizontalDistance.toFixed(2)} units`,
    );

    if (sessionStore) {
      sessionStore.getState().setPhase("throwing");
      sessionStore.getState().setPhaseProgress(0);
    }

    // Spawn magnet in magnet store
    const magnetStore = useMagnetStore.getState();
    magnetStore.spawnMagnet(avatarWorld.x);

    const aboveWaterContainer = layerContainers?.aboveWater ?? app.stage;
    const underwaterContainer = layerContainers?.underwater ?? app.stage;
    const debugContainer = layerContainers?.debug ?? app.stage;

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    aboveWaterContainer.addChild(line);
    const lineUnderwater = new PIXI.Graphics();
    underwaterContainer.addChild(lineUnderwater);
    const lineDebug = new PIXI.Graphics();
    debugContainer.addChild(lineDebug);

    // Create magnet sprite
    const magnetSprite = createMagnetSprite();
    magnetSprite.scale.set(2);
    aboveWaterContainer.addChild(magnetSprite);

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
    // Throw timing: slowed for suspenseful cast feel
    // Base 1200ms + 2.5ms per world unit of horizontal distance
    // Example: 100 units = 1450ms, 200 units = 1700ms, 400 units = 2200ms
    const throwDuration = Math.max(1200, 1200 + horizontalDistance * 2.5);
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
    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) line.parent.removeChild(line);
        line.destroy();
        if (magnetSprite.parent) magnetSprite.parent.removeChild(magnetSprite);
        magnetSprite.destroy();
        if (magnetDebugText.parent)
          magnetDebugText.parent.removeChild(magnetDebugText);
        magnetDebugText.destroy();
        resolve({
          line: null,
          lineUnderwater: null,
          lineDebug: null,
          playerX: 0,
          playerY: 0,
          finalTension: 0,
        });
        return;
      }

      const elapsed = currentTime - startTime;

      if (magnetWorld.z <= WORLD_Z.WATER_SURFACE) {
        if (magnetSprite.parent !== underwaterContainer) {
          if (magnetSprite.parent)
            magnetSprite.parent.removeChild(magnetSprite);
          underwaterContainer.addChild(magnetSprite);
        }
      } else if (magnetSprite.parent !== aboveWaterContainer) {
        if (magnetSprite.parent) magnetSprite.parent.removeChild(magnetSprite);
        aboveWaterContainer.addChild(magnetSprite);
      }

      if (phase === "throwing") {
        // PHASE 1: Throw magnet in arc from avatar to water surface
        const progress = Math.min(elapsed / throwDuration, 1);

        // Animate tension: 95 -> 15 as rope extends
        currentTension = 95 - 80 * progress;
        sessionStore?.getState().setRopeTension(currentTension);
        // Tension is now tracked in sessionStore only.

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

        renderProjectedRope(line, viewport, ropeAnchorWorld, magnetWorld, {
          tension: sessionStore?.getState().ropeTension,
          lineUnderwater,
          lineDebug,
        });

        // Update magnet sprite screen position
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX =
          peaks && Math.abs(peaks.maxX) >= Math.abs(peaks.minX)
            ? peaks.maxX
            : peaks?.minX;
        const peakY =
          peaks && Math.abs(peaks.maxY) >= Math.abs(peaks.minY)
            ? peaks.maxY
            : peaks?.minY;
        const peakZ =
          peaks && Math.abs(peaks.maxZ) >= Math.abs(peaks.minZ)
            ? peaks.maxZ
            : peaks?.minZ;
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (peak: ${peakX?.toFixed(2) ?? "n/a"})
Y: ${magnetWorld.y.toFixed(2)} (peak: ${peakY?.toFixed(2) ?? "n/a"})
Z: ${magnetWorld.z.toFixed(2)} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
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
        const terminalVelocityZ = -0.3; // Terminal velocity (world units/sec)
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
        currentTension = 15 - 15 * sinkProgress;
        sessionStore?.getState().setRopeTension(currentTension);
        // Tension is now tracked in sessionStore only.

        // Update session phase progress
        if (sessionStore) {
          sessionStore.getState().setPhaseProgress(0.5 + sinkProgress * 0.4); // 50-90%
        }

        // Render rope
        renderProjectedRope(line, viewport, ropeAnchorWorld, magnetWorld, {
          tension: sessionStore?.getState().ropeTension,
          lineUnderwater,
          lineDebug,
        });

        // Update magnet sprite
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX =
          peaks && Math.abs(peaks.maxX) >= Math.abs(peaks.minX)
            ? peaks.maxX
            : peaks?.minX;
        const peakY =
          peaks && Math.abs(peaks.maxY) >= Math.abs(peaks.minY)
            ? peaks.maxY
            : peaks?.minY;
        const peakZ =
          peaks && Math.abs(peaks.maxZ) >= Math.abs(peaks.minZ)
            ? peaks.maxZ
            : peaks?.minZ;
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (peak: ${peakX?.toFixed(2) ?? "n/a"})
Y: ${magnetWorld.y.toFixed(2)} (peak: ${peakY?.toFixed(2) ?? "n/a"})
Z: ${magnetWorld.z.toFixed(2)} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
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
        currentTension = 0;
        sessionStore?.getState().setRopeTension(currentTension);
        // Tension is now tracked in sessionStore only.

        // Update session phase progress
        if (sessionStore) {
          sessionStore.getState().setPhaseProgress(0.9 + settleProgress * 0.1); // 90-100%
        }

        // Render rope
        renderProjectedRope(line, viewport, ropeAnchorWorld, magnetWorld, {
          tension: sessionStore?.getState().ropeTension,
          lineUnderwater,
          lineDebug,
        });

        // Update magnet sprite
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        magnetSprite.x = magnetScreen.x - magnetSprite.width / 2;
        magnetSprite.y = magnetScreen.y - magnetSprite.height / 2;

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX =
          peaks && Math.abs(peaks.maxX) >= Math.abs(peaks.minX)
            ? peaks.maxX
            : peaks?.minX;
        const peakY =
          peaks && Math.abs(peaks.maxY) >= Math.abs(peaks.minY)
            ? peaks.maxY
            : peaks?.minY;
        const peakZ =
          peaks && Math.abs(peaks.maxZ) >= Math.abs(peaks.minZ)
            ? peaks.maxZ
            : peaks?.minZ;
        magnetDebugText.text = `Magnet World:
X: ${magnetWorld.x.toFixed(2)} (peak: ${peakX?.toFixed(2) ?? "n/a"})
Y: ${magnetWorld.y.toFixed(2)} (peak: ${peakY?.toFixed(2) ?? "n/a"})
Z: ${magnetWorld.z.toFixed(2)} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
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

          // Store the rope anchor screen position for drag/reel visuals
          const avatarScreenPos = worldToScreen(ropeAnchorWorld, viewport);

          resolve({
            line,
            lineUnderwater,
            lineDebug,
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
 * Animate rope reeling in after drag failure.
 * Uses projected rope rendering (no physics dependency).
 */
export function animateReelIn(
  app,
  _rope,
  line,
  _playerX,
  _playerY,
  startX,
  startY,
  sessionStore,
  options = {},
) {
  return new Promise((resolve) => {
    if (!app || !line) {
      resolve();
      return;
    }

    const magnetStore = useMagnetStore.getState();
    magnetStore?.despawnMagnet?.();

    const retractDuration = 500;
    const startTime = performance.now();
    const viewport = createViewport(app.screen.width, app.screen.height);
    const castOrigin = getAvatarHandWorldPosition();
    const startWorld = screenToWorld(
      startX,
      startY,
      WORLD_Z.RIVERBED,
      viewport,
    );

    const reelMagnetSprite = createMagnetSprite();
    reelMagnetSprite.scale.set(2);
    reelMagnetSprite.pivot.set(
      reelMagnetSprite.width / 2,
      reelMagnetSprite.height / 2,
    );
    (line.parent || app.stage).addChild(reelMagnetSprite);

    const animate = (currentTime) => {
      if (!app) {
        if (line.parent) line.parent.removeChild(line);
        line.destroy();
        if (reelMagnetSprite.parent) {
          reelMagnetSprite.parent.removeChild(reelMagnetSprite);
        }
        reelMagnetSprite.destroy();
        resolve();
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / retractDuration, 1);
      const magnetWorld = {
        x: lerp(startWorld.x, castOrigin.x, progress),
        y: lerp(startWorld.y, castOrigin.y, progress),
        z: lerp(startWorld.z, castOrigin.z, progress),
      };

      renderProjectedRope(line, viewport, castOrigin, magnetWorld, {
        tension: sessionStore?.getState().ropeTension,
        lineUnderwater: options.lineUnderwater ?? null,
        lineDebug: options.lineDebug ?? null,
      });

      const magnetScreen = worldToScreen(magnetWorld, viewport);
      reelMagnetSprite.x = magnetScreen.x;
      reelMagnetSprite.y = magnetScreen.y;

      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }

      if (sessionStore) {
        sessionStore.getState().setPhase("idle");
        sessionStore.getState().setPhaseProgress(0);
        sessionStore.getState().setCastPosition(null, null);
      }

      if (line.parent) line.parent.removeChild(line);
      line.destroy();
      if (reelMagnetSprite.parent) {
        reelMagnetSprite.parent.removeChild(reelMagnetSprite);
      }
      reelMagnetSprite.destroy();

      console.log("[REEL-IN] Complete");
      resolve();
    };

    requestAnimationFrame(animate);
  });
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
 * Create bubbles popping on the water surface above a world position
 * Used when magnet sinks through water
 */
export function createBubbles(app, worldX, worldY, duration = 500) {
  if (!app) return;

  const viewport = createViewport(app.screen.width, app.screen.height);
  const surfaceScreen = worldToScreen(
    { x: worldX, y: worldY, z: WORLD_Z.WATER_SURFACE },
    viewport,
  );
  const bubbleCount = 6;

  for (let i = 0; i < bubbleCount; i++) {
    // Stagger bubble creation
    setTimeout(
      () => {
        if (!app) return;

        const baseRadius = 2 + Math.random() * 2;
        const bubble = new PIXI.Graphics();
        bubble
          .circle(0, 0, baseRadius)
          .stroke({ width: 2, color: 0xcdf5ff, alpha: 0.9 });

        // Random horizontal offset from center
        bubble.x = surfaceScreen.x + (Math.random() - 0.5) * 24;
        bubble.y = surfaceScreen.y + (Math.random() - 0.5) * 6;
        bubble.alpha = 0.6 + Math.random() * 0.3;

        app.stage.addChild(bubble);

        // Animate bubble popping on surface
        let bubbleAlpha = bubble.alpha;
        let scale = 1;
        const scaleSpeed = 0.06 + Math.random() * 0.05;

        const animate = () => {
          if (!app) {
            if (bubble.parent) {
              bubble.parent.removeChild(bubble);
            }
            bubble.destroy();
            return;
          }

          scale += scaleSpeed;
          bubble.scale.set(scale);
          bubbleAlpha -= 0.04;
          bubble.alpha = bubbleAlpha;

          // Remove when faded or reached water surface
          if (bubbleAlpha <= 0) {
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

    // Calculate current item position (world space)
    const itemPos = getItemPosition();
    if (itemPos) {
      // Create a small burst of bubbles (fewer than initial cast)
      createBubbles(app, itemPos.x, itemPos.y, 300);
    }
  }, 800);

  return interval;
}
