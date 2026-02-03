import {
  WORLD_Y,
  WORLD_Z,
  createViewport,
  getSurfaceScreenBounds,
  screenToWorld,
  worldToScreen,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import { metersToWorldRange } from "../mechanics/castAimUtils.js";

export function isWithinWaterSurface(app, x, y) {
  const viewport = createViewport(app.screen.width, app.screen.height);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  const worldPos = screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
  return (
    worldPos.x >= viewport.worldXMin &&
    worldPos.x <= viewport.worldXMax &&
    worldPos.y >= WORLD_Y.WATER_NEAR &&
    worldPos.y <= WORLD_Y.WATER_FAR &&
    y >= waterBounds.top &&
    y <= waterBounds.bottom
  );
}

export function isWithinCastRange(app, x, y, maxRangeMeters) {
  const viewport = createViewport(app.screen.width, app.screen.height);
  const worldTarget = screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
  const origin = getAvatarWorldPosition();
  const worldDistance = Math.hypot(
    worldTarget.x - origin.x,
    worldTarget.y - origin.y
  );
  const maxRangeWorld = metersToWorldRange(maxRangeMeters);
  return worldTarget.y >= origin.y && worldDistance <= maxRangeWorld;
}

export function getQuadrantFromPosition(
  app,
  x,
  y,
  inputPlane = "waterSurface"
) {
  const viewport = createViewport(app.screen.width, app.screen.height);
  const worldPos =
    inputPlane === "riverbed"
      ? screenToWorld(x, y, WORLD_Z.RIVERBED, viewport)
      : screenToWorld(x, y, WORLD_Z.WATER_SURFACE, viewport);
  const worldXMin = viewport.worldXMin;
  const worldXMax = viewport.worldXMax;
  const worldYMin = WORLD_Y.RIVERBED_NEAR;
  const worldYMax = WORLD_Y.RIVERBED_FAR;

  if (
    worldPos.x < worldXMin ||
    worldPos.x > worldXMax ||
    worldPos.y < worldYMin ||
    worldPos.y > worldYMax
  ) {
    return null;
  }

  const quadrantWidth = (worldXMax - worldXMin) / 3;
  const quadrantHeight = (worldYMax - worldYMin) / 3;

  const col = Math.min(2, Math.floor((worldPos.x - worldXMin) / quadrantWidth));
  const row = Math.min(
    2,
    Math.floor((worldPos.y - worldYMin) / quadrantHeight)
  );

  return row * 3 + col + 1;
}

export function getRiverbedScreenFromWaterScreen(app, x, y, viewport = null) {
  const resolvedViewport =
    viewport || createViewport(app.screen.width, app.screen.height);
  const waterWorld = screenToWorld(
    x,
    y,
    WORLD_Z.WATER_SURFACE,
    resolvedViewport
  );
  return worldToScreen(
    { x: waterWorld.x, y: waterWorld.y, z: WORLD_Z.RIVERBED },
    resolvedViewport
  );
}
