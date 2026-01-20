# Slip System (Comprehensive)

**Overview:**
Slip is the core risk mechanic where the magnet slides across the item's surface and can eventually fall off, resulting in failed retrieval. Unlike an abstract "slip value," slip is **positional** - the magnet occupies a specific location on the item's surface and moves toward the edge over time. Failure occurs when the magnet fully slides off the edge.

## Core Concept: Positional Slip Model

**MVP: 1D Linear Model**

Items have a normalized surface width of **100 units**. The magnet:

- Lands at a random position (0-100) when cast
- Has a contact width (10 units for basic magnet)
- Slides toward the nearest edge over time
- Falls off when completely past the edge (position ≤ 0 or ≥ 100)

**Phase 2+: 2D Planar Model**

Items have circular or rectangular surface area. The magnet:

- Lands at random 2D coordinates (x, y from center)
- Drifts radially outward from center
- Events can push it in any direction (not just outward)
- Falls off when center point exceeds surface radius

_This document focuses on MVP 1D model unless otherwise noted._

## Initial Placement (Cast Phase)

**When Magnet Lands on Item:**

RNG determines where magnet makes contact on the item's 100-unit surface:

```javascript
magnetStartPosition = random(0, 100);
magnetContactWidth = 10; // basic magnet (future: 8-15 based on equipment)

// Calculate distance to nearest edge
distanceToLeftEdge = magnetStartPosition;
distanceToRightEdge = 100 - magnetStartPosition;
distanceToNearestEdge = min(distanceToLeftEdge, distanceToRightEdge);
```

**Placement Quality Determination:**

| Distance to Edge | Quality        | Probability | Safe Margin                         | Example Position     |
| ---------------- | -------------- | ----------- | ----------------------------------- | -------------------- |
| 40+ units        | Perfect Center | 20%         | 85-100 units travel before slip-off | Position 50 (center) |
| 25-39 units      | Good Center    | 30%         | 65-84 units travel                  | Position 65 or 35    |
| 15-24 units      | Edge Grip      | 35%         | 40-64 units travel                  | Position 18 or 82    |
| 0-14 units       | Corner Grip    | 15%         | 20-39 units travel                  | Position 5 or 95     |

**Example Placements:**

- **Position 50** (Perfect Center): Distance to edge = 50 units. Can slip 50 units in either direction before falling off.
- **Position 18** (Edge Grip): Distance to left edge = 18 units. Will slip left and has only 18 units before failure.
- **Position 92** (Corner Grip): Distance to right edge = 8 units. Extremely precarious, very close to slip-off.

**Hidden Until Surface Break:**

- Player doesn't know where magnet landed during underwater drag phase
- Position only revealed when item breaks surface (Phase 2b)
- Slip movement occurs continuously but invisibly during Phase 1 and 2a

## Slip Movement Mechanics

## Slip Movement Mechanics

**Slip Direction (1D MVP):**

Magnet always slides toward the **nearest edge**:

```javascript
// Determine which edge is closer
if (distanceToLeftEdge < distanceToRightEdge) {
  slipDirection = -1; // sliding left toward edge 0
} else {
  slipDirection = 1; // sliding right toward edge 100
}
```

**Slip Rate (Units Per Second):**

How fast the magnet's position changes over time:

```javascript
slipRate = baseSlipRate × surfaceConditionMultiplier × tensionModifier

baseSlipRate = 1.0 units/second (at medium tension, clean surface)
surfaceConditionMultiplier = 1.0 to 4.0 (see table below)
tensionModifier = varies by tension level (see table below)
```

**Surface Condition Multipliers:**

| Surface Condition       | Slip Rate Multiplier | Visual Appearance           | Common Item Types                |
| ----------------------- | -------------------- | --------------------------- | -------------------------------- |
| Clean Metal             | 1.0x (baseline)      | Shiny, metallic gleam       | New tools, modern items          |
| Light Rust/Oxidation    | 1.5x                 | Mottled orange-brown        | Old tools, vintage items         |
| Heavy Rust              | 2.5x                 | Rough, flaky texture        | Corroded items, long-submerged   |
| Organic Coating (Algae) | 3.0x                 | Green/brown slimy layer     | Items in still/shallow water     |
| Heavy Sludge/Mud        | 4.0x                 | Thick mud coating, dripping | Industrial sites, polluted water |

**Tension Modifiers:**

| Tension Level    | Tension Modifier | Player Behavior              |
| ---------------- | ---------------- | ---------------------------- |
| Low (0-30%)      | 0.5x             | Gentle drag, minimal tapping |
| Medium (31-60%)  | 1.0x             | Steady hold, regular tapping |
| High (61-80%)    | 2.0x             | Strong hold, fast tapping    |
| Danger (81-100%) | 4.0x             | Maxed out, frantic tapping   |

**Position Update (Each Frame):**

```javascript
// Calculate movement this frame
slipDistanceThisFrame = slipRate × deltaTime

// Update position
currentPosition += (slipDirection × slipDistanceThisFrame)

// Check for failure
magnetLeftEdge = currentPosition - (magnetContactWidth / 2)
magnetRightEdge = currentPosition + (magnetContactWidth / 2)

if (magnetLeftEdge <= 0 || magnetRightEdge >= 100) {
  magnetDetach()  // magnet has slipped off completely
}
```

**Example Slip Scenarios:**

**Best Case (Safe Drag):**

```
Initial: Position 50 (center), magnet width 10 (edges at 45-55)
Surface: Clean metal (1.0x)
Tension: Low (0.5x)
Effective slip rate: 1.0 × 1.0 × 0.5 = 0.5 units/second
Direction: Right (toward edge 100)

After 30 seconds of drag:
Position: 50 + (0.5 × 30) = 65
Distance to right edge: 35 units
Status: Very safe, plenty of margin
```

**Worst Case (Crisis Drag):**

```
Initial: Position 18 (edge grip), magnet width 10 (edges at 13-23)
Surface: Heavy sludge (4.0x)
Tension: Danger level (4.0x)
Effective slip rate: 1.0 × 4.0 × 4.0 = 16 units/second
Direction: Left (toward edge 0)

After 1 second of high tension:
Position: 18 - (16 × 1) = 2
Magnet left edge: 2 - 5 = -3 (PAST EDGE 0)
Status: MAGNET DETACHED - slip-off failure!
```

**Moderate Case (Typical Play):**

```
Initial: Position 35 (good center), magnet width 10 (edges at 30-40)
Surface: Light rust (1.5x)
Tension: Medium (1.0x)
Effective slip rate: 1.0 × 1.5 × 1.0 = 1.5 units/second
Direction: Left (toward edge 0, closer than edge 100)

After 20 seconds of drag:
Position: 35 - (1.5 × 20) = 5
Distance to left edge: 5 units
Status: Dangerous! Approaching edge, needs careful tapping in lift phase
```

## Slip Across Game Phases

**Phase 1: Horizontal Drag (Hidden)**

- Magnet position updates continuously based on slip rate
- Player CANNOT see position or movement
- Position changes based on:
  - Tension level (higher tension = faster slip)
  - Surface condition (determined at cast, fixed throughout)
  - Drag duration (longer drag = more position change)
  - Snag events (temporary high tension = burst of slip movement)
  - Current surge events (forced high tension = slip spike)

**Example Hidden Drag:**

```
Start: Position 60, slipping right toward edge 100
Surface: Rusty (1.5x), Tension: Medium (1.0x)
Slip rate: 1.5 units/second
After 10 seconds: Position 75 (moved 15 units right)

Snag event triggers at 10s mark:
  - Tension spikes to High (2.0x) for 3 seconds
  - Slip rate during snag: 1.5 × 2.0 = 3.0 units/second
  - Position after snag: 75 + (3.0 × 3) = 84

Resume normal drag for 5 more seconds:
  - Position: 84 + (1.5 × 5) = 91.5

Surface break reveals: Magnet at 91.5, only 8.5 units from edge!
Player sees danger and must react carefully.
```

**Phase 2a: Blind Lift (Hidden)**

- Slip continues based on tap frequency and weight
- Still HIDDEN from player
- Position changes based on:
  - Tap frequency (faster = higher tension = faster slip)
  - Item weight (heavier items require more frequent taps)
  - Lift duration (deeper items = more time underwater = more slip)

**Phase 2b: Revealed Lift (Visible)**

- **Position becomes VISIBLE** when item breaks surface
- Player sees magnet position widget showing:
  - Current position on 100-unit surface
  - Magnet width (contact area)
  - Slip direction (arrow pointing toward edge)
  - Distance to edge (visual, not necessarily numeric)
- Player can now react in real-time by adjusting tap frequency
- Slip continues accumulating based on player input

**Cumulative Positional Slip:**

Total position change = drag slip movement + blind lift movement + revealed lift movement

**Example Full Retrieval:**

```
Cast: Magnet lands at position 45 (good center)
  Distance to left edge: 45 units

Horizontal Drag (30s):
  Surface: Rusty (1.5x), Tension: Medium (1.0x)
  Slip rate: 1.5 units/second
  Direction: Left (toward edge 0)
  Position after drag: 45 - (1.5 × 30) = 0 units (moved 45 units left)

Blind Lift (15s):
  Same surface, steady tapping (1.0x tension)
  Slip rate: 1.5 units/second
  Position after blind lift: 0 - (1.5 × 15) = -22.5

Wait... position is NEGATIVE! Magnet left edge at -22.5 - 5 = -27.5
MAGNET DETACHED during blind lift - player never saw it coming!
```

This example shows why managing tension during drag is critical - poor drag performance dooms the lift.

## Position Widget Visualization (Phase 2b Only)

**Core Design Philosophy: Visual Inference Over Numeric Display**

When item breaks surface, player sees the **Magnet Position Widget** revealing the magnet's location on the item surface.

**Visual Elements (MVP - 1D Linear Model):**

```
┌────────────────────────────────────────────┐
│         Magnet Position Widget             │
├────────────────────────────────────────────┤
│                                            │
│  [RED]──[YELLOW]─────[GREEN]─────[YELLOW]──[RED]
│   0    15    25       50        75   85  100
│                                            │
│                   [████]                   │  ← Magnet (width 10)
│               ────●────                    │  ← Position marker
│                   ↑                        │
│                                            │
│          Position: 62                      │  ← Optional numeric display
│          Slipping: RIGHT →                 │  ← Direction indicator
│                                            │
└────────────────────────────────────────────┘
```

**Color Zones (Danger Indication):**

| Zone Color | Distance from Edge | Meaning                              |
| ---------- | ------------------ | ------------------------------------ |
| **Green**  | 40+ units          | Safe zone - plenty of margin         |
| **Yellow** | 15-39 units        | Caution zone - moderate risk         |
| **Red**    | 0-14 units         | Danger zone - very close to slip-off |

**What Player SEES:**

- **Item surface as horizontal line** (100 units wide, normalized)
- **Magnet as rectangle** positioned on the line (width = contact width, typically 10 units)
- **Current position marker** showing magnet center point
- **Slip direction arrow** (← or →) indicating which edge it's sliding toward
- **Color zones** showing danger levels (green center, yellow mid, red edges)
- **Optional: Numeric position** (e.g., "Position: 62") - can be toggled in settings

**What Player DOES NOT SEE:**

- Explicit "distance to edge" value
- "Slip limit" or "maximum safe slip"
- Percentage remaining before failure
- Numeric countdown to slip-off

**Player Inference Process:**

```
1. See magnet at position 18 (visual + optional number)
2. See magnet in RED zone (left side)
3. See slip direction: ← (moving left toward edge 0)
4. See magnet width: 10 units (edges at 13-23)
5. Infer: "Magnet left edge is at 13, only 13 units from edge 0"
6. See surface condition: Heavy sludge (visible on item sprite)
7. Infer: "Slip rate will be fast with sludge"
8. Decision: "Very dangerous! 2-3 seconds max before slip-off. Drop or tap VERY slowly?"
```

**Visual Feedback During Lift:**

| Magnet Position     | Animation                          | Audio Cue                 |
| ------------------- | ---------------------------------- | ------------------------- |
| Green zone (center) | Calm, steady                       | None                      |
| Yellow zone (mid)   | Slight wobble                      | Low tension hum (Tone.js) |
| Red zone (edge)     | Heavy wobble, item shaking         | Rising pitch alarm        |
| 5 units from edge   | Magnet visibly tilting toward edge | Urgent beeping            |
| Slip-off imminent   | Flash warning border               | Loud escalating tone      |
| Failure             | Magnet slides off edge animation   | Loud clunk/pop            |

**Widget Design Options:**

**Option A: Integrated (Overlay on Item Sprite)**

- Position bar overlaid directly on item sprite
- Magnet shown in actual relative position on item surface
- More immersive, less UI clutter
- Risk: Hard to see on complex/dark item sprites

**Option B: Separate Widget (UI Panel)**

- Dedicated widget in corner/side of screen
- Schematic representation (simplified line + magnet rectangle)
- Easier to read, consistent across all items
- Less immersive but clearer information

**MVP Recommendation: Option B** (separate widget) - clearer, easier to implement, consistent readability

## Event Effects on Slip Position

Events during drag and lift can dramatically change magnet position through directional slip changes.

**Event Slip Effects (1D MVP):**

| Event                      | Slip Direction Change           | Rate Multiplier | Duration | Example Effect                       |
| -------------------------- | ------------------------------- | --------------- | -------- | ------------------------------------ |
| **Current Surge**          | Reverse (toward opposite edge)  | 2.0x            | 3-5s     | Slipping right → surges left         |
| **Fish Attack**            | Random (50% same, 50% opposite) | 3.0x            | 1s       | Quick burst, unpredictable direction |
| **Item Rotation**          | Instant shift ±10-25 units      | 1.0x            | Instant  | Position teleports randomly          |
| **Bird Pecks** (lift only) | Random direction                | 5.0x            | 0.5s     | Very fast, short burst               |
| **Debris Scrape**          | Continue current direction      | 1.5x            | 2s       | Accelerates existing slip            |

**Current Surge Example:**

```
Before surge:
  Position: 85 (near right edge 100)
  Slipping: Right at 2 units/second
  Distance to edge: 15 units (RED ZONE - very dangerous!)

Current surge triggers:
  Duration: 4 seconds
  Direction: REVERSE (now slipping LEFT, away from danger!)
  Rate: 2.0x multiplier → 4 units/second left
  Position after surge: 85 - (4 × 4) = 69

After surge:
  Back to normal: Slipping right at 2 units/second
  Distance to right edge: 31 units (YELLOW ZONE - safer!)
  Player saved by surge reversing dangerous slip!
```

**Fish Attack Example:**

```
Before attack:
  Position: 40
  Slipping: Left at 1.5 units/second

Fish attack triggers:
  Duration: 1 second
  Direction: RANDOM (50/50 same or opposite)
  Rate: 3.0x → 4.5 units/second

Outcome A (50% chance - same direction):
  Position: 40 - 4.5 = 35.5 (moved left, slightly more dangerous)

Outcome B (50% chance - opposite direction):
  Position: 40 + 4.5 = 44.5 (moved right, slightly safer)

Short duration means small position change, but adds chaos!
```

**Item Rotation Example:**

```
Before rotation:
  Position: 50 (center, safe)
  Slipping: Right at 2 units/second

Item rotation event (instant):
  Effect: Item spins, magnet stays fixed in space, so RELATIVE position changes
  Shift amount: random(-25, +25) → rolled -18
  New position: 50 - 18 = 32
  New slip direction: Still right (but now from different position)

Player sees: Sudden jump in position! No time to react, instant change.
```

**Strategic Implications:**

- **Current surges can save you** if slipping toward edge (reverses to safety)
- **Current surges can doom you** if in safe zone slipping away from edge (reverses toward edge)
- **Fish attacks are chaotic** - small position change but unpredictable
- **Item rotations are shocking** - can instantly move from safe to danger zone
- **Debris scrapes are punishing** - accelerate existing slip (no direction change)

## Slip Recovery & Mitigation

**No Direct Position Reset:**

- Magnet position NEVER resets to center
- Once slip movement occurs, it cannot be undone
- No "rest" mechanic that moves magnet back toward center
- Only mitigation: slow the rate of continued slip

**Mitigation Strategies:**

**During Drag (Phase 1):**

1. **Maintain low-medium tension** (0.5x-1.0x modifier vs 2.0x-4.0x high tension)
2. **Pulse tension** (hold → release → hold) instead of constant high tension
3. **Pre-emptively ease off before known snag zones** (reduces slip bursts)
4. **Accept slower drag time** for position safety

**During Lift (Phase 2b):**

1. **Tap steadily, not frantically** (resist panic despite visible danger)
2. **Reduce tap frequency** when position enters yellow/red zones
3. **Find minimum tap rate** to maintain rise (don't overtap heavy items)
4. **Monitor slip direction** - if reversing toward center zone, tap aggressively to maximize that window
5. **Use retry mechanic** if slip-off occurs (position resets to midpoint on retry)

**Equipment Upgrades (Slip Resistance):**

Future equipment affects slip through multiple properties:

| Upgrade                      | Effect on Slip             | Mechanism                                              |
| ---------------------------- | -------------------------- | ------------------------------------------------------ |
| **Textured Magnet Surface**  | 0.8x slip rate             | Better friction, slower slide                          |
| **Wider Contact Magnet**     | +5 contact width           | More forgiveness (wider magnet = slips off later)      |
| **Electromagnet (Phase 2+)** | Active nudge               | Can shift position 5-10 units toward center (cooldown) |
| **Synthetic Line Coating**   | 0.9x slip rate during drag | Reduced friction in water                              |

**Contact Width Impact on Forgiveness:**

| Magnet Type   | Contact Width | Edge Position Tolerance                 |
| ------------- | ------------- | --------------------------------------- |
| Basic Disc    | 10 units      | Position must be ≥5 from edge           |
| Horseshoe     | 14 units      | Position can be as low as 7 from edge   |
| Electromagnet | 15 units      | Position can be as low as 7.5 from edge |

Example: Basic magnet at position 3 (width 10, edges at -2 to 8) = SLIP-OFF. Electromagnet at position 3 (width 15, edges at -4.5 to 11.5) = still some overlap with surface, SAFE!

## Slip Failure States

**Soft Failure: Magnet Slip-Off**

Occurs when magnet position fully exits surface boundaries:

```javascript
if (magnetLeftEdge <= 0 || magnetRightEdge >= 100) {
  // Magnet has slipped off completely
  triggerSlipOffFailure();
}
```

**Failure Sequence:**

1. Magnet slides past edge (position ≤ 0 or ≥ 100 with contact width factored)
2. Magnet detaches cleanly from item
3. Item falls back to water (splash animation)
4. **Retry opportunity available**:
   - Item floats/sinks slowly (5-10 second window)
   - Can recast immediately to re-attempt
   - On retry: Magnet position resets to **center (position 50)**
   - Surface condition unchanged (still rusty/sludge if it was before)
   - Slip rate same, but fresh starting position
5. Line and magnet intact (no equipment loss)

**Retry Positioning:**

```
Original attempt: Landed at position 18 → slipped off left edge
Retry attempt: Starts at position 50 (center reset)
  - Much better starting position
  - Distance to edge: 50 units (vs 18 original)
  - Same surface condition penalty applies
  - Can still slip off if player repeats poor tension management
```

**Hard Failure: Line Snap**

Only occurs during **tug mini-game** when hitting red zone:

- NOT related to slip position
- Separate failure mechanic during snag events
- 30% chance when red zone hit during tug
- Line breaks, magnet + item lost
- Must buy replacement line segment
- Session can continue with remaining line length

**Degradation Failure (Multiple Retries):**

If player retries same item 3-4 times:

- Item has degraded from repeated drops
- Container cracked → contents partially lost
- Fragile item broken → reduced value
- Still securable but diminished reward
- Position still resets to center each retry

## Special Cases & Interactions

**Container Water Drainage:**

Containers start heavy, drain at surface:

- **Before drainage**: Heavy weight requires high tap frequency → high tension → fast slip
- **After drainage** (30% weight reduction): Lower tap frequency needed → lower tension → slower slip
- Effectively a slip mitigation reward for getting container to surface

**Example:**

```
Container at 90kg, position 25 (yellow zone)
Before drainage:
  Required tap rate: 3 taps/second → tension 70% → slip rate 3.5 units/s
  Time to slip 25 units to edge: 7 seconds

After drainage (now 63kg):
  Required tap rate: 2 taps/second → tension 45% → slip rate 2.0 units/s
  Time to slip 25 units: 12.5 seconds

Drainage bought player ~5 extra seconds!
```

**Fragile Item Structural Integrity:**

- Some items have "structural integrity" separate from slip position
- Excessive force can break item even if position is safe (center zone)
- Frantic tapping triggers structural check (RNG)
- If break occurs: Item splits, partial value secured, slip becomes irrelevant

**Heavy Items with Poor Placement:**

Worst-case combination:

- Heavy item (requires high tap frequency)
- Poor initial placement (position 12, edge grip)
- Sludge surface (4.0x multiplier)
- Result: Almost impossible to lift without slip-off
- Strategic decision: Drop immediately, try different quadrant

## Expert Player Skill Development

**Skill Progression:**

| Skill Level      | Understanding                                        | Behavior                                             |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Beginner**     | Doesn't understand position system                   | Taps frantically, frequent slip-offs                 |
| **Intermediate** | Reads position widget, plays conservatively          | Slows down in red zone, sometimes drops preemptively |
| **Advanced**     | Estimates safe slip margins, knows surface modifiers | Pushes yellow zone boundaries, rarely drops          |
| **Expert**       | Precise margin calculation, event prediction         | Maximizes risk/reward, uses full position budget     |

**Expert Tactics:**

- **Edge riding**: Deliberately entering red zone briefly to lift heavy items faster, then easing off
- **Event timing**: Anticipating current surge to reverse dangerous slip, tap aggressively during helpful events
- **Surface reading**: Instantly recognizing sludge coating and adjusting tap frequency preemptively
- **Retry calculation**: Knowing when retry (center reset) is better than struggling with edge position

---

## Phase 2+ Features: 2D Planar Slip Model

_Future enhancement for more complex slip interactions. Not in MVP._

**2D Surface Model:**

Items have circular or rectangular surface area instead of linear:

```javascript
itemSurface: {
  shape: "circle",  // or "square" for rectangular items
  radius: 50,       // diameter 100 (normalized)
  center: { x: 0, y: 0 }
}

magnetPosition: {
  x: random(-50, 50),
  y: random(-50, 50)
}

magnetContactRadius: 5  // basic magnet (vs width 10 in 1D)
```

**Distance to Edge Calculation (2D):**

```javascript
// For circular item surface
distanceFromCenter = sqrt(x² + y²)
distanceToEdge = itemRadius - distanceFromCenter

// Magnet overlap check
magnetEdgeDistance = distanceToEdge - magnetRadius

if (magnetEdgeDistance <= 0) {
  magnetDetach()  // magnet has slipped off completely
}
```

**2D Slip Movement:**

Slip moves radially outward from center (or in event-defined directions):

```javascript
// Normal slip: radially outward
slipVector = normalize(magnetPosition - centerPoint)
slipRate = baseSlipRate × surfaceCondition × tensionModifier

// Update position each frame
magnetPosition.x += slipVector.x × slipRate × deltaTime
magnetPosition.y += slipVector.y × slipRate × deltaTime
```

**Event Effects (2D):**

| Event         | Direction (2D)                        | Rate Mult. | Duration |
| ------------- | ------------------------------------- | ---------- | -------- |
| Current Surge | Toward center (helpful!)              | 2.0x       | 3-5s     |
| Fish Attack   | Random angle 0-360°                   | 3.0x       | 1s       |
| Item Rotation | Rotate position ±30-90° around center | 1.0x       | Instant  |
| Bird Pecks    | Random angle                          | 5.0x       | 0.5s     |

**Current Surge (2D) Example:**

```
Before surge:
  Position: (40, 20) from center (0,0)
  Distance from center: sqrt(40² + 20²) = 44.7 units
  Distance to edge (radius 50): 5.3 units (DANGER!)
  Slipping: Radially outward toward edge

Current surge triggers:
  Direction: Toward center (angle points at 0,0)
  Rate: 2.0x
  Duration: 4 seconds
  Movement: 15 units toward center
  New position: (23, 11.5)
  New distance from center: 25.7 units
  Distance to edge: 24.3 units (SAFE!)

Player saved by surge pushing magnet toward center!
```

**Visual Widget (2D):**

Radar-style circular widget:

```
┌─────────────────────┐
│   Magnet Position   │
│                     │
│     ╱───────╲       │
│    │    ●    │      │  ← Magnet (circle)
│    │  ↗      │      │  ← Slip direction arrow
│     ╲───────╱       │
│                     │
│  Distance: 35 units │
└─────────────────────┘

Color zones (concentric circles):
- Green center: 0-15 units from center (safe)
- Yellow ring: 15-40 units (moderate)
- Red outer ring: 40-50 units (danger)
- Black beyond: Slip-off zone (>50)
```

**Electromagnet Active Control (2D):**

Phase 2+ electromagnet can nudge magnet position:

- **Cooldown**: 5 seconds
- **Effect**: Moves position 5-10 units toward center
- **Cost**: +15% tension
- **Strategic use**: Emergency correction when approaching edge
- **Player skill**: Timing nudges to counter fish attacks or maximize safe positioning

---

## Open Questions

- **Q13:** Should magnet contact width be shown explicitly ("Contact Width: 10 units") or just implied through forgiveness?
  - _Recommendation: Show in equipment stats, player learns meaning through play_
- **Q14:** Should position indicator use numbers ("Position: 62") or purely visual (bar)?
  - _Recommendation: Visual only for clean UI, numbers in accessibility settings_
- **Q15:** Should there be color-coded "safe zones" in widget, or leave for player to learn?
  - _Recommendation: Yes, green/yellow/red zones help new players without handholding_
- **Q16:** Electromagnet nudge toward center - automatic (passive) or active (player button)?
  - _Recommendation: Active ability with cooldown - more engaging, skill expression_
- **Q17:** Should item rotation events show before/after position briefly?
  - _Recommendation: Brief flash showing old position fading + new appearing (helps understanding)_
- **Q18:** Do direction-changing events (current surge reverse, fish random) feel unfair or exciting?
  - _Recommendation: Playtest extensively. Current surge helpful (toward center/opposite edge) feels good. Fish attack short duration feels fair. Rotation instant shock needs telegraphing._
- **Q19:** Should retry position reset to exact center (50) or random good center (40-60)?
  - _Recommendation: Exact center (50) - predictable, feels like a clean restart, slightly too easy encourages drops_
- **Q20:** For 1D MVP, should slip rate change be smoothed (easing) or instant when tension changes?
  - _Recommendation: Instant - simpler physics, clearer cause-effect for player learning_
