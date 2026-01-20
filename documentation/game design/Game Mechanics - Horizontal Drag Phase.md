# Horizontal Drag Phase (Pulling Toward Shore)

**Overview:**
Player pulls item horizontally through water toward shore/bank. Tension controls drag speed and slip accumulation rate. This phase focuses on balancing speed (high tension) against risk (slip build-up and instant rip-off at max tension).

---

## Core Interaction: Hold-to-Pull

**Input Method:**

- Press and hold button/screen to generate pull force
- Release to stop pulling and allow tension to decay
- Resuming hold continues building tension from current level

**Tension Mechanics:**

- **Tension Value:** 0-100% representing pulling force
- **Build Rate:** Gradual increase while holding (base: 25%/second, modified by conditions)
- **Decay Rate:** Gradual decrease when not holding (10%/second)
- **Visual Meter:** Shows current tension with color-coded zones

**Tension Consequences:**

| Tension Level      | Drag Speed           | Slip Accumulation Rate | Special Risk               |
| ------------------ | -------------------- | ---------------------- | -------------------------- |
| 0% (None)          | 0x (stopped)         | 0x (no slip)           | Safe but wastes time       |
| 1-50% (Low-Medium) | 0.5x-1.0x base speed | 0.5x-1.0x slip rate    | Safe zone, controlled      |
| 51-80% (High)      | 1.0x-1.5x base speed | 1.0x-2.5x slip rate    | Risky but efficient        |
| 81-99% (Danger)    | 1.5x-2.0x base speed | 2.5x-5.0x slip rate    | Very dangerous, fast slip  |
| 100% (Max)         | N/A                  | N/A                    | **INSTANT MAGNET RIP-OFF** |

**Critical Rule: 100% Tension = Instant Failure**

- Reaching maximum tension causes immediate magnet detachment
- Bypasses slip system entirely (pure force overload)
- Most common during snag events if player doesn't release
- Audio/visual: loud snap, magnet yanks off item
- Item lost, session continues (soft fail)

**Strategic Tension Management:**

- **Low tension (0-50%):** Minimal slip build, safe but slow
- **Medium tension (51-70%):** Optimal for most items, balanced risk/reward
- **High tension (71-85%):** Speed gamble, requires good grip conditions
- **Danger tension (86-99%):** Desperate/expert only, massive slip risk + near instant rip-off
- **Pulse strategy:** Hold → release → hold pattern maintains average tension without hitting 100%

---

## Tension Build Rate Modifiers

**Base build rate: 25%/second** (reaches 100% in 4 seconds from zero)

**Modified by conditions:**

| Condition             | Build Rate Modifier | Effect                                                    |
| --------------------- | ------------------- | --------------------------------------------------------- |
| Normal drag           | 1.0x                | Standard rate (25%/second)                                |
| Heavy item            | 0.6x-0.8x           | Slower build (resistance)                                 |
| Light item            | 1.2x                | Faster build                                              |
| **Snagged (stopped)** | **8.0x-10.0x**      | **Extremely rapid (200-250%/second, hits 100% in ~0.5s)** |
| Current surge         | 2.0x-3.0x           | Temporary spike (3-5 seconds)                             |
| Debris drag           | 1.3x                | Slightly faster build                                     |

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

**Trigger Conditions:**

- Random probability per meter traveled (base 15% per 5m)
- Higher probability in certain locations (industrial = more debris)
- Quadrant position (center = fewer snags than edges)
- **Tension level determines snag severity** (high tension when snagged = harder to clear)

**Snag Detection:**

1. Forward progress stops (distance frozen)
2. **Tension spikes rapidly** (8-10x build rate)
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
- **30% chance:** Line snaps (hard fail)
  - Magnet + item lost
  - Line breaks (must buy replacement)
  - Lose line length (e.g., 20m → 15m until repaired)
  - Session continues with reduced casting range

**Difficulty Scaling:**

| Snag Difficulty | Oscillator Speed        | Green Zone Size | Tension Build During Game |
| --------------- | ----------------------- | --------------- | ------------------------- |
| Easy            | 1.0x (2s full traverse) | 15% (60px)      | 50%/second                |
| Moderate        | 1.8x (1.1s traverse)    | 12% (48px)      | 100%/second               |
| Hard            | 2.8x (0.7s traverse)    | 10% (40px)      | 150%/second               |
| Very Hard       | 4.0x (0.5s traverse)    | 8% (32px)       | 200%/second               |

**Retry Mechanism:**

- Unlimited retries for MVP
- Each missed attempt: tension continues building (pressure increases)
- After 2-3 missed attempts, tension likely near 100% → must succeed or rip-off
- Player can choose to release tension and abandon item instead

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

- Only occurs in tug mini-game red zone
- 30% chance when hitting red
- Lose line segment (equipment damage)
- More punishing, encourages careful play

---

## Weight Feedback During Drag

**Tension Build Resistance:**
Heavy items make tension build slower:

- Light items: Tension reaches 50% quickly (~2 seconds)
- Heavy items: Tension reaches 50% slowly (~3-4 seconds)
- Player feels "resistance" through slower bar fill

**Drag Speed Variation:**
Heavy items move slower even at same tension level:

- Ripple progress visibly slower for heavy items
- Distance counter updates less frequently
- Creates suspense: "Is this heavy or just far away?"

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

- Slow drag speed + slow tension build = "This is heavy"
- Fast drag speed + fast tension build = "This is light"
- Stop + tension spike = "Snagged or very heavy?"
- Builds anticipation: "Is this the engine I'm hunting or another bike?"

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
6. Tension build rate changes: 25%/sec → 200%/sec

**Crisis Window (~0.5-1 second):**
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

- Tension continues building at 200%/sec
- Hits 100% in ~0.2-0.5 seconds
- Instant magnet rip-off
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

## Open Questions

**Q4:** Should we show accumulated slip value to player after drag completes (at lift phase start), or keep it hidden until surface break for maximum "oh shit" reveal?

- **Recommendation:** Keep hidden until surface break - better dramatic reveal

**Q5:** For the tug mini-game: should there be a limit to retry attempts (e.g., 3 tries then auto-fail), or unlimited?

- **Recommendation:** Unlimited for MVP, but tension building during retries creates natural pressure

**Q6:** How punishing should line snap be? Does it end session immediately, or just reduce casting range until repaired?

- **Recommendation:** Reduce range, session continues - less frustrating, maintains economic pressure (repair costs)

**Q7:** Should current surge events be completely random or telegraphed slightly (ripple pattern changes 2s before)?

- **Recommendation:** Slight telegraph (ripples intensify) - rewards attentive players, feels less unfair

**Q40:** When snagged, should tension build happen ONLY if player is still holding, or does tension build automatically even if released?

- **Recommendation:** Automatic build (item stuck creates inherent tension) - forces active decision (release or clear), not passive waiting

**Q41:** Should tension decay continue during snag mini-game, or freeze while player attempts to clear?

- **Recommendation:** Freeze during mini-game - avoids dual-challenge frustration, keeps focus on timing
