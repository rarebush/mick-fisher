# Physics Module Ownership

This note defines ownership boundaries for drag-phase physics modules.

## Scope

- This is implementation ownership, not gameplay design.
- For mechanic intent and balancing formulas, see game design docs in `documentation/game design/`.

## Module Boundaries

### `src/game/physics/physicsConstants.js`

Single tuning hub for drag-phase simulation constants. Grouped domains:

- Core line and drag simulation
- Engine torque curve tuning
- Fish behavior tuning
- Metallic slip and profile derivation defaults
- Wait and strike timing constants

### `src/game/physics/targetStateUpdates.js`

Per-tick state transforms for drag targets:

- Fish state machine (`updateFishAI`): panic, phase, direction, and force intent
- Metallic slip progression (`updateSlip`)

### `src/game/physics/forceCalculations.js`

Pure math and force helpers. No state mutation.

### `src/game/physics/dragPhysics.js`

Main integrator for drag simulation tick:

- Combines forces and constraints
- Integrates motion and line/spool state
- Computes tension/slack and condition decay
- Emits simulation events

### `src/game/physics/targetFactory.js`

Runtime target construction:

- Metallic profile derivation and initialization
- Fish runtime initialization from species and size templates

### `src/game/physics/waitPhase.js`

Wait and strike timing updates:

- Nibble cadence
- Bite transition
- Strike window countdown
- Bob spring motion

### `src/game/physics/physicsState.js`

Initial shape and defaults for physics runtime state.

### `src/game/physics/physicsExports.js`

Public re-export barrel for physics constants and modules.

## Practical Rule of Thumb

- Add a value to `physicsConstants.js` when it affects balancing or simulation tuning.
- Keep a value local when it is only a narrow implementation detail and not a tuning control.
