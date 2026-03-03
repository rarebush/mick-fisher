# Refactor: Reactive Drag as Velocity-Based Drag on the Fish

## Context

This is a fishing game using a 2D force-based physics simulation for the drag phase (reeling in fish/metallic items). The core physics loop lives in `dragPhysics.js` within `updateDragPhysics()`.

The system has two target types: `fish` (active swimmers with AI-driven forces) and `metallic` (passive items dragged along the riverbed). This refactor focuses on the `fish` path, but the metallic path must continue to work as-is.

---

## Physics Reference: Every Force in the System

All forces are measured in Newtons (N). 1 Newton accelerates 1 kg at 1 m/s². A 2 kg fish experiencing a net 4 N force accelerates at 2 m/s². Forces are 2D vectors. To determine their effect along the fishing line, we project them onto the **line axis** (a unit vector pointing from the player toward the fish). A positive projection means the force pushes the fish away from the player. A negative projection means it pushes the fish toward the player.

### Forces acting on the fish (the object)

**Swim force** (`swimForceVector`)

- Source: Fish AI decides a direction and magnitude each tick.
- Direction: Any direction. The fish swims where it wants.
- When active: Always, every tick, as long as the fish is alive.
- Projected onto line axis: Positive = fish swimming away from player. Negative = fish swimming toward player. Near-zero = fish swimming tangentially (perpendicular to line).

**Water drag / velocity drag** (`velocityDragVector`)

- Source: Water resistance opposing the fish’s current velocity.
- Direction: Always directly opposes the fish’s velocity vector.
- Formula: `-kineticDragCoefficient * speed * velocityDirection` (quadratic drag).
- When active: Always, whenever the fish has velocity. Decays naturally as the fish slows.
- Effect: Dissipative. Always removes energy. If the fish stopped swimming, water drag would decelerate it to zero.

**Current force / external force** (`externalForceVector`)

- Source: River current pushing the fish.
- Direction: Determined by the environment’s current settings.
- When active: Always, as a constant background force.
- Effect: Can push the fish in any direction. Usually a gentle sideways or downstream drift.

**Reactive drag** (this is what we are refactoring)

- Source: The fishing reel’s clutch mechanism. When the line is taut, the reel resists line being pulled out.
- Direction: Always along the line axis, pointing inward (toward the player). It can only pull in along the line, never sideways.
- When active: Only when the line is taut AND the fish has outward radial velocity (moving away from the player along the line axis). If the line is slack, or the fish is stationary, or the fish is moving toward the player, reactive drag is zero.
- Cap: Cannot exceed `effectiveDragThreshold` (a property of the equipment). This represents the physical maximum braking force the reel can apply.
- NEW MODEL: Proportional to the fish’s outward radial speed. Formula: `min(outwardRadialSpeed * REACTIVE_DRAG_COEFFICIENT, effectiveDragThreshold)`. This makes it a drag force (dissipative, velocity-dependent) rather than a counter-force (matching the fish’s swim force).
- Cannot pull the fish inward. Can only resist outward movement. Decays to zero as the fish’s outward velocity decays to zero. This is the critical property that solves the residual velocity problem.

**Friction force** (`frictionForceVector`)

- Source: Riverbed friction. Only applies to `metallic` targets, never to fish.
- Not relevant to this refactor.

### Forces originating from the player

**Avatar pull force** (`avatarPullForce`)

- Source: The player holding the input (reeling in).
- Direction: Along the line axis, pointing inward (toward the player).
- When active: ONLY when `isHolding === true`. When the player releases input, this force is zero.
- Magnitude: Derived from the reel’s current RPM via `getAvatarPullForceFromRpm()`. RPM ramps up while holding, ramps down when released. So this force builds over time while holding and decays to zero after release.
- Effect: Actively pulls the fish toward the player. Combined with reactive drag, gives the total inward force along the line.

**Player recovery velocity** (`playerRecoveryVelocity`)

- Not a force. This is a maximum speed at which the reel can take up line. Even if the fish is rushing toward the player at 5 m/s, the reel can only wind line at this speed. Excess approach speed creates geometric slack in the line.
- When active: Only when `isHolding === true` and the fish is approaching.

### Derived values

**Line load force** (`lineLoadForce`)

- What it is: The component of the fish’s propulsive forces projected along the line axis, EXCLUDING water drag. This is `swimForce + externalForce` along the line axis.
- Why it exists: This represents the force the fish is actively exerting on the line. Water drag is environmental resistance on the fish, not a force transmitted through the line. The reel doesn’t “see” water drag.
- Used for: Payout decisions. If `lineLoadForce` exceeds the total resistance the player/equipment can provide, line pays out.

**Object line force** (`objectLineForce`)

- What it is: ALL forces on the fish projected along the line axis, INCLUDING water drag. This is `swimForce + velocityDrag + externalForce` (and `+ frictionForce` for metallic).
- Why it exists: This is the net non-player force that contributes to the fish’s actual radial acceleration.
- Used for: Understanding net acceleration along the line.

**Player line force** (`playerLineForce`)

- What it is: Total inward force from the player’s side: `reactiveDrag + (isHolding ? avatarPullForce : 0)`.
- When NOT holding: `playerLineForce = reactiveDrag` only.
- When holding: `playerLineForce = reactiveDrag + avatarPullForce`.

**Tension**

- What it is: The force the fishing line is actually experiencing. This is what determines line condition degradation and line snap risk.
- How to calculate: Tension is the force being transmitted through the line. When the line is taut, tension equals the player-side resistance being applied, because the line is the medium transmitting that force.
  - Line slack: tension = 0 (no force on line).
  - Line taut, fish pulling outward, drag holds: tension = reactiveDrag. The drag system is resisting, that resistance travels through the line.
  - Line taut, fish pulling outward, player also holding: tension = reactiveDrag + avatarPullForce. Both forces transmit through the line.
  - Line taut, fish moving inward or stationary: tension = avatarPullForce (if holding) or 0 (if not holding). Reactive drag is zero because the fish isn’t pulling outward.
  - Line taut, payout occurring (fish beat the drag): tension = effectiveDragThreshold + avatarPullForce. The drag is at its max, the line is slipping through at the reel’s limit.

### How forces combine each tick

The function runs once per frame. The sequence is:

1. **Fish AI update.** Fish decides its swim force vector for this tick.
1. **Compute all forces on the fish.** Swim, water drag, external/current, reactive drag (new velocity-based model), and if holding, avatar pull.
1. **Sum forces into net force vector.** This is what actually accelerates the fish.
1. **Integrate velocity.** `velocity += (netForce / mass) * deltaTime`. The fish’s velocity changes.
1. **Integrate position.** `position += velocity * deltaTime`. The fish moves.
1. **Line accounting.** Compute new `straightLineDistance`, check slack/taut, calculate tension, decide payout.
1. **Position clamping.** If the line is taut and the drag system can hold the fish, clamp the fish’s position so it can’t exceed line length. Zero out outward radial velocity. Fish can still move tangentially.

---

## The Problem

Reactive drag is currently modelled as a **player-side counter-force** that matches the fish’s outward line load force Newton-for-Newton, up to the equipment’s drag threshold. This creates two failure modes:

1. **Zero drag when it should be active.** Previously, reactive drag was computed from the total `objectLineForce` which included velocity drag. When velocity drag (opposing the fish’s motion) exceeded swim force, the net `objectLineForce` went negative, so `Math.max(negative, 0)` produced zero reactive drag. The fish moved freely. This was fixed by separating `lineLoadForce` (swim + external only) from `objectLineForce` (swim + external + velocity drag).
1. **Residual outward velocity never fully drains.** Even with the lineLoadForce fix, reactive drag only creates force equilibrium. It matches the fish’s outward force but cannot decelerate existing outward velocity. The fish accumulates momentum, then coasts outward indefinitely because the reactive drag force perfectly cancels the swim force each tick, producing near-zero net force but never a restoring force. The `straightLineDistance` grows every tick while `lineLength` stays frozen and `shouldPayOut` remains false, creating an impossible physical state.

## The New Mental Model

Stop thinking of reactive drag as a player-side force that opposes the fish. Instead, think of it as **an additional drag force applied directly to the fish**, acting only on the radial component of velocity that points away from the player.

Like water drag but directional and limited:

- Water drag opposes all velocity in all directions, proportional to speed squared.
- Reactive drag opposes only the **outward radial velocity component** (along the line axis, away from the player), proportional to that component, capped at the equipment’s drag threshold.
- It cannot pull the fish inward. It can only resist outward movement.
- When the fish has zero outward radial velocity, reactive drag is zero. No artificial pull.
- When the fish turns inward, reactive drag does nothing. The fish moves freely toward the player.

This is dissipative by nature. It always removes energy from the outward radial component and decays naturally to zero as the velocity decays to zero.

---

## Scenario Walkthroughs

These describe expected behaviour after the refactor. Use these as acceptance criteria.

### Scenario 1: Fish swims away, player NOT holding, weak fish (drag holds)

- Fish swim force along line = +2 N (outward)
- `effectiveDragThreshold` = 20 N (equipment cap)
- `isHolding` = false, so `avatarPullForce` = 0 N
- Fish starts with outward radial velocity of 0.5 m/s

Tick behaviour:

- Reactive drag = min(0.5 \* 8.0, 20) = 4 N inward
- Water drag also opposes motion (say 0.5 N inward)
- Net radial force = +2 (swim) - 4 (reactive drag) - 0.5 (water drag) = -2.5 N
- Fish decelerates. Outward velocity decreases.
- After several ticks, outward velocity reaches 0. Reactive drag also reaches 0.
- Fish is held in place by the line. `straightLineDistance` stabilises.
- Tension = reactiveDrag (whatever it is that tick). Starts at ~4 N, decays to ~0 N.
- No payout occurs because `lineLoadForce` (2 N) < `effectiveDragThreshold` (20 N).

### Scenario 2: Fish swims away, player NOT holding, strong fish (drag fails)

- Fish swim force along line = +25 N (outward)
- `effectiveDragThreshold` = 20 N
- `isHolding` = false, so `avatarPullForce` = 0 N

Tick behaviour:

- Reactive drag = min(outwardSpeed \* 8.0, 20). As fish accelerates, this saturates at 20 N.
- Net radial force = +25 (swim) - 20 (reactive drag, capped) - waterDrag = positive
- Fish accelerates outward. Cannot be held.
- `lineLoadForce` (25 N) > `effectiveDragThreshold` (20 N), so payout triggers.
- Line pays out. Spool decreases. `lineLength` grows to accommodate fish position.
- Tension = effectiveDragThreshold = 20 N (the drag is at max, that’s what the line feels).

### Scenario 3: Fish swims away, player IS holding

- Fish swim force along line = +15 N (outward)
- `effectiveDragThreshold` = 20 N
- `isHolding` = true, `avatarPullForce` = 10 N (from current RPM)

Tick behaviour:

- Reactive drag = min(outwardSpeed \* 8.0, 20 N cap)
- Avatar pull = 10 N inward (because holding)
- Total inward force on fish = reactive drag + avatar pull + water drag
- With these numbers, the fish decelerates quickly. The combined resistance (up to 20 + 10 = 30 N) far exceeds the fish’s 15 N.
- No payout: `lineLoadForce` (15 N) < `effectiveDragThreshold + avatarPullForce` (30 N).
- Tension = reactiveDrag + avatarPullForce. Higher than scenario 1 because the player is also pulling.
- As fish decelerates and stops, reactive drag falls to 0. Tension = avatarPullForce alone.
- If fish then moves inward (toward player), line recovery takes up slack at `playerRecoveryVelocity`.

### Scenario 4: Fish turns inward (toward player)

- Fish was swimming away, now turns inward.
- Fish radial velocity crosses zero and goes negative (approaching player).

Tick behaviour:

- Outward radial speed = 0 (or negative, which we clamp to 0).
- Reactive drag = min(0 \* 8.0, 20) = 0 N. Reactive drag instantly drops out.
- Fish moves freely toward player. Only water drag opposes its inward motion.
- If `isHolding`, line recovery takes up slack as the fish approaches.
- Tension = avatarPullForce (if holding) or 0 (if not holding). No reactive drag contributing.

### Scenario 5: Fish swims tangentially (perpendicular to line)

- Fish swims sideways. Swim force has zero or near-zero radial component.
- Fish velocity is mostly tangential to the line axis.

Tick behaviour:

- Outward radial speed = ~0 (no outward component).
- Reactive drag = ~0 N. The reel doesn’t resist tangential movement.
- Fish swims sideways freely. `straightLineDistance` stays roughly constant.
- Tension = avatarPullForce (if holding) or 0 (if not holding).

### Scenario 6: Quick release active

- Same as Scenario 1/2, but `dragQuickReleaseActive = true`.
- `effectiveDragThreshold` = `dragThresholdMin` (much lower than `dragThresholdCurrent`).
- Reactive drag cap is much lower. Even weak fish can exceed it and cause payout.
- Tension stays low (capped at the low threshold). Protects line condition.

---

## Implementation

### Step 1: Explore the codebase first

Before making any changes, read and understand these files:

- `dragPhysics.js` - the main physics loop (this is the primary file being changed)
- `forceCalculations.js` - where force helper functions live
- `physicsConstants.js` - where constants are defined
- `vectorUtils.js` - vector math utilities available
- `stateUpdates.js` - fish AI and slip updates

Understand the full flow of `updateDragPhysics()` before editing. Pay particular attention to:

- How `reactiveDragForMotion` is computed and applied in the motion integration phase (early in the function)
- How `reactiveDrag` is computed and used in the line accounting phase (the `if (!lineTaut) { ... } else { ... }` block)
- How tension, payout, and playerLineForce derive from reactive drag
- The existing inward velocity clamp (the `effectiveReelCap` block) as a reference pattern

### Step 2: Add a reactive drag coefficient constant

In `physicsConstants.js`, add a new constant for the reactive drag coefficient. This controls how aggressively the reel’s drag system decelerates outward fish movement. A good starting value:

```js
REACTIVE_DRAG_COEFFICIENT: 8.0;
```

This means: for every 1 m/s of outward radial velocity, apply up to 8 N of inward force (before the threshold cap). This value will need tuning. Higher = stiffer reel feel, fish stops faster. Lower = loose reel, fish can run further before drag catches up.

### Step 3: Refactor the motion integration phase

Currently (approximately lines 147-156), reactive drag for motion is computed as a force-matching counter:

```js
const reactiveDragForMotion = previousLineTaut
  ? Math.min(Math.max(forceAlongLineWithoutPlayer, 0), effectiveDragThreshold)
  : 0;
```

Replace with velocity-based computation. The key inputs are:

- The fish’s current velocity vector (before integration this tick)
- The line axis (unit vector from player to fish, so positive dot product = moving away)
- The drag coefficient from constants
- The equipment’s `effectiveDragThreshold` as the maximum force cap

Compute the outward radial velocity of the fish. If positive (moving away from player), apply a drag force proportional to that velocity, capped at the drag threshold. If zero or negative (stationary or moving toward player), apply nothing.

```
outwardRadialSpeed = max(dot(fishVelocity, lineAxis), 0)
reactiveDragMagnitude = min(outwardRadialSpeed * REACTIVE_DRAG_COEFFICIENT, effectiveDragThreshold)
reactiveDragVector = lineAxis * -reactiveDragMagnitude  // points inward along line
```

This replaces the `playerForceVectorForMotion` calculation for the reactive component. The hold pull force (`holdPullForMotion`) remains unchanged and is added on top as before.

**Important:** This force is added to the fish’s net force for velocity integration. It acts on the fish, not as a separate player-side quantity. It gets included in `netForceVector` the same way the old `playerForceVectorForMotion` was.

### Step 4: Refactor the line accounting phase

In the taut-line block (currently the `else` branch after `if (!lineTaut)`), reactive drag is computed again for tension/payout calculations:

```js
reactiveDrag = Math.min(Math.max(objectLineForce, 0), effectiveDragThreshold);
```

Replace this with the same velocity-based formula, but use the **post-integration** velocity (the fish’s velocity after forces have been applied this tick). This represents the actual drag force currently being exerted:

```
outwardRadialSpeed = max(dot(postIntegrationVelocity, lineAxis), 0)
reactiveDrag = min(outwardRadialSpeed * REACTIVE_DRAG_COEFFICIENT, effectiveDragThreshold)
```

Then derive the downstream values as before:

- `playerLineForce = reactiveDrag + (isHolding ? avatarPullForce : 0)`
- Tension follows the rules described in the physics reference above.

### Step 5: Update the payout condition

The payout condition currently uses force comparison:

```js
const shouldPayOutLine =
  objectLineForce > playerMaxForce || (movingOutward && exceededLineLength);
```

With velocity-based reactive drag, the payout logic should check whether the fish’s outward force exceeds what the drag system can provide at maximum capacity. The payout condition becomes: the fish’s line load force (swim + external, excluding velocity drag) exceeds the drag threshold cap plus the player’s active pull, meaning the reel physically cannot hold the fish.

```
shouldPayOutLine = lineLoadForce > effectiveDragThreshold + avatarPullForce
```

Remove the `(movingOutward && exceededLineLength)` fallback. If the force balance doesn’t justify payout, the fish shouldn’t be able to physically exceed the line length. If it does due to integration overshoot, clamp it rather than accommodating it with payout.

### Step 6: Add position clamping for taut lines

After position integration but before line accounting, if the line is taut and the force balance doesn’t justify payout (i.e. `lineLoadForce <= effectiveDragThreshold + avatarPullForce`), clamp the fish’s position so `straightLineDistance` does not exceed `lineLength`. This handles any integration overshoot:

```
if line is taut AND lineLoadForce <= (effectiveDragThreshold + avatarPullForce):
    if straightLineDistance > lineLength:
        move fish position back along line axis so distance = lineLength
        zero out the outward radial velocity component (keep tangential)
```

This is a constraint projection, consistent with how XPBD solvers work. The fish can still move tangentially (perpendicular to the line), which feels natural: it is swimming sideways against a taut line.

### Step 7: Update tension calculation

Tension follows the rules described in the Physics Reference section above. To summarise the implementation:

```
if line is slack:
    tension = 0
else if payout is occurring (fish beat the drag):
    tension = effectiveDragThreshold + avatarPullForce
else:
    tension = reactiveDrag + (isHolding ? avatarPullForce : 0)
```

This gives tension a clear physical meaning: the actual force the line is experiencing right now.

### Step 8: Verify metallic path is unaffected

The metallic target type uses static/kinetic friction, not reactive drag in the same way. Verify that:

- The `state.targetType === "metallic"` branches still work
- Static friction gating (`isMoving` flag) is not broken
- The `staticBreakTimer` logic is preserved
- Slip calculations still receive correct tension values

### Step 9: Update debug logging

Update the existing `[DRAG TICK]` log to include:

- `reactiveDragCoeff` (the constant, for reference)
- `outwardRadialSpeed` (the velocity component being resisted)
- `reactiveDrag` (the resulting force: `min(speed * coeff, cap)`)
- `lineLoadForce` (swim + external along line, used for payout decisions)
- `isHolding` (0 or 1)
- `avatarPullForce` (the player’s active pull force, 0 when not holding)

Key things to validate in the logs:

- When fish has outward velocity and line is taut: `reactiveDrag > 0`
- When fish has zero or inward velocity: `reactiveDrag = 0`
- Outward radial velocity should decay toward zero when `reactiveDrag` is active and the fish’s swim force is below the drag threshold
- `straightLineDistance` should stop growing (or grow very briefly then stop) when drag can hold the fish
- Payout should only occur when `lineLoadForce > effectiveDragThreshold + avatarPullForce`
- When `isHolding = 1`, tension should be higher than when `isHolding = 0` (because avatarPullForce contributes)

---

## What NOT to Change

- Fish AI (`updateFishAI`) - leave fish behaviour/forces alone
- Water drag / kinetic drag coefficient - the existing `velocityDragVector` calculation stays as-is. Reactive drag is additional directional resistance on top of water drag
- The hold/pull mechanics (`avatarPullForce`, RPM ramp, `playerRecoveryVelocity`) - unchanged
- Line recovery when holding and fish approaches - unchanged
- Spool accounting - unchanged (payout still decrements spool, recovery still increments it)
- Line condition / snap mechanics - unchanged (these use tension which will still be provided)
- Metallic target path - leave the friction model alone
- Slip calculations - unchanged (these use tension)
- Quick release mechanics - `effectiveDragThreshold` still switches between `dragThresholdCurrent` and `dragThresholdMin` based on `dragQuickReleaseActive`

---

## Expected Behaviour After Refactor

1. **Fish swims away, player NOT holding, weak fish:** Fish decelerates to zero outward radial velocity. `straightLineDistance` stabilises. Line stays taut. Tension reflects reactive drag force (decays to ~0). No payout. Fish can still swim tangentially.
1. **Fish swims away, player NOT holding, strong fish:** Fish’s `lineLoadForce` exceeds `effectiveDragThreshold`. Reactive drag saturates at cap. Net force still positive outward. Line pays out. Tension = effectiveDragThreshold.
1. **Fish swims away, player IS holding:** Combined resistance (reactive drag + avatar pull) is higher. Fish decelerates faster. If combined resistance exceeds fish force, fish stops. Tension = reactiveDrag + avatarPullForce.
1. **Fish turns inward:** Reactive drag drops to zero immediately. Fish moves freely toward player. If player is holding, line recovery takes up slack. Tension = avatarPullForce (if holding) or 0.
1. **Fish changes direction rapidly:** Each tick recalculates based on current outward radial velocity. No momentum carryover issues. Direction changes feel responsive.
1. **Quick release active:** `effectiveDragThreshold` drops to `dragThresholdMin`, reducing the cap. Even weak fish can run line out. Tension stays low. Good for protecting line condition.
