# Physics Refactor: Line, Tension, Slack, and Opposing Forces

## Context and Purpose

This prompt describes a complete refactor of the fishing and magnet fishing physics systems in Mick Fisher. The current implementation conflates player pull force with tension, treating the tension bar as a direct proxy for player input. This refactor separates all forces into distinct values, introduces slack as a first-class concept, and creates a unified physics model that works correctly for both static objects (magnet fishing) and dynamic objects (fish) without requiring fundamentally different code paths.

The goal is a physics tick that resolves forces in a consistent order every frame, producing clean outputs that drive both rendering and game state. No existing UI or rendering code should be assumed to be correct after this refactor. All displays should be driven from the new physics values.

---

## Architectural Principle

There are three independent force contributors in this system: the player, the object, and the environment. The line connects the player and object. Tension is not an input to the system, it is an output: the result of opposing forces meeting through a taut line. Slack is what prevents tension from existing at all. These must never be conflated.

Keep physics calculations pure. No state mutation inside force calculation functions. All values flow in, a result flows out, state is updated separately by the orchestration layer.

---

## Values to Track

### Line Values

**lineLength**
Current total line paid out between player and object. Initialised at cast distance. Increases when spool pays out during a fish run. Decreases when line is recovered. This is a real physical length in world units, not a ratio or percentage.

**straightLineDistance**
Direct distance between cast origin and object position on the XY plane. Recalculated every tick from current object position. This is geometry, not physics.

**slack**
lineLength minus straightLineDistance. Clamped to zero minimum. Represents excess line that is not under load. When slack is greater than zero the line is not taut and no tension exists. When slack is zero the line is taut and tension can exist.

**lineTaut**
Boolean. True when slack equals zero. This gates whether tension calculations run at all.

**lineCondition**
0 to 100 percent. Starts at 100 percent on a fresh line. Degrades under sustained high tension. Does not recover during a fight. May partially recover between sessions depending on equipment and rest mechanics. This value scales the effective break threshold.

**breakThreshold**
The tension value at which the line snaps. Calculated as equipment base break value multiplied by lineCondition as a percentage. Example: base 100N at 100 percent condition equals 100N threshold. Same line at 75 percent condition equals 75N threshold. This value drifts downward across a session as condition degrades.

**spoolRemaining**
Metres of line remaining on the reel. Decreases when line pays out during a run. Increases when line is recovered. When spoolRemaining reaches zero the line goes slack and the fish or object is lost. This is the spatial failure condition.

**snapTautImpulse**
A transient value calculated only at the frame when slack transitions from greater than zero to exactly zero. Represents the instantaneous force spike from arresting the object's momentum at the moment the line goes taut. Calculated as object mass multiplied by object velocity magnitude at that moment. Applied to tension for one to two physics ticks only, then resolved to zero. This is a discrete event, not a continuous value.

---

### Player Values

**rpm**
Current engine speed from zero to maximum. Ramps upward while the player is holding input. Decays toward zero when input is released. Ramp up rate and decay rate are separate tunable properties and do not need to be symmetrical. Different equipment tiers can have different ramp profiles, not just different force caps. A beginner rod might have fast decay for safety. A specialist rod might have fast ramp for aggressive play with a commitment cost.

**avatarPullForce**
The active force the player is currently applying toward shore. Derived from rpm through a power curve. Zero at zero rpm. Reaches equipment maximum at full rpm. This is the player's controllable contribution and varies continuously as rpm changes.

**reelDragThreshold**
The passive mechanical resistance of the reel. Always present regardless of player input state. Does not change during a fight. Set by equipment tier. This is the baseline resistance the object must overcome to move away from the player at all. The player's avatarPullForce is additive on top of this value.

**totalPlayerResistance**
The total force the player side presents to the line at any given moment. When holding: avatarPullForce plus reelDragThreshold. When released: reelDragThreshold only. This is what the object's force is measured against to determine whether it moves, whether line pays out, and what tension is.

**linePayout**
Boolean or rate value. True and active when totalObjectForce exceeds totalPlayerResistance and the line is taut. When true, line pays out from the spool at a rate proportional to the excess force above totalPlayerResistance.

---

### Object Values

**objectPosition**
XY coordinates updated each tick from objectVelocity. Z is handled separately for lift mechanics and does not affect tension calculations.

**objectVelocity**
Signed scalar on the axis between player and object. Positive means moving away from player. Negative means moving toward player. This is critical for three calculations: drag force (increases with speed), terminal velocity (equilibrium point where drag equals drive force), and snapTautImpulse (magnitude at moment of snap-taut).

**objectMass**
Fixed property of the object. Heavier objects require more force to overcome static friction, generate higher impulse at snap-taut, and reach higher terminal velocity before drag equilibrium.

**objectState**
Enumeration: static or kinetic. An object starts in static state. Transitions to kinetic when totalPlayerResistance exceeds staticFrictionThreshold. Returns to static when objectVelocity reaches zero and forces are insufficient to maintain movement. This gate determines which friction model applies.

**staticFrictionThreshold**
The force required to initiate movement from rest. Always higher than kinetic resistance for the same object. This is the "unsticking" force. Until totalPlayerResistance exceeds this value nothing moves regardless of how much force is applied. Once exceeded the object transitions to kinetic state and this threshold no longer applies until the object comes to rest again.

**kineticDragCoefficient**
Base resistance once the object is moving. Multiplied by objectVelocity magnitude each tick to produce velocityDrag. This creates velocity-dependent resistance naturally: the faster the object moves the harder it is to move faster. Terminal velocity emerges from this without needing to be explicitly programmed. It is the point where drive force equals velocityDrag.

**velocityDrag**
kineticDragCoefficient multiplied by current objectVelocity magnitude. Recalculated every tick. Zero when object is stationary. Increases as object accelerates. This is the dynamic component of opposing force.

**swimForce**
Fish only. Zero for all static objects. The independent pull force generated by the fish AI. Varies continuously based on fish state (hooked, fighting, tired), fight phase (run, rest), energy level, panic level, and temperament modifiers. This force acts in the away-from-player direction during a run and may act in the toward-player direction when a fish swims toward shore, which is the primary slack-generating scenario.

**externalForce**
Environmental forces acting on the object regardless of player or fish behaviour. River current is the primary example. Signed value: positive pushes object away from player, negative pushes toward player. Wind and slope could contribute here in future. This value applies whether or not the line is taut and whether or not the player is holding.

**totalObjectForce**
The sum of all forces acting on the object in the away-from-player direction. Composed differently depending on object state.

For a static object in static state: zero until staticFrictionThreshold is exceeded, at which point the static state ends and this calculation switches to the kinetic model.

For a kinetic static object (magnet fishing item being dragged): velocityDrag plus externalForce. swimForce is zero.

For a fish: swimForce plus velocityDrag plus externalForce. swimForce dominates during active fight phases.

---

### Tension Values

**tension**
The force on the line when taut. Zero when slack is greater than zero. When lineTaut is true this is calculated from the relationship between totalPlayerResistance and totalObjectForce. See physics tick step four for full calculation logic. This value drives line condition decay, snap probability, and the tension display.

**hotZoneTimer**
Seconds spent with tension above the hot zone threshold continuously. Resets to zero when tension drops below the threshold. Drives escalating snap probability and accelerated condition decay. The hot zone threshold and the snap probability curve per second above it are primary difficulty tuning levers.

---

## Physics Tick Order

The following steps run every physics frame in this order. The order is not arbitrary: each step depends on values produced by the previous step.

---

**Step 1: Apply forces to object, update velocity and position**

Calculate net force on object this tick. If line is slack, player forces do not apply to the object at all. Object moves freely under totalObjectForce only. If line is taut, totalPlayerResistance opposes totalObjectForce. Net force equals totalObjectForce minus totalPlayerResistance. Apply net force to objectVelocity using mass. Update objectPosition from objectVelocity.

Handle the static to kinetic transition here. If objectState is static and totalPlayerResistance exceeds staticFrictionThreshold this tick: transition objectState to kinetic, apply a brief opposing force reduction to simulate the lower kinetic resistance versus static threshold, producing the characteristic lurch as the object breaks free. From this point velocityDrag takes over as the primary resistance component and increases with velocity until equilibrium.

---

**Step 2: Update geometry, calculate slack**

Recalculate straightLineDistance from updated objectPosition. Recalculate slack as lineLength minus straightLineDistance. Clamp to zero minimum. Set lineTaut based on whether slack equals zero.

Check for snap-taut transition: if slack was greater than zero last tick and is zero or less this tick, a snap-taut event has occurred. Calculate snapTautImpulse as objectMass multiplied by objectVelocity magnitude at this moment. Store for use in step four. Flag that this is a snap-taut frame.

---

**Step 3: Auto reel when slack present**

If slack is greater than zero: check whether conditions are safe to auto reel. Safe conditions require tension to be zero and no active opposing forces that could cause a sudden snap-taut. If safe, reduce lineLength by a passive recovery rate, decreasing slack. Clamp lineLength to straightLineDistance minimum. This prevents the line from being shorter than the current distance, which is physically impossible.

The safe condition check is important. Do not auto reel if a fish is actively swimming away, if current is high, or if any force could cause the slack to resolve violently before the auto reel completes. In unsafe conditions, slack remains and the player must manage the snap-taut risk manually.

---

**Step 4: Calculate tension**

If lineTaut is false: tension equals zero. Skip remaining tension calculations.

If lineTaut is true:

When object is stationary: tension equals the greater of totalPlayerResistance and totalObjectForce. Both sides are pulling and the object is not moving. The line carries the full load of whichever side is stronger.

When object is moving away from player: the line is paying out or being held. Tension equals totalObjectForce minus the component being absorbed by payout. If no payout is occurring (player holding firm), tension equals totalObjectForce directly. If payout is occurring, tension is capped at totalPlayerResistance because the line is yielding at that threshold.

When object is moving toward player: distance is decreasing, slack is about to build unless the player is recovering line faster than the object approaches. Tension is low or zero depending on recovery rate.

If this is a snap-taut frame: add snapTautImpulse to tension this tick only. This transient spike may exceed breakThreshold and cause an immediate line break regardless of steady state tension. Reset snapTautImpulse to zero next tick.

---

**Step 5: Handle line payout**

If lineTaut is true and totalObjectForce exceeds totalPlayerResistance: line pays out. Calculate payout rate proportional to excess force above totalPlayerResistance. Increase lineLength by payout amount. Decrease spoolRemaining by payout amount. If spoolRemaining reaches zero: line goes slack immediately, object is lost, trigger session failure event.

---

**Step 6: Update line condition**

Evaluate current tension against thresholds:

If tension exceeds hot zone threshold: increment hotZoneTimer by delta time. Apply hot zone condition decay rate per second. Roll snap probability using hotZoneTimer as input to an escalating probability curve. A brief excursion into the hot zone carries low snap risk. Sustained exposure carries near-certain snap risk within four to five seconds.

If tension is between reelDragThreshold and hot zone threshold: apply slow background condition decay. This is the slow bleed that accumulates across a hard session without being immediately dangerous.

If tension is below reelDragThreshold: no condition decay.

If tension drops below hot zone threshold: reset hotZoneTimer to zero.

Recalculate breakThreshold from updated lineCondition.

---

**Step 7: Check break threshold**

If tension this tick (including any snapTautImpulse) exceeds current breakThreshold: line breaks. Trigger line break event. Object is lost. End retrieve sequence.

---

**Step 8: Update player RPM and forces**

If player input is held: increment rpm toward maximum at equipment ramp rate. If player input is released: decrement rpm toward zero at equipment decay rate. Calculate avatarPullForce from rpm through the power curve. Recalculate totalPlayerResistance.

Note: RPM and force updates happen after tension resolution. The forces calculated in this tick used the RPM values from the previous tick. This one-tick lag is physically correct and prevents circular dependencies.

---

**Step 9: Handle line recovery**

If object is moving toward player (negative objectVelocity): line is being recovered passively. Decrease lineLength proportional to approach velocity. Increase spoolRemaining by the same amount.

If player is actively pulling and totalPlayerResistance exceeds totalObjectForce: object is moving toward player under player force. Recovery rate is proportional to the excess force driving the object toward shore.

Clamp spoolRemaining to maximum spool capacity. Clamp lineLength to straightLineDistance minimum.

---

## The Snap-Taut Event in Detail

This deserves special attention because it is a discrete event with unique calculation logic rather than a continuous process.

The snap-taut event occurs at the exact tick when slack transitions from positive to zero. This happens in two primary scenarios:

**Scenario A: Object was moving toward player, player takes up slack**
Fish swam toward shore generating slack. Player holds, RPM builds, avatarPullForce plus reelDragThreshold takes up the slack. When slack hits zero the fish may still have velocity in the toward-player direction. The impulse reflects that toward-player momentum being arrested. The fish's momentum is in the toward-player direction. The impulse is relatively low risk compared to scenario B because the fish's momentum is being arrested in the same direction the player is already pulling. The dangerous follow-up is if the fish immediately reverses and runs: tension jumps from the impulse spike straight into the fish's full run force.

**Scenario B: Object was moving toward player, reverses direction, slack still present**
Fish swam toward player building slack, then turned and started running before slack was taken up. Now both the player and the fish are taking up slack simultaneously, and fast. When slack hits zero the fish has velocity in the away-from-player direction. This is the most dangerous scenario. The impulse reflects away-from-player momentum being arrested, and both totalPlayerResistance and totalObjectForce are already active at full values. Instantaneous tension is impulse plus both active forces simultaneously. This commonly exceeds breakThreshold on a conditioned line. The player had warning: slack was visible, the reversal was a readable event. The consequence is proportional to how fast the fish was moving and how degraded the line was.

**Scenario C: Static object, player takes up slack from cast**
Object has no independent velocity. Slack was present from the cast landing. Player pulls, RPM builds, slack reduces to zero. Object has no momentum at snap-taut because it was stationary. snapTautImpulse is zero or negligible. Tension rises smoothly from zero as player force begins opposing object resistance. The static friction threshold is the next event, not a snap.

---

## Static to Kinetic Transition Detail

This transition has a characteristic feel that should be preserved in the physics.

Static friction is always higher than kinetic friction for the same object. This means the force required to start an object moving is higher than the force required to keep it moving. The consequence is a brief lurch when the object breaks free: the player applied enough force to overcome static friction, the object starts moving, kinetic resistance is now lower than the force being applied, so the object accelerates briefly before velocityDrag catches up.

Model this as a brief window after the static-to-kinetic transition where opposing force is lower than the staticFrictionThreshold. The object surges, velocity increases, velocityDrag increases with it, until equilibrium is reached. At equilibrium the object moves at terminal velocity: the speed at which velocityDrag exactly equals the net drive force.

For large heavy objects this lurch is pronounced and the terminal velocity is low. For lighter objects the lurch is subtle and terminal velocity is higher. objectMass and kineticDragCoefficient together determine both the lurch magnitude and the terminal velocity without needing to be explicitly programmed. They emerge from the physics.

---

## Display Outputs

All displays are derived from physics values. No display value should be calculated independently of the physics model.

**Slack and tension bar**
Single unified bar. Negative region left of centre represents slack magnitude. Centre represents taut line with zero tension. Positive region right of centre represents tension rising toward breakThreshold. A marker on the positive region shows current breakThreshold and moves leftward as lineCondition degrades. The hot zone is a coloured region near the right end. The bar communicates the full state of the line in one display.

**Player force bar**
Shows avatarPullForce as the active region and reelDragThreshold as a distinct baseline marker. Player can read their current contribution and the passive floor separately. Useful for understanding why line is paying out even when they feel like they are holding.

**Object force bar**
Shows totalObjectForce. For static objects this is relatively stable with occasional spikes from snags, current events, or the static-to-kinetic transition. For fish this fluctuates continuously with swim state and fight phase. Gives the player a read on what the other end is doing.

**Spool indicator**
Remaining line as a depleting bar or numeric display. Should be prominent enough to read during a fight without dominating the screen. Critical information during a fish run.

**Line condition indicator**
Does not need to be real-time prominent. Changes slowly enough that a subtle colour shift on the breakThreshold marker on the tension bar is sufficient. A dedicated indicator can supplement this but the tension bar marker is the primary signal.

---

## Napkin Math Summary

These numbers are illustrative for tuning reference, not final values.

Base break threshold: 100N fresh line. Degrades proportionally with condition.

reelDragThreshold: 40N. Always present. Fish must pull harder than this to move at all.

avatarPullForce maximum: 60N. Total resistance at full rpm: 100N.

Typical fish run force: 80N. Exceeds reelDragThreshold (40N) so line pays out on release. Does not exceed totalPlayerResistance at full rpm (100N) so player holding can arrest a run but at the cost of high tension.

Panic spike: 95 to 110N. May exceed totalPlayerResistance briefly. Primary source of hot zone events.

Hot zone threshold: 85N. Condition decay accelerates above this. Snap probability starts here.

Mid band: 40N to 85N. Slow condition decay at 0.5 percent per second. Not immediately dangerous but accumulates across a session.

snapTautImpulse example: fish mass 2kg, velocity at snap-taut 3 metres per second away from player. Impulse equals 6N. Modest on its own but adds to whatever tension is already present at that moment.

Static friction example: a large rusted bicycle on the riverbed. staticFrictionThreshold 120N. Player maximum totalPlayerResistance is 100N. Player cannot move this object alone. Requires equipment upgrade or a special event. Once moving, kinetic resistance drops to 60N at rest, rising with velocity.

---

## Constraints and Edge Cases to Handle

Line cannot be shorter than straightLineDistance. Clamp lineLength to this minimum at all times.

Slack cannot be negative. Clamp to zero minimum.

SpoolRemaining cannot exceed maximum spool capacity. Clamp on recovery.

Auto reel should not operate when any force condition could cause a violent snap-taut. Gate this conservatively.

snapTautImpulse should only apply for one to two ticks. Ensure it is reset after application or it will permanently inflate tension.

The static to kinetic transition should not re-trigger on the same object until it has come to a full stop. Gate the transition check on objectState being static and objectVelocity being zero or near zero.

Fish swimForce direction is not always away from player. When a fish swims toward shore, swimForce is in the toward-player direction and contributes to slack generation rather than tension. The totalObjectForce calculation must handle signed swimForce correctly.

Line condition decay should not occur when slack is greater than zero. No tension means no load on the line means no degradation.
