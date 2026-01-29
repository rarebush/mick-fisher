import { WORLD_Y, WORLD_Z, worldToScreen, lerp } from "../mechanics/worldConstants.js";

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
  slackMin: 0.05,
  slackMax: 1.0,
  curveSamples: 10,
  overlayColor: 0xffd200,
  overlayWidth: 2,
  showPhysicsRope: false,
  hideUnderwaterSegments: true,
  underwaterFadeDepth: 0.3,
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
  },
};

const SEGMENT_EPSILON = 1e-4;
let cornerBlend = 0;
let lastCornerBlendTime = null;
let cornerLeadX = null;
let lastWaterEntryScreen = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smoothstep01 = (t) => t * t * (3 - 2 * t);

export const resetCornerBlend = () => {
  cornerBlend = 0;
  lastCornerBlendTime = null;
  cornerLeadX = null;
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

const getQuadraticBezierPoint = (start, control, end, t) => {
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
    z: u * u * start.z + 2 * u * t * control.z + t * t * end.z,
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

const computeSegmentedRope = (
  castOrigin,
  magnetWorld,
  tension,
  cornerBlendValue,
  cornerDistanceBlend,
  viewport,
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

  if (castOrigin.y < WORLD_Y.WALKWAY_FRONT - SEGMENT_EPSILON) {
    const lineCorner =
      computeLinePlaneIntersection(
        castOrigin,
        ropeEnd,
        WORLD_Y.WALKWAY_FRONT,
        "y",
        true,
      );
    if (lineCorner) {
      if (viewport) {
        lineCorner.x = clamp(lineCorner.x, viewport.worldXMin, viewport.worldXMax);
      }
      const distToCornerXY = Math.hypot(
        lineCorner.x - castOrigin.x,
        lineCorner.y - castOrigin.y,
      );
      const distToMagnetXY = Math.hypot(
        ropeEnd.x - castOrigin.x,
        ropeEnd.y - castOrigin.y,
      );
      const cornerReach =
        distToCornerXY > SEGMENT_EPSILON
          ? clamp(distToMagnetXY / distToCornerXY, 0, 1)
          : 1;
      const baseCorner = {
        x: lerp(castOrigin.x, lineCorner.x, cornerReach),
        y: lerp(castOrigin.y, lineCorner.y, cornerReach),
        z: lerp(castOrigin.z, lineCorner.z, cornerReach),
      };
      if (cornerReach >= 1 - SEGMENT_EPSILON) {
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
        const targetCornerZ = lerp(
          lineCorner.z,
          WORLD_Z.WALKWAY,
          cornerBlendValue,
        );
        const cornerZ = Math.max(
          WORLD_Z.WALKWAY,
          lerp(lineCorner.z, targetCornerZ, cornerDistanceBlend),
        );
        const pierCorner = {
          x: viewport
            ? clamp(cornerX, viewport.worldXMin, viewport.worldXMax)
            : cornerX,
          y: WORLD_Y.WALKWAY_FRONT,
          z: cornerZ,
        };
        pushWaypoint(pierCorner);
      } else {
        pushWaypoint(baseCorner);
      }
    }
  }

  const waterEntry = computeLinePlaneIntersection(
    waypoints[waypoints.length - 1],
    ropeEnd,
    WORLD_Z.WATER_SURFACE,
    "z",
  );
  if (waterEntry) {
    pushWaypoint(waterEntry);
  }

  pushWaypoint(ropeEnd);

  const segments = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (areWorldPointsNear(start, end)) continue;
    const type = getSegmentType(start, end);
    const slack = getSegmentSlack(type, tension);
    segments.push({ start, end, type, slack });
  }

  return { waypoints, segments, waterEntry };
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
    options.hideUnderwaterSegments ?? SEGMENTED_ROPE_CONFIG.hideUnderwaterSegments;

  const now = performance.now();
  const deltaMs = lastCornerBlendTime ? now - lastCornerBlendTime : 0;
  lastCornerBlendTime = now;
  const shouldUseCorner =
    castOrigin.y < WORLD_Y.WALKWAY_FRONT - SEGMENT_EPSILON;
  // Time-based corner blend, scaled by origin->corner distance (XY).
  let cornerTimeScale = 1;
  if (shouldUseCorner && SEGMENTED_ROPE_CONFIG.cornerBlendMs) {
    const lineCorner = computeLinePlaneIntersection(
      castOrigin,
      magnetWorld,
      WORLD_Y.WALKWAY_FRONT,
      "y",
      true,
    );
    if (lineCorner) {
      const cornerDistance = Math.hypot(
        lineCorner.x - castOrigin.x,
        lineCorner.y - castOrigin.y,
      );
      const referenceDistance = Math.max(
        SEGMENTED_ROPE_CONFIG.cornerBlendDistanceReference ?? 1,
        SEGMENT_EPSILON,
      );
      cornerTimeScale = clamp(
        cornerDistance / referenceDistance,
        SEGMENTED_ROPE_CONFIG.cornerBlendDistanceScaleMin ?? 1,
        SEGMENTED_ROPE_CONFIG.cornerBlendDistanceScaleMax ?? 1,
      );
    }
  }
  const effectiveCornerBlendMs = SEGMENTED_ROPE_CONFIG.cornerBlendMs
    ? SEGMENTED_ROPE_CONFIG.cornerBlendMs * cornerTimeScale
    : 0;
  const blendDelta = effectiveCornerBlendMs
    ? deltaMs / effectiveCornerBlendMs
    : 1;
  if (shouldUseCorner) {
    cornerBlend = clamp(cornerBlend + blendDelta, 0, 1);
  } else {
    cornerBlend = clamp(cornerBlend - blendDelta, 0, 1);
    cornerLeadX = null;
  }
  const easedCornerBlend = smoothstep01(cornerBlend);
  // Distance-based corner blend (magnet Y vs walkway front).
  const cornerDistanceBlend = SEGMENTED_ROPE_CONFIG.cornerBlendDistance
    ? smoothstep01(
        clamp(
          (magnetWorld.y -
            (WORLD_Y.WALKWAY_FRONT -
              SEGMENTED_ROPE_CONFIG.cornerBlendDistance)) /
            SEGMENTED_ROPE_CONFIG.cornerBlendDistance,
          0,
          1,
        ),
      )
    : 1;
  // Use the stricter of time or distance so both must progress.
  const blendedCorner = Math.min(easedCornerBlend, cornerDistanceBlend);

  const { waypoints, segments, waterEntry } = computeSegmentedRope(
    castOrigin,
    magnetWorld,
    tension,
    easedCornerBlend,
    blendedCorner,
    viewport,
  );

  if (!segments.length) {
    return;
  }

  segments.forEach((segment) => {
    const control = {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2,
      z: (segment.start.z + segment.end.z) / 2 - segment.slack,
    };

    const underwater = segment.type !== "air";
    let alpha = underwater ? 0.6 : 1.0;
    if (underwater && hideUnderwaterSegments) {
      const fadeDepth = Math.max(
        SEGMENTED_ROPE_CONFIG.underwaterFadeDepth ?? 0.6,
        SEGMENT_EPSILON,
      );
      const thresholdZ = WORLD_Z.WATER_SURFACE - fadeDepth;
      let hasDrawn = false;
      for (let i = 0; i < SEGMENTED_ROPE_CONFIG.curveSamples; i += 1) {
        const t0 = i / SEGMENTED_ROPE_CONFIG.curveSamples;
        const t1 = (i + 1) / SEGMENTED_ROPE_CONFIG.curveSamples;
        const p0 = getQuadraticBezierPoint(segment.start, control, segment.end, t0);
        const p1 = getQuadraticBezierPoint(segment.start, control, segment.end, t1);
        const visible0 = p0.z >= thresholdZ;
        const visible1 = p1.z >= thresholdZ;
        if (!visible0 && !visible1) {
          continue;
        }
        const depth0 = Math.max(0, WORLD_Z.WATER_SURFACE - p0.z);
        const depth1 = Math.max(0, WORLD_Z.WATER_SURFACE - p1.z);
        const maxDepth = Math.max(depth0, depth1);
        const fadeT = clamp(maxDepth / fadeDepth, 0, 1);
        const stepAlpha = lerp(0.6, 0, fadeT);
        if (stepAlpha <= 0.02) {
          continue;
        }
        line.setStrokeStyle({
          width: SEGMENTED_ROPE_CONFIG.overlayWidth,
          color: SEGMENTED_ROPE_CONFIG.overlayColor,
          alpha: stepAlpha,
        });
        const s0 = worldToScreen(p0, viewport);
        const s1 = worldToScreen(p1, viewport);
        line.moveTo(s0.x, s0.y);
        line.lineTo(s1.x, s1.y);
        line.stroke();
        hasDrawn = true;
      }
      if (!hasDrawn) {
        return;
      }
    } else {
      line.setStrokeStyle({
        width: SEGMENTED_ROPE_CONFIG.overlayWidth,
        color: SEGMENTED_ROPE_CONFIG.overlayColor,
        alpha,
      });

      for (let i = 0; i <= SEGMENTED_ROPE_CONFIG.curveSamples; i += 1) {
        const t = i / SEGMENTED_ROPE_CONFIG.curveSamples;
        const worldPoint = getQuadraticBezierPoint(
          segment.start,
          control,
          segment.end,
          t,
        );
        const screenPoint = worldToScreen(worldPoint, viewport);
        if (i === 0) {
          line.moveTo(screenPoint.x, screenPoint.y);
        } else {
          line.lineTo(screenPoint.x, screenPoint.y);
        }
      }
      line.stroke();
    }
  });

  if (SEGMENTED_ROPE_CONFIG.debug.drawWaypoints) {
    waypoints.forEach((point, index) => {
      const screenPoint = worldToScreen(point, viewport);
      line
        .circle(screenPoint.x, screenPoint.y, 3)
        .fill({ color: 0x00ff66, alpha: 0.9 });
      if (SEGMENTED_ROPE_CONFIG.debug.drawPierCorner && index === 1) {
        line
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
    line
      .circle(lastWaterEntryScreen.x, lastWaterEntryScreen.y, 4)
      .stroke({ width: 2, color: 0xffd200, alpha: 0.9 });
  }

  if (SEGMENTED_ROPE_CONFIG.debug.drawCornerLine) {
    const originGround = { x: castOrigin.x, y: castOrigin.y, z: WORLD_Z.RIVERBED };
    const magnetGround = {
      x: magnetWorld.x,
      y: magnetWorld.y,
      z: WORLD_Z.RIVERBED,
    };
    const originScreen = worldToScreen(originGround, viewport);
    const magnetScreen = worldToScreen(magnetGround, viewport);
    line
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
        lineCorner.x = clamp(lineCorner.x, viewport.worldXMin, viewport.worldXMax);
      }
      const debugCorner = {
        x: Number.isFinite(cornerLeadX) ? cornerLeadX : lineCorner.x,
        y: lineCorner.y,
        z: lineCorner.z,
      };
      const cornerScreen = worldToScreen(debugCorner, viewport);
      line
        .circle(cornerScreen.x, cornerScreen.y, 4)
        .stroke({ width: 2, color: 0xff00ff, alpha: 0.9 });
    }
  }
};
