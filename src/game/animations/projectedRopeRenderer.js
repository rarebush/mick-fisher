import {
  WORLD_Y,
  WORLD_Z,
  lerp,
  worldToScreen,
} from "../mechanics/worldConstants.js";

export const CORNER_PROJECTION_CONFIG = {
  baseSamples: 20,
  transitionSamples: 4,
  enableDebugVisualization: true,
  slack: 0.2,
  line: {
    color: 0x000000,
    width: 2,
    alpha: 1,
  },
  debug: {
    idealColor: 0x66ccff,
    projectedColor: 0xffaa33,
    transitionColor: 0xff33aa,
    idealRadius: 3,
    projectedRadius: 4,
    transitionRadius: 3,
    alpha: 0.9,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getParabolicSagPoint = (start, end, t, sag, minZ = WORLD_Z.RIVERBED) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const baseZ = start.z + dz * t;
  const sagOffset = 4 * sag * t * (1 - t);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
    z: Math.max(baseZ - sagOffset, minZ),
  };
};

const penetratesWalkway = (point) =>
  point.y <= WORLD_Y.WALKWAY_FRONT && point.z < WORLD_Z.WALKWAY;

const projectToWalkway = (point) => ({
  x: point.x,
  y: point.y,
  z: WORLD_Z.WALKWAY,
});

const calculateSag = (start, end, tension, config) => {
  const horizontalDistance = Math.hypot(end.x - start.x, end.y - start.y);
  const tensionFactor = 1 - clamp(tension / 100, 0, 1);
  const slack = Number.isFinite(config.slack) ? config.slack : 0.6;
  const sag = slack * horizontalDistance * tensionFactor;
  return Math.max(0, sag);
};

const buildProjectedRopePoints = (castOrigin, magnetWorld, tension, config) => {
  const safeConfig = {
    ...CORNER_PROJECTION_CONFIG,
    ...config,
    debug: {
      ...CORNER_PROJECTION_CONFIG.debug,
      ...(config?.debug ?? {}),
    },
  };
  const baseSamples = Math.max(2, Math.round(safeConfig.baseSamples ?? 10));
  const transitionSamples = Math.max(
    0,
    Math.round(safeConfig.transitionSamples ?? 0),
  );

  const sag = calculateSag(castOrigin, magnetWorld, tension ?? 50, safeConfig);

  const basePoints = [];
  const idealPoints = [];
  const projectedPoints = [];
  const transitionPoints = [];

  for (let i = 0; i < baseSamples; i += 1) {
    const t = baseSamples === 1 ? 0 : i / (baseSamples - 1);
    const idealPoint = getParabolicSagPoint(
      castOrigin,
      magnetWorld,
      t,
      sag,
      WORLD_Z.RIVERBED,
    );
    const needsProjection = penetratesWalkway(idealPoint);
    const projectedPoint = needsProjection
      ? projectToWalkway(idealPoint)
      : idealPoint;

    idealPoints.push(idealPoint);
    if (needsProjection) {
      projectedPoints.push(projectedPoint);
    }

    basePoints.push({
      point: projectedPoint,
      projected: needsProjection,
    });
  }

  const finalPoints = [];
  for (let i = 0; i < basePoints.length; i += 1) {
    const current = basePoints[i];
    finalPoints.push(current.point);

    const next = basePoints[i + 1];
    if (!next) break;

    const isTransition = current.projected !== next.projected;
    if (!isTransition || transitionSamples === 0) continue;

    for (let j = 1; j <= transitionSamples; j += 1) {
      const t = j / (transitionSamples + 1);
      const intermediate = {
        x: lerp(current.point.x, next.point.x, t),
        y: lerp(current.point.y, next.point.y, t),
        z: lerp(current.point.z, next.point.z, t),
      };
      const projectedIntermediateRaw = penetratesWalkway(intermediate)
        ? projectToWalkway(intermediate)
        : intermediate;
      const projectedIntermediate = {
        ...projectedIntermediateRaw,
        z: Math.max(projectedIntermediateRaw.z, WORLD_Z.RIVERBED),
      };
      transitionPoints.push(projectedIntermediate);
      finalPoints.push(projectedIntermediate);
    }
  }

  return {
    points: finalPoints,
    debug: {
      idealPoints,
      projectedPoints,
      transitionPoints,
      config: safeConfig,
    },
  };
};

/**
 * Generate a single continuous rope curve with corner projection.
 * Returns world-space points ready for rendering.
 */
export function getSingleCurveWithCornerProjection(
  castOrigin,
  magnetWorld,
  tension,
  config = {},
) {
  if (!castOrigin || !magnetWorld) return [];
  const { points } = buildProjectedRopePoints(
    castOrigin,
    magnetWorld,
    tension,
    config,
  );
  return points;
}

/**
 * Optional debug helper that draws markers for rope sampling.
 * - Ideal points: pre-projection curve samples
 * - Projected points: samples clamped to the walkway
 * - Transition points: extra samples added around corner transitions
 */
export function drawProjectedRopeDebug(
  graphics,
  castOrigin,
  magnetWorld,
  tension,
  viewport,
  config = {},
) {
  if (!graphics || !viewport) return;
  const { debug } = buildProjectedRopePoints(
    castOrigin,
    magnetWorld,
    tension,
    config,
  );
  if (!debug?.config?.enableDebugVisualization) return;

  const {
    idealPoints,
    projectedPoints,
    transitionPoints,
    config: safeConfig,
  } = debug;
  const debugConfig = safeConfig.debug ?? CORNER_PROJECTION_CONFIG.debug;
  const alpha = debugConfig.alpha ?? 0.9;

  const drawPoints = (points, color, radius) => {
    points.forEach((point) => {
      const screen = worldToScreen(point, viewport);
      graphics.circle(screen.x, screen.y, radius).fill({ color, alpha });
    });
  };

  drawPoints(idealPoints, debugConfig.idealColor, debugConfig.idealRadius);
  drawPoints(
    projectedPoints,
    debugConfig.projectedColor,
    debugConfig.projectedRadius,
  );
  drawPoints(
    transitionPoints,
    debugConfig.transitionColor,
    debugConfig.transitionRadius,
  );
}

/**
 * Render projected rope points onto a PIXI.Graphics line.
 * Uses black stroke by default to match desired rope color.
 */
export function renderProjectedRopePoints(points, line, viewport, config = {}) {
  if (!line || !viewport || !Array.isArray(points) || points.length < 2) {
    return;
  }

  const safeConfig = {
    ...CORNER_PROJECTION_CONFIG,
    ...config,
    line: {
      ...CORNER_PROJECTION_CONFIG.line,
      ...(config?.line ?? {}),
    },
  };

  line.clear();
  line.setStrokeStyle({
    width: safeConfig.line.width,
    color: safeConfig.line.color,
    alpha: safeConfig.line.alpha,
  });

  const startScreen = worldToScreen(points[0], viewport);
  line.moveTo(startScreen.x, startScreen.y);
  for (let i = 1; i < points.length; i += 1) {
    const screen = worldToScreen(points[i], viewport);
    line.lineTo(screen.x, screen.y);
  }
  line.stroke();
}
