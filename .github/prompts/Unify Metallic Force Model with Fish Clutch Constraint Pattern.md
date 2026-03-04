# Prompt: Unify Metallic Force Model with Fish Clutch Constraint Pattern

## Context

You are working on `src/game/physics/dragPhysics.js` in a 2D fishing/magnet fishing game. The file contains a single large function `updateDragPhysics()` that runs every frame. It handles two target types: `"fish"` and `"metallic"`. Both are connected to the player by a fishing line running through a reel with a clutch (drag) mechanism.

The fish path was recently refactored to use a correct constraint-based clutch model. The metallic path still uses an older additive model that produces physically incorrect results in certain scenarios. This task unifies the metallic path's line force and tension calculations with the fish path's proven pattern, while preserving the metallic-specific behaviours (static/kinetic friction, no swim force).

**Do not modify any imported functions or external modules.** All changes are within `updateDragPhysics()` itself. Before making changes, read the entire function to understand the full flow. The function has two major passes: a motion integration pass (force computation through position update) and a line accounting pass (line length reconciliation, tension, payout/recovery, state output). Both passes need changes.

## The Physical Model (How a Real Reel Works)

A fishing reel has a spool with a clutch (drag brake). The clutch and the player's reel handle operate on the **same spool**. Their forces do not add together. The system works like this:

- The clutch provides constant resistive force **matching the load** up to its set threshold. If the load is 30N and the threshold is 100N, the clutch provides 30N, not 100N.
- The clutch only resists **outward** force (line paying out). It does nothing when line is being recovered.
- When the player cranks the handle, their pull force and the clutch resistance are **alternative** sources of inward force on the same mechanism. The effective inward force is `max(clutchResistance, playerPull)`, never the sum.
- **Tension** in a massless line equals the lesser of the two opposing forces. The excess becomes acceleration of the target, not additional line loading.
- During **payout** (target overwhelms the inward force), the line slips through the clutch. Tension is limited to what the clutch provides, which is the drag threshold.

The fish path already implements all of this correctly. The metallic path needs to match.

## Issue 1: Metallic Force Model Uses Additive Stacking

### Current code (motion integration pass, around lines 159-172)

```javascript
const metallicLineLoadForce =
  dotProduct(swimForceVector, previousAxis) +
  dotProduct(externalForceVector, previousAxis);
const metallicReactiveDrag = previousLineTaut
  ? Math.min(Math.max(metallicLineLoadForce, 0), effectiveDragThreshold)
  : 0;
const metallicPlayerForce =
  metallicReactiveDrag + (isHolding ? avatarPullForce : 0);
```

### Problem

`metallicPlayerForce` adds reactive drag and player pull. With 50N current, 100N threshold, and 80N player pull: `metallicPlayerForce = 50 + 80 = 130N`. The correct value is `max(50, 80) = 80N`. The reactive drag and player pull act on the same spool and should not stack.

### Required change

Replace the additive model with `max()`:

```javascript
const metallicPlayerForce = previousLineTaut
  ? Math.max(metallicReactiveDrag, isHolding ? avatarPullForce : 0)
  : 0;
```

This mirrors the fish path's `lineInwardForce = max(clutchForce, isHolding ? avatarPullForce : 0)`.

**Important:** This variable is used in `playerForceVectorForMotion` (line ~167-172) and feeds into `netForceVector` for the metallic branch. Verify that the downstream usage still makes sense after this change. It should, since the variable's role (total inward force from the line) is unchanged; only its magnitude is corrected.

---

## Issue 2: Metallic Tension Uncapped During Payout

### Current code (line accounting pass, tension computation, around lines 446-458)

```javascript
shouldPayOutLine =
  state.targetType === "fish"
    ? fishOutwardForce > 0 && fishOutwardForce > lineInwardForceAccounting
    : objectLineForce > playerLineForce;

if (state.targetType === "fish") {
  tension = Math.min(lineInwardForceAccounting, fishRadialResistance);
} else {
  tension = clampActive
    ? Math.max(objectLineForce, 0) + reactiveDrag
    : objectLineForce > 0
      ? Math.max(objectLineForce, playerLineForce)
      : playerLineForce;
}
```

### Problem

During metallic payout (`objectLineForce > playerLineForce`), the tension path gives `max(objectLineForce, playerLineForce) = objectLineForce`. This is the raw environmental force, which can be arbitrarily high. In a real reel, when the line is paying out through the clutch, tension is limited to the clutch's resistance (the drag threshold). The fish path correctly produces `min(lineInward, fishOutward)` which caps tension at the inward force.

### Required change

The metallic tension calculation should follow the same principle as the fish path: tension equals the lesser of the two opposing forces. When the line is taut:

- If paying out: tension = the inward force (what the clutch/player can provide). The excess outward force accelerates the target, it doesn't load the line further.
- If held or reeling in: tension = the outward resistance (what the target pushes back with through the water). The excess inward force accelerates the target toward the player.
- Tension should never be negative.

Replace the metallic tension block with:

```javascript
if (state.targetType === "fish") {
  tension = Math.min(lineInwardForceAccounting, fishRadialResistance);
} else {
  if (shouldPayOutLine) {
    // Payout: line slipping through clutch. Tension = inward force (capped at threshold).
    tension = playerLineForce;
  } else if (objectLineForce > 0) {
    // Held or reeling against resistance. Tension = outward resistance (the lesser force).
    tension = Math.min(objectLineForce, playerLineForce);
  } else {
    // No outward resistance. Tension = player pull transmitted through line to drag the object.
    tension = playerLineForce;
  }
  tension = Math.max(0, tension);
}
```

Note: `playerLineForce` in the accounting pass (around lines 407-410) also uses the additive model. See Issue 3 for the corresponding fix there. The tension fix above depends on `playerLineForce` being correct first.

---

## Issue 3: Metallic Accounting Pass Also Uses Additive Model

### Current code (line accounting pass, around lines 407-410)

```javascript
} else {
  reactiveDrag = Math.min(Math.max(lineLoadForce, 0), effectiveDragThreshold);
  playerLineForce = reactiveDrag + (isHolding ? avatarPullForce : 0);
  lineInwardForceAccounting = playerLineForce;
}
```

### Problem

Same additive stacking as Issue 1, but in the accounting pass. `playerLineForce` is used for the payout decision (`objectLineForce > playerLineForce`) and for tension calculation. The inflated value makes payout harder to trigger than it should be (the line resists more than it physically could) and inflates tension.

### Required change

```javascript
} else {
  reactiveDrag = Math.min(Math.max(lineLoadForce, 0), effectiveDragThreshold);
  playerLineForce = Math.max(reactiveDrag, isHolding ? avatarPullForce : 0);
  lineInwardForceAccounting = playerLineForce;
}
```

This is the accounting-pass counterpart of the Issue 1 fix.

---

## Issue 5: Static Friction Gate Ignores Environmental Forces

### Current code (line accounting pass, around lines 514-517)

```javascript
if (!state.target.isMoving) {
  staticFrictionGateReached = lineTaut && isHolding;
  const staticGateComparison = avatarPullForce > staticFrictionThreshold;
  if (staticFrictionGateReached && staticGateComparison) {
```

### Problem

Only `avatarPullForce` is compared against the static friction threshold, and only when the player is holding. Environmental forces (current, external events) that push the object are ignored. If a strong current exceeds both the clutch threshold AND static friction, the object should start moving regardless of player input. Currently it can't, because the gate requires `isHolding` and only checks `avatarPullForce`.

### Physical model for static friction

Static friction resists the **net force** on the object from all sources. The net force on the object is:

- Environmental forces acting directly on the object (current, etc.) in all directions
- Line force pulling the object along the line axis (via clutch and/or player)
- These partially cancel: the line absorbs outward environmental force up to the clutch threshold

The variable `netForceVector` (computed in the motion integration pass, around line 195-198) already represents exactly this. For a static metallic object (zero velocity, zero kinetic friction, zero velocity drag), it reduces to:

```
netForceVector = externalForceVector - max(reactiveDrag, avatarPullForce) * lineAxis
```

This correctly handles all cases:

- **Outward current below threshold:** Clutch absorbs it fully. Net force = 0. No friction break.
- **Outward current above threshold:** Clutch absorbs up to threshold. Excess remains as net outward force. Can break friction.
- **Inward current:** Clutch doesn't engage for inward motion (reactiveDrag = 0 for inward load). Full current acts on object. Can break friction.
- **Tangential current:** Line can't resist tangential forces. Full tangential component acts on object. Can break friction.
- **Player pulling, no current:** Net force = avatarPullForce along line. Can break friction. (Existing behaviour preserved.)

`netForceVector` is a `const` declared at the top level of the function (not inside a nested block), so it is in scope at the static friction check point. For a static metallic object, the velocity integration was skipped (line 214), but `netForceVector` is computed before that branch, so its value is available.

### Required change

Replace the static friction gate with a comparison of `netForceVector` magnitude against the threshold:

```javascript
if (!state.target.isMoving) {
  const netForceMagnitude = magnitude(netForceVector);
  staticFrictionGateReached = netForceMagnitude > 0;
  const staticGateComparison = netForceMagnitude > staticFrictionThreshold;
  if (staticFrictionGateReached && staticGateComparison) {
    state.target.isMoving = true;
    objectState = "kinetic";
    staticBreakTimer = PHYSICS_CONSTANTS.STATIC_BREAK_DURATION;
    postStaticBreakDebugFramesRemaining = 20;
  } else {
    state.target.velocity = { x: 0, y: 0 };
    objectState = "static";
  }
}
```

Key points:

- `netForceVector` already accounts for the clutch constraint via `playerForceVectorForMotion`. No separate clutch logic needed here.
- `magnitude` is already imported from `vectorUtils.js`.
- `staticFrictionGateReached` no longer requires `isHolding`. Any non-zero net force reaches the gate. This allows environmental forces to break friction independently.
- The existing `staticFrictionThreshold` variable (computed just above this block) is unchanged.
- The `staticBreakTimer` and `postStaticBreakDebugFramesRemaining` logic remains unchanged.

**Dependency note:** This fix depends on Issues 1 and 3 being applied first. The corrected `metallicPlayerForce` (using `max()` instead of `+`) feeds into `playerForceVectorForMotion`, which feeds into `netForceVector`. If Issue 1 is not applied, `netForceVector` will contain inflated inward force from the additive bug, making static friction harder to break than it should be.

---

## Verification Checklist

After making all four changes, verify these scenarios produce correct behaviour:

### Scenario A: Calm water, player pulling metallic item

- Current: 0N, player pull: 80N, drag threshold: 100N, static friction: 60N
- Expected: reactiveDrag = 0, playerLineForce = max(0, 80) = 80N
- Static friction breaks (80 > 60), object moves toward player
- Tension = 80N (player pull against water drag on the object)
- **This should behave identically to the old code** since current is zero

### Scenario B: Current pushing metallic item outward, player holding

- Current outward: 50N, player pull: 80N, threshold: 100N
- Expected: reactiveDrag = min(50, 100) = 50, playerLineForce = max(50, 80) = 80N
- Old code would give: playerLineForce = 50 + 80 = 130N (wrong)
- Not paying out (50 < 80), tension = min(50, 80) = 50N (the outward resistance)

### Scenario C: Strong current overwhelms player

- Current outward: 150N, player pull: 80N, threshold: 100N
- Expected: reactiveDrag = min(150, 100) = 100, playerLineForce = max(100, 80) = 100N
- objectLineForce = 150 (includes drag/friction too, but dominated by current)
- Paying out (150 > 100), tension = playerLineForce = 100N (capped at threshold)
- Old code would give: playerLineForce = 100 + 80 = 180N, tension could spike to 150N+

### Scenario D: Strong current overwhelms clutch, breaks static friction without player

- Current outward: 150N, drag threshold: 100N, static friction: 40N, player NOT holding
- reactiveDrag = min(150, 100) = 100, metallicPlayerForce = max(100, 0) = 100
- netForceVector = 150·axis - 100·axis = 50·axis, magnitude = 50
- 50 > 40: static friction breaks, object starts moving outward (excess current beyond clutch)
- Old code: would remain static (required isHolding)

### Scenario E: Current within clutch threshold, does NOT break friction

- Current outward: 70N, drag threshold: 100N, static friction: 50N, player NOT holding
- reactiveDrag = min(70, 100) = 70, metallicPlayerForce = max(70, 0) = 70
- netForceVector = 70·axis - 70·axis = {0, 0}, magnitude = 0
- 0 < 50: remains static. Clutch fully absorbs the current.
- Old code: also remained static (for the wrong reason: it required isHolding)

### Scenario F: Tangential current breaks static friction

- Current: 60N purely tangential (perpendicular to line axis), static friction: 40N
- dot(external, axis) ≈ 0, so reactiveDrag = 0, metallicPlayerForce = 0
- netForceVector = tangential force vector (untouched by line), magnitude = 60
- 60 > 40: static friction breaks. Line cannot resist tangential forces.
- Old code: would remain static (required isHolding and only checked avatarPullForce)

## What NOT to Change

- **Fish path:** Do not modify any fish-specific code. The fish clutch model is correct.
- **Velocity integration:** The reel speed clamp (lines ~254-270) and held-fish velocity stripping (lines ~241-252) are correct. Do not touch them.
- **Line accounting recovery/payout mechanics:** The line length shortening (recovery) and lengthening (payout) logic is correct. Only the force values feeding into payout decisions and tension change.
- **Line condition decay and snap logic:** The hot zone timer, condition decay, and break threshold logic (lines ~546-572) are downstream consumers of tension. They don't need changes; they'll automatically benefit from corrected tension values.
- **Debug logging:** The tick log and post-static-break debug blocks reference variables that are being changed. Make sure the variable names still match after your edits. In particular, `reactiveDrag`, `playerLineForce`, `lineInwardForceAccounting`, and `objectLineForce` are all logged. Their values will change, but their names and roles remain the same.
- **State output assignments** (lines ~600-628): These assign the accounting variables to state. Variable names are unchanged; values will be different. No edits needed here.
- **The `state.forces` output block** (lines ~731-756): Same situation. Variable names unchanged, values corrected. No edits needed.
