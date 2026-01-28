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
  cornerBlendMs: 160,
  cornerLeadStrength: 0.6,
  cornerLeadFadeDistance: 1.2,
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
let lastCornerTargetX = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smoothstep01 = (t) => t * t * (3 - 2 * t);

export const resetCornerBlend = () => {
  cornerBlend = 0;
  lastCornerBlendTime = null;
  cornerLeadX = null;
  lastCornerTargetX = null;
};

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
  viewport,
) => {
  if (!castOrigin || !magnetWorld) {
    return { waypoints: [], segments: [] };
  }

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
        magnetWorld,
        WORLD_Y.WALKWAY_FRONT,
        "y",
        true,
      ) ?? {
        x: castOrigin.x,
        y: WORLD_Y.WALKWAY_FRONT,
        z: castOrigin.z,
      };
    if (viewport) {
      lineCorner.x = clamp(lineCorner.x, viewport.worldXMin, viewport.worldXMax);
    }
    const leadDistance = Math.max(
      SEGMENTED_ROPE_CONFIG.cornerLeadFadeDistance,
      SEGMENT_EPSILON,
    );
    const leadScale = clamp(Math.abs(magnetWorld.x) / leadDistance, 0, 1);
    const leadStrength = clamp(SEGMENTED_ROPE_CONFIG.cornerLeadStrength, 0, 1);
    const targetCornerX = lineCorner.x;
    const deltaX = Number.isFinite(lastCornerTargetX)
      ? targetCornerX - lastCornerTargetX
      : 0;
    cornerLeadX = targetCornerX + deltaX * leadStrength * leadScale;
    lastCornerTargetX = targetCornerX;
    const pierCorner = {
      x: Number.isFinite(cornerLeadX) ? cornerLeadX : lineCorner.x,
      y: WORLD_Y.WALKWAY_FRONT,
      z: lerp(lineCorner.z, WORLD_Z.WALKWAY, cornerBlendValue),
    };
    pushWaypoint(pierCorner);
  }

  const waterEntry = computeLinePlaneIntersection(
    waypoints[waypoints.length - 1],
    magnetWorld,
    WORLD_Z.WATER_SURFACE,
    "z",
  );
  if (waterEntry) {
    pushWaypoint(waterEntry);
  }

  pushWaypoint(magnetWorld);

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
) => {
  if (!SEGMENTED_ROPE_CONFIG.enabled) {
    return;
  }

  const now = performance.now();
  const deltaMs = lastCornerBlendTime ? now - lastCornerBlendTime : 0;
  lastCornerBlendTime = now;
  const shouldUseCorner =
    castOrigin.y < WORLD_Y.WALKWAY_FRONT - SEGMENT_EPSILON;
  const blendDelta = SEGMENTED_ROPE_CONFIG.cornerBlendMs
    ? deltaMs / SEGMENTED_ROPE_CONFIG.cornerBlendMs
    : 1;
  if (shouldUseCorner) {
    cornerBlend = clamp(cornerBlend + blendDelta, 0, 1);
  } else {
    cornerBlend = clamp(cornerBlend - blendDelta, 0, 1);
    cornerLeadX = null;
    lastCornerTargetX = null;
  }
  const easedCornerBlend = smoothstep01(cornerBlend);

  const { waypoints, segments, waterEntry } = computeSegmentedRope(
    castOrigin,
    magnetWorld,
    tension,
    easedCornerBlend,
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
    line.setStrokeStyle({
      width: SEGMENTED_ROPE_CONFIG.overlayWidth,
      color: SEGMENTED_ROPE_CONFIG.overlayColor,
      alpha: underwater ? 0.6 : 1.0,
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

  if (SEGMENTED_ROPE_CONFIG.debug.drawWaterEntry && waterEntry) {
    const entryScreen = worldToScreen(waterEntry, viewport);
    line
      .circle(entryScreen.x, entryScreen.y, 4)
      .stroke({ width: 2, color: 0x00c2ff, alpha: 0.9 });
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
