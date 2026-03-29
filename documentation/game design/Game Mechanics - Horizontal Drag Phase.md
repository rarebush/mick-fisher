# Horizontal Drag Phase (Pulling Toward Shore)

**Overview:**
Player pulls item horizontally through water toward shore/bank. Tension controls drag speed and slip accumulation rate. This phase focuses on balancing speed (high tension) against risk (slip build-up and instant rip-off at max tension).

**Fishing Variant (Fight Phase):**
For rod fishing, this phase becomes a **fight** rather than a steady drag. The fish alternates between **running bursts away from the player** and **rest windows** where the player can reel in. When the fish runs, tension should spike quickly based on fish strength, panic, and stamina. During rest windows, fish continue to swim but with reduced force output (they do **not** intentionally drift toward the player).

**Rhythm Goal:** Strike → fish runs away (tension spikes) → rest window (player reels) → fish runs away again → repeat until capture.

## Hooked Fish Behavior Model (Current)

- Fish AI outputs a swim force vector only (direction + magnitude); drag physics resolves line tension, payout, and movement outcomes.
- Fish avoid swimming into the wall at `world y = 0` by biasing direction away from the wall when close.
- Fish have a slight bias to swim away from the player whenever line tension is above zero.
- Hooked fish use two phases:
  - **Run:** standard force multiplier, higher directional volatility.
  - **Rest:** reduced force multiplier, lower directional volatility, less frequent meaningful turns.
- Fish have a panic meter:
  - Panic rises faster above panic threshold.
  - Higher panic increases potential force output.
  - Higher panic increases likelihood and significance of direction changes.
- Fish have temperament types that modulate panic, force, and direction behavior:
  - **Relaxed:** less force baseline, slower panic buildup, generally steadier.
  - **Normal:** baseline behavior.
  - **Cautious:** faster panic buildup, more reactive direction behavior.
  - **Aggressive:** higher force baseline and stronger directional reactivity across phases.
- Run/rest timing is weighted by temperament, panic, and energy:
  - More panic tends to shorten rests and sustain fight pressure.
  - Lower energy tends to lengthen rests and reduce sustained run pressure.

---

## Core Interaction: Hold-to-Reel (RPM)

- Hold input builds **RPM** toward a per-equipment cap; release decays RPM
- RPM drives **avatarPullForce** via a power curve (zero at 0 RPM, max at cap)
- **reelDragThreshold** is always present; when holding it stacks with avatarPullForce
- **totalPlayerResistance** is the value the object must beat to pay out line
- Tap-to-jerk has been removed in the force/slack model

**Tension Mechanics:**

- **Tension Value:** Output force on a taut line (not an input)
- **Slack Gate:** If slack > 0, tension is zero and forces do not transmit
- **Break Threshold:** Line snaps if tension exceeds break threshold (scaled by line condition)
- **Hot Zone:** High tension accelerates line condition decay and snap probability
- **Visual Meter:** Unified bar with slack on the left and tension on the right, break marker moves left as line condition degrades

**Tension Consequences:**

_Legacy reference only: percent-based tension tables are superseded by the force/slack model and break-threshold logic._

| Tension Level    | Drag Speed   | Slip Rate | Risk Level          |
| ---------------- | ------------ | --------- | ------------------- |
| 0%               | 0x (stopped) | 0x        | None                |
| 1-30% (Low)      | 0.3x-0.6x    | 0.3x      | Very Safe           |
| 31-50% (Medium)  | 0.6x-1.0x    | 0.7x      | Safe                |
| 51-70% (High)    | 1.0x-1.4x    | 1.5x      | Moderate            |
| 71-85% (Danger)  | 1.4x-1.8x    | 3.0x      | High                |
| 86-99% (Extreme) | 1.8x-2.0x    | 6.0x      | Extreme             |
| 100% (Max)       | N/A          | N/A       | **INSTANT RIP-OFF** |

**Critical Rule: Break Threshold = Instant Failure**

- If tension (including snap-taut impulse) exceeds the current break threshold, the line snaps
- Break threshold scales down as line condition degrades
- Slack prevents tension entirely; no tension means no break risk
- Audio/visual: sharp snap, line whips back
- Item lost, session continues (soft fail)

**Strategic Tension Management:**

- **Low tension (0-30%):** Minimal slip build, very safe but very slow
- **Medium tension (31-50%):** Safe and steady, good for unknown items
- **High tension (51-70%):** Optimal speed, moderate slip risk
- **Danger tension (71-85%):** Fast but risky, high slip accumulation
- **Extreme tension (86-99%):** Expert only, extreme slip risk + near instant rip-off
- **Hold strategy:** Gradual build with diminishing returns, good for controlled play
- **Tap strategy:** Rapid bursts to desired tension, bypasses slow build on light items
- **Pulse strategy:** Hold → release → hold pattern maintains average tension without hitting 100%
- **Tap-hold combo:** Tap to target tension, hold to maintain it

---

## Tension Build Rate Modifiers

**Base build rate: 15%/second at 0% tension** (modified by weight and diminishing returns)

**Physics Model - Weight Creates Resistance:**

When you pull on a heavy object (like an elephant tied to a rope), tension builds FAST because the object resists movement - the force accumulates in the rope before the object gives ground. When you pull on a light object (like a plant pot), tension builds SLOWLY because your force immediately converts to motion - the pot moves before much tension can accumulate.

**Weight Modifiers (Higher Multiplier = Faster Tension Build):**

| Item Weight        | Tension Build Multiplier | Tension Feel                          | 0→50% Time (Hold) |
| ------------------ | ------------------------ | ------------------------------------- | ----------------- |
| Light (0-10kg)     | 0.7x (SLOW BUILD)        | Easy, gentle pull - force → motion    | ~5.5 seconds      |
| Medium (10-30kg)   | 1.0x (NORMAL BUILD)      | Standard resistance                   | ~4.0 seconds      |
| Heavy (30-60kg)    | 1.4x (FAST BUILD)        | Strong resistance - object fights you | ~2.8 seconds      |
| Very Heavy (60kg+) | 2.0x (VERY FAST BUILD)   | Immediate heavy feel - rapid tension  | ~2.0 seconds      |

**Diminishing Returns Curve (Realistic Tension Physics):**

| Current Tension | Diminishing Returns Multiplier | Effective Build Rate (Medium Item) |
| --------------- | ------------------------------ | ---------------------------------- |
| 0-30%           | 1.0x (full rate)               | 15%/second                         |
| 31-60%          | 0.8x (slowing down)            | 12%/second                         |
| 61-85%          | 0.5x (much harder)             | 7.5%/second                        |
| 86-99%          | 0.2x (extremely difficult)     | 3%/second                          |

**Combined Formula:**

```
Tension Build Rate (Hold) = Base Rate (15%/s) × Tension Build Multiplier × Diminishing Returns

Example:
Light item (5kg) at 0% tension: 15%/s × 0.7 × 1.0 = 10.5%/s (SLOW - easy to control)
Heavy item (65kg) at 0% tension: 15%/s × 2.0 × 1.0 = 30%/s (FAST - dangerous!)

Key: Higher multiplier = Faster tension = Heavier feel = More dangerous
```

**Event Modifiers (Applied on top of base formula):**

| Condition             | Build Rate Modifier | Effect                                                                     |
| --------------------- | ------------------- | -------------------------------------------------------------------------- |
| Normal drag           | 1.0x                | Standard calculated rate                                                   |
| **Snagged (stopped)** | **8.0x-10.0x**      | **Extremely rapid (120-150%/s base) - reaches 100% in 0.3-0.8s from snag** |
| Current surge         | 2.0x-3.0x           | Temporary spike (3-5 seconds)                                              |
| Debris drag           | 1.3x                | Slightly faster build                                                      |

**Snag Tension Build Examples (Crisis Math):**

When snagged, tension builds at 8-10x normal rate. Time to reach 100% depends on current tension when snag occurs:

| Starting Tension | Tension Points to 100% | Snag Build Rate | Time to Failure | Player Reaction Window |
| ---------------- | ---------------------- | --------------- | --------------- | ---------------------- |
| 30%              | 70 points              | 120%/s (8x)     | 0.58 seconds    | Must release NOW       |
| 40%              | 60 points              | 120%/s (8x)     | 0.50 seconds    | Immediate crisis       |
| 50%              | 50 points              | 135%/s (9x)     | 0.37 seconds    | Reflex-only window     |
| 60%              | 40 points              | 150%/s (10x)    | 0.27 seconds    | Almost instant fail    |
| 70%              | 30 points              | 150%/s (10x)    | 0.20 seconds    | Instant fail (no time) |
| 85%              | 15 points              | 150%/s (10x)    | 0.10 seconds    | Guaranteed failure     |

**Key Insight:** Higher tension when snagged = less time to react. Maintaining low-medium tension during drag provides safety buffer for snag events.

**Calculation Formula:**

```
Time to 100% = (100 - Current Tension) ÷ Snag Build Rate
Snag Build Rate = Base Rate (15%/s) × Snag Modifier (8-10x) = 120-150%/s
```

**Strategic Implications:**

- Snag at 30-40% tension: Survivable if you release immediately (~0.5s reaction time)
- Snag at 50-60% tension: Reflex test (~0.3s - very difficult)
- Snag at 70%+ tension: Almost guaranteed failure (< 0.2s - faster than human reaction)
- **Best practice:** Keep tension below 50% during drag to survive snag events

**Tap Mechanic (Bypasses All Modifiers):**

- **Fixed +10% tension per tap**
- No weight modifier (always 10%)
- No diminishing returns (works at any tension level)
- Detection: Press-release within 200ms
- Can tap 3-4 times per second (human limit)
- Strategic use: Overcome slow build on light items, precise tension control

**Weight Strategy Summary:**

- **Light items:** Slow tension build from hold (safe but tedious) → Use TAPS to speed up
- **Heavy items:** Fast tension build from hold (dangerous) → Use hold SPARINGLY, release often

---

## Tap-to-Jerk Mechanic (Detailed)

**Deprecated (Feb 2026):** Tap-to-jerk is removed in the force/slack model. Hold-to-reel RPM is the only drag input.

**Input Detection:**

```
Tap = Press down → Release within 200ms

If hold duration > 200ms: Treated as hold (continuous pull)
If hold duration ≤ 200ms: Treated as tap (jerk)
```

**Tap Effect:**

- **Instant tension increase: +10%** (fixed increment)
- No diminishing returns (always +10%, even at high tension)
- No weight modifiers (same effect on all items)
- Can tap repeatedly with no cooldown
- Visual: Tension bar "jumps" up in discrete increment
- Audio: Sharp "tug" sound per tap
- Haptic: Quick pulse on mobile

**Rapid Tapping:**

```
Player can tap 3-4 times per second maximum (human limit)

Example sequence:
Tension at 30%
Tap → 40% (+10%)
Tap → 50% (+10%)
Tap → 60% (+10%)
Tap → 70% (+10%)
(4 taps in 1 second = +40% tension gain)
```

**Tension Decay During Taps:**

- Decay rate: 10%/second (constant)
- Time between taps: ~250-333ms
- Decay during single tap cycle: 0.025-0.033% (negligible)
- Player can tap-tap-tap with minimal tension loss between inputs

**Use Cases:**

**1. Emergency Speed Burst:**

- Item far away, session time running low
- Tap repeatedly to build tension fast (30% → 80% in ~1.5 seconds)
- Accept higher slip risk for time efficiency
- Example: 5 taps in quick succession = +50% tension instantly

**2. Precise Tension Control:**

- Hold to 55%, release
- Tap twice → 75% exactly
- Hold to maintain 75% (no overshoot to 100%)
- Avoids danger zone while maintaining good speed

**3. Light Item Optimization:**

- Light item (5kg wrench): Hold builds slowly (0.7x multiplier = 10.5%/s at 0% tension)
- Hold for 6 seconds → only 45% tension (slow because force converts to motion)
- Tap 3 times → 75% tension instantly (bypasses slow build)
- Now can drag light item at high speed (normally impossible with hold alone)

**4. Snag Recovery:**

- Snagged, tension at 70%, building toward 100%
- Release hold immediately (tension starts decaying)
- Clear snag with tug mini-game (tension frozen during game)
- Snag clears, tension reset to 40%
- Tap 3-5 times → back to 70-90% instantly
- Resume drag at high speed without slow rebuild

**5. Pulse-Tap Hybrid:**

- Hold to 60% (safe zone)
- Release, tap 2 times → 80% (high speed zone)
- Release when approaching snag-prone area
- Decay to 60%, resume holding
- Maintains dynamic control without hitting 100%

**Strategic Insight:**

- **Heavy items:** Hold alone can easily reach 80-90% (2.0x multiplier = fast build from resistance), use sparingly
- **Light items:** Hold alone struggles to reach 70% (0.7x multiplier = slow build, force → motion), tap to compensate
- **Best practice:** Combine both - hold for baseline, tap for bursts
- **Expert play:** Pre-tap before drag starts (build to 60% instantly), then maintain with hold
- **Weight recognition:** If tension jumps quickly when you start holding = heavy item = DANGER

---

## Combined Tension Management Examples

**Example 1: Light Item, Clean Water, Conservative Play**

```
Item: 5kg wrench, clean metal surface
Distance: 10m
Session time remaining: 4 minutes (plenty of time)

Strategy: Hold-only, low tension
- Hold for 6 seconds → Tension reaches 45% (slow light-item build)
- Maintain 40-50% tension throughout drag
- Drag speed: 0.5x base (slow but safe)
- Duration: ~30 seconds
- Slip accumulated: 1.0 (clean) × 0.7 (low tension) × 30s = 21 slip
- Result: SAFE - Low slip, successful drag
```

**Example 2: Light Item, Clean Water, Expert Play with Taps**

```
Item: 5kg wrench, clean metal surface
Distance: 10m
Session time remaining: 45 seconds (time pressure!)

Strategy: Tap-burst, high tension
- Tap 7 times rapidly → Tension at 70% instantly
- Hold to maintain 65-70% tension
- Drag speed: 1.3x base (fast)
- Duration: ~12 seconds
- Slip accumulated: 1.0 (clean) × 1.5 (high tension) × 12s = 18 slip
- Result: SAFE - Fast completion, moderate slip, time saved
```

**Example 3: Heavy Item, Unknown Surface, Risky Play**

```
Item: 65kg safe, sludge-coated (unknown to player)
Distance: 15m
Session time: Not a concern

Strategy: Hold with poor management
- Heavy item (2.0x multiplier): Hold for 3 seconds → Tension at 80% already! (30%/s build rate = fast!)
- Current surge triggers → Tension jumps to 92%! (surge multiplies already-fast build)
- Player doesn't release → tension hits 100%
- Result: INSTANT RIP-OFF - Magnet detaches, item lost
- Lesson: Heavy weight = high resistance = rapid tension = must be careful with hold!
```

**Example 4: Heavy Item, Cautious Recovery**

```
Item: 65kg safe, sludge-coated
Distance: 15m
Same scenario but better response:

Strategy: Release during surge, tap recovery
- Hold for 2.5 seconds → Tension at 70% (recognizes FAST BUILD = heavy item signature!)
- Player thinks: "Whoa, tension building too fast, this is heavy - be careful!"
- Current surge triggers → Tension jumping toward 90%
- Player releases immediately → tension decays
- Waits for surge to end (tension at 60%)
- Taps 2 times → 80% tension
- Maintains 75-80% with pulse-holding (release briefly when approaching 85%)
- Duration: 22 seconds (slower but controlled)
- Slip accumulated: 4.0 (sludge) × 3.0 (high tension) × 22s = 264 slip
- Result: Completes drag, but WILL FAIL during lift (slip already extreme)
- Learning moment: Heavy + sludge + high tension = disaster
```

**Example 5: Medium Item, Snag Event, Tap Recovery**

```
Item: 18kg bicycle, light rust
Distance: 12m, currently at 8m remaining
Tension: 60%, dragging steadily

Event: SNAG DETECTED
- Tension spikes: 60% → 75% → 88% (in 0.8 seconds, 8x build rate)
- Player releases hold → tension decays at 10%/s
- Tug mini-game triggers → player hits green zone
- Snag clears, tension reset to 40%
- Player taps 4 times → 80% tension instantly (no slow rebuild)
- Hold to maintain 75-80%
- Completes remaining 8m at high speed
- Total slip: Moderate (mixed tension levels throughout)
- Result: SUCCESS - Quick recovery, maintained good speed
```

**Key Insights from Examples:**

1. Light items benefit massively from taps (overcome slow hold build)
2. Heavy items dangerous with hold (build too fast, easy to hit 100%)
3. Tap recovery after snags maintains momentum (no slow rebuild penalty)
4. Hidden surface condition (sludge) can doom run even with "safe" tension management
5. Expert players recognize weight signature (fast tension build = go easy on hold)

**Snag Creates Panic:**
When item snags on debris:

1. Forward progress stops immediately
2. Tension builds at 8-10x rate (extremely fast)
3. Player has ~0.5-1 second to:
   - **Release tension** (prevent 100% rip-off), OR
   - **Trigger tug mini-game** (attempt to clear snag)
4. If neither action taken → tension hits 100% → instant rip-off

**This creates:** "Oh shit, snagged! Release NOW or clear it fast!"

---

## Drag Speed & Distance

**Item Movement:**

```
Drag Speed (m/s) = Base Speed × (Tension / 100) × Weight Modifier

Base Speed = 0.8 m/s (light items)
Weight Modifier:
  - Light (0-10kg): 1.0x
  - Medium (10-30kg): 0.7x
  - Heavy (30-60kg): 0.5x
  - Very Heavy (60kg+): 0.3x
```

**Example Calculations:**

**Light item, medium tension (50%):**

- Speed: 0.8 × 0.5 × 1.0 = 0.4 m/s
- 10m distance: 25 seconds

**Heavy item, high tension (80%):**

- Speed: 0.8 × 0.8 × 0.5 = 0.32 m/s
- 15m distance: 47 seconds

**Heavy item, low tension (30%):**

- Speed: 0.8 × 0.3 × 0.5 = 0.12 m/s
- 15m distance: 125 seconds (too slow, forces higher tension)

**Strategic Trade-off:**

- Low tension is TOO slow for heavy items (wastes session time)
- Forces player into risky territory (60-80% tension)
- Heavy items inherently more dangerous (require higher tension = more slip)

---

## Slip Accumulation During Drag

**Critical Rule:** Slip meter is HIDDEN during drag phase - player cannot see value

**Slip Formula:**

```
Slip per Second = Surface Slip Rate × Tension Modifier

Surface Slip Rate (item property):
  - Clean metal: 1.0
  - Light rust: 1.5
  - Heavy rust: 2.5
  - Organic coating: 3.0
  - Heavy sludge: 4.0

Tension Modifier:
  - 0% tension: 0x (no movement = no slip)
  - 1-30% tension: 0.3x
  - 31-50% tension: 0.7x
  - 51-70% tension: 1.5x
  - 71-85% tension: 3.0x
  - 86-99% tension: 6.0x
  - 100% tension: INSTANT RIP-OFF (bypasses slip)
```

**Example Scenarios:**

**Safe play (low tension, clean item):**

- Clean metal (1.0 rate)
- 40% tension (0.7x modifier)
- Drag duration: 30 seconds
- **Slip accumulated: 21** (very safe)

**Risky play (high tension, sludge item):**

- Heavy sludge (4.0 rate)
- 80% tension (3.0x modifier)
- Drag duration: 20 seconds
- **Slip accumulated: 240** (almost certainly exceeds limit, will fail at lift)

**Balanced play (medium tension, rusty item):**

- Light rust (1.5 rate)
- 60% tension (1.5x modifier)
- Drag duration: 25 seconds
- **Slip accumulated: 56** (depends on placement - might be safe or risky)

**Key Insight:**
Player makes tension decisions during drag WITHOUT knowing:

- Magnet placement quality (slip limit unknown until surface break)
- Item surface condition (only revealed at surface break)
- How much slip has accumulated

This creates genuine uncertainty and risk/reward calculation.

---

## Snag Event System

**Trigger Conditions (Distance-Based):**

- **Probability check every 5 meters traveled:** 15% base chance
- NOT time-based - triggered by distance accumulation, not polling interval
- Higher probability in certain locations (industrial = 20% per 5m, pristine river = 10% per 5m)
- Quadrant position affects debris density (center = fewer snags than edges)
- **Tension level determines snag severity** (high tension when snagged = harder to clear)

**Implementation Note:**

```javascript
// Distance accumulator triggers probability checks
let distanceSinceLastCheck = 0;
distanceSinceLastCheck += deltaDistance;

if (distanceSinceLastCheck >= 5) {
  distanceSinceLastCheck -= 5;
  if (Math.random() < 0.15) {
    // 15% per 5m
    triggerSnag();
  }
}
```

**Snag Detection:**

1. Forward progress stops (distance frozen)
2. **Tension spikes rapidly** (8-10x build rate: 120-150%/s)
3. Audio cue: scrape/clunk sound
4. Visual: tension bar flashes red
5. Haptic: vibration on mobile
6. UI prompt: "SNAGGED! Tug to free" appears

**Player Response Window:**

- **Immediate release:** Drop tension to prevent 100% rip-off (~0.5-1s window)
- **Tug mini-game:** Attempt to clear snag (must act fast, tension still building)
- **No action:** Tension hits 100% in ~0.5s → instant rip-off

**Snag Severity (based on tension when snagged):**

| Tension When Snagged | Snag Difficulty | Oscillator Speed | Green Zone Size |
| -------------------- | --------------- | ---------------- | --------------- |
| 0-40% (Low)          | Easy            | 1.0x (slow)      | 15%             |
| 41-70% (Medium)      | Moderate        | 1.8x (medium)    | 12%             |
| 71-90% (High)        | Hard            | 2.8x (fast)      | 10%             |
| 91-99% (Extreme)     | Very Hard       | 4.0x (very fast) | 8%              |

Higher tension when you hit snag = harder mini-game to clear it. Punishes reckless high-tension play.

---

## Tug Mini-game (Clearing Snags)

**Objective:** Hit green zone to apply perfect tug force and free magnet from debris

**Interface:**

- Horizontal bar (400px wide)
- Oscillating indicator (small circle or arrow)
- Moves left-right continuously
- Speed varies by snag difficulty

**Zone Layout:**

```
[Grey 40%][Grey 20%][Green 15%][Red 5%][Grey 20%]
          ←———————— Oscillator moves ————————→
```

**Zone Breakdown:**

| Zone            | Size      | Position                                   | Result                        |
| --------------- | --------- | ------------------------------------------ | ----------------------------- |
| Grey (Nothing)  | 80% total | Scattered throughout bar                   | "Not enough force" - retry    |
| Green (Perfect) | 15%       | Middle-upper section (~55-70% position)    | Clears snag, resume drag      |
| Red (Too Hard)  | 5%        | Immediately above green (~70-75% position) | Magnet rips off OR line snaps |

**Interaction:**

1. Oscillator moves across bar continuously
2. Player taps/clicks when indicator enters green zone
3. **Hit grey:** Snag persists, tension continues building, can retry immediately
4. **Hit green:** Snag clears, tension resets to 40%, resume drag from same position
5. **Hit red:** Critical failure (see below)

**Critical Failure (Red Zone):**

- **70% chance:** Magnet detaches from item (soft fail)
  - Item lost (falls back to water, despawns)
  - Keep line and magnet (no equipment loss)
  - Can cast again immediately
  - Session continues
- **30% chance:** Line snaps (hard fail - equipment damage)
  - **Immediate consequences:**
    - Magnet + item both lost (fall into water)
    - Line breaks at stress point
    - Lose 5m of line length (e.g., 20m → 15m, 25m → 20m)
    - Audio: Loud snap sound, line whip effect
    - Visual: Broken line animation, player reels in stub
  - **Ongoing handicap:**
    - Reduced casting range for remainder of session
    - Far quadrants become inaccessible (Q7-Q9 locked if range < 15m)
    - Mid quadrants locked if range < 8m
    - Forces fishing in near/edge quadrants only
    - Session continues with handicap
  - **Repair required:**
    - Must visit shop between sessions to repair
    - Repair cost: $100-200 (based on line quality)
    - Instant repair (no chunk time consumed)
    - Restored to previous length after payment
  - **Strategic lesson:**
    - "Don't hit red zone in tug mini-game"
    - Economic pressure without "game over"
    - Can still complete session, just less efficiently
    - Risk/reward: continue session with handicap vs end early

**Difficulty Scaling:**

| Snag Difficulty | Oscillator Speed        | Green Zone Size | Tension Build During Game |
| --------------- | ----------------------- | --------------- | ------------------------- |
| Easy            | 1.0x (2s full traverse) | 15% (60px)      | 50%/second                |
| Moderate        | 1.8x (1.1s traverse)    | 12% (48px)      | 100%/second               |
| Hard            | 2.8x (0.7s traverse)    | 10% (40px)      | 150%/second               |
| Very Hard       | 4.0x (0.5s traverse)    | 8% (32px)       | 200%/second               |

**Retry Mechanism:**

**Unlimited Retries - Natural Pressure System:**

- No arbitrary retry limit (no "3 strikes" rule)
- Tension continues building during ALL retry attempts
- Creates organic pressure without artificial gates

**Pressure Escalation:**

- **1st miss:** Tension continues climbing (e.g., 70% → 80%)
- **2nd miss:** Tension near danger zone (e.g., 80% → 92%)
- **3rd miss:** Tension at critical level (e.g., 92% → 99%)
- **Next attempt:** Must succeed or tension hits 100% = instant rip-off

**Skill Expression:**

- Skilled players: Clear snag in 1-2 attempts, low tension cost
- Learning players: Get multiple chances, face mounting stakes
- Panicked players: Tension builds faster if they were holding when snagged
- Strategic players: Release tension immediately on snag, buy more retry time

**Player Options During Retries:**

- **Continue attempts:** Try to hit green zone before tension reaches 100%
- **Release and abandon:** Drop tension by releasing hold, give up on item
- **Accept failure:** Do nothing, let tension hit 100%, lose item

**Example Scenario:**

```
Player snagged at 60% tension
Tension building at 120%/s (8x rate)

Attempt 1: Miss (grey zone) → Tension now 75%
Attempt 2: Miss (grey zone) → Tension now 88%
Attempt 3: Miss (grey zone) → Tension now 97%
Attempt 4: Player has ~0.2 seconds before 100%
  → Must hit green zone NOW or instant rip-off
  → High stakes moment: "One more chance!"
```

**Design Philosophy:**

- No artificial "game over" after X attempts
- Tension IS the retry limit (physics-based consequence)
- Player always has agency until tension hits 100%
- Creates memorable clutch moments ("I cleared it on the 4th try at 99% tension!")

**Strategic Element:**

- Maintaining low tension approaching snag-prone zones = easier snag clearing
- High tension when snagged = very difficult mini-game + imminent 100% rip-off
- Experienced players recognize snag-prone quadrants (industrial edges, etc.)
- Risk/reward: speed through risky areas (high tension) vs play safe (low tension)

---

## Two Ways Magnet Comes Off

**Method 1: Tension Overload (Instant)**

- Player tension reaches 100%
- Magnet rips off immediately (force too great)
- Bypasses slip system entirely
- Common causes:
  - Snag event with delayed reaction
  - Current surge pushed tension over limit
  - Player misjudgment (held too long)
- Audio: loud snap/pop
- Visual: tension bar flashes white, haptic burst
- Message: "Magnet ripped off! (Too much force)"

**Method 2: Slip Limit Exceeded (Gradual)**

- Slip accumulation reaches hidden limit
- Occurs during lift phase (when visible)
- Caused by cumulative factors:
  - Poor magnet placement (low slip limit)
  - High surface slip rate (sludge coating)
  - Sustained high tension during drag
- Audio: sliding metal sound, disappointed tone
- Visual: slip meter hits 100%, magnet slides off animation
- Message: "Magnet slipped off!"

**Both are soft failures:**

- Item lost (falls back to water)
- Keep equipment (line, magnet intact)
- Can retry or cast again
- Session continues

**Hard failure (line snap):**

**Occurrence:** Only in tug mini-game red zone (30% chance)

**Immediate Impact:**

- Line breaks, magnet + item lost
- Lose 5m of line length instantly
- Example: 20m line → 15m line for rest of session

**Session Consequences:**

- Quadrant accessibility reduced:
  - 15m line: Can't reach Q7-Q9 (far quadrants locked)
  - 10m line: Can't reach Q4-Q9 (mid + far locked)
  - 5m line: Only Q0-Q3 accessible (edge + near only)
- Must adapt strategy to remaining quadrants
- Session timer continues (can keep fishing)
- Valuable teaching moment: "Red zone = bad"

**Repair System:**

- Visit shop after session ends
- Pay repair cost:
  - Basic line: $100
  - Reinforced line: $150
  - Premium line: $200
- Repair is instant (no chunk time consumed)
- Line restored to full length
- Can upgrade during repair (pay difference)

**Strategic Considerations:**

- **Continue session?** Depends on remaining time and accessible quadrants
- **Cut losses?** End session early, minimize wasted time in limited zones
- **Economic pressure:** Repair cost + reduced efficiency = real punishment
- **Not "game over":** Harsh consequence but recoverable

**Player Learning:**

- First line snap: Shocking, teaches importance of green zone
- Subsequent snaps: Reinforces careful play during snags
- Late-game: Rare (players skilled at tug mini-game)

---

## Weight Feedback During Drag

**Tension Build Physics (Heavy = Fast Tension Build):**

**REALISTIC PHYSICS MODEL:**
Heavy objects resist movement, so when you pull, force accumulates as tension in the rope BEFORE the object moves. Light objects move easily, so force converts to motion instead of building tension.

**Result:** Heavy items make tension build FASTER than light items.

**Tension Build Speed by Weight:**

- **Light items (5kg, 0.7x):** Tension reaches 50% slowly (~5-6 seconds) - Gentle, easy pull, force → motion
- **Medium items (20kg, 1.0x):** Tension reaches 50% moderately (~4 seconds) - Standard feel
- **Heavy items (45kg, 1.4x):** Tension reaches 50% quickly (~2.8 seconds) - Object resists, tension accumulates
- **Very heavy items (80kg, 2.0x):** Tension reaches 50% very quickly (~2 seconds) - Massive resistance, rapid tension spike
- Player feels "weight" through faster tension bar fill
- **Key insight:** If tension builds fast when you start pulling, it's heavy - be careful!

**Drag Speed Variation:**
Heavy items move slower even at same tension level:

- Ripple progress visibly slower for heavy items
- Distance counter updates less frequently
- Combined with fast tension build = clear "heavy item" signature
- Creates suspense: "Tension building fast + moving slow = heavy and dangerous!"

**Misleading Signals (Mystery Creation):**

- **Snag feels like weight:** Sudden stop, tension spike (could be heavy or snagged?)
- **Buoyant containers:** Feel lighter than actual weight (hollow, air-filled)
- **Sludge coating:** Adds drag resistance, feels heavier than it is
- **Weight shifts mid-drag:** Item rotates, changes drag profile

**Audio Cues:**

- Light items: Higher-pitched pulling sounds, faster rhythm
- Heavy items: Deeper, slower pulling sounds, strain audio
- Procedural audio (Tone.js): Pitch lowers with item weight

**Player Inference:**

- **Slow drag speed + FAST tension build = Heavy item** → Use hold sparingly, rely on taps for control
- **Fast drag speed + slow tension build = Light item** → Can use high tension safely, or use taps to speed up
- Stop + tension spike = "Snagged or very heavy?"
- Builds anticipation and teaches weight recognition
- Expert players learn to "feel" weight within first 2 seconds of pulling

---

## Hidden Slip Accumulation

**Critical Rules:**

1. Slip meter is **NOT visible** during horizontal drag phase
2. Slip accumulates silently based on tension and surface condition
3. Player only sees accumulated slip at **surface break** (lift phase transition)

**Slip Formula:**

```
Slip per Frame = Surface Slip Rate × Tension Modifier × Delta Time

Surface Slip Rate (item property, unknown to player during drag):
  - Clean metal: 1.0 slip/second at medium tension
  - Light rust: 1.5 slip/second
  - Heavy rust: 2.5 slip/second
  - Organic coating (algae): 3.0 slip/second
  - Heavy sludge/mud: 4.0 slip/second

Tension Modifier (based on current tension %):
  - 0% tension: 0x (no movement = no slip)
  - 1-30%: 0.3x (very safe)
  - 31-50%: 0.7x (safe)
  - 51-70%: 1.5x (moderate risk)
  - 71-85%: 3.0x (high risk)
  - 86-99%: 6.0x (extreme risk)
  - 100%: INSTANT RIP-OFF (bypasses slip calculation)
```

**Example Slip Accumulation:**

**Scenario A: Conservative Play (Low Tension)**

- Item: Clean metal bicycle (slip rate: 1.0)
- Player tension: Average 40% throughout drag
- Tension modifier: 0.7x
- Drag duration: 35 seconds
- Magnet placement: Edge (slip limit: 50)
- **Slip accumulated: 1.0 × 0.7 × 35 = 24.5**
- **Result at surface break:** 24.5/50 slip (49% of limit, SAFE)

**Scenario B: Aggressive Play (High Tension)**

- Item: Sludge-coated safe (slip rate: 4.0)
- Player tension: Average 75% throughout drag
- Tension modifier: 3.0x
- Drag duration: 25 seconds
- Magnet placement: Edge (slip limit: 45)
- **Slip accumulated: 4.0 × 3.0 × 25 = 300**
- **Result at surface break:** 300/45 slip (667% of limit, GUARANTEED FAILURE)
- Player will fail during lift phase unless they got incredibly lucky with placement

**Scenario C: Balanced Play (Medium Tension)**

- Item: Rusty wrench (slip rate: 1.5)
- Player tension: Average 60% throughout drag
- Tension modifier: 1.5x
- Drag duration: 20 seconds
- Magnet placement: Center (slip limit: 85)
- **Slip accumulated: 1.5 × 1.5 × 20 = 45**
- **Result at surface break:** 45/85 slip (53% of limit, MODERATE RISK)
- Player has room for careful lift but must be cautious

**Strategic Implication:**

- High tension during drag = fast but accumulates massive hidden slip
- Low tension during drag = slow but arrives at lift phase with slip safety buffer
- Player won't know placement or surface condition until surface break
- "Oh shit" moment: item surfaces, slip meter appears showing 85% already accumulated
- Expert players use medium tension as default, adjust based on experience

---

## Drag Phase Events

**Event Types:**

| Event              | Trigger                 | Duration      | Mechanical Effect                    | Tension Impact                       |
| ------------------ | ----------------------- | ------------- | ------------------------------------ | ------------------------------------ |
| **Debris Snag**    | Random 15%/5m           | Until cleared | Progress stops, tension builds 8-10x | Spikes toward 100% rapidly           |
| **Current Surge**  | Random 10%/session      | 3-5s          | Tension build rate ×2-3              | Pushes tension upward uncontrollably |
| Weight Shift       | Mid-drag (50% distance) | Instant       | Drag speed changes ±20%              | Tension build rate shifts            |
| Onlooker Interrupt | Time/location-dependent | 5-15s         | Game pauses (timer pauses)           | Tension frozen during event          |
| Wildlife Encounter | Rare 5%, shallow water  | 3s            | Comedy moment, no effect             | None                                 |

---

## Debris Snag Event (Detailed)

**Detection Phase:**

1. Item traveling normally (tension 60%, drag progressing)
2. Random check every 5m: 15% probability
3. **Snag triggers:** Forward progress = 0 m/s
4. Audio: Metal scrape/clunk sound
5. Visual: Ripple stops moving, tension bar flashes red
6. **Tension build rate spikes:** Normal rate × 8-10x modifier
   - Example at 30% tension: 15%/s × 8 = 120%/s → hits 100% in 0.58s (70 tension points / 120)
   - Example at 60% tension: 15%/s × 10 = 150%/s → hits 100% in 0.27s (40 tension points / 150)
   - Example at 85% tension: 15%/s × 10 = 150%/s → hits 100% in 0.10s (15 tension points / 150)

**Crisis Window (0.3-0.8 seconds depending on current tension):**
Player must choose:

**Option A: Release Tension (Safe)**

- Let go of pull button immediately
- Tension decays at normal rate (10%/second)
- Buys time to assess
- Can resume pulling after tension drops
- Snag persists (must still clear it eventually)

**Option B: Trigger Tug Mini-game (Active)**

- Tap/click "Tug" button (appears on snag detection)
- Launches mini-game immediately
- Tension continues building DURING mini-game
- Must succeed quickly or hit 100%

**Option C: Do Nothing (Failure)**

- Tension continues building at 8-10x rate (120-150%/s)
- Time to 100% depends on current tension when snagged:
  - Low tension (30%): ~0.5-0.6 seconds to failure
  - Medium tension (60%): ~0.3 seconds to failure
  - High tension (85%): ~0.1 seconds to failure
- Instant magnet rip-off when 100% reached
- Item lost, restart cast

**Snag Clearing Success:**

- Green zone hit in tug mini-game
- Snag releases
- Tension resets to 40% (partial relief)
- Slip accumulated during snag: moderate amount added
- Resume drag from same distance (progress preserved)
- Brief "recovery" animation (1s where input disabled)

**Current Surge Event (Detailed):**

**Trigger:**

- Random: 10% chance per session
- Can occur at any point during drag
- Duration: 3-5 seconds

**Effect:**

1. Tension build rate increases ×2-3
2. Player holding at 50% tension → jumps to 70-80% quickly
3. Slip accumulation accelerates (higher tension = higher slip)
4. Visual: Ripples intensify, water darkens slightly
5. Audio: Rushing water sound, rising tension drone

**Player Response:**

- Release immediately if near danger zone (>70% tension)
- Accept higher tension if in safe zone (<50%)
- Risk assessment: "Can I ride this out or must I release?"

**Strategic Element:**

- Current surge while at high tension (80%) = almost guaranteed 100% rip-off
- Rewards conservative play (keeping tension <60% gives buffer for surge)
- Unlucky timing: surge during snag = extremely dangerous (double tension spike)

---

## Drag Memory System

**State Persistence:**

When drag is interrupted (event, pause, quit), system preserves:

- **Item distance from shore** (exact position saved)
- **Accumulated slip value** (carries over on resume)
- **Tension resets to 0** (player must rebuild on resume)

**Resume Scenarios:**

**Snag Cleared:**

- Tug mini-game succeeded
- Item at same distance as when snagged
- Tension at 40% (post-snag reset)
- Slip: accumulated during snag + previous accumulation
- Resume dragging immediately

**Onlooker Dismissed:**

- Event dialogue completed
- Item slightly closer (drifted during chat: -1-2m)
- Tension at 0% (player wasn't holding during event)
- Slip: preserved from before interruption
- Resume dragging

**Game Paused Mid-Drag:**

- Player pauses game (menu)
- All state frozen (distance, tension, slip)
- Resume: exact same state
- Timer resumes from pause point

**Session Quit Mid-Drag:**

- Player exits to main menu or closes game
- Item despawns (claimed by someone else - narrative)
- Return to location: must cast fresh
- No progress preserved across sessions

**Benefit:**

- Events don't feel punishing (progress preserved)
- Visible ripple position shows "item is still there"
- Tension reset forces re-engagement (can't AFK through events)

---

## Transition to Lift Phase

**Completion Trigger:**
Item distance reaches 0m (arrived at shore/bank)

**Transition Sequence:**

1. **Final meter of drag:**
   - Visual: Ripple reaches shore line
   - Audio: Scraping sound (item contacts edge)
   - Drag speed slows (friction at bank)

2. **Arrival moment (0.5s pause):**
   - Tension bar fades out
   - "Reached shore" text appears
   - Audio: Water slosh, item settling
   - Anticipation builds

3. **Phase switch:**
   - UI transition: Tension bar → Lift controls
   - Text changes: "Tap to lift" instruction
   - Visual: Ripple at shore, ready for vertical lift
   - Timer continues (no pause)

4. **Lift phase begins:**
   - Player starts tapping to lift item
   - Slip meter STILL hidden (blind underwater lift)
   - Item begins rising from depth
   - New phase, new challenge

**Player Awareness:**

- Clear audio/visual feedback (phase changed)
- Control scheme changes (hold → tap)
- Tension bar repurposed or replaced with different UI
- Accumulated slip carries over (invisible consequence of drag choices)

**"Phew, made it" moment:**

- Survived drag without hitting 100% tension
- Avoided or cleared snags successfully
- Now facing new challenge: lift without knowing slip state
- Building anticipation for surface break reveal

---

## Player Skill Expression

**Beginner Mistakes:**

- Only uses hold input (ignores tap mechanic entirely) → slow on light items, can't recover quickly from snags
- Holds constantly without releasing → tension drifts to 100% on heavy items (fast build catches them off guard)
- Panics during snags → doesn't release hold, hits 100% rip-off
- Doesn't recognize weight signatures → treats all items the same
- Maintains high tension throughout drag → massive hidden slip accumulation
- Success rate: ~40-50% of items reach shore

**Intermediate Play:**

- Uses tap mechanic for light items (recognizes slow hold build, uses taps for speed boost)
- Pulses hold on heavy items (recognizes fast tension build = heavy, releases periodically)
- Releases during snags (avoids 100% rip-off)
- Maintains 50-70% average tension (balances speed vs slip risk)
- Starts recognizing weight within 3-5 seconds of dragging
- Adjusts strategy based on session time remaining (more aggressive when time pressure)
- Success rate: ~70-80% of items reach shore

**Expert Play:**

- **Tap-hold mastery:** Tap to target tension instantly (e.g., 3 taps → 60%), hold to maintain without overshoot
- **Weight signature reading:** Recognizes heavy items within 2 seconds (fast tension build), immediately switches to conservative strategy
- **Pre-emptive tension management:** Lowers tension before snag-prone zones (industrial edges, debris-heavy quadrants)
- **Optimal tension zones:** Maximizes tension on clean/light items (knows low slip risk), conservative on heavy/unknown items
- **Rapid tap recovery:** After snag clears, taps 4-5 times to instantly rebuild tension (maintains momentum)
- **Time optimization:** Uses rapid tapping for time-critical situations (session ending, maximizes catches per session)
- **Pulse-tap hybrid:** Dynamically switches between hold (baseline) and tap (bursts) based on real-time conditions
- **Current surge response:** Releases immediately when surge detected at high tension, taps back up after surge ends
- **Diminishing returns awareness:** Knows that 85%+ tension is extremely hard to build with hold, uses taps to reach extreme zone when needed
- Success rate: ~90-95% of items reach shore (failures usually due to hidden sludge + heavy weight combination)

**Skill Progression Curve:**

1. **Phase 1 (0-10 sessions):** Learning hold mechanic, frequent 100% rip-offs, slow drag speeds
2. **Phase 2 (10-30 sessions):** Discovers tap mechanic, understands tension zones, avoids most rip-offs
3. **Phase 3 (30-60 sessions):** Recognizes weight signatures, uses tap-hold combos, manages snags effectively
4. **Phase 4 (60+ sessions):** Masters tension control, optimizes for item type + time pressure, minimal failures

**What Separates Skill Levels:**

- **Beginner → Intermediate:** Learning to release before 100% (basic survival)
- **Intermediate → Expert:** Recognizing weight signatures early (proactive strategy adjustment)
- **Expert mastery:** Seamless tap-hold integration + real-time risk assessment

---

## Open Questions

**Q7:** Should current surge events be completely random or telegraphed slightly (ripple pattern changes 2s before)?

- **Recommendation:** Slight telegraph (ripples intensify) - rewards attentive players, feels less unfair

**Q40:** When snagged, should tension build happen ONLY if player is still holding, or does tension build automatically even if released?

- **Recommendation:** Automatic build (item stuck creates inherent tension) - forces active decision (release or clear), not passive waiting

**Q41:** Should tension decay continue during snag mini-game, or freeze while player attempts to clear?

- **Recommendation:** Freeze during mini-game - avoids dual-challenge frustration, keeps focus on timing
