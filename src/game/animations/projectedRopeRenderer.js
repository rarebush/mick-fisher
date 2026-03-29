import {
  WORLD_Y,
  WORLD_Z,
  lerp,
  worldToScreen,
} from "../mechanics/worldConstants.js";
import { clamp, distance2D } from "../physics/vectorUtils.js";

// Temporary tuning switch: keep strain color feedback but disable rope shake.
const ENABLE_STRAIN_VIBRATION = true;

export const CORNER_PROJECTION_CONFIG = {
  baseSamples: 20,
  transitionSamples: 4,
  enableDebugVisualization: true,
  slack: 0.2,
  slackResponseExponent: 2,
  maxSagDistanceFactor: 0.45,
  strainStart: 0.1,
  maxVibrationPx: 2.2,
  vibrationFrequency: 28,
  strainColor: 0xff3a30,
  line: {
    color: 0x414141,
    width: 1.1,
    alpha: 1,
  },
  debug: {
    idealColor: 0x66ccff,
    projectedColor: 0xffaa33,
    transitionColor: 0xff33aa,
    idealRadius: 2,
    projectedRadius: 3,
    transitionRadius: 2,
    alpha: 0.5,
  },
};

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

const calculateSag = (start, end, config, slackValue) => {
  const horizontalDistance = distance2D(start, end);
  if (horizontalDistance <= 1e-6) {
    return 0;
  }

  const resolvedSlack = Number.isFinite(slackValue)
    ? Math.max(0, slackValue)
    : 0;
  if (resolvedSlack <= 0) {
    return 0;
  }

  const slackRatio = clamp(resolvedSlack / horizontalDistance, 0, 10);
  const slackResponseExponent = clamp(
    Number.isFinite(config.slackResponseExponent)
      ? config.slackResponseExponent
      : 2,
    0.5,
    4,
  );
  const shapedSlack =
    horizontalDistance * Math.pow(slackRatio, slackResponseExponent);

  // For a parabolic arc, small-sag approximation gives:
  // slack ~= (8 * sag^2) / (3 * distance) -> sag ~= sqrt((3 * distance * slack) / 8)
  // We shape slack response before solving sag to reduce perceived
  // near-taut acceleration while preserving a monotonic, distance-aware curve.
  const sagFromSlack = Math.sqrt((3 * horizontalDistance * shapedSlack) / 8);
  const maxSagDistanceFactor = clamp(
    Number.isFinite(config.maxSagDistanceFactor)
      ? config.maxSagDistanceFactor
      : 0.45,
    0.05,
    1.5,
  );
  const maxSag = horizontalDistance * maxSagDistanceFactor;
  return clamp(sagFromSlack, 0, maxSag);
};

const blendColor = (startColor, endColor, t) => {
  const n = clamp(t, 0, 1);
  const sr = (startColor >> 16) & 0xff;
  const sg = (startColor >> 8) & 0xff;
  const sb = startColor & 0xff;
  const er = (endColor >> 16) & 0xff;
  const eg = (endColor >> 8) & 0xff;
  const eb = endColor & 0xff;

  const r = Math.round(lerp(sr, er, n));
  const g = Math.round(lerp(sg, eg, n));
  const b = Math.round(lerp(sb, eb, n));
  return (r << 16) | (g << 8) | b;
};

const getVisualState = (options, config) => {
  const tension = Number.isFinite(options?.tension) ? options.tension : 0;
  const breakThreshold = Number.isFinite(options?.breakThreshold)
    ? Math.max(0, options.breakThreshold)
    : 0;
  const strainRatio =
    breakThreshold > 0 ? clamp(tension / breakThreshold, 0, 1) : 0;

  const strainStart = clamp(
    Number.isFinite(config.strainStart) ? config.strainStart : 0.1,
    0,
    0.95,
  );
  const strainBlend =
    strainRatio <= strainStart
      ? 0
      : clamp((strainRatio - strainStart) / (1 - strainStart), 0, 1);

  const baseColor = config.line?.color ?? CORNER_PROJECTION_CONFIG.line.color;
  const strainColor =
    config.strainColor ?? CORNER_PROJECTION_CONFIG.strainColor ?? 0xff3a30;
  const color = blendColor(baseColor, strainColor, strainBlend);

  const maxVibrationPx = Math.max(
    0,
    Number.isFinite(config.maxVibrationPx) ? config.maxVibrationPx : 2.2,
  );
  const vibrationFrequency = Math.max(
    0,
    Number.isFinite(config.vibrationFrequency) ? config.vibrationFrequency : 28,
  );
  const timeSeconds = Number.isFinite(options?.timeSeconds)
    ? options.timeSeconds
    : performance.now() / 1000;

  return {
    color,
    strainRatio,
    vibration: {
      amplitudePx: ENABLE_STRAIN_VIBRATION ? maxVibrationPx * strainBlend : 0,
      frequency: vibrationFrequency,
      timeSeconds,
    },
  };
};

const applyVibrationToScreenPoint = (point, index, totalPoints, vibration) => {
  if (!vibration || vibration.amplitudePx <= 0) {
    return point;
  }

  const total = Math.max(2, totalPoints);
  const t = clamp(index / (total - 1), 0, 1);
  const envelope = Math.sin(Math.PI * t);
  if (envelope <= 0) {
    return point;
  }

  const phase = vibration.timeSeconds * Math.PI * 2 * vibration.frequency;
  const wave = Math.sin(phase + index * 0.85);
  const offsetY = wave * vibration.amplitudePx * envelope;
  return {
    x: point.x,
    y: point.y + offsetY,
  };
};

const buildProjectedRopePoints = (
  castOrigin,
  magnetWorld,
  slackValue,
  config,
) => {
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

  const sag = calculateSag(castOrigin, magnetWorld, safeConfig, slackValue);

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
  slackValue,
  config = {},
) {
  if (!castOrigin || !magnetWorld) return [];
  const { points } = buildProjectedRopePoints(
    castOrigin,
    magnetWorld,
    slackValue,
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
  slackValue,
  viewport,
  config = {},
) {
  if (!graphics || !viewport) return;
  const { debug } = buildProjectedRopePoints(
    castOrigin,
    magnetWorld,
    slackValue,
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
export function renderProjectedRopePoints(
  points,
  line,
  viewport,
  config = {},
  renderState = {},
) {
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

  line.setStrokeStyle({
    width: safeConfig.line.width,
    color: renderState.color ?? safeConfig.line.color,
    alpha: safeConfig.line.alpha,
  });

  const startScreenRaw = worldToScreen(points[0], viewport);
  const startScreen = applyVibrationToScreenPoint(
    startScreenRaw,
    0,
    points.length,
    renderState.vibration,
  );
  line.moveTo(startScreen.x, startScreen.y);
  for (let i = 1; i < points.length; i += 1) {
    const screenRaw = worldToScreen(points[i], viewport);
    const screen = applyVibrationToScreenPoint(
      screenRaw,
      i,
      points.length,
      renderState.vibration,
    );
    line.lineTo(screen.x, screen.y);
  }
  line.stroke();
}

function renderProjectedRopeSegments(
  segments,
  line,
  viewport,
  config = {},
  renderState = {},
) {
  if (!line || !viewport || !Array.isArray(segments) || segments.length === 0) {
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

  line.setStrokeStyle({
    width: safeConfig.line.width,
    color: renderState.color ?? safeConfig.line.color,
    alpha: safeConfig.line.alpha,
  });

  const totalPoints = Math.max(2, renderState.totalPoints ?? 2);

  segments.forEach((segment) => {
    if (!Array.isArray(segment) || segment.length < 2) {
      return;
    }
    const getPointIndex = (point, fallback) => {
      const mapped = renderState.pointIndexLookup?.get(point);
      if (Number.isFinite(mapped)) {
        return mapped;
      }
      return fallback;
    };

    const startIndex = getPointIndex(segment[0], 0);
    const startScreenRaw = worldToScreen(segment[0], viewport);
    const startScreen = applyVibrationToScreenPoint(
      startScreenRaw,
      startIndex,
      totalPoints,
      renderState.vibration,
    );
    line.moveTo(startScreen.x, startScreen.y);
    for (let i = 1; i < segment.length; i += 1) {
      const index = getPointIndex(segment[i], startIndex + i);
      const screenRaw = worldToScreen(segment[i], viewport);
      const screen = applyVibrationToScreenPoint(
        screenRaw,
        index,
        totalPoints,
        renderState.vibration,
      );
      line.lineTo(screen.x, screen.y);
    }
  });

  line.stroke();
}

/**
 * Render rope using projected rope points and optional debug overlay.
 * This is the shared entrypoint for cast/drag/reel visuals.
 */
export function renderProjectedRope(
  line,
  viewport,
  castOrigin,
  magnetWorld,
  options = {},
) {
  if (!line || line.destroyed || !viewport || !castOrigin || !magnetWorld) {
    return null;
  }

  line.clear();
  if (options.lineUnderwater) {
    options.lineUnderwater.clear();
  }
  if (options.lineDebug) {
    options.lineDebug.clear();
  }

  const slack =
    Number.isFinite(options?.slack) && options.slack !== null
      ? Math.max(0, options.slack)
      : null;
  const projectedConfig =
    options.projectedRopeConfig ?? CORNER_PROJECTION_CONFIG;
  const ropeConfig = {
    ...projectedConfig,
    breakThreshold: Number.isFinite(options?.breakThreshold)
      ? Math.max(0, options.breakThreshold)
      : projectedConfig.breakThreshold,
  };
  const visualState = getVisualState(options, ropeConfig);
  const projectedPoints = getSingleCurveWithCornerProjection(
    castOrigin,
    magnetWorld,
    slack,
    ropeConfig,
  );
  const pointIndexLookup = new Map(
    projectedPoints.map((point, index) => [point, index]),
  );
  const renderState = {
    color: visualState.color,
    vibration: visualState.vibration,
    pointIndexLookup,
    totalPoints: projectedPoints.length,
  };
  if (options.lineUnderwater) {
    const { aboveSegments, underwaterSegments } = splitRopeByWaterSurface(
      projectedPoints,
      WORLD_Z.WATER_SURFACE,
    );
    renderProjectedRopeSegments(
      aboveSegments,
      line,
      viewport,
      ropeConfig,
      renderState,
    );
    renderProjectedRopeSegments(
      underwaterSegments,
      options.lineUnderwater,
      viewport,
      ropeConfig,
      renderState,
    );
  } else {
    renderProjectedRopePoints(
      projectedPoints,
      line,
      viewport,
      ropeConfig,
      renderState,
    );
  }

  const waterHitWorld = getWaterSurfaceIntersection(projectedPoints);

  if (options.lineDebug) {
    drawProjectedRopeDebug(
      options.lineDebug,
      castOrigin,
      magnetWorld,
      slack,
      viewport,
      ropeConfig,
    );
  }

  return { waterHitWorld, points: projectedPoints };
}

function splitRopeByWaterSurface(points, waterZ) {
  const aboveSegments = [];
  const underwaterSegments = [];

  const pushPoint = (segment, point) => {
    const last = segment[segment.length - 1];
    if (!last) {
      segment.push(point);
      return;
    }
    if (last.x === point.x && last.y === point.y && last.z === point.z) {
      return;
    }
    segment.push(point);
  };

  const appendSegment = (segments, segment) => {
    if (!Array.isArray(segment) || segment.length < 2) {
      return;
    }
    const lastSegment = segments[segments.length - 1];
    if (
      lastSegment &&
      lastSegment.length > 0 &&
      segment[0].x === lastSegment[lastSegment.length - 1].x &&
      segment[0].y === lastSegment[lastSegment.length - 1].y &&
      segment[0].z === lastSegment[lastSegment.length - 1].z
    ) {
      for (let i = 1; i < segment.length; i += 1) {
        pushPoint(lastSegment, segment[i]);
      }
      return;
    }
    segments.push(segment);
  };

  if (!Array.isArray(points) || points.length < 2) {
    return { aboveSegments, underwaterSegments };
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const da = a.z - waterZ;
    const db = b.z - waterZ;

    const segmentsToAdd = [];
    if (da === 0 || db === 0 || da * db <= 0) {
      if (da * db < 0) {
        const t = (waterZ - a.z) / (b.z - a.z);
        const hit = {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          z: waterZ,
        };
        segmentsToAdd.push([a, hit], [hit, b]);
      } else {
        segmentsToAdd.push([a, b]);
      }
    } else {
      segmentsToAdd.push([a, b]);
    }

    segmentsToAdd.forEach((segment) => {
      const midZ = (segment[0].z + segment[1].z) / 2;
      if (midZ >= waterZ) {
        appendSegment(aboveSegments, segment);
      }
      if (midZ <= waterZ) {
        appendSegment(underwaterSegments, segment);
      }
    });
  }

  return { aboveSegments, underwaterSegments };
}

function getWaterSurfaceIntersection(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const waterZ = WORLD_Z.WATER_SURFACE;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const da = a.z - waterZ;
    const db = b.z - waterZ;

    if (da === 0) {
      return { x: a.x, y: a.y, z: waterZ };
    }
    if (da * db > 0) {
      continue;
    }

    const t = da === db ? 0 : (waterZ - a.z) / (b.z - a.z);
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      z: waterZ,
    };
  }

  return null;
}
