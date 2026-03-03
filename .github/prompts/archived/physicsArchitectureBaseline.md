# Mick Fisher Physics Architecture Baseline

## Source

This document was produced by a codebase audit during Phase 0+1 (Data Model Validation). It captures the state of the physics system as of March 2026, after the Phase 0+1 remediation changes (C-1, C-2, F-1) were applied. It is intended as a reference for Phase 2 (Tension Model Refactor with 2D Motion Integration).

---

## 1. Object Data Model

### Evidence Anchors

- Target factories: `src/game/physics/targetFactory.js`
- Physics state container: `src/game/physics/physicsState.js`
- Metallic initialization path: `src/game/sequences/castSequence.js`
- Fish initialization path: `src/game/sequences/dragSequence.js`

### Metallic Target Shape (createMetallicTargetFromItem)

| Property                | Type    | Where Defined    | Where Updated                | Purpose                                       |
| ----------------------- | ------- | ---------------- | ---------------------------- | --------------------------------------------- |
| id                      | string  | targetFactory.js | none in physics loop         | Runtime identifier                            |
| type                    | string  | targetFactory.js | none                         | Item type/id                                  |
| category                | string  | targetFactory.js | none                         | Category metadata                             |
| mass                    | number  | targetFactory.js | read in physics force/accel  | Inertial mass                                 |
| dragFactor              | number  | targetFactory.js | read in current/drag calcs   | Drag scaling                                  |
| staticFrictionThreshold | number  | targetFactory.js | read in drag loop            | Static break gate                             |
| kineticDragCoefficient  | number  | targetFactory.js | read in drag loop            | Linear velocity drag coefficient              |
| position                | {x, y}  | targetFactory.js | dragPhysics.js, bounds clamp | Object world position                         |
| velocity                | {x, y}  | targetFactory.js | dragPhysics.js               | Stored velocity vector                        |
| isMoving                | boolean | targetFactory.js | dragPhysics.js               | Static/kinetic state                          |
| currentForce            | {x, y}  | targetFactory.js | none (always zero)           | Unified force interface (added Phase 0+1 C-1) |
| magneticStrength        | number  | targetFactory.js | none                         | Item property                                 |
| surfaceCondition        | string  | targetFactory.js | none                         | Slip modifier input                           |
| attachmentPoint         | string  | targetFactory.js | none                         | Slip profile metadata                         |
| slipAccumulation        | number  | targetFactory.js | dragPhysics.js               | Slip progress                                 |
| slipLimit               | number  | targetFactory.js | none                         | Detachment threshold                          |
| attached                | boolean | targetFactory.js | none                         | Attachment state                              |
| dropCount               | number  | targetFactory.js | none                         | Item metadata                                 |
| quality                 | number  | targetFactory.js | none                         | Item metadata                                 |

### Fish Target Shape (createFishTarget)

| Property                             | Type                  | Where Defined    | Where Updated           | Purpose                  |
| ------------------------------------ | --------------------- | ---------------- | ----------------------- | ------------------------ |
| id/species/size/category             | string                | targetFactory.js | mostly immutable        | Identity/classification  |
| mass                                 | number                | targetFactory.js | read in drag loop accel | Inertial mass            |
| dragFactor                           | number                | targetFactory.js | read in force calcs     | Drag scaling             |
| kineticDragCoefficient               | number                | targetFactory.js | read in drag loop       | Linear drag coefficient  |
| position                             | {x, y}                | targetFactory.js | dragPhysics.js          | Fish world position      |
| velocity                             | {x, y}                | targetFactory.js | dragPhysics.js          | Stored velocity vector   |
| isMoving                             | boolean               | targetFactory.js | dragPhysics.js          | Kinetic marker           |
| baseStrength                         | number                | targetFactory.js | read in AI              | Force baseline           |
| maxEnergy / energyRegen              | number                | targetFactory.js | AI updates energy       | Stamina system           |
| temperament                          | string                | targetFactory.js | none                    | AI behavior profile      |
| panicThreshold                       | number                | targetFactory.js | none                    | Panic trigger threshold  |
| state                                | string                | targetFactory.js | stateUpdates.js         | hooked/fighting/tired    |
| energy                               | number                | targetFactory.js | stateUpdates.js         | Stamina                  |
| panicLevel                           | number                | targetFactory.js | stateUpdates.js         | Panic progression        |
| targetDirection                      | {x, y}                | targetFactory.js | stateUpdates.js         | AI desired heading       |
| directionChangeTimer                 | number                | targetFactory.js | stateUpdates.js         | Retarget cadence         |
| directionChangeFrequency             | number                | targetFactory.js | read in AI              | Base cadence             |
| fightPhase                           | string                | targetFactory.js | stateUpdates.js         | run/rest phase           |
| fightPhaseTimer                      | number                | targetFactory.js | stateUpdates.js         | Phase duration           |
| fightRunDuration / fightRestDuration | number                | targetFactory.js | read in AI              | Seeded cadence           |
| currentForce                         | {x, y}                | targetFactory.js | stateUpdates.js         | Fish output force vector |
| lineStress / baseValue / attached    | number/number/boolean | targetFactory.js | mostly immutable        | Metadata/UI/economy      |

### Key Observations

- 2D position exists and is used for both physics and rendering: physics update in dragPhysics.js, rendering read in dragSequence.js.
- 2D velocity exists but update is scalar-on-axis then reprojected into {x, y} vector.
- Mass and kineticDragCoefficient are stored directly on target objects; drag loop has fallback from dragFactor for kinetic coefficient.
- Fish vs metallic differ structurally: fish has AI state/force fields, metallic has slip/attachment/surface fields. Both now share currentForce interface (Phase 0+1 C-1/C-2).

---

## 2. Physics Loop

### Entry and Call Chain

- Drag ticker calls `updateDragMechanics` in dragSequence.js
- `updateDragMechanics` computes deltaTime (now clamped via F-1) and calls `updateDragPhysics(deltaTime, isHolding, physicsState)` in dragPhysics.js

### Per-Tick Execution Order (dragPhysics.js)

1. **Step 1:** Forces + velocity/position update
2. **Step 2:** Line axis refresh + recovery
3. **Step 3:** Geometry + slack/taut
4. **Step 4:** Auto-reel safe condition
5. **Step 5:** Tension compute
6. **Step 6:** Payout
7. **Step 7:** Line condition
8. **Step 8:** Break check
9. **Step 9:** RPM/outputs/state commit

### Velocity and Position Update Mode (1D Axis-Constrained)

- Velocity scalar computed along line axis via `getSignedAxisVelocity`
- Velocity drag is scalar
- Acceleration uses scalar net force
- Scalar velocity reprojected back onto axis as {x, y} vector
- Position advanced along axis by scalar velocity
- **This is axis-constrained 1D dynamics represented in 2D coordinates**

### Tension, Geometry, and Storage

- lineAxis and straightLineDistance from `getLineAxis`
- slack and lineTaut computed and stored in physicsState
- Tension computed in Step 5 and committed to state
- Break threshold from equipment lineStrength scaled by line condition
- Force breakdown stored in `state.forces`

---

## 3. Fish AI

### Location and Output

- Implementation: `updateFishAI` in stateUpdates.js
- Outputs `fish.currentForce` as 2D vector each tick
- Physics loop reads currentForce via unified interface (Phase 0+1 C-2), projects onto line axis for scalar swimForce

### Inputs and Mutation

- Reads tension and avatarPosition via function parameters
- Uses fish.position to compute pull/away directions
- Does not directly mutate world position or velocity; returns updated fish state including force and internal AI fields

### Internal AI State

- Energy / maxEnergy / regen
- Panic model and state transitions (hooked/fighting)
- Fight phase run/rest and timers
- Direction change timers and targetDirection

---

## 4. Existing Utilities

### Vector Utilities (vectorUtils.js)

- `magnitude(v)`
- `distance2D(a, b)`
- `normalize(v)`
- `subtract(a, b)`
- `add(a, b)`
- `scale(v, s)`
- `dotProduct(a, b)`
- `clamp(value, min, max)`
- `speedFromDelta(dx, dy, deltaTime, minDeltaTime)`

### Force Calculations (forceCalculations.js)

- `getEngineTorque(tension, equipment)`
- `getLineAxis(avatarPosition, targetPosition)`
- `getSignedAxisVelocity(velocity, axis)`
- `getDragThresholdMax/Min/Current(equipment)`
- `getSpoolCapacity(equipment)`
- `getAvatarPullForceFromRpm(rpm, equipment)`
- `getPullForce(tension, equipment, target, avatarPosition)`
- `getWaterDrag(target, velocity, lineLength)`
- `getCurrentForce(target, currentEnvironment)`
- `getFriction(target, velocity, isMoving)`

### World Bounds (worldBounds.js)

- `getWaterBounds` / `getRiverbedBounds`
- `clampPositionToBounds` / `clampTargetToBounds`
- Hard clamping (not soft boundary forces)
- Drag loop clamps target position after integration each tick

---

## 5. Known Quirks and Constraints

- **1D axis projection:** Physics is structurally 1D along line axis despite {x, y} storage. Net force and acceleration are scalar-on-axis then reprojected. This is the primary target for Phase 2 refactor.
- **Fish force scalar consumption:** Fish currentForce exists as 2D but is consumed as scalar projection onto line axis for movement.
- **deltaTime safety:** Clamped at drag sequence level (Phase 0+1 F-1). No sub-stepping.
- **Type branching:** Physics loop branches on target type for fish AI/slip/static friction paths.
- **Debug logging:** Remains in hot path.
- **DISABLE_MAGNET_SLIP:** Feature flag bypasses magnet slip (true in physicsConstants.js).
- **Design doc discrepancy:** Technical Architecture notes force/slack replacing legacy percent model. Horizontal Drag doc still contains legacy percent/tap sections with deprecation note.

---

## 6. Phase 0+1 Changes Applied

| ID  | File             | Change                                                            | Purpose                                      |
| --- | ---------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| C-1 | targetFactory.js | Added `currentForce: { x: 0, y: 0 }` to metallic targets          | Unified force interface                      |
| C-2 | dragPhysics.js   | Unified actor-force read path with defensive fallback and warning | Removed type-gated swim force branch         |
| F-1 | dragSequence.js  | Added deltaTime clamp (MAX_DRAG_PHYSICS_DELTA_TIME ~67ms)         | Prevents physics explosions on frame hitches |
