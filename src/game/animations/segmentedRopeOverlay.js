import {
  WORLD_Y,
  WORLD_Z,
  worldToScreen,
  lerp,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";

export const SEGMENTED_ROPE_CONFIG = {
  enabled: true,
  castOriginYOffset: 0,
  slackByType: {
    air: 0.6,
    water: 0.35,
    riverbed: 0.15,
  },
  slackScaleMin: 0.3,
  slackScaleMax: 1.2,
  slackMin: 0,
  slackMax: 1.0,
  curveSamples: 10,
  waterEntrySamples: 40,
  overlayColor: 0xffd200,
  overlayWidth: 2,
  showPhysicsRope: false,
  hideUnderwaterSegments: true,
  underwaterFadeDepth: 0.3,
  ropeSagScale: 0.7,
  ropeSagMin: 0,
  ropeSagMax: 1.0,
  ropeSagSmoothing: 0.25,
  ropeSagFirstSegmentMultiplier: 0.1,
  cornerIntersectSamples: 24,
  cornerIntersectDepth: 0.35,
  cornerTransitionMs: 450,
  // Time (ms) for the corner blend to ease 0 -> 1 (and back).
  // Smaller = faster snap to the corner; larger = slower transition.
  cornerBlendMs: 2000,
  // Reference distance (world units, XY) used to scale cornerBlendMs.
  cornerBlendDistanceReference: 1.5,
  // Clamp for the distance-based time scaling.
  cornerBlendDistanceScaleMin: 0.6,
  cornerBlendDistanceScaleMax: 3.0,
  // Distance (world Y) over which the corner blend ramps based on magnet position.
  cornerBlendDistance: 1.0,
  cornerLeadStrength: 0.5,
  cornerLeadMaxOffset: 11.0,
  cornerLeadFadeDistance: 1.2,
  cornerLeadSmoothing: 0.2,
  debug: {
    drawWaypoints: true,
    drawWaterEntry: true,
    drawPierCorner: true,
    drawCornerLine: true,
    drawSingleCurve: true,
    drawCornerIntersection: true,
    drawAvatarFeet: true,
    singleCurveAlpha: 0.35,
    singleCurveColor: 0x66ccff,
    cornerIntersectionColor: 0xff66ff,
    riverwallIntersectionColor: 0x00ff66,
    walkwayIntersectionColor: 0x999999,
  },
};

const SEGMENT_EPSILON = 1e-4;
let cornerBlend = 0;
let lastCornerBlendTime = null;
let cornerLeadX = null;
let lastWaterEntryScreen = null;
let lastSingleSegmentSags = [];
let lastCornerSegmentSags = [];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smoothstep01 = (t) => t * t * (3 - 2 * t);

export const resetCornerBlend = () => {
  cornerBlend = 0;
  lastCornerBlendTime = null;
  cornerLeadX = null;
  lastSingleSegmentSags = [];
  lastCornerSegmentSags = [];
};

export const getSegmentedWaterEntryScreen = () => lastWaterEntryScreen;

const areWorldPointsNear = (a, b, epsilon = SEGMENT_EPSILON) => {
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.z - b.z) < epsilon
  );
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

const computeLinePlaneIntersection = (
  start,
  end,
  planeValue,
  axis = "z",
  allowOutsideSegment = false,
) => {
  const startValue = start[axis];
  const endValue = end[axis];
  const delta = endValue - startValue;
  if (Math.abs(delta) < SEGMENT_EPSILON) {
    return null;
  }
  const t = (planeValue - startValue) / delta;
  if (!allowOutsideSegment && (t <= 0 || t >= 1)) {
    return null;
  }
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
};

const getSegmentType = (start, end) => {
  const maxZ = Math.max(start.z, end.z);
  if (maxZ <= WORLD_Z.RIVERBED + SEGMENT_EPSILON) {
    return "riverbed";
  }
  if (maxZ <= WORLD_Z.WATER_SURFACE + SEGMENT_EPSILON) {
    return "water";
  }
  return "air";
};

const getSegmentSlack = (segmentType, tension = 50) => {
  const tensionNormalized = clamp(tension / 100, 0, 1);
  const baseSlack =
    SEGMENTED_ROPE_CONFIG.slackByType[segmentType] ??
    SEGMENTED_ROPE_CONFIG.slackByType.air;
  const slackScale = lerp(
    SEGMENTED_ROPE_CONFIG.slackScaleMin,
    SEGMENTED_ROPE_CONFIG.slackScaleMax,
    1 - tensionNormalized,
  );
  return clamp(
    baseSlack * slackScale,
    SEGMENTED_ROPE_CONFIG.slackMin,
    SEGMENTED_ROPE_CONFIG.slackMax,
  );
};

const getSegmentTargetSag = (segment) => {
  const horizontalDistance = Math.hypot(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y,
  );
  const sagScale = SEGMENTED_ROPE_CONFIG.ropeSagScale ?? 0.5;
  const sagMultiplier =
    Number.isFinite(segment.sagMultiplier) && segment.sagMultiplier >= 0
      ? segment.sagMultiplier
      : 1;
  const sag = segment.slack * horizontalDistance * sagScale * sagMultiplier;
  return clamp(
    sag,
    SEGMENTED_ROPE_CONFIG.ropeSagMin,
    SEGMENTED_ROPE_CONFIG.ropeSagMax,
  );
};

const getSegmentCurvePoint = (segment, t) => {
  const sag =
    Number.isFinite(segment.sag) && segment.sag > 0
      ? segment.sag
      : getSegmentTargetSag(segment);
  const minZ =
    Number.isFinite(segment.minZ) && segment.minZ !== null
      ? segment.minZ
      : WORLD_Z.RIVERBED;
  return getParabolicSagPoint(segment.start, segment.end, t, sag, minZ);
};

const findWaterEntryOnSegments = (segments) => {
  const samples =
    SEGMENTED_ROPE_CONFIG.waterEntrySamples ??
    SEGMENTED_ROPE_CONFIG.curveSamples ??
    10;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    for (let j = 0; j < samples; j += 1) {
      const t0 = j / samples;
      const t1 = (j + 1) / samples;
      const p0 = getSegmentCurvePoint(segment, t0);
      const p1 = getSegmentCurvePoint(segment, t1);
      const d0 = p0.z - WORLD_Z.WATER_SURFACE;
      const d1 = p1.z - WORLD_Z.WATER_SURFACE;
      if (d0 === 0) {
        return p0;
      }
      if (d0 * d1 < 0) {
        const hitT = Math.abs(d0 - d1) > SEGMENT_EPSILON ? d0 / (d0 - d1) : 0;
        return {
          x: lerp(p0.x, p1.x, hitT),
          y: lerp(p0.y, p1.y, hitT),
          z: WORLD_Z.WATER_SURFACE,
        };
      }
    }
  }
  return null;
};

const getSegmentsFromWaypoints = (waypoints, tension, castOrigin, lastSags) => {
  const segments = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (areWorldPointsNear(start, end)) continue;
    const type = getSegmentType(start, end);
    const slack = getSegmentSlack(type, tension);
    const minZ =
      start === castOrigin && end?.isPierCorner ? WORLD_Z.WALKWAY : null;
    segments.push({ start, end, type, slack, minZ });
  }

  if (segments.length) {
    const smoothing = clamp(
      SEGMENTED_ROPE_CONFIG.ropeSagSmoothing ?? 0.25,
      0,
      1,
    );
    const nextSags = [];
    for (let i = 0; i < segments.length; i += 1) {
      const isFirstSegment = segments.length > 1 && i === 0;
      segments[i].sagMultiplier = isFirstSegment
        ? (SEGMENTED_ROPE_CONFIG.ropeSagFirstSegmentMultiplier ?? 1)
        : 1;
      const targetSag = getSegmentTargetSag(segments[i]);
      const prevSag = lastSags[i];
      const smoothedSag =
        Number.isFinite(prevSag) && smoothing > 0
          ? lerp(prevSag, targetSag, smoothing)
          : targetSag;
      segments[i].sag = smoothedSag;
      nextSags[i] = smoothedSag;
    }
    return { segments, nextSags };
  }

  return { segments, nextSags: [] };
};

const computeCornerIntersectionFactor = (segments) => {
  const samples = Math.max(
    2,
    SEGMENTED_ROPE_CONFIG.cornerIntersectSamples ??
      SEGMENTED_ROPE_CONFIG.curveSamples ??
      10,
  );
  const maxDepth = Math.max(
    SEGMENTED_ROPE_CONFIG.cornerIntersectDepth ?? 0.2,
    SEGMENT_EPSILON,
  );
  let maxFactor = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    for (let j = 0; j < samples; j += 1) {
      const t0 = j / samples;
      const t1 = (j + 1) / samples;
      const p0 = getSegmentCurvePoint(segment, t0);
      const p1 = getSegmentCurvePoint(segment, t1);
      const y0 = p0.y - WORLD_Y.WALKWAY_FRONT;
      const y1 = p1.y - WORLD_Y.WALKWAY_FRONT;
      if (y0 === 0 || y0 * y1 < 0) {
        const tCross = Math.abs(y1 - y0) > SEGMENT_EPSILON ? y0 / (y0 - y1) : 0;
        const zCross = lerp(p0.z, p1.z, tCross);
        if (
          zCross >= WORLD_Z.RIVERBED - SEGMENT_EPSILON &&
          zCross <= WORLD_Z.WALKWAY + SEGMENT_EPSILON
        ) {
          const depth = WORLD_Z.WALKWAY - zCross;
          if (depth > 0) {
            maxFactor = Math.max(maxFactor, clamp(depth / maxDepth, 0, 1));
          }
        }
      }
    }
  }
  return clamp(maxFactor, 0, 1);
};

const findCurvePlaneIntersection = (
  segments,
  axis,
  planeValue,
  boundsCheck,
) => {
  const samples = Math.max(
    2,
    SEGMENTED_ROPE_CONFIG.cornerIntersectSamples ??
      SEGMENTED_ROPE_CONFIG.curveSamples ??
      10,
  );
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    for (let j = 0; j < samples; j += 1) {
      const t0 = j / samples;
      const t1 = (j + 1) / samples;
      const p0 = getSegmentCurvePoint(segment, t0);
      const p1 = getSegmentCurvePoint(segment, t1);
      const d0 = p0[axis] - planeValue;
      const d1 = p1[axis] - planeValue;
      if (d0 === 0 || d0 * d1 < 0) {
        const tCross = Math.abs(d1 - d0) > SEGMENT_EPSILON ? d0 / (d0 - d1) : 0;
        const hitPoint = {
          x: lerp(p0.x, p1.x, tCross),
          y: lerp(p0.y, p1.y, tCross),
          z: lerp(p0.z, p1.z, tCross),
        };
        if (!boundsCheck || boundsCheck(hitPoint)) {
          return hitPoint;
        }
      }
    }
  }
  return null;
};

const computeCornerWaypoints = (
  castOrigin,
  magnetWorld,
  cornerDistanceBlend,
  viewport,
  shouldIncludeCorner,
) => {
  if (!castOrigin || !magnetWorld) {
    return { waypoints: [], segments: [] };
  }

  const ropeEnd = magnetWorld;

  const waypoints = [];
  const pushWaypoint = (point) => {
    if (!point) return;
    const last = waypoints[waypoints.length - 1];
    if (!last || !areWorldPointsNear(last, point)) {
      waypoints.push(point);
    }
  };

  pushWaypoint(castOrigin);

  if (
    shouldIncludeCorner &&
    castOrigin.y < WORLD_Y.WALKWAY_FRONT - SEGMENT_EPSILON
  ) {
    const lineCorner = computeLinePlaneIntersection(
      castOrigin,
      ropeEnd,
      WORLD_Y.WALKWAY_FRONT,
      "y",
      true,
    );
    if (lineCorner) {
      if (viewport) {
        lineCorner.x = clamp(
          lineCorner.x,
          viewport.worldXMin,
          viewport.worldXMax,
        );
      }
      const leadDistance = Math.max(
        SEGMENTED_ROPE_CONFIG.cornerLeadFadeDistance,
        SEGMENT_EPSILON,
      );
      const leadScale = clamp(Math.abs(magnetWorld.x) / leadDistance, 0, 1);
      const leadStrength = Math.max(
        0,
        SEGMENTED_ROPE_CONFIG.cornerLeadStrength,
      );
      const targetCornerX = lineCorner.x;
      const leadOffsetRaw =
        (castOrigin.x - targetCornerX) * leadStrength * leadScale;
      const leadOffset = clamp(
        leadOffsetRaw,
        -SEGMENTED_ROPE_CONFIG.cornerLeadMaxOffset,
        SEGMENTED_ROPE_CONFIG.cornerLeadMaxOffset,
      );
      const leadTargetX = targetCornerX + leadOffset;
      const leadSmoothing = clamp(
        SEGMENTED_ROPE_CONFIG.cornerLeadSmoothing ?? 0.2,
        0,
        1,
      );
      cornerLeadX = Number.isFinite(cornerLeadX)
        ? lerp(cornerLeadX, leadTargetX, leadSmoothing)
        : leadTargetX;
      const cornerX = lerp(
        lineCorner.x,
        Number.isFinite(cornerLeadX) ? cornerLeadX : lineCorner.x,
        cornerDistanceBlend,
      );
      const pierCorner = {
        x: viewport
          ? clamp(cornerX, viewport.worldXMin, viewport.worldXMax)
          : cornerX,
        y: WORLD_Y.WALKWAY_FRONT,
        z: WORLD_Z.WALKWAY,
        isPierCorner: true,
      };
      pushWaypoint(pierCorner);
    }
  }

  pushWaypoint(ropeEnd);

  return { waypoints };
};

export const renderSegmentedRopeOverlay = (
  line,
  castOrigin,
  magnetWorld,
  tension,
  viewport,
  options = {},
) => {
  if (!SEGMENTED_ROPE_CONFIG.enabled) {
    return;
  }

  const hideUnderwaterSegments =
    options.hideUnderwaterSegments ??
    SEGMENTED_ROPE_CONFIG.hideUnderwaterSegments;

  const now = performance.now();
  const deltaMs = lastCornerBlendTime ? now - lastCornerBlendTime : 0;
  lastCornerBlendTime = now;

  const singleWaypoints = [castOrigin, magnetWorld];
  const { segments: singleSegments, nextSags: nextSingleSags } =
    getSegmentsFromWaypoints(
      singleWaypoints,
      tension,
      castOrigin,
      lastSingleSegmentSags,
    );
  lastSingleSegmentSags = nextSingleSags;

  const intersectionFactor = singleSegments.length
    ? computeCornerIntersectionFactor(singleSegments)
    : 0;

  const cornerBlendDelta = SEGMENTED_ROPE_CONFIG.cornerTransitionMs
    ? deltaMs / SEGMENTED_ROPE_CONFIG.cornerTransitionMs
    : 1;
  cornerBlend = clamp(
    lerp(cornerBlend, intersectionFactor, cornerBlendDelta),
    0,
    1,
  );
  if (cornerBlend <= SEGMENT_EPSILON) {
    cornerLeadX = null;
  }
  const easedCornerBlend = smoothstep01(cornerBlend);

  const shouldIncludeCorner = cornerBlend > 0.001;
  const { waypoints: cornerWaypoints } = computeCornerWaypoints(
    castOrigin,
    magnetWorld,
    easedCornerBlend,
    viewport,
    shouldIncludeCorner,
  );
  const { segments: cornerSegments, nextSags: nextCornerSags } =
    getSegmentsFromWaypoints(
      cornerWaypoints,
      tension,
      castOrigin,
      lastCornerSegmentSags,
    );
  lastCornerSegmentSags = nextCornerSags;

  const activeWaypoints = shouldIncludeCorner
    ? cornerWaypoints
    : singleWaypoints;
  const segments = shouldIncludeCorner ? cornerSegments : singleSegments;
  const waterEntry = findWaterEntryOnSegments(segments);
  if (!segments.length) {
    return;
  }

  const lineAbove = options.lineAbove ?? line;
  const lineBelow = options.lineBelow ?? line;
  const debugLine = options.debugLine ?? lineAbove;
  const fadeDepth = Math.max(
    SEGMENTED_ROPE_CONFIG.underwaterFadeDepth ?? 0.9,
    SEGMENT_EPSILON,
  );
  const samples = Math.max(2, SEGMENTED_ROPE_CONFIG.curveSamples);

  const drawStep = (
    targetLine,
    p0,
    p1,
    alpha,
    colorOverride = SEGMENTED_ROPE_CONFIG.overlayColor,
  ) => {
    if (!targetLine) return;
    if (alpha <= 0.02) return;
    targetLine.setStrokeStyle({
      width: SEGMENTED_ROPE_CONFIG.overlayWidth,
      color: colorOverride,
      alpha,
    });
    const s0 = worldToScreen(p0, viewport);
    const s1 = worldToScreen(p1, viewport);
    targetLine.moveTo(s0.x, s0.y);
    targetLine.lineTo(s1.x, s1.y);
    targetLine.stroke();
  };

  const drawUnderwaterStep = (p0, p1, alphaMultiplier = 1, colorOverride) => {
    if (!lineBelow) return;
    const depth0 = Math.max(0, WORLD_Z.WATER_SURFACE - p0.z);
    const depth1 = Math.max(0, WORLD_Z.WATER_SURFACE - p1.z);
    const maxDepth = Math.max(depth0, depth1);
    const fadeT = clamp(maxDepth / fadeDepth, 0, 1);
    const stepAlpha = hideUnderwaterSegments ? lerp(0.6, 0, fadeT) : 0.6;
    drawStep(lineBelow, p0, p1, stepAlpha * alphaMultiplier, colorOverride);
  };

  const renderSegments = (segmentList, alphaMultiplier, colorOverride) => {
    segmentList.forEach((segment) => {
      for (let i = 0; i < samples; i += 1) {
        const t0 = i / samples;
        const t1 = (i + 1) / samples;
        const p0 = getSegmentCurvePoint(segment, t0);
        const p1 = getSegmentCurvePoint(segment, t1);
        const above0 = p0.z >= WORLD_Z.WATER_SURFACE;
        const above1 = p1.z >= WORLD_Z.WATER_SURFACE;

        if (above0 && above1) {
          drawStep(lineAbove, p0, p1, 1.0 * alphaMultiplier, colorOverride);
          continue;
        }

        if (!above0 && !above1) {
          drawUnderwaterStep(p0, p1, alphaMultiplier, colorOverride);
          continue;
        }

        const splitT =
          Math.abs(p1.z - p0.z) > SEGMENT_EPSILON
            ? (WORLD_Z.WATER_SURFACE - p0.z) / (p1.z - p0.z)
            : 0.5;
        const mid = {
          x: lerp(p0.x, p1.x, splitT),
          y: lerp(p0.y, p1.y, splitT),
          z: WORLD_Z.WATER_SURFACE,
        };

        if (above0) {
          drawStep(lineAbove, p0, mid, 1.0 * alphaMultiplier, colorOverride);
          drawUnderwaterStep(mid, p1, alphaMultiplier, colorOverride);
        } else {
          drawUnderwaterStep(p0, mid, alphaMultiplier, colorOverride);
          drawStep(lineAbove, mid, p1, 1.0 * alphaMultiplier, colorOverride);
        }
      }
    });
  };

  renderSegments(segments, 1);

  if (SEGMENTED_ROPE_CONFIG.debug.drawSingleCurve && singleSegments.length) {
    renderSegments(
      singleSegments,
      SEGMENTED_ROPE_CONFIG.debug.singleCurveAlpha ?? 0.35,
      SEGMENTED_ROPE_CONFIG.debug.singleCurveColor ??
        SEGMENTED_ROPE_CONFIG.overlayColor,
    );
  }

  if (SEGMENTED_ROPE_CONFIG.debug.drawAvatarFeet) {
    const avatarWorld = getAvatarWorldPosition();
    const avatarFeetWorld = {
      x: castOrigin.x,
      y: avatarWorld.y,
      z: WORLD_Z.AVATAR_FEET,
    };
    const avatarFeetScreen = worldToScreen(avatarFeetWorld, viewport);
    debugLine
      .circle(avatarFeetScreen.x, avatarFeetScreen.y, 6)
      .fill({ color: 0xff0000, alpha: 1 });
  }

  if (SEGMENTED_ROPE_CONFIG.debug.drawWaypoints) {
    activeWaypoints.forEach((point, index) => {
      const screenPoint = worldToScreen(point, viewport);
      debugLine
        .circle(screenPoint.x, screenPoint.y, 3)
        .fill({ color: 0x00ff66, alpha: 0.9 });
      if (SEGMENTED_ROPE_CONFIG.debug.drawPierCorner && index === 1) {
        debugLine
          .circle(screenPoint.x, screenPoint.y, 5)
          .stroke({ width: 2, color: 0xff5500, alpha: 0.9 });
      }
    });
  }

  if (waterEntry) {
    lastWaterEntryScreen = worldToScreen(waterEntry, viewport);
  } else {
    lastWaterEntryScreen = null;
  }
  if (SEGMENTED_ROPE_CONFIG.debug.drawWaterEntry && lastWaterEntryScreen) {
    debugLine
      .circle(lastWaterEntryScreen.x, lastWaterEntryScreen.y, 4)
      .stroke({ width: 2, color: 0xffd200, alpha: 0.9 });
  }

  if (
    SEGMENTED_ROPE_CONFIG.debug.drawCornerIntersection &&
    singleSegments.length
  ) {
    const riverwallPoint = findCurvePlaneIntersection(
      singleSegments,
      "y",
      WORLD_Y.WALKWAY_FRONT,
      (point) =>
        point.z >= WORLD_Z.RIVERBED - SEGMENT_EPSILON &&
        point.z <= WORLD_Z.WALKWAY + SEGMENT_EPSILON,
    );
    const walkwayPoint = findCurvePlaneIntersection(
      singleSegments,
      "z",
      WORLD_Z.WALKWAY,
      (point) => point.y <= WORLD_Y.WALKWAY_FRONT + SEGMENT_EPSILON,
    );
    const riverwallMarkerColor =
      SEGMENTED_ROPE_CONFIG.debug.riverwallIntersectionColor ??
      SEGMENTED_ROPE_CONFIG.debug.cornerIntersectionColor ??
      0x00ff66;
    const walkwayMarkerColor =
      SEGMENTED_ROPE_CONFIG.debug.walkwayIntersectionColor ??
      SEGMENTED_ROPE_CONFIG.debug.cornerIntersectionColor ??
      0x999999;
    if (riverwallPoint) {
      riverwallPoint.y = WORLD_Y.WALKWAY_FRONT;
      const screenPoint = worldToScreen(riverwallPoint, viewport);
      debugLine
        .circle(screenPoint.x, screenPoint.y, 4)
        .stroke({ width: 2, color: riverwallMarkerColor, alpha: 0.9 });
    }
    if (walkwayPoint) {
      walkwayPoint.z = WORLD_Z.WALKWAY;
      const screenPoint = worldToScreen(walkwayPoint, viewport);
      debugLine
        .circle(screenPoint.x, screenPoint.y, 5)
        .stroke({ width: 2, color: walkwayMarkerColor, alpha: 0.6 });
    }
  }

  if (SEGMENTED_ROPE_CONFIG.debug.drawCornerLine) {
    const originGround = {
      x: castOrigin.x,
      y: castOrigin.y,
      z: WORLD_Z.RIVERBED,
    };
    const magnetGround = {
      x: magnetWorld.x,
      y: magnetWorld.y,
      z: WORLD_Z.RIVERBED,
    };
    const originScreen = worldToScreen(originGround, viewport);
    const magnetScreen = worldToScreen(magnetGround, viewport);
    debugLine
      .moveTo(originScreen.x, originScreen.y)
      .lineTo(magnetScreen.x, magnetScreen.y)
      .stroke({ width: 1, color: 0xff00ff, alpha: 0.7 });

    const lineCorner = computeLinePlaneIntersection(
      originGround,
      magnetGround,
      WORLD_Y.WALKWAY_FRONT,
      "y",
      true,
    );
    if (lineCorner) {
      if (viewport) {
        lineCorner.x = clamp(
          lineCorner.x,
          viewport.worldXMin,
          viewport.worldXMax,
        );
      }
      const debugCorner = {
        x: Number.isFinite(cornerLeadX) ? cornerLeadX : lineCorner.x,
        y: lineCorner.y,
        z: lineCorner.z,
      };
      const cornerScreen = worldToScreen(debugCorner, viewport);
      debugLine
        .circle(cornerScreen.x, cornerScreen.y, 4)
        .stroke({ width: 2, color: 0xff00ff, alpha: 0.9 });
    }
  }
};
