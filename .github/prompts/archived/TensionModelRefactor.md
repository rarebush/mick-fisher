# Phase 2: Tension Model Refactor with 2D Motion Integration

## Purpose and Scope

This document specifies a refactor of the drag physics loop in Mick Fisher. It replaces the current 1D axis-constrained motion model with true 2D motion integration and implements a new tension model that cleanly separates object line force from player line force.

This is self-contained. It does not require prior conversation context. It can be handed directly to an AI coding assistant. A companion document, "Physics Architecture Baseline," describes the current codebase in detail and should be read first.

**Important context:** A previous refactor attempt was unsatisfactory and overcomplicated the physics. This prompt is designed for a clean replacement of the physics loop, not a layered modification. Read the baseline document and the current code thoroughly before writing anything. The current system works. The replacement must also work, and must be simpler and more correct, not just different.

The game is built with Vite, React, PixiJS, and Zustand. Physics runs in a PixiJS ticker loop.

---

## What This Refactor Achieves

1. Replaces 1D axis-projected motion with true 2D vector motion, so fish can move laterally while the tension system operates on the radial component only.
2. Separates objectLineForce from velocityDrag, which were previously conflated, and correctly computes objectLineForce as a radial projection of all active forces.
3. Implements a clean two-phase model distinguishing slack and engaged states with explicit transition logic.
4. Introduces playerForceVector as a 2D force entering the object's motion calculation, so player pull physically decelerates the object rather than being an abstract tension input.
5. Implements line recovery via playerRecoveryVelocity (a reel equipment property) independent of RPM.

---

## What This Refactor Does Not Include

- **Inertial momentum term.** The objectLineForce formula uses only active forces and their radial projections. No `mass * deltaRadialVelocity / deltaTime` term. This will be added in a future phase if needed.
- **Snap-taut impulse.** No impulse fires at the slack-to-taut transition. The existing snap-taut behavior in the current code should be removed. It can be reintroduced later if playtesting indicates a need.
- **Smooth transition band.** The slack/taut boundary is binary, using the existing SLACK_EPSILON tolerance. No force-scaling ramp near the boundary.
- **Fish AI changes.** The fish AI continues to output currentForce as a 2D vector. Its internal logic is unchanged.
- **Sub-stepping.** The deltaTime clamp from Phase 0+1 (F-1) remains. No additional sub-stepping is added.

If any of these features exist in the current code, they should be removed as part of this refactor. The new system is built from the spec below, not from the existing implementation with modifications.

---

## Reference: Current Codebase (from Baseline Document)

The AI assistant must read the baseline document and the actual source files before proceeding. Key locations:

- Physics loop: `src/game/physics/dragPhysics.js` (entry: `updateDragPhysics`)
- Force calculations: `src/game/physics/forceCalculations.js`
- State updates (fish AI): `src/game/physics/stateUpdates.js`
- Physics state: `src/game/physics/physicsState.js`
- Physics constants: `src/game/physics/physicsConstants.js`
- Target factories: `src/game/physics/targetFactory.js`
- Vector utilities: `src/game/physics/vectorUtils.js`
- Equipment data: `src/game/data/fishingEquipmentDatabase.js` (or equivalent)
- World bounds: `src/game/mechanics/worldBounds.js`
- Drag sequence: `src/game/sequences/dragSequence.js`

The current physics loop (Section 2.2 of the baseline) executes nine steps per tick. The replacement will follow a different step order specified below.

---

## Sign Convention and Terminology

Every value in this document uses this convention without exception. These definitions supersede any differing conventions in the current code.

**lineAxis:** Unit vector from player to object. Positive direction is away from player toward object. Computed as `normalize(objectPosition - playerPosition)`. Consistent with the existing `getLineAxis` implementation. Recomputed every tick after the position update.

**straightLineDistance:** Scalar magnitude of `objectPosition - playerPosition`. Recomputed every tick.

**slack:** `lineLength - straightLineDistance`, clamped to a minimum of SLACK_EPSILON. Positive means the line has excess length.

**SLACK_EPSILON:** Existing tolerance constant. Retained unchanged.

**lineTaut:** Boolean. True when slack is at or below SLACK_EPSILON.

**objectVelocity:** 2D vector in world space `{ x, y }`. Updated each tick from net force and object mass. This replaces the current scalar-on-axis velocity model.

**radialVelocity:** Signed scalar. `dotProduct(objectVelocity, lineAxis)`. Positive means object moving away from player. Negative means object moving toward player.

**objectApproachRate:** `magnitude(radialVelocity)` when radialVelocity is negative. Zero when radialVelocity is zero or positive.

**swimForce:** 2D vector. The force the object exerts under its own power this tick. For fish, this is `currentForce` from the fish AI. For inanimate objects, this is `{ x: 0, y: 0 }`. Read from `target.currentForce` via the unified interface established in Phase 0+1.

**externalForce:** 2D vector. Environmental forces such as water current. Does not include player force. Does not include velocityDrag.

**velocityDrag:** 2D vector opposing the object's full velocity, scaled by speed and kineticDragCoefficient. Computed as: `scale(objectVelocity, -kineticDragCoefficient * magnitude(objectVelocity))`. This gives quadratic drag (force proportional to speed squared). Note: the current system uses linear drag. This change is intentional and physically correct for objects moving through water. If the feel is wrong after implementation, the exponent can be tuned.

**objectLineForce:** The total radial force the object exerts on the line. Scalar. Computed as:

```
objectLineForce = dotProduct(swimForce + externalForce + velocityDrag, lineAxis)
```

This is the projection of all forces acting on the object (excluding player force) onto the line axis. Positive means the object is loading the line away from the player. Negative means the object's net radial effect is toward the player.

velocityDrag enters this formula only as a radial projection via the dot product. The full 2D velocityDrag vector enters the motion calculation separately. This is not double-counting: objectLineForce is a measurement of line load, not a force applied to the object.

**reactiveDrag:** The reel's passive mechanical resistance. Scalar. Equipment property ceiling on passive resistance. Computed as `min(max(objectLineForce, 0), dragThresholdCurrent)`. Zero when objectLineForce is zero or negative.

**playerLineForce:** Total force the player side applies along lineAxis toward the player. Scalar, expressed as a positive magnitude. Equals `reactiveDrag + avatarPullForce` when holding, `reactiveDrag` only when not holding.

**playerForceVector:** Player force as a 2D vector for use in object motion. Equals `scale(lineAxis, -playerLineForce)`. Negative because it acts toward the player, opposite to lineAxis. Zero during slack phase.

**playerRecoveryVelocity:** Maximum rate at which the player can shorten lineLength. Reel equipment property. World units per second. Active at full value when player is holding. Zero when not holding. Not derived from force. Not scaled by RPM.

**slackChangeRate:** `objectApproachRate - playerRecoveryVelocity`. Positive means slack is growing. Negative means slack is shrinking. Used in slack phase only.

**SLACK_RPM_DECAY_RATE:** New constant. Controls how fast RPM decays during the slack phase. Should be faster than normal release decay to reduce accumulated player force at re-engagement.

---

## The Two Phases

### Slack Phase

Active when lineTaut is false (slack > SLACK_EPSILON).

No force is transmitted through the line. Tension is zero. playerForceVector does not enter the object motion calculation. The object moves under swimForce, velocityDrag, and externalForce only.

Each tick during slack phase:

1. Compute slackChangeRate = objectApproachRate - playerRecoveryVelocity.
2. If player is holding: lineLength reduces by `playerRecoveryVelocity * deltaTime`, clamped so lineLength never falls below straightLineDistance. The object's approach does not cause line to recover faster. Excess approach builds slack.
3. RPM decays at SLACK_RPM_DECAY_RATE. avatarPullForce is calculated from decaying RPM but has no mechanical effect during slack.
4. reactiveDrag is zero. playerLineForce is zero. tension is zero.

Transition to engaged: when slack reaches SLACK_EPSILON or below after the geometry recomputation (Step 8 in the tick order below).

### Engaged Phase

Active when lineTaut is true (slack <= SLACK_EPSILON).

Forces are transmitted through the line. Tension is computed. playerForceVector enters the object motion calculation.

Each tick during engaged phase:

1. Compute objectLineForce from the formula above.
2. Compute reactiveDrag = `min(max(objectLineForce, 0), dragThresholdCurrent)`.
3. Compute playerLineForce = reactiveDrag + avatarPullForce (if holding) or reactiveDrag (if not holding).
4. Compute playerForceVector = `scale(lineAxis, -playerLineForce)`.
5. Compute tension (see Tension Formula below).
6. If player is holding and objectLineForce <= playerLineForce (player winning): lineLength reduces by `playerRecoveryVelocity * deltaTime`, clamped to straightLineDistance minimum. spoolRemaining increases accordingly.
7. If objectLineForce > playerLineForce (object winning): line pays out. lineLength increases to match the object's radial movement. spoolRemaining decreases. No rate limit on payout.

Transition to slack: when slack exceeds SLACK_EPSILON after the geometry recomputation.

### Tension Formula

During slack phase: tension = 0.

During engaged phase:

- When objectLineForce is positive (object loading the line away): `tension = max(objectLineForce, playerLineForce)`.
- When objectLineForce is zero or negative (object not loading the line): `tension = playerLineForce`.

Tension is a display and gameplay value. It drives the UI tension bar, line condition degradation, and break checks. It does not directly enter the force calculations (those use objectLineForce and playerLineForce).

---

## Object Motion Calculation

This is the core of the refactor. It replaces the current scalar-on-axis integration with true 2D integration.

Each tick, in order:

```
1. Read swimForce from target.currentForce (fish AI output or zero for inanimate).
2. Read externalForce from environment (current, etc.) or zero if none.
3. Compute velocityDrag:
     speed = magnitude(objectVelocity)
     if speed < 0.0001: velocityDrag = { x: 0, y: 0 }
     else: velocityDrag = scale(objectVelocity, -kineticDragCoefficient * speed)

4. Determine playerForceVector:
     If slack phase: playerForceVector = { x: 0, y: 0 }
     If engaged phase: playerForceVector = scale(lineAxis, -playerLineForce)

5. Compute netForce = add(add(add(swimForce, velocityDrag), externalForce), playerForceVector)

6. Update objectVelocity:
     acceleration = scale(netForce, 1 / mass)
     objectVelocity = add(objectVelocity, scale(acceleration, deltaTime))

7. Update objectPosition:
     objectPosition = add(objectPosition, scale(objectVelocity, deltaTime))

8. Clamp objectPosition to world bounds (existing clampTargetToBounds).

9. Recompute derived values:
     lineAxis = normalize(subtract(objectPosition, playerPosition))
     straightLineDistance = distance2D(objectPosition, playerPosition)
     radialVelocity = dotProduct(objectVelocity, lineAxis)
     objectApproachRate = radialVelocity < 0 ? Math.abs(radialVelocity) : 0
     slack = Math.max(lineLength - straightLineDistance, SLACK_EPSILON)
     lineTaut = slack <= SLACK_EPSILON
```

Note on step ordering: steps 1-8 update the object's physical state. Step 9 derives the values that the tension system needs. The tension calculation (engaged phase steps 1-7 above) runs after this, using the freshly derived values. This means tension for this tick is based on the object's position and velocity after forces have been applied, not before.

Note on existing utilities: use the existing vectorUtils functions (add, scale, normalize, subtract, dotProduct, magnitude, distance2D) wherever possible. Do not reimplement vector math.

---

## Per-Tick Execution Order (Full)

The replacement physics loop should execute in this order:

```
1.  Fish AI update (if fish target): call updateFishAI, get updated fish state
       including currentForce. Write updated fish state to target.
2.  Object motion calculation (steps 1-9 above).
3.  Phase determination: read lineTaut from step 9 results.
4.  If slack phase:
       a. Compute slackChangeRate.
       b. Line recovery (reduce lineLength if holding).
       c. RPM decay at SLACK_RPM_DECAY_RATE.
       d. Set tension = 0.
       e. Set reactiveDrag = 0, playerLineForce = 0.
5.  If engaged phase:
       a. Compute objectLineForce.
       b. Compute reactiveDrag.
       c. Compute playerLineForce.
       d. Compute tension.
       e. Line recovery or payout.
       f. RPM update (normal hold/release behavior).
6.  Static friction check (for metallic items: if not isMoving, check
       avatarPullForce against staticFrictionThreshold).
7.  Line condition degradation from tension.
8.  Break check (tension vs break threshold).
9.  Slip accumulation (if applicable and not disabled).
10. Commit state: write tension, forces breakdown, lineTaut, slack,
       lineLength, spoolRemaining, rpm, and all other outputs to physicsState.
```

This replaces the existing nine-step sequence entirely. The step numbering is different from the current code. Do not try to map old steps to new steps. Write the new loop from scratch.

---

## Equipment Data Changes

Add `playerRecoveryVelocity` to each reel tier in the equipment database alongside existing dragThreshold values. Units are world units per second.

- Tier 1 (basic): low recovery velocity. Fish approaching at speed will outpace recovery and build slack.
- Tier 2 (intermediate): moderate. Keeps pace with slower approaches.
- Tier 3 (quality): higher. Maintains taut line against most approach speeds.
- Tier 4 (specialist): maximum. Near-taut maintenance against fast approaches.

Actual values require playtesting calibration. Use placeholders flagged with `// PLACEHOLDER - requires calibration`.

---

## New Constants

Add to physicsConstants.js:

```javascript
SLACK_RPM_DECAY_RATE: 30,    // RPM units per second during slack. PLACEHOLDER.
                              // Should be faster than normal release decay.
```

---

## What Changes in Existing Force Calculations

The existing `forceCalculations.js` functions should be preserved where they compute values still needed. Specifically:

- `getLineAxis`: still used, same convention.
- `getSignedAxisVelocity`: replaced by direct `dotProduct(objectVelocity, lineAxis)` in the new loop since objectVelocity is now a true 2D vector. Can be retained as a convenience wrapper or removed.
- `getDragThresholdCurrent`: still used for reactiveDrag ceiling.
- `getAvatarPullForceFromRpm`: still used for avatarPullForce.
- `getWaterDrag`: replaced by the new velocityDrag calculation in the motion loop. The new formula uses quadratic drag instead of the current linear drag. Remove or deprecate the old function.
- `getCurrentForce`: still used for externalForce (water current).
- `getFriction`: still used for static/kinetic friction on metallic items.
- `getPullForce`: likely replaced by the new playerLineForce calculation. Review whether anything outside the physics loop calls it. If not, remove.

Do not remove functions that are called from outside the physics loop without checking all call sites.

---

## Scenarios to Validate

Trace all nine scenarios through the new code before applying any changes. For each scenario, show the values of: objectLineForce, reactiveDrag, playerLineForce, playerForceVector, tension, and the resulting effect on objectVelocity. Confirm the result matches the expected behavior described.

**Scenario 1: Fish pulling away, player not holding.**
Fish swimForce: 80N radial (directed away from player along lineAxis). Player not holding: avatarPullForce = 0. dragThresholdCurrent = 40N.
Expected: objectLineForce positive (80N minus radial drag component). reactiveDrag = min(objectLineForce, 40) = 40N. playerLineForce = 40N. tension = max(objectLineForce, 40). Line pays out. Fish moves away, slowed by player reactive drag and water drag.

**Scenario 2: Fish pulling away, player holding.**
Same as Scenario 1 but player holding at 60N avatarPullForce. dragThresholdCurrent = 40N.
Expected: reactiveDrag = 40N. playerLineForce = 100N. playerForceVector = -100N along lineAxis. tension = max(objectLineForce, 100). Net radial force on fish is toward player (player wins). Fish decelerates radially. Tangential swim component unaffected.

**Scenario 3: Fish swimming toward player, player not holding.**
swimForce directed toward player (negative radial projection). Player not holding.
Expected: objectLineForce negative. reactiveDrag = 0. playerLineForce = 0. Line goes slack. Tension = 0. playerForceVector = {0,0}. Fish moves under own forces and drag only.

**Scenario 4: Fish swimming toward player, player holding, recovery outpaces approach.**
playerRecoveryVelocity > objectApproachRate.
Expected: During slack phase, slackChangeRate negative. Slack shrinks to zero. Line re-engages. objectLineForce small negative (fish still heading toward player). tension = playerLineForce only. playerForceVector enters motion. No velocity escalation.

**Scenario 5: Fish swimming toward player, player holding, approach outpaces recovery.**
objectApproachRate > playerRecoveryVelocity.
Expected: slackChangeRate positive. Slack phase maintained. Tension stays zero. System waits for drag to slow fish or energy to reduce swimForce.

**Scenario 6: Static magnet, player not holding.**
All forces zero. Object stationary.
Expected: objectLineForce = 0. tension = 0. No movement.

**Scenario 7: Static magnet, player holds and exceeds static friction.**
avatarPullForce exceeds staticFrictionThreshold. Object transitions to kinetic.
Expected: Object starts moving toward player. Kinetic friction opposes motion (positive objectLineForce contribution). tension = max(objectLineForce, playerLineForce). Player drags object toward shore.

**Scenario 8: Fish running perpendicular to line while player holds.**
swimForce perpendicular to lineAxis. dotProduct(swimForce, lineAxis) near zero.
Expected: objectLineForce near zero. tension = playerLineForce. playerForceVector acts radially. Fish accelerates laterally while being pulled radially toward player. lineAxis rotates each tick. Arcing behavior emerges naturally.

**Scenario 9: Fish turns from approaching to fleeing.**
Fish was swimming toward player (slack phase, RPM decaying). Fish turns. radialVelocity flips positive. Slack shrinks as line catches up. Line goes taut. RPM is reduced from slack decay, so avatarPullForce is lower than it would have been with continuous holding.
Expected: Tension re-engages at reduced player force. Fish initially pulls away with advantage due to RPM decay. Player must rebuild RPM. Validates that slack phase RPM decay creates a meaningful consequence for the approaching fish scenario.

---

## Implementation Order

1. Read the baseline document and all source files listed in the Reference section. Understand the current nine-step loop completely.
2. Add playerRecoveryVelocity to equipment database. Add SLACK_RPM_DECAY_RATE to physicsConstants.js.
3. Trace all nine scenarios through the new spec (on paper / in comments) before writing any code. Present the traces and stop for developer confirmation.
4. Write the new physics loop as specified in the Per-Tick Execution Order section. This replaces the body of updateDragPhysics. Write it from scratch rather than modifying the existing code line by line.
5. Ensure the new loop reads from and writes to the same physicsState structure the rest of the game expects. The interface between the physics loop and the rest of the game (dragSequence, sessionStore, rendering) must not change. Same property names, same state shape, same outputs.
6. Remove any code from the old loop that is no longer referenced: snap-taut impulse logic, scalar velocity projection, old tension branches, any other dead code.
7. Verify that getWaterDrag (if removed) is not called from outside the physics loop. Verify the same for any other removed functions.
8. Run the game. Play through drag sequences with both fish and magnetic items. Validate:
   - Fish pulling away: tension rises, line pays out, fish slows from drag.
   - Fish swimming toward player: line goes slack, tension drops to zero, RPM decays.
   - Fish turns after approach: tension re-engages at reduced player force.
   - Fish swimming perpendicular: low tension, fish arcs toward player.
   - Magnetic item: static friction gate works, kinetic drag works, item drags toward shore.
   - Line break: excessive tension still triggers break.
   - Slack/taut transitions: clean, no flickering, no stuck states.
9. Log objectLineForce, playerLineForce, tension, radialVelocity, and slack for several seconds during a fish fight. Verify: tension does not escalate with velocity (the old conflation bug). Tension reflects the force balance, not the speed.

---

## What Does Not Change

Fish AI internal logic (state machine, panic, energy, direction selection). Line condition degradation formula (input is still tension). Break threshold calculation (input is still equipment + condition). Spool length and capacity. Equipment tier properties other than the addition of playerRecoveryVelocity. Casting. Lift phase. Slip system (though DISABLE_MAGNET_SLIP remains). Input handling. Rendering pipeline. Audio. UI tension bar (it still reads tension from physicsState). Quick release mechanic and dragThresholdCurrent. SLACK_EPSILON tolerance. World bounds behavior.

The interface between the physics loop and the rest of the game is unchanged. The physics loop receives deltaTime, isHolding, and physicsState. It mutates physicsState in place. The property names and shapes in physicsState are unchanged. If any new properties are needed in physicsState (e.g., for the force breakdown), add them without removing existing ones that other systems read.
