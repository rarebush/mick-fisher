import {
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  createViewport,
  screenToWorld,
  worldToScreen,
  getAvatarWorldPosition,
  getAvatarHandWorldPosition,
} from "../mechanics/worldConstants.js";
import {
  computeCastTargetWorld,
  getAvatarCastOrigin,
  metersToWorldRange,
} from "../mechanics/castAimUtils.js";
import { getCastingEquipmentMaxRange } from "../data/castingEquipmentDatabase.js";

export function updateCastAimOverlay({
  app,
  castAimOverlay,
  castAimMask,
  gameStore,
  sessionStore,
}) {
  if (!app || !castAimOverlay) {
    return;
  }

  const sessionState = sessionStore?.getState();
  if (!sessionState) return;

  const gamePhase = gameStore?.getState().gamePhase;
  const aimState = sessionState.castAimState;
  const donutAimState = sessionState.donutAimState;
  const castMode = sessionState.castInputMode;

  const drawPolygon = (graphics, points, fill, stroke) => {
    if (!points.length) return;
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    if (fill) graphics.fill(fill);
    if (stroke) graphics.stroke(stroke);
  };

  const getWaterSurfacePolygon = (viewport) => {
    const z = WORLD_Z.WATER_SURFACE;
    return [
      { x: WORLD_X.MIN, y: WORLD_Y.WATER_NEAR, z },
      { x: WORLD_X.MAX, y: WORLD_Y.WATER_NEAR, z },
      { x: WORLD_X.MAX, y: WORLD_Y.WATER_FAR, z },
      { x: WORLD_X.MIN, y: WORLD_Y.WATER_FAR, z },
    ].map((pos) => worldToScreen(pos, viewport));
  };

  const getCastRangePolygon = (originWorld, rangeWorld, viewport) => {
    const steps = 96;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = (Math.PI * i) / steps;
      const worldPoint = {
        x: originWorld.x + Math.cos(angle) * rangeWorld,
        y: originWorld.y + Math.sin(angle) * rangeWorld,
        z: WORLD_Z.WATER_SURFACE,
      };
      points.push(worldToScreen(worldPoint, viewport));
    }
    points.push(
      worldToScreen(
        { x: originWorld.x, y: originWorld.y, z: WORLD_Z.WATER_SURFACE },
        viewport
      )
    );
    return points;
  };

  const drawCastRangeRing = (viewport) => {
    if (!castAimMask) return;
    castAimMask.clear();
    const waterPolygon = getWaterSurfacePolygon(viewport);
    drawPolygon(castAimMask, waterPolygon, { color: 0xffffff });

    const equipmentId = gameStore?.getState().selectedCastingEquipmentId;
    const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
    const rangeWorld = Math.max(0, metersToWorldRange(maxRangeMeters));
    if (!Number.isFinite(rangeWorld) || rangeWorld <= 0) return;

    const origin = getAvatarCastOrigin();
    const ringPoints = getCastRangePolygon(origin, rangeWorld, viewport);
    drawPolygon(
      castAimOverlay,
      ringPoints,
      { color: 0x00c2ff, alpha: 0.15 },
      { width: 2, color: 0x00c2ff, alpha: 0.6 }
    );
  };

  if (gamePhase !== "idle") {
    if (aimState && aimState.phase !== "idle") {
      sessionState.resetCastAim();
    }
    if (donutAimState && donutAimState.phase !== "idle") {
      sessionState.resetDonutAim();
    }
    castAimOverlay.clear();
    return;
  }

  if (castMode === "direction_power") {
    if (!aimState || aimState.phase === "idle") {
      castAimOverlay.clear();
      const viewport = createViewport(app.screen.width, app.screen.height);
      drawCastRangeRing(viewport);
      return;
    }

    const now = performance.now();
    const deltaTime = aimState.lastUpdate
      ? (now - aimState.lastUpdate) / 1000
      : 0;
    if (deltaTime > 0) {
      sessionState.updateCastAim(deltaTime);
    }

    const updatedAim = sessionStore.getState().castAimState;
    const viewport = createViewport(app.screen.width, app.screen.height);
    const equipmentId = gameStore?.getState().selectedCastingEquipmentId;
    const maxRangeMeters = getCastingEquipmentMaxRange(equipmentId);
    const previewPower = updatedAim.phase === "angle" ? 1 : updatedAim.power;
    const targetWorld = computeCastTargetWorld(
      updatedAim.angle,
      previewPower,
      viewport,
      maxRangeMeters
    );
    const targetScreen = worldToScreen(targetWorld, viewport);
    const avatarScreen = worldToScreen(getAvatarHandWorldPosition(), viewport);

    castAimOverlay.clear();
    drawCastRangeRing(viewport);

    // Preview line and marker
    castAimOverlay.setStrokeStyle({
      width: 2,
      color: 0x00c2ff,
      alpha: 0.8,
    });
    castAimOverlay.moveTo(avatarScreen.x, avatarScreen.y);
    castAimOverlay.lineTo(targetScreen.x, targetScreen.y);
    castAimOverlay.stroke();
    castAimOverlay
      .circle(targetScreen.x, targetScreen.y, 5)
      .stroke({ width: 2, color: 0x00c2ff });

    const barWidth = 220;
    const barHeight = 6;
    const centerX = app.screen.width / 2;
    const angleBarY = app.screen.height - 70;
    const powerBarY = app.screen.height - 45;

    // Angle bar
    castAimOverlay
      .rect(centerX - barWidth / 2, angleBarY, barWidth, barHeight)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    const angleNorm = (updatedAim.angle + 90) / 180;
    const angleX = centerX - barWidth / 2 + angleNorm * barWidth;
    castAimOverlay
      .circle(angleX, angleBarY + barHeight / 2, 4)
      .fill({ color: 0xffd700 });

    // Power bar (only when selecting power)
    if (updatedAim.phase === "power") {
      castAimOverlay
        .rect(centerX - barWidth / 2, powerBarY, barWidth, barHeight)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
      const powerX = centerX - barWidth / 2 + updatedAim.power * barWidth;
      castAimOverlay
        .circle(powerX, powerBarY + barHeight / 2, 4)
        .fill({ color: 0x00ff7f });
    }
    return;
  }

  if (castMode === "donut") {
    if (!donutAimState || donutAimState.phase === "idle") {
      castAimOverlay.clear();
      const viewport = createViewport(app.screen.width, app.screen.height);
      drawCastRangeRing(viewport);
      return;
    }

    const now = performance.now();
    const deltaTime = donutAimState.lastUpdate
      ? (now - donutAimState.lastUpdate) / 1000
      : 0;
    if (deltaTime > 0) {
      sessionState.updateDonutAim(deltaTime);
    }

    const updatedDonut = sessionStore.getState().donutAimState;
    if (!updatedDonut.target) {
      castAimOverlay.clear();
      return;
    }

    castAimOverlay.clear();

    const viewport = createViewport(app.screen.width, app.screen.height);
    drawCastRangeRing(viewport);
    const avatarWorld = getAvatarWorldPosition();
    const targetWorld = screenToWorld(
      updatedDonut.target.x,
      updatedDonut.target.y,
      WORLD_Z.WATER_SURFACE,
      viewport
    );
    const deltaX = targetWorld.x - avatarWorld.x;
    const deltaY = targetWorld.y - avatarWorld.y;
    const distance = Math.hypot(deltaX, deltaY);
    const forward =
      distance > 0
        ? { x: deltaX / distance, y: deltaY / distance }
        : { x: 0, y: 1 };
    const right = { x: -forward.y, y: forward.x };
    const targetScreen = worldToScreen(targetWorld, viewport);
    const aspectRatioX = updatedDonut.aspectRatioX ?? 1;
    const aspectRatioY = updatedDonut.aspectRatioY ?? 1;
    const toWorldRadius = (radiusPixels) =>
      radiusPixels / viewport.pixelsPerUnit;

    const drawOrientedEllipse = (radiusPixels) => {
      const steps = 72;
      const radiusWorldX = toWorldRadius(radiusPixels) * aspectRatioX;
      const radiusWorldY = toWorldRadius(radiusPixels) * aspectRatioY;
      for (let i = 0; i <= steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        const localX = Math.cos(angle) * radiusWorldX;
        const localY = Math.sin(angle) * radiusWorldY;
        const worldPoint = {
          x: targetWorld.x + forward.x * localX + right.x * localY,
          y: targetWorld.y + forward.y * localX + right.y * localY,
          z: WORLD_Z.WATER_SURFACE,
        };
        const screenPoint = worldToScreen(worldPoint, viewport);
        if (i === 0) {
          castAimOverlay.moveTo(screenPoint.x, screenPoint.y);
        } else {
          castAimOverlay.lineTo(screenPoint.x, screenPoint.y);
        }
      }
      castAimOverlay.stroke();
    };

    // Min and max accuracy rings
    castAimOverlay.setStrokeStyle({
      width: 2,
      color: 0x6bdcff,
      alpha: 0.8,
    });
    drawOrientedEllipse(updatedDonut.minRadius);
    drawOrientedEllipse(updatedDonut.maxRadius);

    // Target marker
    castAimOverlay
      .circle(targetScreen.x, targetScreen.y, 3)
      .fill({ color: 0xffffff });

    if (updatedDonut.phase === "oscillate") {
      castAimOverlay.setStrokeStyle({
        width: 2,
        color: 0xffd700,
        alpha: 0.9,
      });
      drawOrientedEllipse(updatedDonut.currentRadius);
    }
    return;
  }

  if (aimState && aimState.phase !== "idle") {
    sessionState.resetCastAim();
  }
  if (donutAimState && donutAimState.phase !== "idle") {
    sessionState.resetDonutAim();
  }
  castAimOverlay.clear();

  if (castMode === "click") {
    const viewport = createViewport(app.screen.width, app.screen.height);
    drawCastRangeRing(viewport);
  }
}
