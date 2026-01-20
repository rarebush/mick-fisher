# Vertical Lift Phase (Bringing to Surface)

**Overview:**
After horizontal drag brings item to shore/bank, player must lift vertically from underwater to air. This phase has two distinct sub-phases: blind underwater lift (mystery) and revealed lift (informed decision-making).

## Phase 2a: Blind Underwater Lift

**Context:**

- Item is at shore but still submerged
- Player cannot see what item is
- Slip meter remains hidden
- Only weight/resistance feedback available

**Core Interaction: Rhythmic Tapping**

**NOT a rhythm game** (no music beat matching) - instead, tap frequency creates tension vs safety trade-off

**Input Method:**

- Tap/click screen or button repeatedly
- Each tap applies upward force
- Item rises incrementally per tap
- No input = item slowly sinks (recoverable)

**Tap Frequency Effects:**

| Tap Rate            | Rise Speed | Tension Level | Slip Rate | Risk                       |
| ------------------- | ---------- | ------------- | --------- | -------------------------- |
| <1 tap/s (Slow)     | 0.3 m/s    | Low (20%)     | 0.5x      | Item may sink, wastes time |
| 1-2 taps/s (Steady) | 0.8 m/s    | Medium (50%)  | 1.0x      | Balanced, safe default     |
| 2-3 taps/s (Fast)   | 1.5 m/s    | High (75%)    | 2.5x      | Slip accumulates quickly   |
| >3 taps/s (Frantic) | 2.0 m/s    | Danger (95%)  | 5.0x      | Very likely to slip off    |

**Strategic Trade-off:**

- **Slow tapping:** Safe but time-consuming, burns session timer
- **Steady tapping:** Efficient, manageable slip build
- **Fast tapping:** Speed gamble, relies on good placement from drag phase
- **Frantic tapping:** Desperation/panic, almost always causes failure

**Weight Resistance:**
Heavy items require higher tap frequency to maintain rise speed:

- Light items (0-10kg): 1 tap/s maintains 0.8 m/s rise
- Medium items (10-25kg): 1.5 taps/s needed for same speed
- Heavy items (25-50kg): 2 taps/s needed
- Very heavy (50kg+): 2.5+ taps/s needed (dangerous territory)

**Depth-Based Duration:**

- Shallow water (Q0, Q1-Q3): 2-4m depth = 8-15s blind lift
- Medium depth (Q4-Q6): 5-8m depth = 15-25s blind lift
- Deep water (Q7-Q9): 8-12m depth = 25-40s blind lift

**Visual Feedback (Minimal):**

- Depth meter: shows current depth (12m → 8m → 4m)
- Ripple intensity: increases as item nears surface
- Bubble trail: streams upward, frequency matches tap rate
- Shadow hint: vague silhouette becomes slightly clearer (not identifiable)

**Audio Feedback:**

- Procedural underwater ambience (Tone.js filtered noise)
- Tap response: muffled splash per tap
- Strain sounds: increase with tap frequency
- Rising pitch: as item ascends (creates mounting tension)
- Weight groans: for heavy items at high tap frequency

**Hidden Slip Continues:**

- Slip accumulates based on tap frequency
- Carries over from drag phase accumulation
- Player still unaware of slip value
- High-frequency tapping can push slip near limit before surface

**Critical Decision Point Approaching:**
As item nears surface (depth <2m):

- Audio cue intensifies (water rushing, pressure change)
- Bubble frequency increases dramatically
- Light begins to penetrate (brightness increases)
- Player anticipation peaks: "What is it?"

## Phase 2b: Surface Break & Revealed Lift

**Transition: The Reveal Moment**

**Sequence (2-3 seconds):**

1. Item breaches water surface
2. **Visual reveal:**
   - Item sprite appears (full detail, scaled to "near" size)
   - Water drainage animation (streams off item)
   - Magnet position visible (centered, edge, corner grip)
   - Surface condition visible (clean, rusty, sludge-coated)
3. **UI elements appear:**
   - Slip meter becomes visible (shows accumulated slip)
   - Item name/type label
   - Condition indicator (pristine, worn, corroded)
   - Estimated value (if applicable)
4. **Audio cue:**
   - Triumphant chime (pitch/timbre varies by item rarity)
   - Surface splash
   - Ambient sound shifts (muffled underwater → clear air)
5. **Timer pauses** (2-3s decision window)

**Information Revealed:**

| Visual Element   | Information Conveyed        | Strategic Implication |
| ---------------- | --------------------------- | --------------------- |
| Item sprite      | Identity (bike, safe, etc)  | Value assessment      |
| Magnet position  | Slip limit estimate         | Risk calculation      |
| Surface coating  | Slip rate indicator         | Caution needed        |
| Slip meter value | Current slip (e.g., 45/90)  | Available margin      |
| Condition        | Refurb potential, fragility | Keep/drop decision    |

**The Drop Decision**

**Window:** 2-3 seconds after surface break (timer pauses)

**Decision Factors:**

- **Item value:** Is it worth continuing the risky lift?
- **Slip margin:** How much slip budget remains?
- **Magnet grip:** Centered (safe) vs edge (risky)?
- **Surface condition:** Clean (slow slip) vs sludge (fast slip)?
- **Time remaining:** Is this my last cast anyway?

**Options:**

**Option 1: Continue Lift (Commit)**

- Resume tapping to complete retrieval
- Timer resumes
- Accept risk of slip-off before securing item
- Potential reward: valuable item secured

**Option 2: Intentional Drop (Abort)**

- Button prompt: "Drop item? [Yes] [No]"
- Confirm: Item falls back to water, magnet returns to hand
- Benefits:
  - Saves 10-15 seconds (no lift completion needed)
  - Preserves line/magnet (no break risk)
  - Can immediately recast in different quadrant
- Costs:
  - Lose that item (might have had rare parts)
  - Emotional cost (sunk time investment)
  - Quadrant depletion still occurs

**Strategic Scenarios:**

**Scenario A: Keep Low-Value Item**

- Rusty bike appears, magnet edge-grip, slip at 65/75
- Very risky (only 10 slip margin)
- But: bike might have rare parts unknown until inspection
- Decision: Drop and recast, or gamble on parts?

**Scenario B: Commit to High-Value**

- Safe appears! Magnet centered, slip at 30/90
- Excellent margin (60 slip remaining)
- High value, worth the remaining effort
- Decision: Obviously continue (no one drops a safe)

**Scenario C: Time Pressure**

- Container appears, decent grip, safe slip margin
- But: only 45 seconds left in session
- Decision: Secure this find or drop and try for one more cast?

**Option 3: Auto-Continue (No Decision)**

- If player doesn't actively choose to drop within 2-3s window
- Auto-commits to completion
- Prevents accidental drops from inaction
- Timer resumes, lift continues

**Revealed Lift Mechanics**

**Same tapping interaction** as blind phase, but now:

- **Slip meter visible** - player sees slip increasing in real time
- **Visual warnings:**
  - 80% of slip limit: meter flashes yellow, magnet wobbles on item
  - 95% of slip limit: meter flashes red, urgent audio cue
  - 100% slip limit reached: magnet pops off (soft failure)

**Slip Rate Influenced By:**

```
Current Slip Rate = Base Rate × Surface Condition × Tap Frequency × Tension

Base Rate = 1.0 (standard)
Surface Condition = 1.0 (clean), 2.0 (rusty), 4.0 (sludge)
Tap Frequency Multiplier = 0.5 (slow), 1.0 (steady), 2.5 (fast), 5.0 (frantic)
Tension = derived from tap frequency (slow = low, fast = high)
```

**Example Calculations:**

**Safe scenario:**

- Base rate: 1.0
- Clean metal surface: ×1.0
- Steady tapping (1.5 taps/s): ×1.0
- Current slip: 30, Limit: 90
- **Slip rate: 1.0/s, time to limit: 60s** (plenty of margin)

**Dangerous scenario:**

- Base rate: 1.0
- Heavy sludge: ×4.0
- Fast tapping (2.5 taps/s): ×2.5
- Current slip: 65, Limit: 75
- **Slip rate: 10.0/s, time to limit: 1 second** (imminent failure)

**Player Response to Visible Slip:**

- See slip climbing fast → reduce tap frequency
- Trade speed for safety: slower lift but more likely to succeed
- Skill expression: finding optimal tap rate for conditions
- Experienced players anticipate: see sludge-coated item, immediately tap slowly

**Lift Completion:**

**Success Condition:**
Item fully lifted out of water (reaches "secured" height threshold)

**Success Sequence:**

1. Final taps bring item to safety threshold
2. Audio: triumphant fanfare, item secured sound
3. Visual: item scales larger (closer to camera), sparkle effect
4. Item added to session inventory automatically
5. UI transition: Reveal screen (detailed item info)
6. Timer pauses for item inspection

**Failure Condition:**
Slip meter reaches limit before item secured

**Failure Sequence (Soft Fail):**

1. Slip meter hits 100%
2. Audio: magnet clunk/pop, disappointed sound
3. Visual: magnet detaches, item falls back to water
4. Splash animation
5. **Item drops to water surface** (not fully lost)
6. Option appears: "Try again? Magnet still attached"

**Retry Mechanic:**

- Item floats/sinks slowly back down
- Player can tap to attempt lift again immediately
- Slip resets to 50% of previous value (partial recovery)
- Can retry multiple times until:
  - Success (item secured)
  - Item sinks too deep (despawns after 3 retries)
  - Player chooses to abandon

**Degradation on Retry:**
Some items degrade if dropped repeatedly:

- Containers: may crack, lose some contents (RNG per drop)
- Fragile electronics: break further, reduce value
- Solid metal items: no degradation (bikes, safes, tools)

**Strategic Retry Decision:**

- Valuable container, already cracked once: risk another drop?
- Heavy item, slip conditions bad: accept loss or keep trying?
- Session time running out: one more attempt or cut losses?

## Lift Phase Events

**Event Types:**

| Event              | Trigger                         | Effect                                           | Frequency           |
| ------------------ | ------------------------------- | ------------------------------------------------ | ------------------- |
| Item Rotation      | Random, mid-lift                | Slip spike +15-25, visual item spin              | 20% chance          |
| Container Drainage | Container items only            | Weight reduction 30%, easier tapping             | 100% for containers |
| Structural Break   | Fragile items, fast tapping     | Item splits, keep piece (reduced value)          | 10% fragile items   |
| Wildlife Startle   | Shallow water, rare             | Bird/otter splash, no mechanical effect (comedy) | 5% Q0-Q3            |
| Audience Reaction  | Public locations, valuable item | NPC dialogue, no mechanical effect (narrative)   | Varies by location  |

**Item Rotation Detail:**

- Occurs randomly during revealed lift
- Item sprite rotates visibly
- Slip meter suddenly jumps +15-25 (magnet grip shifts)
- Audio: grinding metal, strain sounds
- Player must react: reduce tap frequency to compensate
- Cannot be prevented, tests player adaptability

**Container Drainage Detail:**

- All containers (safes, bags, boxes, crates) start heavy with water
- As item emerges from water, drainage animation plays
- Weight reduces by ~30% (simulates water pouring out)
- Rise speed increases noticeably
- Audio: water gushing, hollow echoes
- Visual: streams of water off item
- Makes final lift easier (reward for getting container this far)

**Structural Break Detail:**

- Rare event for corroded/fragile items
- Triggered by excessive tap frequency (frantic tapping)
- Item visibly cracks or splits mid-lift
- Player secures only part of item (handle, piece, fragment)
- Value reduced (e.g., 100% → 30% of original)
- Catalog progress still counts (found item, even if broken)

## Sub-Phase Timing Summary

**Phase 2a: Blind Lift (underwater)**

- Duration: 8-40s depending on depth and tap frequency
- Player input: Rhythmic tapping (frequency determines speed vs risk)
- Slip accumulation: Hidden, carried over from drag + new accumulation
- Goal: Reach surface to see what you have

**Phase 2b: Revealed Lift (above water)**

- Duration: 5-25s depending on item height, weight, and conditions
- Decision window: 2-3s at surface break (keep or drop)
- Player input: Rhythmic tapping with visible slip feedback
- Slip accumulation: Visible, player adjusts strategy in real-time
- Goal: Secure item before slip reaches limit

**Total Lift Phase Time:**

- Fast/easy: 13-20s (shallow, light, good conditions)
- Medium: 25-35s (medium depth/weight, average conditions)
- Slow/difficult: 50-65s (deep, heavy, poor grip, sludge)

## Lift Phase Success Rate Factors

**Factors that increase success:**

- Good magnet placement (center grip)
- Clean item surface (no sludge)
- Low tension during drag phase (less accumulated slip)
- Steady tapping during lift (not frantic)
- Player experience (reading conditions, adjusting frequency)

**Factors that decrease success:**

- Poor magnet placement (edge/corner grip)
- Heavy sludge coating (high slip rate)
- High tension during drag phase (slip already near limit)
- Heavy item weight (requires faster tapping, builds tension/slip)
- Frantic tapping (panic response, accelerates failure)

**Skill Ceiling:**

- Beginners: succeed ~40-60% of lifts (panic tapping, ignore conditions)
- Intermediate: succeed ~60-75% (recognize conditions, adjust tapping)
- Expert: succeed ~80-90% (optimal tapping, use intentional drops wisely)
- Note: Some failures unavoidable (bad RNG on placement + sludge)

## Open Questions

- **Q8:** Should the "drop decision" window be timed (auto-commit after 3s) or wait indefinitely for player input (pausing timer)?
- **Q9:** How many retry attempts should be allowed after magnet slip-off before item is lost? (Current: 3 retries)
- **Q10:** Should structural break events be completely random or tied to cumulative tap frequency (damage threshold model)?
- **Q11:** For container drainage: should weight reduction be instant at surface break, or gradual as lift continues?

---
