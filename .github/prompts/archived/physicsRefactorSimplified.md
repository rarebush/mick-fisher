# Physics Refactor: Simplified Projection-Based Tension Model (Revised)

## Sign Convention and Terminology

This section defines the coordinate convention used throughout. Every force, velocity, and rate value in this document uses this convention. Implementation must be consistent with these definitions.

**lineAxis:** unit vector from player to object. This is the positive direction along the line. Computed as normalise(objectPosition minus playerPosition). Consistent with existing getLineAxis implementation which returns target minus avatar.

**objectLineForce:** the component of the object's active forces projected onto lineAxis. Positive means the object is pulling or accelerating away from the player, loading the line. Negative means the object's forces are directed toward the player, unloading the line.

**playerLineForce:** the total force the player side applies along lineAxis in the negative direction (toward player). Expressed as a positive magnitude for comparison purposes. Composed of reactiveDrag plus avatarPullForce when holding.

**objectVelocity:** signed scalar along lineAxis. Positive means object moving away from player. Negative means object moving toward player.

**slackChangeRate:** rate of change of slack per tick. Positive means slack is growing. Negative means slack is shrinking. Zero means slack is stable.

**reactiveDrag:** the reel's passive mechanical resistance. A player-equipment property. Reactive ceiling on how much passive resistance the reel provides against the object pulling away. Not water drag on the object. Not related to object speed.

**velocityDrag:** water resistance on the object opposing its motion. An object property. Function of object speed and drag coefficient. Affects object acceleration and velocity only. Does not directly load the line.

---

## The Two Phases

The system operates in exactly two phases. The transition between them is governed by slack.

### Slack Phase

Slack is greater than zero. The line is not taut. No force is transmitted through the line in either direction. Player force is suppressed: avatarPullForce cannot build during this phase and RPM decays. reactiveDrag is zero because there is no line load to react to.

The only competition during the slack phase is velocity. Two velocities race against each other:

**objectApproachRate:** the rate at which straightLineDistance is decreasing. Equals the magnitude of objectVelocity when objectVelocity is negative (object moving toward player). Zero when objectVelocity is positive (object moving away, which does not build slack).

**playerRecoveryVelocity:** the rate at which the player can shorten lineLength. This is a velocity, not a force. It is an equipment property representing the reel's maximum line recovery speed. May be scaled by whether the player is holding input. When player is not holding, playerRecoveryVelocity is zero or near zero. When holding, it is at the equipment-defined maximum recovery speed.

**slackChangeRate = objectApproachRate minus playerRecoveryVelocity**

If slackChangeRate is positive: slack grows. Object is approaching faster than player can recover line.

If slackChangeRate is negative: slack shrinks. Player is recovering line faster than object approaches.

If slackChangeRate is zero: slack is stable.

Slack changes each tick by slackChangeRate multiplied by deltaTime. lineLength is not changed by the velocity competition. Only straightLineDistance changes as the object moves. Slack is always lineLength minus straightLineDistance clamped to zero minimum.

When slack reaches zero, the system transitions to the engaged phase.

**Important:** a fish moving toward the player faster than playerRecoveryVelocity will keep slack building. The line dips and rises. Tension stays zero. This is correct. The loop resolves naturally as velocityDrag slows the fish over time and energy drain reduces swimForce. No special handling is required.

### Engaged Phase

Slack is zero (within SLACK_EPSILON tolerance). The line is taut. Force is transmitted. Standard force comparison applies.

**objectLineForce** for tension and reactive drag purposes is computed from swimForce and externalForce projected onto lineAxis only. velocityDrag is excluded from this calculation. velocityDrag affects object motion (velocity, position) but does not directly load the line.

Formally: objectLineForce = dot(swimForce + externalForce, lineAxis)

**playerLineForce** = reactiveDrag + avatarPullForce (when holding), where reactiveDrag = min(max(objectLineForce, 0), dragThresholdCurrent). Note that reactiveDrag clamps to zero when objectLineForce is negative or zero, meaning the reel does not resist an object that is not loading the line.

**Unified tension formula:**

If objectLineForce is positive (object pulling or moving away from player): tension = max(objectLineForce, playerLineForce). The line carries the load of whichever side is dominant.

If objectLineForce is negative or zero (object moving toward player or stationary): tension = max(abs(objectLineForce), playerLineForce). Same formula, same principle. The dominant force determines line load.

However: if objectVelocity is negative (object still moving toward player) and slackChangeRate would be positive this tick (object approach rate exceeds playerRecoveryVelocity), the line is about to go slack. Treat this tick as the transition back to slack phase. Set tension to zero. Slack opens on the next tick.

This handles the re-engagement loop cleanly: the system briefly enters engaged phase, detects that the fish is still winning the velocity competition, and immediately returns to slack phase. No artificial tension is generated.

---

## Object Motion Calculation

velocityDrag is used for motion only. Every tick:

netForce = swimForce + velocityDrag + externalForce (full force including water drag, for accurate motion simulation)

objectVelocity updated from netForce and objectMass.

objectPosition updated from objectVelocity.

straightLineDistance recalculated from objectPosition.

slack recalculated as lineLength minus straightLineDistance, clamped to SLACK_EPSILON.

lineTaut set based on slack.

velocityDrag does not appear anywhere after this point in the tick. All tension, reactive drag, and payout calculations use objectLineForce as defined above.

---

## Player Force During Slack Phase

When slack is greater than zero:

RPM decays at a faster rate than normal release decay. A separate SLACK_RPM_DECAY_RATE constant controls this. The intent is that RPM reaches near zero before the line goes taut again, preventing tension snap from accumulated force.

avatarPullForce is calculated from the decaying RPM as normal but has no mechanical effect during slack phase.

reactiveDrag is zero.

playerLineForce for tension purposes is zero.

playerRecoveryVelocity is the equipment-defined value, active when player is holding input. This is the only player contribution during slack phase.

When the system transitions back to engaged phase, RPM begins building from whatever level it has decayed to. Force re-engages gradually. This is intentional.

---

## Snap-Taut Impulse

The existing snapTautImpulse calculation is retained. It fires when slack transitions from greater than zero to zero (previousSlack greater than zero and current slack at or below SLACK_EPSILON). The impulse is calculated as objectMass multiplied by objectVelocity magnitude at the transition moment, capped at MAX_SNAP_VELOCITY to prevent impulse from accumulated velocity during extended slack phases.

Because RPM is suppressed during the slack phase, player force is near zero at snap-taut. The impulse therefore represents primarily the fish's momentum being arrested, not the combined load of fish momentum plus maximum player force. This significantly reduces snap-taut line break risk compared to the previous model.

---

## Payout Logic

Line payout uses the same objectLineForce and playerLineForce values as tension, not totalObjectForce. This ensures payout and tension are consistent: the same view of line load determines both whether the line is paying out and how much tension it is under.

Payout occurs when objectLineForce exceeds playerLineForce and the line is taut. Payout rate is proportional to the excess. spoolRemaining decreases by payout amount. lineLength increases by payout amount.

---

## Static to Kinetic Transition

For metallic objects, when objectState is static, both totalObjectForce and objectLineForce are set to zero until the static friction check passes. This ensures reactive drag and tension see no phantom load from a static object that has not yet been dislodged. The static friction check uses avatarPullForce only, unchanged from the previous refactor.

---

## Line Condition and Break Threshold

These systems are unchanged. They operate on the tension value produced by the unified formula above. The hot zone threshold, mid-band decay, and break threshold calculations remain as previously implemented. Line condition does not degrade during slack phase because tension is zero.

---

## Scenarios to Validate

Ask Copilot to trace these through the revised code before applying any patches.

**Scenario 1: Fish pulling away at 80N swimForce, player not holding, dragThresholdCurrent 40N**
objectLineForce = 80N positive. reactiveDrag = min(80, 40) = 40N. playerLineForce = 40N. tension = max(80, 40) = 80N. Line pays out.

**Scenario 2: Fish pulling away at 80N, player holding at full 60N avatarPullForce**
objectLineForce = 80N. playerLineForce = 40 + 60 = 100N. tension = max(80, 100) = 100N. Fish moves toward player.

**Scenario 3: Fish swimming toward player, player not holding**
objectLineForce negative. reactiveDrag = 0. playerLineForce = 0. playerRecoveryVelocity = 0 (not holding). slackChangeRate positive. Slack builds. Tension zero.

**Scenario 4: Fish swimming toward player, player holding, recovery rate exceeds approach rate**
playerRecoveryVelocity exceeds objectApproachRate. slackChangeRate negative. Slack shrinks toward zero. When slack hits zero: engaged phase. objectLineForce negative (small, fish slowing). playerLineForce building from RPM ramp. tension = max(abs(objectLineForce), playerLineForce). No escalation with velocity.

**Scenario 5: Fish swimming toward player, player holding, approach rate exceeds recovery rate**
slackChangeRate positive. Slack builds. Tension zero throughout. System waits for fish to slow or turn.

**Scenario 6: Static magnet, player not holding**
swimForce zero. externalForce zero. objectLineForce zero. reactiveDrag zero. playerLineForce zero. tension zero. Object stationary.

**Scenario 7: Static magnet, player holds and exceeds static friction**
avatarPullForce exceeds staticFrictionThreshold. Object transitions to kinetic. objectLineForce reflects kinetic resistance. tension = max(objectLineForce, playerLineForce). Player drags object toward shore.

**Scenario 8: Fish swimming toward player then turning to run**
Slack phase during approach. Fish turns. objectVelocity flips positive. objectApproachRate drops to zero. slackChangeRate flips negative. Slack shrinks. Line goes taut. snapTautImpulse fires from fish velocity at transition moment, capped at MAX_SNAP_VELOCITY. Player force is near zero from RPM suppression. Tension spike is modest and manageable. Engaged phase resumes normally.

---

## What Does Not Change

Fish AI states, energy, and panic model. Line condition degradation and break threshold. Spool length and payout triggering. Quick release mechanic. Equipment tier progression. SLACK_EPSILON tolerance on slack zero check. All display outputs remain driven from the same named values.

---

## Implementation Order

First: confirm how objectLineForce is currently derived and separate it from velocityDrag. Identify every line in dragPhysics.js where totalObjectForce feeds into reactive drag or tension and replace with objectLineForce.

Second: implement the two-phase structure explicitly. Add SLACK_RPM_DECAY_RATE constant. Add playerRecoveryVelocity as an equipment property. Implement slackChangeRate calculation in the slack phase.

Third: implement the unified tension formula replacing all current tension branches.

Fourth: update payout to use objectLineForce and playerLineForce consistently.

Fifth: trace all eight scenarios before applying any patches.

Sixth: apply patches and run playtesting log. Confirm no spurious tension spikes during fish approach, no tension escalation with velocity, and clean re-engagement after slack resolves.
