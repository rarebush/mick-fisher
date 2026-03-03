# Revised Implementation Steps 3-7: Constraint-Based Clutch Model

These steps replace Steps 3-7 from the original prompt. Steps 1-2, 8, and 9 remain unchanged, except that Step 2 (adding `REACTIVE_DRAG_COEFFICIENT`) is no longer needed and should be removed. The clutch model has no tuning coefficient; `effectiveDragThreshold` is the sole parameter.

---

## Step 2 (Revised): Remove the reactive drag coefficient constant

The velocity-based drag model is replaced entirely. Do NOT add `REACTIVE_DRAG_COEFFICIENT` to `physicsConstants.js`. The clutch model uses `effectiveDragThreshold` directly, which already exists as an equipment property.

If a previous implementation added `REACTIVE_DRAG_COEFFICIENT`, remove it.

---

## Step 3 (Revised): Refactor the motion integration phase

### The clutch model

The reel's drag system is a friction clutch. It does not apply force proportional to velocity. It is a constraint: the clutch matches the fish's outward radial force exactly, up to the equipment's drag threshold. If the fish's outward force is below the threshold, the clutch holds completely and the fish cannot accelerate outward. If the fish's outward force exceeds the threshold, the clutch provides its maximum and the excess force accelerates the fish outward.

The player's pull force (avatarPullForce) and the clutch force are not additive. They operate on the same spool and transmit through the same line. The force the fish experiences inward through the line is whichever is greater: the clutch force or the player's pull force.

```
clutchForce = min(fishOutwardForce, effectiveDragThreshold)
lineInwardForce = max(clutchForce, avatarPullForce)
```

When the player's pull exceeds what the clutch is currently providing (i.e. exceeds the fish's outward force), the player takes over. The clutch doesn't add to the player's force; the player replaces it.

### Computing the radial force balance

Currently (approximately lines 147-156), reactive drag for motion is computed as a force-matching counter:

```js
const reactiveDragForMotion = previousLineTaut
  ? Math.min(Math.max(forceAlongLineWithoutPlayer, 0), effectiveDragThreshold)
  : 0;
```

Replace this entire block with the clutch constraint model. The key inputs are:

- All forces on the fish (swim, velocity drag, external/current) as 2D vectors, summed and projected onto the line axis to get the radial component.
- `effectiveDragThreshold` (equipment property, already exists).
- `avatarPullForce` (already computed from RPM, already exists).
- Whether the line is taut (from previous tick state, already exists as `previousLineTaut`).

The computation each tick, when the line is taut:

```
// Sum all forces on the fish as 2D vectors
fishNetForce = swimForceVector + velocityDragVector + externalForceVector

// Project onto line axis to get radial component
// Positive = outward (away from player)
fishOutwardForce = dot(fishNetForce, lineAxis)

if fishOutwardForce > 0:
    // Fish is trying to move away from player
    clutchForce = min(fishOutwardForce, effectiveDragThreshold)
    lineInwardForce = max(clutchForce, avatarPullForce)

    if fishOutwardForce <= lineInwardForce:
        // HELD: clutch or player arrests the fish completely.
        // No outward radial acceleration.
        // The radial component of net force on the fish is zero.
        // Tangential forces still apply normally.
        // Strip the radial component from fishNetForce, keep tangential only.
        tangentialForce = fishNetForce - (fishOutwardForce * lineAxis)
        netForceOnFish = tangentialForce
        // Also zero out any existing outward radial velocity (constraint projection).
        // See "Velocity constraint" below.
    else:
        // OVERWHELMED: fish exceeds all resistance.
        // The excess radial force accelerates the fish outward.
        excessOutward = fishOutwardForce - lineInwardForce
        // Reconstruct net force: tangential unchanged, radial reduced to excess only.
        tangentialForce = fishNetForce - (fishOutwardForce * lineAxis)
        netForceOnFish = tangentialForce + (excessOutward * lineAxis)
else:
    // Fish radial force is zero or inward. Clutch has nothing to resist.
    if avatarPullForce > 0:
        // Player is reeling in. Apply player pull as inward force on the fish.
        // Fish's own forces (swim, drag, external) still apply in full.
        playerPullVector = lineAxis * -avatarPullForce  // inward along line
        netForceOnFish = fishNetForce + playerPullVector
    else:
        // No outward fish force, no player input. Fish moves freely.
        netForceOnFish = fishNetForce
```

When the line is NOT taut (slack): no forces transmit through the line. `netForceOnFish = fishNetForce` (the fish's own forces only, no clutch, no player pull).

### Velocity constraint

When the clutch or player holds the fish (the HELD case above), zero out the outward radial velocity component before position integration:

```
radialSpeed = dot(fishVelocity, lineAxis)
if radialSpeed > 0:
    // Remove outward radial component, preserve tangential
    fishVelocity = fishVelocity - (radialSpeed * lineAxis)
```

This is a constraint projection. The fish can still move tangentially (sideways along the taut line), which feels natural. It cannot move outward because the clutch/player is holding it.

### Integrate velocity and position

After computing `netForceOnFish` and applying the velocity constraint:

```
fishVelocity += (netForceOnFish / fishMass) * deltaTime
fishPosition += fishVelocity * deltaTime
```

This replaces the old `playerForceVectorForMotion` calculation entirely. The hold pull force is no longer a separate vector added to a reactive drag vector. It's part of the unified clutch model above.

---

## Step 4 (Revised): Refactor the line accounting phase

In the taut-line block (the `else` branch after `if (!lineTaut)`), replace the reactive drag recomputation with values derived from the clutch model.

The motion integration phase (Step 3) already determined the force balance. Store these values during Step 3 so Step 4 can use them:

- `fishOutwardForce`: the fish's radial force projected onto the line axis.
- `clutchForce`: `min(max(fishOutwardForce, 0), effectiveDragThreshold)`.
- `lineInwardForce`: `max(clutchForce, avatarPullForce)`.
- `isHeld`: whether `fishOutwardForce <= lineInwardForce` (and `fishOutwardForce > 0`).
- `isOverwhelmed`: whether `fishOutwardForce > lineInwardForce`.

For the line accounting phase:

```
if line is slack:
    reactiveDrag = 0
    playerLineForce = 0
    tension = 0
else:
    // Line is taut
    reactiveDrag = clutchForce  // what the clutch is providing (0 to effectiveDragThreshold)
    lineInwardForce = max(clutchForce, avatarPullForce)
    // These values feed into tension (Step 5) and payout (Step 5)
```

`playerLineForce` as a concept is replaced by `lineInwardForce`. If downstream code references `playerLineForce`, replace it with `lineInwardForce` everywhere. The semantics are: `lineInwardForce` is the total inward resistance the fish faces through the line, which is the greater of the clutch force or the player's pull.

---

## Step 5 (Revised): Update payout condition and tension calculation

### Payout

Payout occurs when the fish's outward force overwhelms all resistance:

```
shouldPayOutLine = fishOutwardForce > 0 AND fishOutwardForce > lineInwardForce
```

When payout occurs, the excess force (`fishOutwardForce - lineInwardForce`) is what accelerated the fish outward in Step 3. The spool unwinds. `lineLength` increases to match the fish's new position.

Remove the old `(movingOutward && exceededLineLength)` fallback. If the force balance says the fish is held, the velocity constraint in Step 3 prevents position overshoot. If minor numerical overshoot still occurs, the position clamping in Step 6 handles it as a safety net.

### Tension

Tension is the force the line is actually carrying. It equals the lesser of the two opposing forces transmitted through the line.

```
if line is slack:
    tension = 0

else if shouldPayOutLine:
    // Fish overwhelms resistance. The line carries the resistance side (the lesser force).
    tension = lineInwardForce

else if fishOutwardForce > 0:
    // Fish pushing outward but held. The line carries the fish's force (the lesser force).
    // The resistance side could provide more, but only matches what's needed.
    tension = fishOutwardForce

else if avatarPullForce > 0:
    // Fish not pushing outward. Player reeling in.
    // Line carries the fish's resistance to being pulled in.
    // This is the magnitude of the fish's inward-opposing force (its outward swim + inertia).
    // For simplicity: tension = avatarPullForce limited by what the fish actually resists with.
    // The fish's "resistance" here is abs(fishOutwardForce) if it's pushing outward (covered above),
    // or near-zero if the fish is passive/moving inward.
    // When the fish is passive: tension = small inertial resistance, practically low.
    // Approximate as: tension = min(avatarPullForce, fishMass * fishAcceleration) or simply
    // tension = avatarPullForce * (1 - approachEfficiency) as a gameplay approximation.
    //
    // IMPLEMENTATION NOTE: The exact tension when reeling in a non-resisting fish is a tuning
    // decision. In real fishing, reeling in slack/passive fish produces minimal rod load.
    // A simple approach: tension = max(abs(fishOutwardForce), minTensionWhenReeling)
    // where fishOutwardForce is negative or zero here (fish not pushing out).
    // This gives near-zero tension when the fish is passive, which is correct.
    tension = abs(min(fishOutwardForce, 0))

else:
    // Line taut, no outward force, no player input.
    tension = 0
```

The key scenarios:

| Scenario                                             | fishOutwardForce | lineInwardForce                                                | Payout? | Tension             |
| ---------------------------------------------------- | ---------------- | -------------------------------------------------------------- | ------- | ------------------- |
| Weak fish (2N), clutch holds (20N cap), no player    | 2                | 20 (clutch=2, but cap=20, so clutch=2; max(2,0)=2... see note) | No      | 2                   |
| Strong fish (25N), clutch maxed (20N), no player     | 25               | 20                                                             | Yes     | 20                  |
| Strong fish (25N), clutch maxed (20N), player at 30N | 25               | 30                                                             | No      | 25                  |
| Strong fish (25N), clutch maxed (20N), player at 22N | 25               | 22                                                             | Yes     | 22                  |
| Fish passive (0N), player reeling at 5N              | 0                | 5                                                              | No      | ~0                  |
| Fish swimming inward (-3N), player reeling at 5N     | -3               | 5                                                              | No      | ~0 (fish assisting) |

**Correction to the table for the weak fish case:** `clutchForce = min(fishOutwardForce, effectiveDragThreshold) = min(2, 20) = 2`. `lineInwardForce = max(clutchForce, avatarPullForce) = max(2, 0) = 2`. Fish outward (2) <= lineInwardForce (2). Held. Tension = 2.

---

## Step 6 (Revised): Position clamping safety net

After position integration but before line accounting, if the line should be taut and the force balance says the fish is held (not payout), clamp the fish's position so `straightLineDistance` does not exceed `lineLength`. This handles rare numerical overshoot from large delta times:

```
if line is taut AND NOT shouldPayOutLine:
    if straightLineDistance > lineLength:
        // Clamp position back along line axis
        overshoot = straightLineDistance - lineLength
        fishPosition = fishPosition - (overshoot * lineAxis)
        // Zero out outward radial velocity (keep tangential)
        radialSpeed = dot(fishVelocity, lineAxis)
        if radialSpeed > 0:
            fishVelocity = fishVelocity - (radialSpeed * lineAxis)
```

This should rarely trigger because the velocity constraint in Step 3 prevents outward velocity when the fish is held. It exists as a safety net for edge cases where delta time spikes or force balance changes mid-integration.

---

## Step 7 (Revised): Tension feeds into downstream systems

Tension as computed in Step 5 feeds directly into:

- **Line condition degradation**: higher tension = faster degradation. Unchanged mechanically.
- **Line snap risk**: tension exceeding line capacity triggers snap. Unchanged mechanically.
- **Slip calculations**: slip rate scales with tension. Unchanged mechanically.
- **Audio/visual feedback**: rod bend, line strain sounds scale with tension. Unchanged mechanically.

No changes needed to these downstream consumers. They receive a tension value and use it as before. The only difference is that tension now has a clearer physical meaning: the lesser of the two opposing forces through the line.

---

## Summary of changes from the original prompt

| Original prompt (velocity-based drag)                 | Revised (clutch constraint)                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `REACTIVE_DRAG_COEFFICIENT` constant (8.0)            | Removed. No coefficient needed.                                                   |
| `reactiveDrag = min(outwardSpeed * coeff, threshold)` | `clutchForce = min(fishOutwardForce, threshold)`                                  |
| Reactive drag proportional to velocity                | Clutch matches fish force exactly, up to limit                                    |
| Reactive drag + avatarPullForce (additive)            | `lineInwardForce = max(clutchForce, avatarPullForce)` (replacement, not additive) |
| Near-zero velocity = near-zero reactive drag          | Near-zero fish force = near-zero clutch force (correct: nothing to resist)        |
| Velocity ramp / dead zone needed for chatter          | No chatter. Clutch holds or doesn't. Binary on force, not velocity.               |
| Tension = reactiveDrag + avatarPullForce              | Tension = lesser of fishOutwardForce and lineInwardForce                          |
| Payout when lineLoadForce > threshold + avatarPull    | Payout when fishOutwardForce > lineInwardForce                                    |

---

## Revised scenario walkthroughs

### Scenario 1: Fish swims away, player NOT holding, weak fish (clutch holds)

- Fish swim force along line = +2 N (outward)
- velocityDrag along line (velocity drag projected along the line) = -0.5 N (opposing fish motion)
- fishOutwardForce = 2 - 0.5 = 1.5 N
- `effectiveDragThreshold` = 20 N
- `avatarPullForce` = 0 N (not holding)

Tick behaviour:

- clutchForce = min(1.5, 20) = 1.5 N
- lineInwardForce = max(1.5, 0) = 1.5 N
- fishOutwardForce (1.5) <= lineInwardForce (1.5): HELD
- Outward radial velocity zeroed. Fish cannot move away.
- Tangential movement unaffected. Fish swims sideways freely.
- Tension = 1.5 N (the fish's outward force, the lesser side).
- No payout.
- `straightLineDistance` stable.

### Scenario 2: Fish swims away, player NOT holding, strong fish (clutch overwhelmed)

- Fish swim force along line = +25 N (outward)
- velocityDrag along line = -2 N
- fishOutwardForce = 23 N
- `effectiveDragThreshold` = 20 N
- `avatarPullForce` = 0 N

Tick behaviour:

- clutchForce = min(23, 20) = 20 N
- lineInwardForce = max(20, 0) = 20 N
- fishOutwardForce (23) > lineInwardForce (20): OVERWHELMED
- Excess = 3 N outward. Fish accelerates away.
- Payout occurs. `lineLength` grows. Spool decreases.
- Tension = 20 N (the resistance side, the lesser).

### Scenario 3: Fish swims away, player IS holding

- Fish swim force along line = +15 N (outward)
- velocityDrag along line = -1 N
- fishOutwardForce = 14 N
- `effectiveDragThreshold` = 20 N
- `avatarPullForce` = 10 N (from current RPM)

Tick behaviour:

- clutchForce = min(14, 20) = 14 N
- lineInwardForce = max(14, 10) = 14 N (clutch still dominates because fish force < threshold)
- fishOutwardForce (14) <= lineInwardForce (14): HELD
- Player's 10 N is below the clutch's 14 N, so the clutch handles it. Player input changes nothing here.
- Tension = 14 N.
- No payout.

Now if the fish pushes harder at 22 N (after velocity drag: 20 N outward):

- clutchForce = min(20, 20) = 20 N (maxed)
- lineInwardForce = max(20, 10) = 20 N (clutch at max still dominates player's 10 N)
- fishOutwardForce (20) <= lineInwardForce (20): HELD (barely)
- Tension = 20 N.

If the fish pushes at 25 N outward:

- clutchForce = min(25, 20) = 20 N
- lineInwardForce = max(20, 10) = 20 N
- fishOutwardForce (25) > lineInwardForce (20): OVERWHELMED
- But if the player increases pull to 30 N:
- lineInwardForce = max(20, 30) = 30 N (player takes over)
- fishOutwardForce (25) <= lineInwardForce (30): HELD
- Tension = 25 N.
- The player's excess (30 - 25 = 5 N) becomes inward acceleration on the fish. Fish reels in.

### Scenario 4: Fish turns inward (toward player)

- Fish was swimming away, now turns inward.
- fishOutwardForce becomes 0 or negative.

Tick behaviour:

- fishOutwardForce <= 0. Clutch has nothing to resist. clutchForce = 0.
- Fish moves freely in whatever direction its forces dictate.
- If player is holding, avatarPullForce applies as inward force. Fish reels in.
- If player is not holding, fish drifts on its own forces. Line may go slack if fish approaches faster than line can be recovered.
- Tension = near zero (fish not resisting).

### Scenario 5: Fish swims tangentially (perpendicular to line)

- Fish swims sideways. Radial projection of swim force is ~0.
- fishOutwardForce = ~0.

Tick behaviour:

- Clutch matches ~0. Nothing to hold against.
- Fish moves tangentially. `straightLineDistance` roughly constant.
- Tension = ~0.
- Line stays taut but under minimal load.

### Scenario 6: Quick release active

- `dragQuickReleaseActive = true`
- `effectiveDragThreshold = dragThresholdMin` (much lower, say 5 N)
- Fish at 15 N outward, player not holding.

Tick behaviour:

- clutchForce = min(15, 5) = 5 N
- lineInwardForce = max(5, 0) = 5 N
- fishOutwardForce (15) > lineInwardForce (5): OVERWHELMED
- Fish runs freely. Payout at low tension.
- Tension = 5 N. Line condition protected.

### Scenario 7: Player reeling in a held fish

- Fish at 2 N outward, clutch holds at 2 N.
- Player starts reeling. avatarPullForce ramps from 0 toward 10 N.

At avatarPullForce = 1 N:

- clutchForce = 2 N. lineInwardForce = max(2, 1) = 2 N. Clutch dominates.
- Fish held stationary. Player's 1 N is below clutch force, changes nothing.
- Tension = 2 N.

At avatarPullForce = 2 N:

- lineInwardForce = max(2, 2) = 2 N. Tied. Fish still held stationary.
- Tension = 2 N.

At avatarPullForce = 3 N:

- lineInwardForce = max(2, 3) = 3 N. Player takes over.
- fishOutwardForce (2) <= lineInwardForce (3): HELD (by player now, not clutch).
- Excess inward = 3 - 2 = 1 N. Fish accelerates inward. Reeling in begins.
- Tension = 2 N (the fish's resistance, the lesser side).

At avatarPullForce = 10 N:

- lineInwardForce = 10 N. Excess inward = 10 - 2 = 8 N.
- Fish reels in faster, subject to max reel-in velocity cap.
- Tension = 2 N still (the fish's resistance hasn't changed).

Key insight: tension stays at the fish's outward force (2 N) regardless of how hard the player pulls, because the fish is the weaker side. The excess becomes acceleration, not line load. Reeling in a weak fish is low tension. Reeling in a strong fish is high tension.
