[6 tools called]

Here’s the thorough review of duplicate/overlapping code and likely unused exports in `src/`, plus a cleanup plan.

## Duplicate or Overlapping Logic

- **Peak selection logic duplicated in `castLineAnimation` instead of using `getPeakValue`**
  - Utility:

```
1:13:src/game/utils/peakUtils.js
export function getPeakValue(peaks, axis) {
  if (!peaks) return undefined;
  const maxKey = `max${axis}`;
  const minKey = `min${axis}`;
  const maxValue = peaks[maxKey];
  const minValue = peaks[minKey];
  if (!Number.isFinite(maxValue) && !Number.isFinite(minValue)) {
    return undefined;
  }
  if (!Number.isFinite(maxValue)) return minValue;
  if (!Number.isFinite(minValue)) return maxValue;
  return Math.abs(maxValue) >= Math.abs(minValue) ? maxValue : minValue;
}
```

- Duplicated inline logic (two locations in same file):

```
369:382:src/game/animations/castLineAnimation.js
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
```

```
436:448:src/game/animations/castLineAnimation.js
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
```

- **Manual distance calculation duplicates existing `distance2D`**

```
137:141:src/game/animations/castLineAnimation.js
const dx = targetWorld.x - ropeAnchorWorld.x;
const dy = targetWorld.y - ropeAnchorWorld.y;
const dz = targetWorld.z - ropeAnchorWorld.z;
const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
```

```
5:7:src/game/physics/vectorUtils.js
export function distance2D(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
```

- **`magnitudeOrZero` duplicates `magnitude` with null guards**

```
411:414:src/game/sequences/dragSequence.js
function magnitudeOrZero(vector) {
  if (!vector) return 0;
  return magnitude({ x: vector.x || 0, y: vector.y || 0 });
}
```

```
1:3:src/game/physics/vectorUtils.js
export function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
```

- **`getDistance` and `circlesOverlap` duplicate `distance2D` usage**

```
31:47:src/game/mechanics/hitDetection.js
export function getDistance(x1, y1, x2, y2) {
  return distance2D({ x: x1, y: y1 }, { x: x2, y: y2 });
}

export function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  const distance = getDistance(x1, y1, x2, y2);
  return distance <= r1 + r2;
}
```

- **Avatar origin helpers overlap (2D vs 3D)**

```
20:23:src/game/mechanics/castAimUtils.js
export function getAvatarCastOrigin() {
  const avatarWorld = getAvatarWorldPosition();
  return { x: avatarWorld.x, y: avatarWorld.y };
}
```

```
45:51:src/game/mechanics/worldDimensions.js
export function getAvatarHandWorldPosition(offset = {}) {
  const avatar = getAvatarWorldPosition();
  return {
    x: avatar.x + AVATAR_CAST_OFFSET.x + (offset.x || 0),
    y: avatar.y + AVATAR_CAST_OFFSET.y + (offset.y || 0),
    z: avatar.z + AVATAR_CAST_OFFSET.z + (offset.z || 0),
  };
}
```

- **Clamping wrappers overlap core utilities**

```
32:38:src/game/mechanics/castAimUtils.js
export function clampCastAngleDeg(angleDeg) {
  return clamp(angleDeg, CAST_AIM_ANGLE_MIN_DEG, CAST_AIM_ANGLE_MAX_DEG);
}

export function clampCastPower(power) {
  return clamp(power, 0, 1);
}
```

```
31:33:src/game/physics/vectorUtils.js
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
```

```
23:25:src/game/physics/dragPhysics.js
function clampTargetToWorld(target) {
  clampTargetToBounds(target, getWaterBounds());
}
```

```
29:35:src/game/mechanics/worldBounds.js
export function clampTargetToBounds(target, bounds) {
  if (!target?.position) return;
  target.position = {
    ...target.position,
    ...clampPositionToBounds(target.position, bounds),
  };
}
```

- **Duplicate “Need longer line” messaging in two modules**

```
42:58:src/game/animations/messageAnimations.js
export function showAccessMessage(app, x, y) {
  if (!app) return;

  const text = new PIXI.Text({
    text: "Need longer line!",
    style: { fontSize: 20, fill: 0xff0000 },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  app.stage.addChild(text);
  // ...
}
```

```
3:29:src/game/input/inputFeedback.js
export function showAccessMessageAtPosition(app, x, y) {
  if (!app) return;

  const text = new PIXI.Text({
    text: "Need longer line!",
    style: { fontSize: 24, fill: 0xffaa00 },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  app.stage.addChild(text);
  // ...
}
```

## Likely Unused / Orphaned Exports

These appear to be exported but not referenced anywhere in `src/` (outside of barrel re-exports):

- **`rollPlacementQuality`, `isQuadrantAccessible` in `castMechanics`**

```
68:92:src/game/mechanics/castMechanics.js
export function rollPlacementQuality() {
  const roll = Math.random();

  if (roll < 0.5) {
    return {
      placement: "center",
      multiplier: 0.7,
      label: "Center Grip",
    };
  } else if (roll < 0.85) {
    return {
      placement: "edge",
      multiplier: 1.0,
      label: "Edge Grip",
    };
  } else {
    return {
      placement: "corner",
      multiplier: 1.5,
      label: "Corner Grip",
    };
  }
}
```

```
227:230:src/game/mechanics/castMechanics.js
export function isQuadrantAccessible(quadrant, maxRangeMeters) {
  const range = getQuadrantDistance(quadrant);
  return range.max <= maxRangeMeters;
}
```

- **`calculateLoadResistance` exported but not used**

```
19:28:src/game/physics/forceCalculations.js
export function calculateLoadResistance(target, avatarPosition) {
  const pullDirection = normalize(subtract(avatarPosition, target.position));
  const speed = magnitude(target.velocity);
  let alignment = 0;
  if (speed > 0.01) {
    alignment = dotProduct(normalize(target.velocity), pullDirection);
  }
  const speedFactor = Math.max(0.3, 1 - speed * 0.3);
  const alignmentFactor = 1 - alignment * 0.5;
  return target.mass * speedFactor * alignmentFactor * 0.5;
}
```

```
23:30:src/game/physics/physicsSystem.js
export {
  getEngineTorque,
  calculateLoadResistance,
  getPullForce,
  getWaterDrag,
  getCurrentForce,
  getFriction,
} from "./forceCalculations.js";
```

- **Message animation exports not referenced**

```
64:125:src/game/animations/messageAnimations.js
export function showSuccessMessage(app, itemName) { /* ... */ }

export function showFailureMessage(app, reason) { /* ... */ }
```

- **World helpers not referenced (only re-exported)**

```
8:29:src/game/mechanics/worldHelpers.js
export function isUnderwater(worldZ) {
  return worldZ < WORLD_Z.WATER_SURFACE;
}

export function isOnRiverbed(worldZ) {
  return worldZ <= WORLD_Z.RIVERBED;
}

export function getWaterDepth(worldZ) {
  if (worldZ >= WORLD_Z.WATER_SURFACE) return 0;
  return WORLD_Z.WATER_SURFACE - worldZ;
}
```

```
29:37:src/game/mechanics/worldConstants.js
export { createViewport, getWorldBoundsProjectionSamples } from "./viewport.js";

export {
  RENDER_LAYERS,
  getMagnetRenderLayer,
  calculateSortKey,
} from "./renderLayers.js";

export { isUnderwater, isOnRiverbed, getWaterDepth, lerp } from "./worldHelpers.js";
```

- **Render layer helpers not referenced (only re-exported)**

```
8:42:src/game/mechanics/renderLayers.js
export const RENDER_LAYERS = { /* ... */ };

export function getMagnetRenderLayer(worldZ) { /* ... */ }

export function calculateSortKey(worldY, worldZ, worldX = 0) {
  return projectToIsometric(worldX, worldY, worldZ).y;
}
```

- **Viewport debug helper not referenced (only re-exported)**

```
20:44:src/game/mechanics/viewport.js
export function getWorldBoundsProjectionSamples(viewport) {
  const bounds = {
    xMin: WORLD_X.MIN,
    xMax: WORLD_X.MAX,
    yMin: WORLD_Y.MIN,
    yMax: WORLD_Y.MAX,
    zMin: WORLD_Z.RIVERBED,
    zMax: WORLD_Z.MAX,
  };

  const corners = [
    [bounds.xMin, bounds.yMin, bounds.zMin],
    [bounds.xMin, bounds.yMin, bounds.zMax],
    // ...
  ];

  return corners.map(([worldX, worldY, worldZ]) => ({
    world: { x: worldX, y: worldY, z: worldZ },
    screen: projectToScreen(worldX, worldY, worldZ, viewport),
  }));
}
```

## Cleanup Plan (No Code Changes Yet)

- **Peak utilities**
  - Replace manual peak selection in `castLineAnimation` with `getPeakValue` for `X/Y/Z`.
- **Distance and magnitude utilities**
  - Replace manual 2D distance with `distance2D` or add a `distance3D` helper and use it where needed.
  - Move `magnitudeOrZero` into `vectorUtils` (as `safeMagnitude`) or inline null guards at call sites.
- **Helper consolidation**
  - Replace `getAvatarCastOrigin` with a call to `getAvatarHandWorldPosition` and drop the 2D wrapper where possible.
  - Inline `clampCastAngleDeg`, `clampCastPower`, and `clampTargetToWorld` if they don’t add domain meaning.
- **Messaging duplication**
  - Consolidate access message rendering to `inputFeedback` or `messageAnimations` and remove the duplicate. Pick a single style to avoid inconsistent visuals.
- **Unused exports**
  - Remove or un-export unused functions after confirming they aren’t referenced outside `src/` (e.g., in docs, tooling, or tests).
  - If a function is intended for future use, consider adding a comment or moving it to a clearly marked debug/util area.

### Risks and Verification

- **Risk:** Deleting exported functions can break future work or tests outside `src/`.
  - **Mitigation:** Search non-`src` files (docs, scripts) before removal.
- **Risk:** Consolidating wrappers may change behavior if some call sites relied on specific defaults.
  - **Mitigation:** Update call sites in tandem; verify runtime for cast animation and drag sequence.
- **Suggested validation:** Manual playthrough of casting + drag + reel-in + access-blocked cast, check visuals and tension values.

If you want, I can proceed with the cleanup changes next.
