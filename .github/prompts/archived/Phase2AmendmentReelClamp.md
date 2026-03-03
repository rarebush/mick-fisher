# Phase 2 Amendment: Reel-In Velocity Clamp

## Purpose

This amendment replaces the object motion and tension sections of the Phase 2 prompt. It resolves the issue where the force model produces approach velocities that outrun the reel, causing oscillating slack and RPM collapse on metallic items. The fix applies equally to fish and metallic objects.

This document should be read alongside the Phase 2 prompt and the Physics Architecture Baseline. It supersedes any conflicting sections in Phase 2 regarding object motion, playerForceVector, and tension calculation.

---

## Core Principle

The fishing line is a physical tether. When the line is taut and the player is reeling, the object cannot approach the player faster than the reel winds line onto the spool. The reel-in speed is `playerRecoveryVelocity`, an equipment property.

Forces still govern acceleration and determine whether the object can reach the capped speed. The cap is a ceiling on the outcome, not a replacement for the force model. Below the cap, everything works as the existing Phase 2 spec describes. The cap only activates when the force-derived velocity exceeds the reel's physical limit.

---

## How It Works

Each tick, after the normal force integration produces an unclamped objectVelocity:

1. Decompose objectVelocity into radial and tangential components relative to lineAxis.
2. If the line is taut, the player is holding, and radialVelocity is negative (approaching):
   a. Compute the approach speed the object would have without playerForceVector. Call this `intrinsicApproachRate`. This is the approach rate from swimForce + velocityDrag + externalForce + friction alone (no player contribution).
   b. Compute the effective clamp: `effectiveReelCap = max(playerRecoveryVelocity, intrinsicApproachRate)`. This means: the reel caps player-caused approach, but if the object is approaching under its own power faster than the reel, the object is not artificially slowed.
   c. If `objectApproachRate > effectiveReelCap`: clamp the radial component of objectVelocity to `-effectiveReelCap` (toward player at capped rate). The tangential component is unchanged.
   d. If `objectApproachRate <= effectiveReelCap`: no clamp. The force-derived velocity stands.
3. If the line is not taut, or the player is not holding, or radialVelocity is positive (moving away): no clamp. The object moves at whatever velocity the forces produce.

### Computing intrinsicApproachRate

This does not require a second integration pass. Compute the net force excluding playerForceVector:

```
intrinsicNetForce = swimForce + velocityDrag + externalForce + frictionForce
intrinsicRadialForce = dotProduct(intrinsicNetForce, lineAxis)
```

If intrinsicRadialForce is negative (pushes object toward player), the object would approach under its own power. The intrinsic approach velocity contribution this tick is:

```
intrinsicApproachAccel = abs(intrinsicRadialForce) / mass
intrinsicApproachRate = max(0, currentApproachRateFromIntrinsicForces)
```

A simpler approximation that avoids needing to track intrinsic velocity separately: use the radial component of the velocity that would result from integrating without playerForceVector. Since we already compute `forceWithoutPlayer` in the current code (line 180-186 in dragPhysics.js), this is available:

```
velocityWithoutPlayer = objectVelocityBeforeIntegration + (forceWithoutPlayer / mass) * deltaTime
intrinsicRadialVelocity = dotProduct(velocityWithoutPlayer, lineAxis)
intrinsicApproachRate = intrinsicRadialVelocity < 0 ? abs(intrinsicRadialVelocity) : 0
```

Then:

```
effectiveReelCap = max(playerRecoveryVelocity, intrinsicApproachRate)
```

### Applying the Clamp

After the normal velocity integration:

```
radialVelocity = dotProduct(objectVelocity, lineAxis)
objectApproachRate = radialVelocity < 0 ? abs(radialVelocity) : 0

if (lineTaut && isHolding && radialVelocity < 0) {
    if (objectApproachRate > effectiveReelCap) {
        // Clamp radial component, preserve tangential
        tangentialVelocity = subtract(objectVelocity, scale(lineAxis, radialVelocity))
        clampedRadialVelocity = -effectiveReelCap  // negative = toward player
        objectVelocity = add(tangentialVelocity, scale(lineAxis, clampedRadialVelocity))
    }
}
```

---

## Effect on Tension

When the clamp is active, the object is moving at a steady speed (playerRecoveryVelocity) toward the player. There is no radial acceleration. The net radial force is effectively zero at this steady state.

Tension should reflect the resistance the object puts up, not the player's full available force. The player is only applying as much force as needed to maintain reel-in speed against the resistance.

### Tension Formula (Revised)

The tension formula from Phase 2 remains structurally the same, but the inputs change when the clamp is active.

**When clamp is NOT active** (normal force battle):

Same as Phase 2 spec:

```
objectLineForce = dotProduct(swimForce + externalForce + velocityDrag [+ frictionForce for metallic], lineAxis)
reactiveDrag = min(max(objectLineForce, 0), dragThresholdCurrent)
playerLineForce = reactiveDrag + avatarPullForce (if holding) or reactiveDrag (if not)
tension = objectLineForce > 0 ? max(objectLineForce, playerLineForce) : playerLineForce
```

**When clamp IS active** (player winning, approach capped at reel speed):

The object is at steady-state reel-in velocity. The player is applying just enough force to match resistance. Tension reflects the resistance:

```
objectLineForce = dotProduct(swimForce + externalForce + velocityDrag [+ frictionForce for metallic], lineAxis)
reactiveDrag = min(max(objectLineForce, 0), dragThresholdCurrent)
tension = max(objectLineForce, 0) + reactiveDrag
```

Note: avatarPullForce does NOT enter the tension formula when clamped. The player has excess capacity but isn't using it. Tension is purely the resistance the line is working against.

**Payout threshold remains force-based:**

Even when clamped, the system continuously checks: could the object's forces overcome the player's full available force? If objectLineForce exceeds `avatarPullForce + reactiveDrag`, the clamp breaks, the player can no longer maintain reel-in speed, and payout begins. This transition from clamped reel-in to payout is the moment a fish "breaks free" and starts running.

```
playerMaxForce = reactiveDrag + avatarPullForce
if (objectLineForce > playerMaxForce) {
    // Clamp deactivates, payout logic from Phase 2 takes over
}
```

---

## Effect on Line Length

When the clamp is active and the object approaches at the capped rate, lineLength shortens at the same rate:

```
if (clampActive && isHolding) {
    recovery = playerRecoveryVelocity * deltaTime
    // but never more than current slack + object's approach this tick
    recovery = min(recovery, max(0, lineLength - straightLineDistance))
    lineLength -= recovery
    spoolRemaining = min(spoolCapacity, spoolRemaining + recovery)
}
```

When the clamp is not active but the object is still approaching (slower than reel speed, e.g., heavy item), lineLength shortens at the object's actual approach rate since the reel can keep up:

```
if (lineTaut && objectApproachRate > 0 && isHolding) {
    recovery = min(objectApproachRate, playerRecoveryVelocity) * deltaTime
    recovery = min(recovery, max(0, lineLength - straightLineDistance))
    lineLength -= recovery
    spoolRemaining = min(spoolCapacity, spoolRemaining + recovery)
}
```

This ensures lineLength always tracks the object's approach (up to the reel's max rate), preventing geometric slack from forming during a taut drag.

---

## Effect on RPM

RPM builds and decays normally based on hold/release. The clamp does not affect RPM. avatarPullForce (derived from RPM) represents the player's available force. When clamped, not all of it is used, but it's still available and displayed.

The SLACK_RPM_DECAY_RATE only activates during actual geometric slack (lineLength > straightLineDistance + SLACK_EPSILON). Since the clamp prevents geometric slack from forming during taut reel-in, SLACK_RPM_DECAY_RATE should never activate during a normal drag. It only activates when the object genuinely outpaces the reel (fish swimming toward player faster than recovery, or player not holding while object approaches).

---

## Effect on UI

Two values are displayed:

**Player force (avatarPullForce):** Always derived from RPM. Represents available force. Builds while holding, decays while not. Unaffected by the clamp.

**Tension:** Reflects the actual load on the line. When clamped (easy reel-in), tension is low because resistance is low. When fighting (not clamped), tension reflects the force battle. When payout (object winning), tension is high.

The player sees: high available force, low tension during easy pulls. Both converging during a fight. Tension exceeding available force during a losing battle. This is correct and intuitive.

---

## Revised Scenarios

**Scenario 1: Fish pulling away, player not holding.**
No clamp (radialVelocity positive, moving away). Unchanged from Phase 2. Force battle between fish and reactive drag. Line pays out.

**Scenario 2: Fish pulling away, player holding at 100N, fish at 80N.**
No clamp (radialVelocity positive initially). Player wins force battle. Fish decelerates, eventually approaches. Once approaching: clamp check activates. intrinsicApproachRate is near zero (fish is fighting away, player is overpowering). effectiveReelCap = playerRecoveryVelocity. Approach clamped at reel speed. Tension = resistance (moderate, fish still fighting but losing). Clean, steady reel-in.

**Scenario 3: Fish swimming toward player, player not holding.**
No clamp (player not holding). Fish approaches freely. Line doesn't shorten (no reeling). Slack forms when object approaches. Tension drops to zero. RPM decays.

**Scenario 4: Fish swimming toward player, player holding, fish faster than reel.**
Fish intrinsicApproachRate > playerRecoveryVelocity. effectiveReelCap = intrinsicApproachRate (fish's own speed wins). No effective clamp on the object. But line only shortens at playerRecoveryVelocity. Fish outpaces reel. Slack forms. Tension drops. Correct.

**Scenario 5: Fish swimming toward player, player holding, fish slower than reel.**
intrinsicApproachRate < playerRecoveryVelocity. effectiveReelCap = playerRecoveryVelocity. But object isn't going that fast anyway (total approach including player force might exceed it). If total approach > playerRecoveryVelocity, clamp activates. Approach capped at reel speed. Line shortens at reel speed. No slack. Tension low (fish helping, minimal resistance). Clean reel-in.

**Scenario 6: Static metallic item, player not holding.**
No clamp. No forces. Stationary.

**Scenario 7: Static metallic item, player holds, breaks free.**
Static gate fires. Object transitions to kinetic. RPM builds (brief lag from ramp-up). Force accelerates object toward player. Object reaches playerRecoveryVelocity. Clamp activates. Steady reel-in at capped speed. Tension = friction + drag resistance. No oscillation. No slack.

**Scenario 8: Fish perpendicular, player holding.**
Radial component near zero (fish not approaching or fleeing on radial axis). Tangential component high. Player force pulls fish radially. Fish accelerates toward player on radial axis. If approach exceeds playerRecoveryVelocity, clamp activates on radial component. Tangential component (lateral fish movement) is unaffected. Fish arcs. Tension = resistance to the radial pull.

**Scenario 9: Fish turns from approaching to fleeing.**
During approach: clamp may be active. Tension low. When fish turns: radialVelocity flips positive. Clamp deactivates. Force battle resumes. Tension rises. If fish wins, payout. If player wins, fish decelerates and approach resumes with clamp.

---

## Implementation Notes

**The clamp is applied after the normal force integration.** Do not modify the force model. Compute the full unclamped velocity first, then clamp if conditions are met. This keeps the force model clean and the clamp as a separate, removable layer.

**The clamp operates on the radial component only.** Tangential velocity is never clamped. Fish can move laterally at any speed.

**intrinsicApproachRate uses forceWithoutPlayer which already exists in the code.** No new force calculation is needed. Just integrate without playerForceVector to get the intrinsic velocity, project onto lineAxis, and take the approach component.

**The tension formula branches on whether the clamp is active.** This is a simple boolean check added to the existing tension section, not a restructure.

**Remove the line 531 Math.max that prevents lineLength from decreasing.** Replace with the line recovery logic specified above, which tracks the object's approach up to the reel's max rate. This is what caused the original oscillation bug.
