# Slip System (Comprehensive)

**Overview:**
Slip is the core risk mechanic that can cause magnet to detach from item, resulting in failed retrieval. It's influenced by initial placement RNG, item surface condition, and player tension/input behavior across both drag and lift phases.

## Slip Limit (Hidden Maximum)

**Set at Moment of Magnet Contact (Cast Phase):**

When magnet lands on item, RNG determines placement quality:

| Placement Quality | Probability | Slip Limit Range | Visual Indicator (at surface break) |
| ----------------- | ----------- | ---------------- | ----------------------------------- |
| Perfect Center    | 15%         | 85-100           | Magnet dead-center on item sprite   |
| Good Center       | 35%         | 65-84            | Magnet near-center, slight offset   |
| Edge Grip         | 35%         | 40-64            | Magnet on edge of item              |
| Corner Grip       | 15%         | 20-39            | Magnet barely attached, corner/tip  |

**Slip Limit Examples:**

- Large flat safe, center grip: limit = 95 (very secure)
- Bicycle frame, edge grip: limit = 48 (precarious)
- Small tool, corner grip: limit = 25 (very likely to slip)

**Hidden Until Surface Break:**

- Player cannot see slip limit value
- Only revealed indirectly via visual placement at surface break
- Experienced players learn to estimate: "That's an edge grip, probably 40-60 limit"

## Slip Rate (Accumulation Speed)

**Determined by Item Surface Condition:**

When item is pulled through water and lifted, surface condition affects how easily magnet slides off:

| Surface Condition       | Slip Rate Multiplier | Visual Appearance           | Common Item Types                |
| ----------------------- | -------------------- | --------------------------- | -------------------------------- |
| Clean Metal             | 1.0x (baseline)      | Shiny, metallic gleam       | New tools, modern items          |
| Light Rust/Oxidation    | 1.5x                 | Mottled orange-brown        | Old tools, vintage items         |
| Heavy Rust              | 2.5x                 | Rough, flaky texture        | Corroded items, long-submerged   |
| Organic Coating (Algae) | 3.0x                 | Green/brown slimy layer     | Items in still/shallow water     |
| Heavy Sludge/Mud        | 4.0x                 | Thick mud coating, dripping | Industrial sites, polluted water |

**Slip Rate Formula:**

```
Slip Accumulation per Frame = Base Slip Rate × Surface Condition Multiplier × Tension Modifier × Delta Time

Base Slip Rate = 1.0 slip/second at medium tension
Surface Condition Multiplier = 1.0 to 4.0 (table above)
Tension Modifier = f(tension level)
  - Low tension (0-30%): 0.5x
  - Medium tension (31-60%): 1.0x
  - High tension (61-80%): 2.0x
  - Danger tension (81-100%): 4.0x
```

**Example Scenarios:**

**Best Case:**

- Clean metal (1.0x)
- Low tension play (0.5x)
- **Effective slip rate: 0.5 slip/second**
- Time to reach limit of 80: 160 seconds (more than enough)

**Worst Case:**

- Heavy sludge (4.0x)
- Danger tension (4.0x)
- **Effective slip rate: 16 slip/second**
- Time to reach limit of 40: 2.5 seconds (almost instant failure)

## Slip Accumulation Across Phases

**Phase 1: Horizontal Drag**

- Slip accumulates but meter is HIDDEN
- Player cannot see slip value
- Influenced by:
  - Tension level (low/med/high)
  - Surface condition (determined at cast, fixed)
  - Drag duration (longer drag = more accumulation)
  - Snag events (high tension spikes during snag = slip burst)
  - Current surge events (forced high tension = slip spike)

**Phase 2a: Blind Lift**

- Slip continues accumulating, still HIDDEN
- Influenced by:
  - Tap frequency (slow/steady/fast)
  - Weight resistance (heavy items require higher frequency)
  - Lift duration (deeper items = more time = more slip)

**Phase 2b: Revealed Lift**

- Slip meter becomes VISIBLE at surface break
- Shows current accumulated slip vs inferred limit
- Player can now react to slip in real-time
- Influenced by same factors as blind lift, but player has agency to adjust

**Cumulative Nature:**

```
Total Slip at Surface Break = Drag Slip + Blind Lift Slip

Example:
Drag Phase (30s, medium tension, rusty surface 1.5x):
  Slip accumulated: 45

Blind Lift (20s, steady tapping 1.5 taps/s, same surface):
  Slip accumulated: 30

Total at Surface Break: 75
Slip Limit (edge grip): 80
Remaining Margin: 5 (VERY dangerous!)
```

**Strategic Implication:**

- Player choices during drag directly affect lift success odds
- High-tension drag = risky lift (slip already near limit)
- Low-tension drag = safe lift (slip has room to grow)
- Skilled players "bank" slip budget during drag for lift phase

## Slip Meter Visualization (Phase 2b Only)

**Core Design Philosophy: Hidden Limit Creates Tension**

**What Player SEES:**

- Current slip value accumulating (e.g., meter shows "45")
- Magnet position indicator via UI bar/icon (center/edge/corner)
- Surface condition on item sprite (clean/rusty/sludge)
- Slip rate of increase (how fast the number climbs)

**What Player DOES NOT SEE:**

- Slip limit value (NOT shown as "45/90" - only "45")
- Exact margin remaining (must infer from visual clues)
- Numeric threshold for failure (hidden until failure occurs)

**UI Design:**

**Slip Meter Bar:**

- Horizontal bar that fills as slip accumulates
- Fill color shifts: Green (low) → Yellow (medium) → Red (high)
- Current slip value shown numerically: "45" (NOT "45/90")
- No limit indicator, no max value displayed
- Bar length is fixed (always full width), filling represents unknown percentage

**Magnet Position Indicator (MVP: Bar/Icon Only):**

- Separate UI element (not shown on item sprite)
- Visual: Horizontal bar with magnet icon positioned along it
  - Left side = Edge grip (poor, low limit)
  - Center = Centered grip (good, high limit)
  - Right side = Corner grip (very poor, very low limit)
- Color-coded: Green (center) → Yellow (off-center) → Red (edge/corner)
- No numeric values, purely visual indication

**Player Inference Process:**

1. See magnet position indicator shows edge grip (red zone)
2. Infer: "Edge grip probably means limit around 40-60"
3. See current slip: "45"
4. Think: "I might be close to limit, better tap slowly!"
5. Watch slip meter climb during tapping
6. Make real-time decision based on rate + inference

**Warning States (Based on Slip Behavior, NOT Known Limit):**

| Slip Value Range | Visual Feedback        | Audio Cue                 | Gameplay Effect                     |
| ---------------- | ---------------------- | ------------------------- | ----------------------------------- |
| 0-30             | Green bar, calm        | None                      | No warnings                         |
| 31-50            | Yellow bar, slow pulse | Low tension hum (Tone.js) | Magnet wobbles slightly             |
| 51-70            | Orange bar, pulse      | Rising pitch tone         | Magnet wobbles more                 |
| 71-90            | Red bar, fast pulse    | Rising pitch alarm        | Magnet wobbles heavily, item shakes |
| 91+              | Red bar, flashing      | Urgent beeping            | Visual "about to slip" animation    |
| Limit Reached    | Bar full, flash white  | Loud pop/clunk            | Magnet detaches, item falls         |

**Note:** These ranges are illustrative - player doesn't know if "71" means danger (limit is 75) or safe (limit is 100). Uncertainty is intentional!

**Expert Player Skill Development:**

- Beginners: Blind guessing, often fail
- Intermediate: Learn to read position indicator, estimate conservatively
- Advanced: Recognize patterns ("Edge grip on sludge item = ~50 limit")
- Expert: Push boundaries precisely, maximize slip budget usage

## Slip Recovery & Mitigation

**No Direct Slip Reduction:**

- Once slip accumulates, it CANNOT decrease
- No "rest" mechanic that resets slip
- Only mitigation: slow the rate of increase

**Mitigation Strategies:**

**During Drag:**

1. Maintain low-medium tension (avoid high/danger zones)
2. Pulse tension (hold → release → hold) instead of constant hold
3. Pre-emptively ease off before snag zones (if known)
4. Accept slower drag time for slip safety

**During Lift:**

1. Tap steadily, not frantically (resist panic urge)
2. Reduce tap frequency when yellow/red warnings appear
3. For heavy items: find minimum tap rate to maintain rise (don't overtap)
4. Use retry mechanic if slip-off occurs (50% slip reset on retry)

**Equipment Upgrades (Future):**

Potential slip mitigation via gear:

- **Stronger magnets:** Don't reduce slip rate, but increase pull force (indirect help)
- **Textured magnet surfaces:** Reduce slip rate by 0.8x multiplier (future upgrade)
- **Electromagnets:** Active grip, can "pulse" to reset slip partially (advanced upgrade)
- **Synthetic line coating:** Reduces friction = slower slip build during drag (late-game)

## Slip Events & Special Cases

**Slip-Inducing Events:**

| Event           | Slip Impact           | Phase | Avoidable?              |
| --------------- | --------------------- | ----- | ----------------------- |
| Current Surge   | +20-30 instant slip   | Drag  | No (random)             |
| Debris Snag     | +10-15 per failed tug | Drag  | Partially (skill check) |
| Item Rotation   | +15-25 instant slip   | Lift  | No (random)             |
| Frantic Tapping | +5 slip/second extra  | Lift  | Yes (player control)    |

**Container Special Case:**

- Containers start heavy with water
- Drainage at surface reduces weight by 30%
- Weight reduction = less required tap frequency = lower slip rate
- Effectively a slip mitigation reward for getting container to surface

**Fragile Item Special Case:**

- Some items have "structural integrity" separate from slip
- Excessive force can break item even if slip is low
- Frantic tapping triggers structural check (RNG)
- If break occurs: item splits, partial value secured, slip becomes irrelevant

## Slip Failure States

**Soft Failure: Magnet Pop-Off**

- Slip reaches 100% of limit
- Magnet detaches cleanly
- Item falls back to water
- Retry available (item floats/sinks slowly)
- Slip resets to 50% for retry attempt
- Line and magnet intact (no equipment loss)

**Hard Failure: Line Snap**

- Only occurs during tug mini-game when hitting red zone (NOT during normal drag)
- 30% chance when red zone hit in tug mini-game
- Separate from 100% tension instant rip-off (which is a soft fail)
- Line breaks, magnet + item lost
- Must buy replacement line segment
- Session can continue with remaining line length (if any)
- Rare but punishing - rewards careful play during snag events

**Degradation Failure:**

- Occurs on 3rd or 4th retry attempt (RNG)
- Item has degraded from repeated drops
- Container cracked, contents partially lost
- Fragile item broken, reduced value
- Still securable but diminished reward

## Open Questions

- **Q13:** Should there be a "slip forgiveness" mechanic for new players (e.g., first 5 retrieves have +20% slip limit bonus)?
- **Q14:** How much should slip reset on retry? Currently 50% - too forgiving or too punishing?
- **Q15:** Should certain items have "slip resistance" property independent of surface condition (e.g., ribbed surfaces grip magnet better)?
