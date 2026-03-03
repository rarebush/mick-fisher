import * as PIXI from "pixi.js";
import {
  WORLD_Z,
  createViewport,
  worldToScreen,
  screenToWorld,
  lerp,
  getAvatarHandWorldPosition,
  getProjectionMetrics,
} from "../mechanics/worldConstants.js";
import {
  FLOAT_WORLD_RADIUS,
  FLOAT_VISUAL_SCALE,
} from "../rendering/floatConstants.js";
import { createMagnetSprite } from "../graphics/placeholderSprites.js";
import useMagnetStore from "../state/magnetStore.js";
import { renderProjectedRope } from "./projectedRopeRenderer.js";
import { cleanupDisplayObjects } from "../rendering/displayCleanup.js";
import { getPeakValue } from "../utils/peakUtils.js";

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
  onWaterHit = null,
  options = {},
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
      `[CAST] Viewport: ${viewport.pixelsPerUnit.toFixed(
        1,
      )} px/unit, offset: ${viewport.screenYOffset.toFixed(1)}`,
    );
    console.log(
      `[CAST] World bounds: X [${viewport.worldXMin.toFixed(
        2,
      )}, ${viewport.worldXMax.toFixed(2)}] (${viewport.worldXWidth.toFixed(
        2,
      )} units), Y [${viewport.worldYMin}, ${viewport.worldYMax}], Z [${
        viewport.worldZMin
      }, ${viewport.worldZMax}]`,
    );

    const skipSink = Boolean(options.skipSink);

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
      `[CAST] Click at screen (${targetScreenX.toFixed(
        0,
      )}, ${targetScreenY.toFixed(
        0,
      )}) -> water world (${waterSurfaceWorld.x.toFixed(
        2,
      )}, ${waterSurfaceWorld.y.toFixed(2)}, ${waterSurfaceWorld.z})`,
    );

    // ===========================================
    // TARGET POSITION (riverbed directly below click, or surface for rod)
    // ===========================================
    const targetWorld = {
      x: waterSurfaceWorld.x,
      y: waterSurfaceWorld.y,
      z: skipSink ? WORLD_Z.WATER_SURFACE : WORLD_Z.RIVERBED,
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

    console.log(
      `[CAST DEBUG] Avatar screen: ${avatarScreen.y.toFixed(
        0,
      )}px | Water hit screen: ${waterHitScreen.y.toFixed(
        0,
      )}px | Target: ${targetScreen.y.toFixed(0)}px`,
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
      `[CAST] Distance: ${distance3D.toFixed(
        2,
      )} units | Horizontal: ${horizontalDistance.toFixed(2)} units`,
    );

    if (sessionStore) {
      sessionStore.getState().setPhase("throwing");
      sessionStore.getState().setPhaseProgress(0);
    }

    const magnetStore = useMagnetStore.getState();
    if (!skipSink) {
      // Spawn magnet in magnet store
      magnetStore.spawnMagnet(avatarWorld.x);
    }

    const aboveWaterContainer = layerContainers?.aboveWater ?? app.stage;
    const underwaterContainer = layerContainers?.underwater ?? app.stage;
    const debugContainer = layerContainers?.debug ?? app.stage;

    // Create graphics object for the line
    const line = new PIXI.Graphics();
    aboveWaterContainer.addChild(line);
    const lineUnderwater = new PIXI.Graphics();
    underwaterContainer.addChild(lineUnderwater);
    const lineDebug = new PIXI.Graphics();
    lineDebug.visible = false;
    debugContainer.addChild(lineDebug);

    // Create cast sprite (magnet or float)
    let magnetSprite = null;
    let floatSprite = null;
    if (!skipSink) {
      magnetSprite = createMagnetSprite();
      magnetSprite.scale.set(2);
      aboveWaterContainer.addChild(magnetSprite);
    } else {
      const metrics = getProjectionMetrics(viewport);
      const radiusPx =
        FLOAT_WORLD_RADIUS *
        ((metrics.screenXPerWorldUnit + metrics.screenYPerWorldUnit) / 2) *
        FLOAT_VISUAL_SCALE;
      floatSprite = new PIXI.Graphics()
        .circle(0, 0, radiusPx)
        .fill({ color: 0xe24b3a, alpha: 1 });
      aboveWaterContainer.addChild(floatSprite);
    }

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
    magnetDebugText.visible = false;
    app.stage.addChild(magnetDebugText);

    const updateCastSprite = (screenPos) => {
      if (magnetSprite) {
        magnetSprite.x = screenPos.x - magnetSprite.width / 2;
        magnetSprite.y = screenPos.y - magnetSprite.height / 2;
      }
      if (floatSprite) {
        floatSprite.x = screenPos.x;
        floatSprite.y = screenPos.y;
      }
    };

    // ===========================================
    // ANIMATION PARAMETERS
    // ===========================================
    // Throw timing: slowed for suspenseful cast feel
    // Base 1200ms + 2.5ms per world unit of horizontal distance
    // Example: 100 units = 1450ms, 200 units = 1700ms, 400 units = 2200ms
    const throwDuration = Math.max(1200, 1200 + horizontalDistance * 2.5);
    const magnetSinkPhase = {
      settleDuration: 200,
    };
    const settleDuration = skipSink ? 0 : magnetSinkPhase.settleDuration;
    const startTime = performance.now();

    let phase = "throwing"; // 'throwing' -> 'sinking' -> 'settling' -> 'done'
    let phaseStartTime = 0;

    // Current magnet position in world space
    let magnetWorld = { ...avatarWorld };

    // Sinking physics state
    let sinkVelocityZ = 0;
    let prevTime = startTime;
    let prevMagnetZ = magnetWorld.z;
    let lastVelocityZ = 0;

    // Tension animation: 95 (throw start) -> 15 (water) -> 10 (settled)
    let currentTension = 95;
    const animate = (currentTime) => {
      if (!app) {
        cleanupDisplayObjects(line, magnetSprite, floatSprite, magnetDebugText);
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

      if (!skipSink && magnetSprite) {
        if (magnetWorld.z <= WORLD_Z.WATER_SURFACE) {
          if (magnetSprite.parent !== underwaterContainer) {
            if (magnetSprite.parent) {
              magnetSprite.parent.removeChild(magnetSprite);
            }
            underwaterContainer.addChild(magnetSprite);
          }
        } else if (magnetSprite.parent !== aboveWaterContainer) {
          if (magnetSprite.parent) {
            magnetSprite.parent.removeChild(magnetSprite);
          }
          aboveWaterContainer.addChild(magnetSprite);
        }
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

        if (!skipSink) {
          // Update magnet store with current position (automatically tracks peaks)
          magnetStore.updateMagnetPosition(
            magnetWorld.x,
            magnetWorld.y,
            magnetWorld.z,
          );
        }

        renderProjectedRope(line, viewport, ropeAnchorWorld, magnetWorld, {
          tension: sessionStore?.getState().ropeTension,
          lineUnderwater,
          lineDebug,
        });

        // Update cast sprite screen position
        const magnetScreen = worldToScreen(magnetWorld, viewport);
        updateCastSprite(magnetScreen);

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX = getPeakValue(peaks, "X");
        const peakY = getPeakValue(peaks, "Y");
        const peakZ = getPeakValue(peaks, "Z");
        magnetDebugText.text = `Magnet World:\nX: ${magnetWorld.x.toFixed(
          2,
        )} (peak: ${peakX?.toFixed(2) ?? "n/a"})\nY: ${magnetWorld.y.toFixed(
          2,
        )} (peak: ${peakY?.toFixed(2) ?? "n/a"})\nZ: ${magnetWorld.z.toFixed(
          2,
        )} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        // Track velocity for water entry
        const dt = (currentTime - prevTime) / 1000;
        if (dt > 0) {
          lastVelocityZ = (magnetWorld.z - prevMagnetZ) / dt;
          sinkVelocityZ = -2; // Initial sink velocity (world units/sec)
        }
        prevTime = currentTime;
        prevMagnetZ = magnetWorld.z;

        if (progress >= 1) {
          // Magnet hit water surface
          console.log(
            `[CAST] Magnet hit water at world (${magnetWorld.x.toFixed(
              2,
            )}, ${magnetWorld.y.toFixed(2)}, ${magnetWorld.z.toFixed(2)})`,
          );
          if (typeof onWaterHit === "function") {
            onWaterHit(magnetWorld.x, magnetWorld.y, WORLD_Z.WATER_SURFACE);
          }
          if (skipSink) {
            phase = "settling";
            phaseStartTime = currentTime;
            magnetWorld.z = WORLD_Z.WATER_SURFACE;
          } else {
            phase = "sinking";
            phaseStartTime = currentTime;
            magnetWorld.z = WORLD_Z.WATER_SURFACE;
            sinkVelocityZ = -3; // Fast initial sink (world units/sec)
          }
        }
      }

      if (phase === "sinking" && !skipSink) {
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
        updateCastSprite(magnetScreen);

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX = getPeakValue(peaks, "X");
        const peakY = getPeakValue(peaks, "Y");
        const peakZ = getPeakValue(peaks, "Z");
        magnetDebugText.text = `Magnet World:\nX: ${magnetWorld.x.toFixed(
          2,
        )} (peak: ${peakX?.toFixed(2) ?? "n/a"})\nY: ${magnetWorld.y.toFixed(
          2,
        )} (peak: ${peakY?.toFixed(2) ?? "n/a"})\nZ: ${magnetWorld.z.toFixed(
          2,
        )} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        if (magnetWorld.z <= WORLD_Z.RIVERBED) {
          console.log(
            `[CAST] Magnet reached riverbed at world (${magnetWorld.x.toFixed(
              2,
            )}, ${magnetWorld.y.toFixed(2)}, ${magnetWorld.z.toFixed(2)})`,
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
        updateCastSprite(magnetScreen);

        // Update debug text with world coordinates and peaks from store
        const peaks = magnetStore.getPeakValues();
        const peakX = getPeakValue(peaks, "X");
        const peakY = getPeakValue(peaks, "Y");
        const peakZ = getPeakValue(peaks, "Z");
        magnetDebugText.text = `Magnet World:\nX: ${magnetWorld.x.toFixed(
          2,
        )} (peak: ${peakX?.toFixed(2) ?? "n/a"})\nY: ${magnetWorld.y.toFixed(
          2,
        )} (peak: ${peakY?.toFixed(2) ?? "n/a"})\nZ: ${magnetWorld.z.toFixed(
          2,
        )} (peak: ${peakZ?.toFixed(2) ?? "n/a"})`;
        magnetDebugText.x = 10;
        magnetDebugText.y = app.screen.height - 80;

        if (settleProgress >= 1) {
          // Done - clean up cast magnet sprite (drag phase has its own)
          cleanupDisplayObjects(magnetSprite, floatSprite, magnetDebugText);

          // Clean up debug graphics
          // debug overlay removed

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
            finalCastVelocityZ: lastVelocityZ,
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
