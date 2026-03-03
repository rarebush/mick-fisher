# Physics Refactor Update: Reel Drag Threshold as Reactive Resistance

## Context

This prompt updates the physics model described in the previous refactor prompt. Specifically it revises how reelDragThreshold behaves, removes the idle versus engaged state distinction, and introduces drag adjustment and quick release as player-facing mechanics. All other aspects of the physics model described previously remain unchanged.

---

## The Core Change: Reactive Drag Model

The previous model treated reelDragThreshold as a constant passive output. This was incorrect. reelDragThreshold is a ceiling on passive resistance matching, not a fixed force the reel always exerts.

The reel responds proportionally to whatever opposing force is acting on the line, up to the threshold limit. Above the limit, excess force pays out line as before.

### Revised Formula

**Passive reel drag force = min(totalObjectForce, reelDragThreshold)**

Examples with reelDragThreshold set at 40N:

- totalObjectForce 0N: reel exerts 0N. No opposing force, no drag response.
- totalObjectForce 30N: reel matches 30N exactly. Item held in place passively.
- totalObjectForce 50N: reel caps at 40N. Excess 10N pays out line.
- totalObjectForce 40N: reel matches exactly at the threshold ceiling. No payout, held in place.

This model requires no engagement state, no idle versus active distinction, and no commitment mechanic. The reel is always reactive and always proportional to the current load.

---

## Revised totalPlayerResistance Calculation

totalPlayerResistance is now always composed of two components: the reactive reel drag and the player's active pull force.

**When player is not holding:**

totalPlayerResistance = min(totalObjectForce, reelDragThreshold)

**When player is holding:**

totalPlayerResistance = min(totalObjectForce, reelDragThreshold) + avatarPullForce

The reel drag component is always present and always reactive regardless of player input state. The player's avatarPullForce is purely additive on top of it. The player supplements the reel, they do not replace it.

This means:

- The player never needs to hold to prevent a light item drifting. The reel handles it passively up to its threshold.
- The player's input only meaningfully changes the system when avatarPullForce adds enough force to exceed totalObjectForce and move the item toward shore.
- Releasing input during a retrieve never drops resistance to zero. It drops resistance to the reel's current reactive level, which may be sufficient to hold a tired fish or a light item, and insufficient to hold a hard-running fish above the threshold.

---

## Remove Idle vs Engaged State

The previous prompt introduced an idle and engaged state to gate when reelDragThreshold applied. This is no longer needed and should be removed.

The reactive drag model handles post-cast behaviour correctly without any engagement gating:

- After cast with no opposing force: reel exerts zero resistance. Item settles freely under gravity and current.
- After cast with light current pushing item: reel matches current force up to threshold. Item held in place or drifting slowly depending on current magnitude relative to threshold.
- After cast with strong current exceeding threshold: line pays out. Item drifts downstream.

No state transition is required. The physics resolves correctly from the reactive formula alone.

---

## reelDragThreshold as a Player-Adjustable Value

reelDragThreshold is no longer a fixed equipment property. It is a player-adjustable value with a range defined by the equipped reel tier.

### Value Properties

**dragThresholdMin:** the lowest value the player can set for this reel. On basic reel tiers this may equal dragThresholdMax, making it effectively fixed. On higher tiers this approaches zero, enabling a near-free-spool state.

**dragThresholdMax:** the highest passive resistance the reel can provide. Determined by equipment tier. Replaces the previous fixed reelDragThreshold property.

**dragThresholdCurrent:** the player's current setting within the min to max range. This is the value used in all physics calculations as reelDragThreshold.

### Adjustment Timing

Drag adjustment is a pre-cast or between-cast action. It is not a real-time mid-fight control by default. The player sets their drag threshold before committing to a retrieve. This is authentic to how real fishing reels work and avoids the need for a second real-time input.

Mid-fight drag adjustment can be introduced as an advanced equipment capability on higher tier reels if desired, but this should not be assumed as default behaviour in the physics model.

---

## Quick Release as a Discrete Action

Quick release is a separate mechanic from drag adjustment. It is an instantaneous action that drops dragThresholdCurrent to dragThresholdMin for the duration it is held or for a brief fixed duration, then returns to the previous setting.

### Behaviour

On quick release activation: dragThresholdCurrent drops to dragThresholdMin immediately. If dragThresholdMin is zero, totalPlayerResistance drops to avatarPullForce only. If the player is also not holding, totalPlayerResistance is zero. Line goes fully slack. Object moves freely under its own forces with no resistance from the player side.

On quick release deactivation: dragThresholdCurrent returns to its previous value. The reactive drag model resumes immediately from the new load state.

### Primary Use Cases

**Fish running toward player:** fish swimForce in toward-player direction is generating slack. Player activates quick release to ensure zero resistance as the fish approaches, preventing any possibility of a taut line event while the fish is generating slack. When the fish turns and runs, the player deactivates quick release and the reel drag re-engages reactively against the new opposing force.

**Post-cast settling:** player wants the magnet or lure to drift freely with the current before engaging. Quick release to dragThresholdMin allows free drift. Player deactivates when satisfied with position.

**Snag management:** item is snagged and tension is building. Quick release drops resistance, reduces tension spike, may allow the snag to resolve without a line break.

### Input Mapping

Quick release requires a second input gesture since the primary hold input is occupied by avatarPullForce generation. Suggested options in order of preference:

- Double tap: accessible within single touch model, distinct from hold
- Long press: conflicts with sustained hold, not recommended
- Dedicated second button: breaks single touch ideal but explicit and learnable

The choice of input mapping is outside the scope of this physics prompt but the mechanic should be implemented in a way that accepts any of these trigger types so the input mapping can be decided and changed independently.

---

## Equipment Progression Through Drag Mechanics

Reel tiers are now meaningfully distinct through drag capabilities rather than just force capacity differences. Suggested tier structure:

**Basic reel:** dragThresholdMin equals dragThresholdMax. Fixed drag, not adjustable. No quick release. Player accepts whatever passive resistance the reel provides. Simple and forgiving but inflexible.

**Intermediate reel:** dragThresholdMin is lower than dragThresholdMax. Player can pre-set drag within a range before casting. No quick release. Introduces drag strategy without real-time complexity.

**Quality reel:** full drag range including near-zero minimum. Adds quick release capability. Player can now manage slack events and free-spool situations deliberately.

**Specialist reel:** all quality reel capabilities plus mid-fight drag adjustment as a real-time control. Highest skill ceiling. Intended for experienced players who want full control over passive resistance during a fight.

---

## Edge Cases to Handle

**totalObjectForce is zero and player is not holding:** totalPlayerResistance is zero. This is correct. Nothing is pulling, nothing is resisting. Line is taut but unloaded.

**Quick release activated while tension is high:** dragThresholdCurrent drops to minimum, totalPlayerResistance drops sharply. Tension drops to avatarPullForce only or zero if not holding. If the object had momentum away from player at this moment, objectVelocity continues under its own force with minimal resistance. Spool pays out rapidly. This is intentional: quick release during a hard run is a deliberate sacrifice of ground to protect the line.

**Player adjusts drag threshold between casts:** dragThresholdCurrent updates immediately. No physics consequences until the next cast since no line is under load. Safe to change freely between retrieves.

**dragThresholdMin is zero and player activates quick release while not holding:** totalPlayerResistance is zero. Object moves completely freely. Spool pays out at full rate if object is moving away. This is the maximum risk state and should be communicated clearly in the display.

**reelDragThreshold mid-fight on specialist reel:** if mid-fight adjustment is implemented, changes to dragThresholdCurrent take effect next physics tick. No smoothing or ramping required: a physical drag dial adjusts immediately. However the reactive drag formula still applies, so increasing the threshold mid-fight only increases resistance up to the current totalObjectForce level, not beyond it.

---

## Display Updates

**Player force bar:** now shows three values. dragThresholdCurrent as the passive ceiling marker. Current reactive drag force (min of totalObjectForce and dragThresholdCurrent) as the active passive region. avatarPullForce as the additional active region on top. Player can read at a glance what the reel is doing passively and what they are adding actively.

**Drag threshold indicator:** if drag is player-adjustable, a separate simple indicator showing dragThresholdCurrent within its min to max range. Only needs to be prominent on reel tiers where adjustment is available. Hidden or greyed on basic fixed-drag reels.

**Quick release indicator:** a visible state indicator when quick release is active. Should be prominent enough to confirm the action was registered and communicate that the player is currently in a low-resistance state.
