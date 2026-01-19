# Magnet Fishing Game: Comprehensive Design Document

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Game Concept](#core-game-concept)
3. [Technical Architecture](#technical-architecture)
4. [Game Mechanics - Detailed Specifications](#game-mechanics---detailed-specifications)
5. [Visual Design Considerations](#visual-design-considerations)
6. [Audio Design](#audio-design)
7. [Progression Systems](#progression-systems)
8. [User Interface & Experience](#user-interface--experience)
9. [Scope & Development Phases](#scope--development-phases)
10. [Open Questions & Decisions Needed](#open-questions--decisions-needed)

---

## Project Overview

### Vision Statement

A web-based magnet fishing simulation that captures the mystery, anticipation, and discovery of real magnet fishing through simple, satisfying mechanics and a focus on finding weird and wonderful items. The experience emphasizes the rhythm of cast → wait → retrieve → reveal, with special excitement around discovering closed containers with unknown contents.

### Design Principles

1. **Simple mechanics, satisfying execution** - Core interactions should feel good to perform repeatedly
2. **Discovery over complexity** - Item variety and surprise drive engagement more than deep systems
3. **Performance first** - Snappy, immediate feedback with room for expansion
4. **Accessible yet engaging** - Auto modes for accessibility, manual modes for skill expression
5. **Consistent experience** - Same gameplay feel across device sizes (iPad, desktop, phone)

### Target Platforms

- **Primary:** iPad (landscape/portrait), Desktop (browser)
- **Secondary:** Mobile phones (if responsive UX can be designed effectively)
- **Constraint:** Consistent experience across device sizes within same orientation
- **Note:** Experience should not show "more content" on larger screens - scale UI/game view proportionally

---

## Core Game Concept

### The Hook

Finding weird and wonderful things with simple, engaging mechanics that feel good. The "safe moment" - discovering a closed safe with unknown contents - represents the ultimate jackpot discovery that drives player excitement.

### Core Loop (60-second cycle)

1. **Choose location** - Select themed fishing spot
2. **Cast magnet** - Click quadrant in casting arc
3. **Horizontal drag** - Pull item toward shore with tension management
4. **Blind lift** - Bring item to surface without knowing what it is
5. **Surface break** - Reveal item type, condition, and magnet grip quality
6. **Revealed lift** - Complete retrieval with visible slip meter
7. **Reveal & decision** - Inspect item, decide to keep/sell/scrap, open containers
8. **Repeat** - Return to step 2 until session ends

### Meta Loop (daily cycle)

1. **Plan day** - Allocate 4× 6-hour chunks across: fishing, shop, refurb, sleep
2. **Execute sessions** - Complete fishing sessions with time pressure
3. **Manage inventory** - Sort items for sale, refurb, or materials
4. **Upgrade equipment** - Craft better gear using materials + cash
5. **Progress collection** - Fill silhouette catalog, unlock new locations
6. **Repeat cycle** - Plan next day based on needs and goals

---

## Technical Architecture

### Tech Stack

#### Core Framework

- **Build Tool:** Vite (fast dev server, optimized builds)
- **UI Framework:** React (for menus, HUD, UI overlays)
- **Game Rendering:** PixiJS + @pixi/react (WebGL-accelerated 2D rendering)
- **State Management:** Zustand (lightweight, performant game state)
- **Styling:** CSS Modules (scoped, performant styling)

#### Audio

- **Sample Playback:** Howler.js (UI sounds, simple effects)
- **Procedural Audio:** Tone.js (dynamic tension, environmental sounds)
- **Approach:** Hybrid - samples for discrete events, synthesis for continuous/dynamic sounds

#### Dev Tools

- **PixiJS DevTools:** Scene inspector, performance monitoring
- **Tone.js Analyzers:** Audio debugging and visualization

#### Data Persistence

- **MVP:** LocalStorage (simple key-value for save data)
- **Future:** IndexedDB if data complexity grows

### Architecture Rationale

**Why PixiJS over SVG/DOM?**

- Performance headroom for particle effects, multiple animated elements
- Smooth scaling/transforms for "item approaching camera" effect
- WebGL acceleration handles future expansion (weather, complex animations)
- Proven game rendering pipeline

**Why Zustand over Context/Redux?**

- Lightweight (minimal bundle size impact)
- Less boilerplate than Redux
- Better performance than Context for frequent updates
- Easy dev tools integration

**Why Tone.js for audio?**

- Procedural tension sounds that respond to game state (slip meter rising)
- Dynamic environmental ambience
- Community support from live-coding/algorave scene
- Can create unique sounds per item/event without large audio asset library

### Project Structure

```
/magnet-fishing
  /src
    /components
      /game
        CastingView.jsx          # PixiJS canvas - top-down fishing view
        TensionBar.jsx           # Hold-to-pull meter during drag
        TugMinigame.jsx          # Oscillating slider for clearing snags
        LiftInterface.jsx        # Tap rhythm + slip meter for vertical lift
        SlipMeter.jsx            # Visual slip accumulation indicator
        RevealScreen.jsx         # Item showcase after successful retrieve
      /ui
        SessionTimer.jsx         # Countdown clock for fishing sessions
        QuadrantOverlay.jsx      # Depletion indicators on casting view
        InventoryPanel.jsx       # Current session catch list
        CollectionCatalog.jsx    # Silhouette discovery tracker
      /shop
        ShopInterface.jsx        # Buy/sell/upgrade screens
        RefurbStation.jsx        # Item refurbishment interface
        CraftingBench.jsx        # Upgrade crafting with materials
    /game
      /state
        gameStore.js             # Zustand store - global game state
        sessionStore.js          # Current fishing session state
        inventoryStore.js        # Player inventory management
      /mechanics
        castMechanics.js         # Quadrant selection, placement RNG
        dragMechanics.js         # Tension, snag detection, distance calc
        liftMechanics.js         # Tap rhythm, slip accumulation
        slipCalculations.js      # Placement × surface condition → slip rate
        eventSystem.js           # Probability tables, event triggers
      /data
        itemDatabase.js          # All retrievable items with properties
        locationDatabase.js      # Location themes, spawn tables
        upgradeDatabase.js       # Equipment progression trees
        eventDatabase.js         # Special events with conditions
    /audio
      audioManager.js            # Howler.js sample coordination
      proceduralAudio.js         # Tone.js synthesis (tension drone, etc)
      audioLibrary.js            # Sound effect definitions
    /utils
      constants.js               # Game balance values, timing configs
      helpers.js                 # Utility functions (RNG, lerp, etc)
      responsive.js              # Device detection, orientation handling
    /hooks
      useGameLoop.js             # RAF-based game loop for PixiJS
      useAudio.js                # Audio playback wrapper
      useTimer.js                # Session countdown timer
      useInput.js                # Hold/tap/click input handling
    /assets
      /sprites                   # Item illustrations (vector or pixel)
      /audio                     # Sample library (splashes, clicks, etc)
      /ui                        # Menu graphics, icons
    App.jsx                      # Root component, routing
    main.jsx                     # Entry point
```

### Performance Considerations

**Target Performance:**

- 60fps game loop during active retrieve
- <100ms input latency (hold/tap/click → visual feedback)
- Smooth scaling animations (no jank during item approach)
- Audio sync with visual events (<50ms offset)

**Optimization Strategies:**

- PixiJS sprite batching for multiple items/particles
- Object pooling for frequently created/destroyed elements (particles, ripples)
- Lazy loading for item assets (load location-specific items on demand)
- Audio sprite sheets for combining small samples
- Debounced state updates (don't update UI on every frame)

**Device-Specific:**

- Detect device capabilities on load
- Reduce particle counts on lower-end devices
- Adjust animation quality based on FPS monitoring
- Fallback to simpler audio on devices with limited Web Audio API support

---

## Game Mechanics - Detailed Specifications

### 1. Casting System

#### Quadrant Layout

**Visual Structure (Top-Down View):**

```
           [Player Position - Shore/Walkway]
    ==========================================
         [Q0: Edge Quadrant - 0-2m range]
    ------------------------------------------
              /    |    |    \
             /  Q1 | Q2 | Q3  \
            /      |    |      \
           /   Q4  | Q5 |  Q6   \
          /        |    |        \
         /    Q7   | Q8 |   Q9    \
        /          |    |          \
       ----------------------------------------
```

**Quadrant Properties:**

- **60° casting arc** from player position
- **Radial slicing:** 3 angular sections (20° each: left, center, right)
- **Depth rings:** 3 radial zones (near 2-8m, mid 8-15m, far 15-25m)
- **Edge quadrant (Q0):** Special near-shore zone (0-2m)
- **Total clickable areas:** 10 quadrants (Q0 + 9 main quadrants)

**Quadrant Attributes:**
| Quadrant | Angular Position | Distance Range | Depth Zone | Base Drag Time |
|----------|-----------------|----------------|------------|----------------|
| Q0 | Edge (full arc) | 0-2m | Shallow | 8-12s |
| Q1-Q3 | Left/Center/Right | 2-8m | Near | 15-22s |
| Q4-Q6 | Left/Center/Right | 8-15m | Mid | 25-35s |
| Q7-Q9 | Left/Center/Right | 15-25m | Far | 38-50s |

**Depletion System:**

- Each quadrant tracks "freshness" value (0-100)
- Successful retrieve reduces freshness by amount based on item rarity
- Freshness regenerates over time (real-time or between sessions - TBD)
- Visual indicator: Green (fresh 80-100) → Yellow (depleted 40-79) → Red (exhausted 0-39)

**Equipment Range Limitation:**

- Starting equipment: Can only reach Q0-Q3 (edge + near zones)
- Upgraded line length: Unlocks Q4-Q6 (mid zones)
- Max upgraded line: Unlocks Q7-Q9 (far zones)
- Greyed-out quadrants indicate inaccessible zones

**Click Interaction:**

1. Player clicks quadrant
2. Cast animation plays (magnet throw arc)
3. Magnet lands at random position within clicked quadrant
4. Settle animation (magnet sinks, ripples)
5. Contact check: RNG determines if item is present
6. If item present: Magnet attaches, proceed to drag phase
7. If no item: "Nothing here" feedback, return to cast

**Quadrant Selection Strategy:**

- Near quadrants: Fast retrieves, common items, good for volume fishing
- Far quadrants: Slow retrieves, rare items, target-hunting strategy
- Depletion visible: Encourages rotating between quadrants
- Location-specific spawn tables: Some items only spawn in certain depth zones

#### Open Questions:

- **Q1:** How quickly should quadrant freshness regenerate? Real-time (minutes) or fixed respawn on session start?
- **Q2:** Should we show "no item present" immediately or after a brief suspense delay?
- **Q3:** Do we want visual hints (ripples, shadows) indicating items are present in certain quadrants, or keep it fully blind?

---

### 2. Horizontal Drag Phase (Pulling Toward Shore)

**Overview:**
Player pulls item horizontally through water toward shore/bank. This phase focuses on tension management, obstacle navigation, and hidden slip accumulation.

#### Core Interaction: Hold-to-Pull

**Input Method:**

- Press and hold button/screen to generate pull force
- Release to stop pulling (tension drops)
- Resuming hold continues pull from current position

**Tension Mechanics:**

- **Tension Bar:** Visual meter (0-100%) showing current pull force
- **Tension builds** while holding input
- **Tension Rate:** Gradual increase (0 → 100% over 2-3 seconds)
- **Tension Release:** Immediate drop when input released
- **Danger Zone:** Tension >80% triggers risk events

**Tension Consequences:**

| Tension Level    | Pull Speed      | Slip Accumulation Rate | Risk Events |
| ---------------- | --------------- | ---------------------- | ----------- |
| 0-30% (Low)      | 0.5x base speed | 0.5x slip rate         | None        |
| 31-60% (Medium)  | 1.0x base speed | 1.0x slip rate         | Rare        |
| 61-80% (High)    | 1.5x base speed | 2.0x slip rate         | Common      |
| 81-100% (Danger) | 2.0x base speed | 4.0x slip rate         | Guaranteed  |

**Strategic Tension Management:**

- **Low tension:** Safe but slow, minimal slip build
- **Medium tension:** Efficient, balanced risk/reward
- **High tension:** Fast but risky, slip accumulates quickly
- **Danger tension:** Speed gamble, high chance of snap/slip/snag

**Player Skill Expression:**
Experienced players pulse tension (hold → release → hold) to:

- Maintain medium tension average without hitting danger zone
- React to weight feedback (heavy items benefit from pulsing)
- Pre-emptively ease off before snag zones (learn location patterns)

#### Drag Progression & Distance

**Distance-Based Timing:**

- Quadrant determines starting distance from shore
- Item position updates in real-time (visual: ripples move closer)
- Distance marker shows progress: "18m away" → "12m away" → "6m away"
- Drag completes when item reaches shore/bank (transition to lift phase)

**Progress Calculation:**

```
Pull Speed (m/s) = Base Speed × Tension Multiplier × Weight Modifier
Base Speed = 0.5 m/s (configurable per item weight class)
Weight Modifier = 1.0 (light) to 0.4 (heavy)
```

**Example Drag Times:**

- Q0 edge (2m), medium tension, light item: ~8 seconds
- Q5 mid (12m), medium tension, medium item: ~28 seconds
- Q9 far (23m), high tension, heavy item: ~42 seconds

#### Snag Event System

**Trigger Conditions:**

- Random probability per meter traveled (base 15% per 5m)
- Higher probability in certain locations (industrial = more debris)
- Tension level affects snag severity (high tension = harder snags)
- Quadrant position (center = fewer snags than edges)

**Snag Event Flow:**

1. **Detection:** Forward progress stops, audio cue (scrape/clunk)
2. **Feedback:** Tension bar flashes red, vibration on mobile
3. **Prompt:** "Snagged! Tug to free" UI appears
4. **Transition:** Launch Tug Mini-game

#### Tug Mini-game (Clearing Snags)

**Objective:** Hit the green zone to apply perfect tug force and clear snag

**Interface:**

- Horizontal slider bar (grey fill)
- Oscillating indicator moving left-right across bar
- Speed of oscillation varies by snag difficulty (easy = slow, hard = fast)

**Zone Breakdown:**
| Zone | Size | Position | Result |
|------|------|----------|--------|
| Grey (Nothing) | 80% | Throughout bar | No effect, snag persists |
| Green (Perfect) | 15% | Middle-upper section | Clears snag, continue drag |
| Red (Too Hard) | 5% | Above green zone | Magnet pops off OR line snaps |

**Interaction:**

- Tap/click when indicator is in green zone
- **Miss (grey):** "Not enough force" - can retry immediately
- **Success (green):** Snag clears, return to drag phase with brief stun recovery
- **Failure (red):** Critical failure - either:
  - Magnet detaches from item (soft fail, item lost, keep line/magnet)
  - Line snaps (hard fail, lose line segment, must buy replacement)

**Difficulty Modifiers:**

- **Oscillation speed:** 1.0x (easy) to 3.0x (hard) base speed
- **Green zone size:** 15% (easy) to 8% (hard)
- **Retry limit:** None for MVP (can attempt until success or failure)

**Strategic Element:**
Players learn to:

- Maintain lower tension approaching known snag zones
- Risk high tension in clear water for speed
- Identify snag-heavy quadrants and avoid or prepare

#### Weight Feedback During Drag

**Weight Signature Indicators:**

- **Pull speed variation:** Heavy items slow progress noticeably
- **Tension resistance:** Heavy items cause tension to build faster
- **Audio cues:** Deeper, slower pulling sounds for heavy items
- **Visual feedback:** Ripple size/frequency indicates item mass

**Misleading Signals (Creates Mystery):**

- Snag can feel like heavy item (temporary slowdown)
- Buoyant items (hollow containers) feel lighter than actual weight
- Sludge/debris coating adds drag that disappears when item surfaces
- Weight signature changes as item rises through water column

**Player reads weight clues to:**

- Estimate if retrieval is worth continuing
- Anticipate if upgraded equipment will be needed
- Build suspense: "Is this heavy thing a safe or just a bike?"

#### Hidden Slip Accumulation

**Critical Rule:** Slip meter is NOT visible during horizontal drag phase

**Slip accumulates silently based on:**

1. **Initial Placement RNG** (magnet landed center vs edge of item)
2. **Surface Condition** (clean metal vs sludge-coated)
3. **Tension Level** (high tension = faster slip build)
4. **Duration at High Tension** (cumulative, not instantaneous)

**Slip Calculation:**

```
Slip Increase per Frame = Tension Level × Surface Slip Rate × Time Delta
Surface Slip Rate = Item property (1.0 clean, 2.0 rusty, 4.0 sludge)
```

**Example Scenarios:**

**Scenario A: Good Conditions**

- Magnet landed center (slip limit: 90)
- Clean metal surface (slip rate: 1.0)
- Player maintains medium tension (50-60%)
- Drag duration: 25 seconds
- **Accumulated slip: ~18** (safe margin remaining)

**Scenario B: Dangerous Conditions**

- Magnet landed edge (slip limit: 40)
- Heavy sludge coating (slip rate: 4.0)
- Player uses high tension (70-80%)
- Drag duration: 30 seconds
- **Accumulated slip: ~68** (exceeds limit, will fail during lift unless player is careful)

**Strategic Implication:**

- Players can't see slip building
- Must infer risk from visible cues (magnet placement shown at surface break)
- Rewards skilled play: low tension during drag = safety buffer for lift phase
- Creates "oh shit" moment when slip meter appears during lift

#### Drag Phase Events

**Event Types:**

| Event              | Trigger                        | Duration | Effect                               |
| ------------------ | ------------------------------ | -------- | ------------------------------------ |
| Debris Snag        | Random 15%/5m                  | 8-12s    | Tug mini-game, +10s time             |
| Current Surge      | Random 10%/session             | 3-5s     | Tension spike (auto +30%), slip risk |
| Weight Shift       | Mid-drag (50% distance)        | Instant  | Tension change, hints at item type   |
| Onlooker Interrupt | Time-based, location-dependent | 5-15s    | Pause game, dialogue, resume         |
| Wildlife Encounter | Rare (5%), shallow water       | 3s       | Comedy moment, no mechanical impact  |

**Current Surge Detail:**

- Unpredictable water flow increases
- Tension automatically jumps +30% for 3-5 seconds
- Player cannot reduce tension during surge
- Slip accumulates at accelerated rate
- Audio: rushing water, strain sounds
- Visual: ripples intensify, item drift indicated

**Onlooker Interrupt Detail:**

- Triggered by location type (public parks, city rivers)
- Time-of-day affects probability (day > night)
- Equipment noise modifier (powered winch attracts attention)
- **Pause timer** during interaction
- Dialogue options:
  - "Just fishing" - quick dismissal, resume
  - "Want to see what I find?" - extended chat, +10s time penalty
  - (Night + noisy equipment): Police/security encounter

#### Drag Memory System

**State Persistence:**
If drag phase is interrupted (pause, event, quit):

- Item position saved (distance from shore)
- Tension state reset (starts at 0 on resume)
- Slip accumulation preserved (carries over)
- Visual indicator: ripples/disturbance at last known position

**Resume Scenarios:**

**Interrupt by Event:**

- Snag cleared → resume from same position
- Onlooker dismissed → resume from slightly closer position (item drifted during chat)
- Current surge ends → resume from current position

**Session Quit Mid-Drag:**

- Exit game during drag
- Return to location later
- Item despawned (claimed by someone else)
- Must recast to find new item

**Benefit:**

- Reduces frustration from interruptions
- Visible progress maintained (ripple position indicator)
- Reinforces that item is "real" object in space, not abstract

#### Transition to Lift Phase

**Completion Condition:**
Item reaches shore/bank (distance = 0)

**Transition Sequence:**

1. Final drag pull brings item to edge
2. Audio cue: scrape on shore, change in water sound
3. Visual: item ripple reaches shore line
4. **Brief pause (0.5s)** - moment of anticipation
5. UI transition: Drag controls fade out
6. Lift phase interface appears
7. Item begins blind underwater lift

**Player Awareness:**

- Clear feedback that phase has changed
- Different control scheme (hold → tap rhythm)
- Tension bar remains but repurposed for tap frequency
- Slip meter still hidden (phase 2a: blind lift begins)

#### Open Questions:

- **Q4:** Should we show accumulated slip value to player after drag completes (during lift phase), or only show rate of increase?
- **Q5:** For the tug mini-game: should there be a limit to retry attempts (e.g., 3 tries then auto-fail), or unlimited?
- **Q6:** How punishing should line snap be? Immediate session end, or just cost + continue?
- **Q7:** Should current surge events be completely random or telegraphed slightly (ripple pattern changes 2s before)?

---

### 3. Vertical Lift Phase (Bringing to Surface)

**Overview:**
After horizontal drag brings item to shore/bank, player must lift vertically from underwater to air. This phase has two distinct sub-phases: blind underwater lift (mystery) and revealed lift (informed decision-making).

#### Phase 2a: Blind Underwater Lift

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

#### Phase 2b: Surface Break & Revealed Lift

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

#### Lift Phase Events

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

#### Sub-Phase Timing Summary

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

#### Lift Phase Success Rate Factors

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

#### Open Questions:

- **Q8:** Should the "drop decision" window be timed (auto-commit after 3s) or wait indefinitely for player input (pausing timer)?
- **Q9:** How many retry attempts should be allowed after magnet slip-off before item is lost? (Current: 3 retries)
- **Q10:** Should structural break events be completely random or tied to cumulative tap frequency (damage threshold model)?
- **Q11:** For container drainage: should weight reduction be instant at surface break, or gradual as lift continues?

---

### 4. Slip System (Comprehensive)

**Overview:**
Slip is the core risk mechanic that can cause magnet to detach from item, resulting in failed retrieval. It's influenced by initial placement RNG, item surface condition, and player tension/input behavior across both drag and lift phases.

#### Slip Limit (Hidden Maximum)

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

#### Slip Rate (Accumulation Speed)

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

#### Slip Accumulation Across Phases

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

#### Slip Meter Visualization (Phase 2b Only)

**UI Design:**

- Horizontal or vertical bar
- Fill color shifts: Green (0-50%) → Yellow (51-80%) → Red (81-100%)
- Current slip value shown numerically (optional, for clarity)
- Limit NOT shown (player infers from magnet position visual)

**Warning States:**

| Slip % of Limit   | Visual Feedback        | Audio Cue                 | Gameplay Effect                     |
| ----------------- | ---------------------- | ------------------------- | ----------------------------------- |
| 0-50% (Safe)      | Green bar, calm        | None                      | No warnings                         |
| 51-80% (Caution)  | Yellow bar, slow pulse | Low tension hum (Tone.js) | Magnet wobbles slightly             |
| 81-95% (Danger)   | Red bar, fast pulse    | Rising pitch alarm        | Magnet wobbles heavily, item shakes |
| 96-99% (Critical) | Red bar, flashing      | Urgent beeping            | Visual "about to slip" animation    |
| 100% (Failure)    | Bar full, flash white  | Loud pop/clunk            | Magnet detaches, item falls         |

**Player Response to Warnings:**

- See yellow bar → ease off tapping slightly
- See red bar → significantly reduce tapping (accept slower lift)
- Hear audio alarm → immediate response (adrenaline trigger)
- Experienced players preemptively slow when they see sludge coating

#### Slip Recovery & Mitigation

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

#### Slip Events & Special Cases

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

#### Slip Failure States

**Soft Failure: Magnet Pop-Off**

- Slip reaches 100% of limit
- Magnet detaches cleanly
- Item falls back to water
- Retry available (item floats/sinks slowly)
- Slip resets to 50% for retry attempt
- Line and magnet intact (no equipment loss)

**Hard Failure: Line Snap**

- Only occurs if slip at 100% AND tension in danger zone simultaneously
- Rare (requires both conditions)
- Line breaks, magnet + item lost
- Must buy replacement line segment
- Session can continue with remaining line length (if any)

**Degradation Failure:**

- Occurs on 3rd or 4th retry attempt (RNG)
- Item has degraded from repeated drops
- Container cracked, contents partially lost
- Fragile item broken, reduced value
- Still securable but diminished reward

#### Open Questions:

- **Q12:** Should slip limit be partially visible (e.g., bar shows estimated range based on visual placement) or completely hidden until failure?
- **Q13:** Should there be a "slip forgiveness" mechanic for new players (e.g., first 5 retrieves have +20% slip limit bonus)?
- **Q14:** How much should slip reset on retry? Currently 50% - too forgiving or too punishing?
- **Q15:** Should certain items have "slip resistance" property independent of surface condition (e.g., ribbed surfaces grip magnet better)?

---

### 5. Item System

**Overview:**
Items are the core reward and discovery mechanic. Each item has mechanical properties (weight, slip rate, value) and narrative properties (description, lore, rarity). Items populate the collection catalog and drive progression.

#### Item Properties Schema

```javascript
{
  id: 'rusty_bike_01',
  name: 'Rusty Bicycle',
  category: 'vehicle_parts',

  // Mechanical Properties
  weight: 18, // kg, affects drag/lift difficulty
  magneticStrength: 'medium', // how strongly it attracts to magnet
  surfaceCondition: 'heavy_rust', // determines slip rate (2.5x)
  fragility: 'low', // resistance to structural break events

  // Economic Properties
  baseValue: 45, // cash value if sold as-is
  refurbValue: 120, // value after refurbishment
  refurbTime: 30, // minutes of refurb time chunk required
  materialYield: [
    { type: 'steel_scrap', amount: 3 },
    { type: 'rubber', amount: 1 }
  ],

  // Spawn Properties
  rarity: 'common', // affects spawn probability
  depthZones: ['shallow', 'medium'], // where it can spawn
  locationTypes: ['urban_river', 'city_river'], // which locations

  // Visual Properties
  spritePath: '/assets/items/rusty_bike_01.png',
  spriteScale: 1.2, // relative size on screen
  silhouettePath: '/assets/silhouettes/bike.png',
  color: '#8B4513', // dominant color for UI accent

  // Narrative Properties
  description: 'Someone\'s abandoned commute. The chain is rusted solid.',
  lore: 'City bikes often end up in the river after late-night joyrides. This one has been down there for years.',
  discoveryQuote: '"That\'s someone\'s ride home... or it was."',

  // Collection Properties
  catalogCategory: 'Transportation',
  catalogIndex: 12,
  variantOf: null, // 'rusty_bike' if this is a variant
  discoveryDate: null, // timestamp when first found (populated at runtime)
}
```

#### Item Categories & Spawn Tables

**Category Breakdown:**

| Category      | Rarity Distribution             | Typical Locations     | Weight Range | Example Items                    |
| ------------- | ------------------------------- | --------------------- | ------------ | -------------------------------- |
| Trash         | 40% common                      | All locations         | 0.5-5kg      | Shopping trolleys, bottles, cans |
| Tools         | 25% common, 10% uncommon        | Industrial, urban     | 1-10kg       | Wrenches, hammers, toolboxes     |
| Vehicle Parts | 15% common, 8% uncommon         | Urban, industrial     | 5-50kg       | Bikes, wheels, engines           |
| Historical    | 5% uncommon, 3% rare            | Historic sites, moats | 0.2-15kg     | Coins, weapons, artifacts        |
| Containers    | 5% uncommon, 2% rare, 0.5% epic | All (lower in rural)  | 10-100kg     | Safes, lockboxes, bags, crates   |
| Electronics   | 8% uncommon, 4% rare            | Urban, city           | 2-20kg       | Phones, cameras, laptops         |
| Curiosities   | 3% rare, 1% epic                | Location-specific     | Varies       | Unusual, unique finds            |

**Rarity Tiers:**

| Rarity    | Spawn Weight | Visual Indicator | Audio Cue          | Avg Value | Catalog Impact       |
| --------- | ------------ | ---------------- | ------------------ | --------- | -------------------- |
| Common    | 60%          | Grey border      | Standard chime     | 10-50     | Basic entry          |
| Uncommon  | 25%          | Green border     | Higher pitch chime | 50-150    | Interesting find     |
| Rare      | 12%          | Blue border      | Harmonic chime     | 150-500   | Notable discovery    |
| Epic      | 2.5%         | Purple border    | Multi-tone fanfare | 500-2000  | Major achievement    |
| Legendary | 0.5%         | Gold border      | Full musical sting | 2000+     | Collection milestone |

**Location-Specific Spawn Tables:**

Example: **Industrial Canal**

```javascript
spawnTable: {
  trash: { weight: 30, items: ['shopping_trolley', 'oil_drum', 'scrap_metal'] },
  tools: { weight: 35, items: ['wrench_set', 'industrial_hammer', 'bolt_cutter'] },
  vehicleParts: { weight: 20, items: ['car_engine', 'motorcycle_frame', 'wheel_hub'] },
  containers: { weight: 10, items: ['tool_chest', 'safe_small', 'metal_crate'] },
  electronics: { weight: 5, items: ['industrial_radio', 'control_panel'] }
}
```

Example: **Castle Moat**

```javascript
spawnTable: {
  trash: { weight: 20, items: ['glass_bottle', 'modern_trash'] },
  tools: { weight: 10, items: ['medieval_hammer', 'trowel'] },
  historical: { weight: 40, items: ['medieval_coin', 'sword_fragment', 'armor_piece', 'cannonball'] },
  containers: { weight: 5, items: ['wooden_chest', 'iron_lockbox'] },
  curiosities: { weight: 25, items: ['pottery_shard', 'decorative_hinge', 'ancient_nail'] }
}
```

#### Container System (Special Items)

**Container Properties:**
Containers are special items that hold other items inside. Their contents are unknown until opened.

```javascript
{
  id: 'rusted_safe_medium',
  name: 'Rusted Safe',
  category: 'containers',
  containerType: 'safe',

  // Container-Specific
  locked: true,
  lockDifficulty: 'medium', // affects opening mini-game or tool requirement
  contentsRoll: 'safe_medium_loot_table', // references loot table
  openingMethods: [
    { method: 'crowbar', time: 45, damageChance: 0.7 }, // 70% chance to damage contents
    { method: 'lockpick', time: 120, damageChance: 0.1 }, // 10% chance
    { method: 'professional', cost: 150, damageChance: 0 } // guaranteed safe open
  ],

  // Standard Properties
  weight: 65, // heavy, requires good equipment
  surfaceCondition: 'heavy_rust',
  baseValue: 200, // safe itself has value (collectors)
  refurbValue: 500, // restored safe is decorative item

  // Mystery Appeal
  description: 'A locked safe. What could be inside?',
  discoveryQuote: '"NO WAY. What are the odds? I need to get this open."'
}
```

**Loot Tables (Container Contents):**

Example: **Medium Safe Contents**

```javascript
lootTables.safe_medium: {
  rolls: [1, 3], // 1-3 items inside
  items: [
    { item: 'cash_small', weight: 30, quantity: [50, 200] }, // $50-200 cash
    { item: 'jewelry_ring', weight: 15, quantity: 1 },
    { item: 'jewelry_necklace', weight: 10, quantity: 1 },
    { item: 'documents', weight: 20, quantity: [1, 5] },
    { item: 'photos', weight: 15, quantity: [2, 10] },
    { item: 'empty', weight: 10 } // 10% chance safe is empty (tragedy/comedy)
  ]
}
```

**Container Opening Mechanics:**

**Option 1: Crowbar (On-Site)**

- Available immediately if player has crowbar tool
- Timed mini-game: tap rapidly to fill progress bar
- Durability vs progress race (bar depletes vs fills)
- Success: contents revealed, container destroyed
- Failure: container damaged, some contents lost (RNG)
- Time cost: ~45 seconds

**Option 2: Lockpick (On-Site or Shop)**

- Requires lockpick tool (crafted or purchased)
- Longer duration: ~2 minutes
- Higher success rate, preserves container value
- On-site: burns session time
- At shop: burns refurb time chunk
- Success: contents intact, container resellable

**Option 3: Professional Opening (Shop Service)**

- Pay shop NPC flat fee (varies by container difficulty)
- Instant reveal (no mini-game)
- Guaranteed success, no damage
- Expensive but safe choice
- Strategic: worth it for epic/legendary containers

**Strategic Container Decisions:**

| Scenario                           | Best Choice          | Reasoning                        |
| ---------------------------------- | -------------------- | -------------------------------- |
| Common safe, session time low      | Crowbar on-site      | Fast, container value low anyway |
| Rare chest, plenty of session time | Lockpick on-site     | Preserve value, no rush          |
| Epic safe, unknown contents        | Take to professional | High stakes, minimize risk       |
| Late in day, tired, valuable safe  | Professional         | Don't gamble when exhausted      |

#### Material Yield System

Items can be scrapped for materials used in crafting upgrades:

**Material Types:**

| Material           | Sources              | Rarity   | Used For                                  |
| ------------------ | -------------------- | -------- | ----------------------------------------- |
| Steel Scrap        | Bikes, tools, frames | Common   | Basic magnet upgrades, line reinforcement |
| Copper Wire        | Electronics, motors  | Uncommon | Advanced magnets, detector circuits       |
| Brass Components   | Locks, fixtures      | Uncommon | Lockpicking tools, precision parts        |
| Rare Earth Magnets | Industrial equipment | Rare     | High-tier magnet upgrades                 |
| Synthetic Fibers   | Modern items, ropes  | Common   | Line coating, winch cable                 |
| Wood (treated)     | Crates, furniture    | Common   | Winch frame, tool handles                 |

**Scrap Decision:**

```javascript
// Example item material yield
rustyBike: {
  sellValue: 45,
  materialYield: [
    { material: 'steel_scrap', amount: 3, value: 60 },
    { material: 'rubber', amount: 1, value: 15 }
  ]
}
// Player choice: Sell for 45 or scrap for materials worth 75 (but need materials for crafting)
```

#### Refurbishment System

Some items can be refurbished to increase value:

**Refurb Mechanics:**

- Costs time (burns refurb chunk in day cycle)
- Requires basic tools (unlocked early)
- Increases sell value significantly (2-4x multiplier)
- Some items cannot be refurbed (too damaged, modern electronics)
- Refurb quality affects final value (skill check or mini-game)

**Example Refurb Progression:**

```
Rusty Wrench:
  As-found: $15
  Light refurb (30 min): $35 (rust removal)
  Full refurb (60 min): $60 (rust removal, handle replacement, polish)
```

**Refurb Strategy:**

- High-value items: always refurb (maximize profit)
- Common trash: sell as-is (time not worth it)
- Material candidates: scrap instead of refurb (better yield)
- Collect items during week, refurb in batch on dedicated day

#### Collection Catalog

**Purpose:**

- Track all items discovered (Pokemon-style gotta-catch-em-all)
- Show silhouettes of undiscovered items (creates curiosity)
- Provide lore/descriptions for found items (narrative reward)
- Unlock rewards at milestones (new locations, equipment, story beats)

**Catalog Structure:**

```javascript
catalogEntry: {
  itemId: 'rusty_bike_01',
  discovered: true,
  discoveryDate: '2025-01-18T14:32:00Z',
  timesFound: 3,
  bestCondition: 'worn', // tracks best version found
  variants: ['rusty_bike_01', 'rusty_bike_02'], // color/style variants
  loreUnlocked: true
}
```

**Catalog Categories:**

- Trash (30 items)
- Tools (25 items)
- Vehicle Parts (20 items)
- Electronics (15 items)
- Historical Artifacts (20 items)
- Containers (10 items)
- Curiosities (15 items)
  **Total: ~135 unique items for MVP**

**Milestone Rewards:**

| Milestone | Reward                | Mechanical Benefit             |
| --------- | --------------------- | ------------------------------ |
| 10 items  | Lockpick tool         | Can open basic containers      |
| 25 items  | New location unlock   | Access to "Sewage Works"       |
| 50 items  | Detector upgrade      | Shows "hot" quadrants          |
| 75 items  | New location unlock   | Access to "Industrial Runoff"  |
| 100 items | Professional contacts | Discounted container opening   |
| All items | Legendary magnet      | Access to "deepest" depth zone |

#### Item Balance & Tuning

**Weight Distribution:**

- 60% light (0-10kg) - easy to retrieve, low value
- 25% medium (10-30kg) - moderate challenge, decent value
- 12% heavy (30-60kg) - difficult, high value
- 3% very heavy (60-100kg+) - requires upgrades, jackpot value

**Value Distribution:**

- 50% low ($5-30) - trash, common items
- 30% medium ($30-100) - useful items, uncommon
- 15% high ($100-400) - rare finds
- 4% very high ($400-1500) - epic items
- 1% jackpot ($1500+) - legendary finds, safe contents

**Spawn Rate Tuning:**
Goal: Player finds something interesting every 3-5 casts on average

```
Per cast probability:
- Trash (boring): 40%
- Common useful: 35%
- Uncommon interesting: 15%
- Rare exciting: 8%
- Epic/legendary: 2%
```

#### Open Questions:

- **Q16:** Should items have condition variations (pristine/worn/corroded) as separate catalog entries or single entry with "best condition" tracker?
- **Q17:** For containers: should contents be rolled at moment of discovery (fixed) or at moment of opening (player can save-scum)?
- **Q18:** Should there be "cursed" or "haunted" items with special negative events (for narrative flavor/humor)?
- **Q19:** How many total unique items for full game? MVP target is ~135, but should we plan for 200+ eventually?

---

### 6. Location System

**Overview:**
Locations are thematic fishing spots, each with unique spawn tables, visual aesthetics, events, and progression requirements. Locations are NOT geographically simulated in MVP - they're discrete themed experiences.

#### Location Structure

```javascript
{
  id: 'castle_moat',
  name: 'Thornbury Castle Moat',

  // Access Requirements
  unlocked: true, // starts unlocked or requires catalog milestone
  unlockCondition: null, // e.g., '25_items_discovered'

  // Visual Theme
  environmentType: 'historic',
  visualTheme: {
    waterColor: '#4A5D4F', // murky green
    skyColor: '#C8D8E4', // overcast
    ambientParticles: 'leaves', // falling leaves
    backgroundLayers: ['castle_wall', 'trees', 'bridge']
  },

  // Spawn Configuration
  depthZones: ['shallow', 'medium'], // no deep zone
  quadrantConfig: {
    q0: { depth: 'shallow', spawnModifier: 1.2 }, // edge slightly better
    q1_q3: { depth: 'shallow', spawnModifier: 1.0 },
    q4_q6: { depth: 'medium', spawnModifier: 0.9 },
    q7_q9: { depth: null, inaccessible: true } // moat not deep enough
  },

  // Spawn Tables (per category weights)
  spawnTables: {
    trash: { weight: 20, items: ['glass_bottle', 'modern_litter'] },
    tools: { weight: 10, items: ['medieval_tools'] },
    historical: { weight: 40, items: ['medieval_coins', 'sword_fragments', 'armor_pieces'] },
    containers: { weight: 5, items: ['wooden_chest', 'iron_lockbox'] },
    curiosities: { weight: 25, items: ['pottery', 'decorative_items'] }
  },

  // Event Configuration
  eventTables: {
    snagRate: 0.12, // 12% per 5m (lower than industrial)
    onlookerRate: 0.25, // 25% per session (tourist destination)
    policeRate: 0.05, // low security presence
    wildlifeRate: 0.15, // ducks, swans
    specialEvents: ['tourist_asks_about_castle', 'swan_attack']
  },

  // Mechanical Properties
  currentStrength: 'low', // affects drag difficulty
  visibility: 'medium', // affects visual feedback underwater
  noiseRestrictions: 'moderate', // powered winch attracts attention

  // Narrative Properties
  description: 'A medieval moat surrounding a restored castle. Popular with tourists.',
  lore: 'Thornbury Castle dates to 1511. The moat has been dredged several times, but centuries of history remain.',
  discoveryQuote: '"Medieval stuff in here for sure. Wonder what stories these items could tell..."'
}
```

#### MVP Location Roster

**Starting Locations (Unlocked):**

**1. Picturesque River** (Tutorial/Easy)

- **Theme:** Peaceful countryside, recreational
- **Depth:** Shallow, Medium
- **Spawn Focus:** Mixed common items, low trash ratio
- **Events:** Wildlife (ducks, fish jumping), occasional jogger
- **Difficulty:** Easy (low current, clear water, low snag rate)
- **Purpose:** Learning location, safe experimentation

**2. City River** (Moderate)

- **Theme:** Urban waterway through downtown
- **Depth:** Shallow, Medium, Deep (near bridge)
- **Spawn Focus:** Modern items, shopping trolleys, phones, safes (crime-related)
- **Events:** Onlookers frequent, police at night, homeless person chat
- **Difficulty:** Moderate (moderate current, murky water, medium snag rate)
- **Purpose:** Volume fishing, safe hunting, urban variety

**Unlockable Locations:**

**3. Castle Moat** (Historical, unlock at 10 items)

- **Theme:** Medieval historic site, tourist destination
- **Depth:** Shallow, Medium (no deep)
- **Spawn Focus:** Historical artifacts, medieval items, pottery
- **Events:** Tourists asking questions, swan encounters, guided tours passing
- **Difficulty:** Easy-Moderate (still water, clear, low snag rate)
- **Purpose:** Historical collection progress, narrative lore

**4. Industrial Canal** (Heavy, unlock at 25 items)

- **Theme:** Abandoned factory district, polluted water
- **Depth:** Medium, Deep
- **Spawn Focus:** Heavy machinery, tools, industrial waste, large containers
- **Events:** Hazmat warnings, structural collapses, vagrant encounters
- **Difficulty:** Hard (strong current, zero visibility, high snag rate, sludge)
- **Purpose:** Heavy item farming, material collection, challenge

**5. Sewage Works** (Gross/Valuable, unlock at 40 items)

- **Theme:** Water treatment outflow, aesthetically unpleasant
- **Depth:** Medium, Deep
- **Spawn Focus:** Jewelry (lost down drains), valuables, phones, mechanical parts
- **Events:** Health warnings, smell complaints, worker interruptions
- **Difficulty:** Hard (extreme sludge, high slip rate, contamination)
- **Purpose:** High-value small items, jewelry collection

**6. Nature Reserve** (Pristine, unlock at 60 items)

- **Theme:** Protected wetland, ecological sensitivity
- **Depth:** Shallow, Medium
- **Spawn Focus:** Natural curiosities, low trash (protected), rare wildlife items
- **Events:** Ranger patrols, wildlife photography, ecological observations
- **Difficulty:** Moderate (restricted noise, time limits, careful play required)
- **Purpose:** Unique curiosities, peaceful experience, ecological theme

#### Location-Specific Mechanics

**Industrial Canal - Winch Advantage:**

- Heavy items common (engines, safes, machinery)
- Manual retrieval nearly impossible for best finds
- Winch becomes essential equipment
- Location teaches: proper gear for proper job

**Sewage Works - Risk/Reward:**

- Extreme sludge coating (4.0x slip rate)
- High-value small items (jewelry)
- Trade-off: disgusting but profitable
- Introduces contamination event (cosmetic, player disgust)

**Castle Moat - Historical Narrative:**

- Items come with extended lore (mini-stories)
- NPC interactions provide context (tour guide, historian)
- Catalog completion unlocks castle backstory
- Lower mechanical challenge, higher narrative reward

**City River - Safe Hunting:**

- Highest safe spawn rate (organized crime connections)
- Night fishing increases safe odds but also police risk
- Balance: when to risk night session for better spawns

#### Location Progression Path

**Progression Arc:**

1. **Picturesque River:** Learn mechanics, build confidence
2. **City River:** Experience variety, discover first safe (hook moment)
3. **Castle Moat:** Unlock (10 items), explore historical theme
4. **Industrial Canal:** Unlock (25 items), challenge difficulty spike, upgrade equipment
5. **Sewage Works:** Unlock (40 items), risk/reward mastery
6. **Nature Reserve:** Unlock (60 items), completionist content

#### Location Selection UI

**Interface Elements:**

- Map view (abstract, not geographic simulation)
- Location cards with:
  - Name and theme description
  - Depth zones available
  - Difficulty rating (1-5 stars)
  - "Last visited" timestamp
  - Quadrant depletion preview (if implemented)
  - Expected item categories (icons)
  - Lock icon if not yet unlocked
- Filter by: difficulty, theme, available depths, unlock status

**Strategic Location Choice:**

- Early game: rotate between Picturesque and City for variety
- Mid game: Industrial for heavy items, Castle for historical completion
- Late game: Sewage for high-value farming, Nature Reserve for completionism

#### Open Questions:

- **Q20:** Should location depletion be global (affects all players) or per-save (individual progression)? Global creates FOMO, individual creates control.
- **Q21:** Should locations have time-of-day restrictions (e.g., Castle Moat closes at night)? Adds realism but limits player freedom.
- **Q22:** How many total locations for full game? MVP targets 6, but should we plan for 10-12 eventually?
- **Q23:** Should we include "secret" locations unlocked by finding specific items (e.g., find ancient key → unlock crypt entrance)?

---

### 7. Equipment & Progression Systems

**Overview:**
Player starts with basic equipment and upgrades over time to access deeper zones, heavier items, and reduce failure rates. Progression gated by crafting materials + cash, not just cash (prevents rushing).

#### Starting Equipment

```javascript
startingGear: {
  magnet: {
    name: 'Basic Neodymium Magnet',
    strength: 25, // kg pulling force
    shape: 'disc',
    slipResistance: 1.0, // baseline, no bonus
    cost: 0 // starter gear
  },
  line: {
    name: 'Nylon Rope',
    length: 10, // meters, determines accessible quadrants
    strength: 30, // kg breaking strength
    slipRate: 1.0, // baseline
    cost: 0
  },
  winch: null, // no winch at start, manual only
  tools: ['basic_gloves'], // quality of life, no mechanical benefit
  detectors: [] // no detection equipment initially
}
```

#### Magnet Progression

**Upgrade Path:**

| Tier      | Name                 | Strength | Shape     | Slip Resistance       | Cost  | Materials Required                                |
| --------- | -------------------- | -------- | --------- | --------------------- | ----- | ------------------------------------------------- |
| 1 (Start) | Basic Disc           | 25kg     | Disc      | 1.0x                  | $0    | N/A                                               |
| 2         | Reinforced Disc      | 50kg     | Disc      | 1.0x                  | $150  | 5x Steel Scrap                                    |
| 3         | Heavy Bar            | 75kg     | Bar       | 0.95x                 | $400  | 3x Rare Earth, 10x Steel                          |
| 4         | Industrial Horseshoe | 120kg    | Horseshoe | 0.9x                  | $900  | 5x Rare Earth, 15x Steel                          |
| 5         | Textured Disc        | 150kg    | Disc      | 0.8x                  | $1800 | 8x Rare Earth, 20x Steel, 5x Brass                |
| 6 (Late)  | Electromagnet        | 250kg    | Disc      | 0.7x + active control | $5000 | 12x Rare Earth, 10x Copper Wire, Advanced Circuit |

**Magnet Shape Effects:**

- **Disc:** Broad surface contact, good for flat objects (safes, panels), balanced
- **Bar:** Narrow contact, precise targeting, good for small items, higher slip risk on large items
- **Horseshoe:** Wide grab area, good for odd shapes (bikes, frames), moderate slip

**Strategic Magnet Choice:**

- City River (safes): Disc magnet optimal
- Industrial Canal (frames, engines): Horseshoe optimal
- Castle Moat (small artifacts): Bar magnet optimal
- Sewage Works (jewelry): Bar magnet for precision

**Slip Resistance Bonus:**

- Baseline magnets: 1.0x slip rate (no reduction)
- Textured surface magnets: 0.8x slip rate (20% slower slip build)
- Electromagnet: 0.7x slip rate + can "pulse" to partially reset slip (advanced mechanic)

#### Line Progression

**Upgrade Path:**

| Tier      | Name                | Length | Strength | Slip Rate | Cost  | Materials                                        |
| --------- | ------------------- | ------ | -------- | --------- | ----- | ------------------------------------------------ |
| 1 (Start) | Nylon Rope          | 10m    | 30kg     | 1.0x      | $0    | N/A                                              |
| 2         | Reinforced Rope     | 15m    | 60kg     | 0.95x     | $200  | 8x Synthetic Fiber                               |
| 3         | Steel Cable (Thin)  | 20m    | 100kg    | 1.0x      | $500  | 12x Steel Scrap, 5x Copper Wire                  |
| 4         | Steel Cable (Heavy) | 25m    | 180kg    | 1.0x      | $1200 | 20x Steel Scrap, 10x Copper                      |
| 5 (Late)  | Coated Cable        | 30m    | 250kg    | 0.85x     | $3000 | 15x Synthetic Fiber, 25x Steel, Advanced Coating |

**Length Determines Accessible Quadrants:**

- 10m: Q0-Q3 (edge + near zones)
- 15m: Q0-Q6 (+ mid zones)
- 20m+: Q0-Q9 (+ far zones, full access)

**Strength Determines Snap Risk:**

- If item weight + tension > line strength: snap risk
- Margin of safety: 2x item weight recommended
- Example: 60kg line safely handles 30kg items at high tension

**Slip Rate Modifier:**

- Coated cables reduce friction during drag
- Less slip accumulation during horizontal phase
- Premium upgrade (expensive, late-game)

#### Winch Progression

**Upgrade Path:**

| Tier         | Name              | Type       | Power     | Slip Reduction | Cost  | Materials                                   |
| ------------ | ----------------- | ---------- | --------- | -------------- | ----- | ------------------------------------------- |
| 0 (Start)    | None              | Manual     | N/A       | N/A            | $0    | N/A                                         |
| 1            | Portable Ratchet  | Hand-crank | Low       | 20%            | $600  | 10x Steel, 5x Brass, 8x Synthetic           |
| 2            | Electric Portable | Battery    | Medium    | 35%            | $1500 | 15x Steel, 8x Copper, Battery Pack          |
| 3 (Location) | Mountable Winch   | Wall-mount | High      | 50%            | $3500 | 25x Steel, 15x Copper, Motor Assembly       |
| 4 (Late)     | Powered Winch     | Industrial | Very High | 65%            | $8000 | 40x Steel, 20x Rare Earth, Industrial Motor |

**Winch Types:**

**Portable Ratchet:**

- Hand-crank mechanism
- Slower retrieve (0.6x speed)
- Reduces slip by 20% (consistent pull force)
- Noise: moderate (clicking sound)
- Can use anywhere

**Electric Portable:**

- Battery-powered, rechargeable (no in-game battery mechanic for MVP)
- Normal retrieve speed (1.0x)
- Reduces slip by 35%
- Noise: high (motor hum)
- Can use anywhere

**Mountable Winch:**

- Requires location with mounting points (Industrial, City River docks)
- Fast retrieve (1.5x speed)
- Reduces slip by 50%
- Noise: very high (industrial sounds)
- Location-restricted

**Powered Winch:**

- Late-game unlock, very expensive
- Very fast retrieve (2.0x speed)
- Reduces slip by 65%
- Can pull items beyond manual capacity (60kg+)
- Noise: extreme (attracts events)
- Location-restricted

**Winch Trade-off:**

- **Advantage:** Reduces slip (consistent force), enables heavy items
- **Disadvantage:** Loss of tension feedback (can't "feel" item), noise attracts attention, expensive

#### Tool & Detector Progression

**Tools (Utility):**

| Tool         | Purpose                          | Cost | Materials              | Unlock Condition    |
| ------------ | -------------------------------- | ---- | ---------------------- | ------------------- |
| Basic Gloves | Starting gear (cosmetic)         | $0   | N/A                    | Start               |
| Crowbar      | Open containers (on-site)        | $100 | 5x Steel               | Shop available      |
| Lockpick Set | Open containers (preserve value) | $400 | 8x Brass, 3x Steel     | 25 items discovered |
| Bolt Cutters | Open padlocks quickly            | $250 | 10x Steel, 5x Copper   | Shop available      |
| Refurb Kit   | Enables item refurbishment       | $300 | 8x Steel, 5x Synthetic | 15 items discovered |

**Detectors (Information):**

| Detector       | Function                                   | Cost  | Materials                                    | Unlock Condition |
| -------------- | ------------------------------------------ | ----- | -------------------------------------------- | ---------------- |
| Basic Sonar    | Shows depth profile of quadrant            | $800  | 10x Copper, 5x Electronics                   | 30 items         |
| Item Detector  | Hints if item present in quadrant (binary) | $1500 | 15x Copper, 10x Electronics, Circuit         | 50 items         |
| Rarity Scanner | Shows estimated rarity if item present     | $3500 | 20x Copper, 15x Rare Earth, Advanced Circuit | 75 items         |

**Strategic Detector Use:**

- Early game: Blind fishing, accept randomness
- Mid game: Basic sonar helps choose quadrants efficiently
- Late game: Rarity scanner enables targeted rare item hunting

#### Crafting System

**Crafting Bench (Shop):**

- Unlocked early (after 5 items discovered)
- Requires materials + cash
- Crafting time: instant (no mini-game for MVP)
- Preview required materials before starting

**Material Sources:**

- Scrapping found items
- Buying from shop (expensive, emergency option)
- Special locations (Industrial Canal high steel yield)

**Crafting UI:**

- Shows upgrade tree (visual progression path)
- Highlights next available upgrade
- Displays owned materials vs required
- Shows stat improvements (before/after comparison)

**Example Crafting Flow:**

```
Player wants: Reinforced Disc Magnet (Tier 2)
Requires: 5x Steel Scrap + $150

Check inventory:
- Steel Scrap: 3/5 (need 2 more)
- Cash: $200 (sufficient)

Options:
1. Scrap 1 rusty bike (yields 3 steel) → craft immediately
2. Fish Industrial Canal for more steel items
3. Buy steel from shop ($30 each, $60 total) → craft immediately

Player chooses option 1:
- Scrap bike (lose bike, gain 3 steel)
- Craft upgrade (spend 5 steel + $150)
- Equip new magnet (can now pull 50kg items)
```

#### Progression Pacing

**Early Game (0-25 items discovered):**

- Focus: Learn mechanics, volume fishing, build cash
- Upgrades: Line to 15m (access mid quadrants), Reinforced Magnet
- Locations: Picturesque, City River
- Bottleneck: Cash (not many materials needed yet)

**Mid Game (25-60 items):**

- Focus: Location variety, heavier items, container hunting
- Upgrades: Heavy Bar Magnet, Steel Cable 20m, Portable Ratchet
- Locations: Castle Moat, Industrial Canal, Sewage Works
- Bottleneck: Materials (Rare Earth Magnets become critical)

**Late Game (60-100+ items):**

- Focus: Collection completion, legendary finds, optimization
- Upgrades: Electromagnet, Coated Cable, Powered Winch
- Locations: All unlocked, strategic choice per session
- Bottleneck: Rare materials (Advanced Circuits, Industrial Motors)

**Endgame (Collection complete):**

- Focus: Perfect efficiency, speed runs, experimental builds
- Upgrades: Fully maxed gear
- Locations: Free choice, aesthetic preference
- Goal: Optimize session value ($/10min), complete all variants

#### Open Questions:

- **Q24:** Should electromagnet have active control (player can pulse to reset slip partially) or just passive bonus (lower slip rate)? Active adds complexity.
- **Q25:** Should there be cosmetic customization (magnet paint, line colors) or purely functional upgrades?
- **Q26:** For winches: should battery life be a mechanic (electric winch requires recharge), or abstract it away for simplicity?
- **Q27:** Should some upgrades be mutually exclusive (e.g., can only equip one detector at a time) to force strategic choice?

---

### 8. Time Management & Day Cycle

**Overview:**
Player owns a quirky pawn shop and must balance time between fishing (acquiring inventory), running shop (generating income), refurbishing items (increasing value), and sleep (required for health).

#### Day Structure

**24-Hour Cycle Split into 4× 6-Hour Chunks:**

| Chunk     | Time Range    | Available Activities                   | Restrictions                   |
| --------- | ------------- | -------------------------------------- | ------------------------------ |
| Morning   | 06:00 - 12:00 | Shop, Fishing, Refurb                  | Cannot sleep (day hours)       |
| Afternoon | 12:00 - 18:00 | Shop, Fishing, Refurb                  | Cannot sleep (day hours)       |
| Evening   | 18:00 - 00:00 | Shop (limited), Fishing, Refurb, Sleep | Shop closes early (20:00)      |
| Night     | 00:00 - 06:00 | Fishing, Sleep                         | Shop closed, limited locations |

**Chunk Allocation Rules:**

- Must allocate all 4 chunks before day starts (planning phase)
- **Must sleep at least 1 chunk per day** (hard requirement)
- Can change plan mid-day at cost (lose current chunk progress, restart)
- Unused chunks: not possible, all 4 must be assigned

#### Activity Breakdown

**Fishing Session (1 chunk = 10 minutes real-time gameplay):**

- Choose location
- 10-minute timer (as discussed in mechanics)
- Return with inventory of items
- Items automatically transferred to shop storage
- Can fish multiple chunks consecutively (different locations or same)

**Shop Operation (1 chunk):**

- Shop opens to NPC customers (automated, not manual transactions for MVP)
- Items in "for sale" inventory get purchased by NPCs
- Customer flow: morning/afternoon = high traffic, evening = moderate
- Revenue generated based on:
  - Item value
  - Item condition (refurbed items sell faster/higher)
  - Shop reputation (unlocked through progression)
- Player can:
  - Set items for sale vs hold for refurb/scrap
  - Adjust prices (basic slider: low/fair/high)
  - Interact with special customers (story events)

**Refurbishment (1 chunk):**

- Choose items from inventory to refurb
- Each item has refurb time cost (15-60 minutes)
- Multiple items can be processed in one chunk (queue system)
- Quality mini-game (optional for MVP):
  - Simple: automatic refurb, standard quality
  - Advanced: timed mini-game, better quality result
- Refurbed items moved to "for sale" inventory

**Sleep (1 chunk minimum required):**

- Restores energy (cosmetic, no mechanical fatigue system for MVP)
- Advances day to next chunk
- Cannot skip, must sleep once per day
- If neglected: negative events increase (oversleeping, missed opportunities)

#### Chunk Timing & Continuity

**Session Timer Overflow:**
As discussed in mechanics section:

- Fishing session timer expires during retrieve
- Player chooses to continue (overtime)
- **Current chunk extends until retrieve completes**
- Example:
  - Chunk ends at 12:00
  - Retrieve takes 3 more minutes
  - Next chunk starts at 12:03 (real time: 06:03)

**Cascading Effects (Future Scope, note for later):**

- Shop chunk starts late → fewer customers
- Refurb chunk starts late → fewer items processable
- Sleep chunk starts late → energy penalty next day

**For MVP:** No cascading effects, just delayed start time.

#### Strategic Planning

**Daily Planning Phase:**
Before day starts, player reviews:

- Current cash reserves
- Inventory (items to sell, items to refurb)
- Material needs (for crafting)
- Location goals (which items to hunt)

**Example Day Plans:**

**Early Game (Building Cash):**

- Morning: Fishing (Picturesque River, volume)
- Afternoon: Shop (sell common finds)
- Evening: Fishing (City River, safe hunt)
- Night: Sleep

**Mid Game (Material Farming):**

- Morning: Fishing (Industrial Canal, steel farming)
- Afternoon: Refurb (process valuable finds)
- Evening: Shop (sell refurbed items)
- Night: Sleep

**Late Game (Targeted Hunting):**

- Morning: Fishing (Sewage Works, jewelry hunt)
- Afternoon: Fishing (Castle Moat, historical completion)
- Evening: Refurb (high-value items only)
- Night: Sleep

**Binge Fishing Day:**

- Morning: Fishing (Location A)
- Afternoon: Fishing (Location B)
- Evening: Fishing (Location C)
- Night: Sleep
- Result: 3 sessions worth of items, no revenue until next day

**Recovery Day:**

- Morning: Refurb (process backlog)
- Afternoon: Shop (clear inventory)
- Evening: Refurb (finish queue)
- Night: Sleep
- Result: Convert accumulated items to cash, no new finds

#### Economic Pressure

**Shop Overhead Costs:**

- Rent: $300/week (due every 7 days)
- Utilities: $50/week
- Tool maintenance: $30/week
- **Total fixed costs: $380/week**

**Revenue Requirements:**

- Week 1 (starter gear): Need ~$500/week to break even + save
- Week 5 (mid-game): Need ~$1200/week to afford upgrades + costs
- Week 10+ (late-game): Need ~$3000/week for expensive upgrades

**Pressure Points:**

- Early game: Struggle to make rent, forces efficient fishing
- Mid game: Balance fishing vs shop vs refurb for optimal revenue
- Late game: Cash flow stable, focus shifts to collection completion

**Failure State (Optional for MVP):**

- Miss rent payment: reputation penalty, warning
- Miss 2 consecutive payments: shop closes temporarily (lose 1 week)
- Miss 3 payments: game over (harsh), OR loan shark appears (softer, story beat)

**For MVP:** Rent is cosmetic pressure (not enforced), just reminder UI

#### Night Fishing Special Rules

**Night Sessions (00:00 - 06:00):**

- Limited locations: City River, Industrial Canal only
- Increased rare item spawn (+10% rare, +5% epic)
- Increased police/security encounter chance
- Noise equipment (powered winch) = guaranteed encounter
- Visual: darker palette, limited visibility (affects underwater phase)

**Night Strategy:**

- Risk/reward: better spawns, higher interference
- Safes more common (crime activity narrative)
- Requires confidence (can handle police encounters)
- Quiet gear recommended (manual or ratchet only)

#### Time Management Mastery

**Efficiency Metrics (Endgame Optimization):**

- Revenue per chunk ($/chunk)
- Items per fishing session (volume)
- Refurb queue throughput (items/chunk)
- Material yield per session (steel/chunk, etc.)

**Optimal Strategies Emerge:**

- Binge fish on high-value locations, refurb batch, shop batch
- Target night fishing for rare hunting (accept encounter cost)
- Use shop chunks for passive income, focus time on fishing
- Late game: minimize shop chunks (automation upgrades)

#### Shop Interface (Brief)

**For MVP (Simplified):**

- List of items in storage
- Toggle: For Sale / Hold (for refurb/scrap)
- Price slider (auto, fair, premium)
- Start shop chunk → automated sales → revenue summary at end

**Future (More Depth):**

- Customer interactions (dialogue, negotiation)
- Special orders (hunt specific item for NPC)
- Shop decoration (cosmetic upgrades)
- Reputation system (better customers, higher prices)

#### Open Questions:

- **Q28:** Should sleep be flexible (can sleep during any chunk, not just night), or realistic (only evening/night)?
- **Q29:** For shop operation: should it be fully automated (press button, get revenue), or require light management (choose which items to display)?
- **Q30:** Should there be a "fast forward" option to skip shop/refurb chunks for players who just want to fish?
- **Q31:** How punishing should rent pressure be? Strictly enforced vs soft reminder?

---

### 9. Audio Design

**Overview:**
Audio is critical for game feel. Combination of procedural audio (Tone.js) for dynamic tension and sample playback (Howler.js) for discrete events.

#### Audio Categories

**1. UI Sounds (Howler.js samples):**

- Button clicks (menu navigation)
- Location selection confirm
- Item added to inventory (soft chime)
- Upgrade crafted (success fanfare)
- Money received (cash register ding)
- Catalog entry filled (satisfying pop)

**2. Environmental Ambience (Tone.js synthesis):**

- Water sounds (filtered noise, varies by location)
  - Picturesque River: gentle babbling
  - City River: urban water, muffled traffic
  - Industrial Canal: echoey, mechanical hums
  - Sewage Works: unsettling drips, bubbling
- Wind (subtle, location-specific)
- Time-of-day shifts (night = quieter, crickets)

**3. Interaction Feedback (Hybrid):**

**Casting:**

- Throw whoosh (Howler sample)
- Magnet settle splash (Howler sample)
- Ripples (Tone.js filtered decay)

**Horizontal Drag:**

- Water drag (Tone.js filtered noise, pitch follows speed)
- Tension build (Tone.js rising pitch drone)
- Snag impact (Howler sample: metal clunk)
- Line strain (Tone.js creaking, pitch follows tension)

**Lift Phase:**

- Underwater ambience (Tone.js muffled low-pass filter)
- Tap response (Howler sample: muted splash per tap)
- Rising pitch (Tone.js, ascending frequency as depth decreases)
- Weight groans (Tone.js, modulated by tap frequency)

**Surface Break:**

- Splash (Howler sample)
- Item reveal chime (Howler sample, pitch varies by rarity):
  - Common: single note (C)
  - Uncommon: major third (C-E)
  - Rare: major chord (C-E-G)
  - Epic: arpeggiated major 7th
  - Legendary: full melodic phrase
- Water drainage (Howler sample for containers)

**Slip Warnings:**

- 50-80% slip: Tone.js low hum (slowly intensifies)
- 80-95% slip: Tone.js urgent beeping (frequency increases)
- 95-99% slip: Tone.js alarm (rapid beeping)
- 100% slip (failure): Howler sample (magnet pop, disappointed tone)

**Events:**

- Snag detected: Howler sample (scrape, thud)
- Current surge: Tone.js water rush (sudden volume swell)
- Onlooker interrupt: Howler sample (footsteps, voice mumble)
- Police encounter: Howler sample (radio static, authority voice)

**4. Procedural Tension System (Tone.js):**

**Dynamic Tension Drone:**
During horizontal drag and blind lift, continuous drone responds to game state:

```javascript
// Pseudo-code for tension drone
const drone = new Tone.Synth({
  oscillator: { type: "sawtooth" },
  envelope: { attack: 0.1, sustain: 0.9, release: 0.5 },
});

// Update frequency based on tension + slip
function updateDrone(tension, slipPercent) {
  const baseFreq = 80; // low bass
  const tensionMod = tension * 2; // 0-200 Hz range
  const slipMod = slipPercent * 1.5; // adds urgency
  const targetFreq = baseFreq + tensionMod + slipMod;

  drone.frequency.rampTo(targetFreq, 0.1); // smooth transition
}
```

**Effect:** As player increases tension and slip accumulates, drone pitch rises → subconscious anxiety builds → encourages careful play

**During Revealed Lift:**
Drone continues but also triggers:

- Slip meter in yellow (50-80%): add harmonic overtone (warning)
- Slip meter in red (80-95%): add dissonant interval (danger)
- Slip meter critical (95%+): aggressive beeping overrides drone

#### Audio-Visual Sync

**Critical Sync Points:**

- Tap input → splash sound (<50ms latency)
- Surface break → chime + visual reveal (synchronized exactly)
- Magnet pop-off → sound + visual separation (<30ms)
- Snag event → audio cue + UI prompt (simultaneous)

**Performance:**

- Use Howler.js sprite sheets (combine small samples)
- Pre-load all samples at location load (no mid-session loading)
- Tone.js polyphony: max 5 simultaneous synths (keep CPU usage low)
- Fallback: disable procedural audio on low-end devices, keep samples only

#### Audio Settings (Accessibility)

**Player Options:**

- Master volume (0-100%)
- Music volume (future: ambient music layer)
- SFX volume (Howler samples)
- Ambience volume (Tone.js environmental)
- Tension drone toggle (on/off, for players who find it stressful)

**Presets:**

- Full Experience (all audio)
- Minimal (samples only, no ambience/drone)
- Silent (mute all, for accessibility)

#### Open Questions:

- **Q32:** Should there be a music layer (ambient background music) separate from environmental sounds, or keep it purely diegetic?
- **Q33:** For the tension drone: should it be subtle (barely noticeable) or prominent (clear gameplay feedback)?
- **Q34:** Should rare item reveal chimes be unique melodies (composable, memorable) or just pitch variations (simpler)?
- **Q35:** Should audio design include haptic feedback on mobile (vibration for tension, slip, events)?

---

### 10. Visual Design & UI/UX

**Overview:**
Consistent experience across device sizes (iPad, desktop, phones). Visual style undecided (pixel art vs vector illustration) but must support scaling items gracefully and clear silhouettes for collection catalog.

#### Responsive Design Constraints

**Key Principle:** Same experience, scaled proportionally - NOT "more content on larger screens"

**Device Support:**

- Desktop: 1920x1080 baseline, scales up to 4K
- iPad: 2388x1668 (landscape), 1668x2388 (portrait)
- iPhone: 1170x2532 (portrait), 2532x1170 (landscape)

**Orientation Handling:**

**Landscape (Primary):**

- Left: Casting view (PixiJS canvas, 60% width)
- Right: UI panels (inventory, timer, controls, 40% width)
- Bottom: Tension bar, slip meter (full width when active)

**Portrait (Secondary, phones):**

- Top: UI panels (inventory, timer, 30% height)
- Middle: Casting view (PixiJS canvas, 50% height)
- Bottom: Controls + meters (20% height)

**Scaling Strategy:**

- UI elements: EM units (scale with base font size)
- PixiJS canvas: Render at logical resolution, scale to viewport
- Touch targets: Minimum 44x44pt (iOS guidelines)
- Font size: Adjust base size per device class, keep ratios

#### Visual Style (To Be Determined)

**Criteria for Style Choice:**

1. Must support clear item identification at multiple scales
2. Silhouettes must be recognizable (catalog system)
3. Must convey item condition (clean vs rusty vs sludge)
4. Achievable within your skill level (solo dev)
5. Performs well (lots of sprites on screen)

**Option A: Vector Illustration (Recommended)**

- **Tools:** Figma/Illustrator (your existing workflow)
- **Style:** High-contrast, bold outlines, limited palette
- **Reference:** Risk of Rain 2 item art, Hades boon icons
- **Pros:**
  - Scales infinitely (no pixelation)
  - Clear silhouettes
  - Overlay system for wear/rust (multiply blend modes)
  - Familiar tools
- **Cons:**
  - Requires illustration skill
  - More time per item than pixel art (maybe)

**Option B: Chunky Pixel Art**

- **Tools:** Aseprite, Pixaki
- **Style:** Large pixels (8x8 or 16x16 base), limited palette
- **Reference:** Dead Cells, Celeste, Stardew Valley
- **Pros:**
  - Scales cleanly (nearest-neighbor)
  - Faster to produce (grids constrain decisions)
  - Nostalgic aesthetic appeal
- **Cons:**
  - Limited detail (may not convey condition well)
  - Learning curve if you're not experienced

**Recommendation:** Prototype with vector illustration (Figma mockups) → see if it feels right → commit to full style guide

#### Core UI Screens

**1. Main Menu:**

- Logo/title
- Start Game / Continue
- Settings
- Collection Catalog
- Quit

**2. Day Planning Screen:**

- 4 chunk slots (visual timeline)
- Activity selection (Fishing / Shop / Refurb / Sleep)
- Location selection (for fishing chunks)
- Summary: expected costs, current cash, warnings (no sleep selected)

**3. Location Selection:**

- Map view (abstract, not geographic)
- Location cards with:
  - Name, theme description
  - Depth zones (icons: shallow/medium/deep)
  - Difficulty rating (stars: 1-5)
  - Spawn hints (category icons)
  - Lock icon if not unlocked
  - "Last visited" timestamp
- Filter/sort options (difficulty, theme, unlock status)

**4. Fishing Interface (Main Gameplay):**

**Landscape Layout:**

```
┌─────────────────────────────────────┬────────────────────┐
│                                     │ Timer: 8:34        │
│                                     ├────────────────────┤
│         Casting View (PixiJS)       │ Session Inventory: │
│         - Top-down river            │ - Rusty Bike       │
│         - Quadrant overlays         │ - Wrench Set       │
│         - Item animation            │ - Glass Bottle     │
│                                     ├────────────────────┤
│                                     │ Current Catch:     │
│                                     │ [Item preview]     │
│                                     │ "Dragging..."      │
├─────────────────────────────────────┴────────────────────┤
│ Tension Bar: [████████░░░░░░░░░░] Hold to Pull          │
└──────────────────────────────────────────────────────────┘
```

**Portrait Layout:**

```
┌──────────────────────────────────────┐
│ Timer: 8:34  Inventory: 3 items      │
├──────────────────────────────────────┤
│                                      │
│        Casting View (PixiJS)         │
│        - Top-down river              │
│        - Quadrants                   │
│                                      │
├──────────────────────────────────────┤
│ Tension Bar: [████░░░░] Hold        │
├──────────────────────────────────────┤
│ Current Catch: Rusty Bike            │
│ [Visual preview]                     │
└──────────────────────────────────────┘
```

**5. Reveal Screen (After Successful Retrieve):**

- Item sprite (large, centered)
- Item name + rarity border (color-coded)
- Condition indicator (pristine/worn/corroded)
- Value estimate ($)
- Weight (kg)
- Description text (lore)
- Buttons:
  - Keep (add to inventory)
  - Drop (discard, save time - edge case)
  - Inspect (open catalog entry)

**6. Collection Catalog:**

- Grid layout (6x8 grid = 48 items per page)
- Each cell:
  - Discovered: Full sprite + name
  - Undiscovered: Silhouette + "???"
- Filter by category (Tools, Vehicles, Historical, etc.)
- Sort by: discovery date, rarity, value
- Progress bar: "73/135 discovered"
- Milestone indicators (next unlock at 75 items)

**7. Shop Interface:**

- Inventory list (items in storage)
- Per item:
  - Sprite (small)
  - Name, condition, value
  - Toggle: [For Sale] / [Hold]
  - Price slider (if for sale): Low / Fair / High
- Start Shop button (begins chunk, automated)
- Revenue summary at end of chunk

**8. Refurb Station:**

- Queue list (items to refurb)
- Per item:
  - Sprite
  - Name, condition
  - Time cost (30min, 60min, etc.)
  - Quality option: Auto / Manual (mini-game)
- Total time in queue display
- Start Refurb button (begins chunk)

**9. Crafting Bench:**

- Upgrade tree (visual node graph)
- Selected upgrade:
  - Current stats → New stats
  - Required materials (owned/needed)
  - Cost ($)
  - Craft button (if materials sufficient)
- Material inventory display

#### Animation & VFX

**PixiJS Canvas Animations:**

**Casting Animation:**

1. Magnet throw arc (parabola, 1 second)
2. Settle splash (particle burst)
3. Ripples expand (concentric circles, 2 seconds)

**Drag Animation:**

1. Ripple moves toward shore (position updates)
2. Bubble trail (particles follow path)
3. Tension visual: line "tightens" (slight curve straightens)

**Lift Animation:**

1. Ripple shrinks (depth decreases)
2. Bubbles intensify (frequency increases)
3. Shadow grows darker (item nearing surface)
4. Surface break: splash particle burst, item sprite appears
5. Item scales up (lerp from 0.5x to 1.0x scale over 1 second)
6. Water streams off item (particle effect)

**Slip Failure Animation:**

1. Item wobbles (rotation oscillates)
2. Magnet "pops" off (quick scale down, rotate)
3. Item falls (scale down, sink animation)
4. Splash (particle effect)

**VFX Particles:**

- Water splashes: white/blue particles, gravity, fade
- Bubbles: rise slowly, wobble, pop at surface
- Ripples: expanding circles, alpha fade
- Sludge drips: brown particles, slower fall, sticky feel
- Success sparkles: gold particles, burst pattern

#### Accessibility Considerations

**Visual:**

- Color-blind modes (rarity borders use shape + color)
- High contrast mode (increase border thickness, reduce transparency)
- Text size options (small/medium/large)
- Icon labels (optional text labels on all icons)

**Motor:**

- Auto-retrieve toggle (discussed in mechanics)
- Hold vs tap options (choose input preference)
- Touch target size (44x44pt minimum)
- Adjustable timers (optional: easier mode with +50% time)

**Cognitive:**

- Tutorial mode (step-by-step with pauses)
- Simple mode (reduce event frequency, clearer warnings)
- Clear feedback (audio + visual + text for all events)

#### Performance Targets

**Rendering:**

- 60fps during active gameplay (casting, drag, lift)
- 30fps acceptable during UI screens (menus, catalog)
- PixiJS optimizations:
  - Sprite batching (combine draw calls)
  - Culling (don't render off-screen elements)
  - Texture atlases (reduce draw calls)
  - Object pooling (particles, ripples)

**Memory:**

- <200MB total memory footprint
- Lazy load item sprites (per location)
- Unload unused assets (previous location sprites)

**Load Times:**

- Initial load: <5 seconds (critical assets)
- Location change: <2 seconds (location-specific assets)
- Session start: <1 second (UI transition)

#### Open Questions:

- **Q36:** For visual style: should we create a few test items in both pixel and vector styles to compare feel before committing?
- **Q37:** Should the casting view show decorative background layers (castle walls, trees, buildings) or keep it minimal/abstract for performance?
- **Q38:** For item scaling during lift: should it be smooth/gradual (lerp) or stepped/sudden (pop at breakpoints)?
- **Q39:** Should there be animated weather effects (rain, fog, snow) or keep environmental variation to static color palettes?

---

### 11. Scope & Development Phases

**Overview:**
Clear MVP definition to validate core loop, followed by iterative expansion phases.

#### MVP Scope (Prove the Core Loop)

**Objective:** Validate that cast → drag → lift → reveal loop is satisfying and has "one more cast" appeal

**Included in MVP:**

- 2 locations (Picturesque River, City River)
- 10-15 unique items with varying weights, slip rates, values
- Full two-phase retrieval (horizontal drag + blind lift + revealed lift)
- Slip system (placement RNG, surface condition, tension/tap mechanics)
- Quadrant casting system (9 quadrants + edge)
- Session timer (10 minutes)
- Basic snag event + tug mini-game
- Basic onlooker event (pause, dismiss)
- Tension bar, slip meter, item reveal screen
- Collection catalog (silhouette system, 15 entries)
- Basic audio (Howler samples for key events, optional Tone.js drone)
- Manual retrieve only (no winch yet)
- Hold-to-pull (drag) + tap-to-lift (lift) interactions
- 1 container type (basic safe, RNG open, simple loot table)

**Excluded from MVP:**

- Shop ownership, day cycle, time management (defer to Phase 2)
- Equipment upgrades, crafting system (defer to Phase 2)
- Refurbishment system (defer to Phase 2)
- Material scrapping (defer to Phase 2)
- Additional locations (Castle Moat, Industrial, Sewage, Nature - Phase 2+)
- Winch system (Phase 2)
- Detector tools (Phase 3)
- Advanced container opening (lockpick, crowbar mini-games - Phase 2)
- Night fishing special rules (Phase 3)
- Event variety (limit to 2-3 event types for MVP)
- Weather systems (Phase 4)
- Real-world map integration (Phase 5+)
- Multiplayer/co-op (Phase 5+)

**MVP Success Criteria:**

1. Core loop feels satisfying (playtesters want "one more cast")
2. Slip system creates meaningful tension without feeling unfair
3. Item reveal moment is exciting
4. Session timer creates appropriate urgency without stress
5. Players understand mechanics without excessive tutorial
6. Performance: stable 60fps on target devices
7. Audio enhances feel (doesn't distract or annoy)

**MVP Development Timeline (Estimate):**

- Week 1: Project setup, PixiJS integration, basic casting view
- Week 2: Drag phase mechanics (tension, snag, drag memory)
- Week 3: Lift phase mechanics (blind lift, surface break, revealed lift)
- Week 4: Slip system, failure states, retry mechanic
- Week 5: Item system, reveal screen, basic catalog
- Week 6: Audio integration (Howler samples, optional Tone.js)
- Week 7: UI polish, responsiveness (landscape/portrait)
- Week 8: Playtesting, iteration, bug fixes
  **Total: ~8 weeks for MVP**

#### Phase 2: Meta-Game Systems

**Objective:** Add progression hooks and economic pressure

**Additions:**

- Shop ownership + day cycle (4× 6-hour chunks)
- Economic pressure (rent, overhead costs)
- Equipment upgrades (magnet tiers 1-3, line tiers 1-2)
- Crafting system (material scrapping, upgrade crafting)
- Refurbishment system (basic, increase item value)
- Portable winch (ratchet type)
- Container opening choices (crowbar/lockpick/professional)
- 2 additional locations (Castle Moat, Industrial Canal)
- 25-30 more items (total 40-45 items)
- Catalog milestones (unlock locations at 10, 25 items)

**Development Timeline:** ~6 weeks

#### Phase 3: Depth & Variety

**Objective:** Expand content, add strategic tools

**Additions:**

- 2 more locations (Sewage Works, Nature Reserve)
- Night fishing special rules
- Detector tools (sonar, item detector)
- Event variety (10+ event types, location-specific)
- Advanced winch (electric portable, mountable)
- Magnet shape variations (bar, horseshoe)
- 30-40 more items (total 75-85 items)
- Container variety (chests, crates, bags)
- Advanced opening mini-games

**Development Timeline:** ~6 weeks

#### Phase 4: Polish & Expansion

**Objective:** Refine systems, add atmospheric depth

**Additions:**

- Weather systems (rain, fog, affects visibility/events)
- Time-of-day visual variations (dawn, dusk lighting)
- Shop customization (cosmetic upgrades)
- Special NPC customers (story events, unique requests)
- Advanced electromagnet (active slip control)
- Rarity scanner detector
- 50+ more items (total 135+ items, full catalog)
- Location variations (seasonal changes)
- Achievement system

**Development Timeline:** ~8 weeks

#### Phase 5+: Future Vision (Post-Launch)

**Potential Additions:**

- Real-world map integration (GPS-based locations)
- Multiplayer/co-op (real-time or asynchronous)
- User-generated content (custom locations, item mods)
- Narrative expansion (story mode, character arcs)
- Advanced shop management (manual sales, decoration)
- Competitive modes (leaderboards, challenges)
- Mobile-specific features (AR mode, camera integration)

**Development Timeline:** Ongoing, based on player feedback

#### Development Priorities

**Phase 1 (MVP) Focus:**

1. **Feel first:** Core interactions must feel good before adding systems
2. **Performance:** Optimize early, avoid tech debt
3. **Iteration:** Expect to rebuild drag/lift mechanics 2-3 times based on feel
4. **Audio:** Implement early (critical to feel), even with placeholder sounds
5. **Testing:** Playtest with non-developers every 2 weeks

**Post-MVP Focus:**

1. **Data-driven balance:** Log player session data (if privacy-compliant)
2. **Community feedback:** Reddit/Discord for direct player input
3. **Content pipeline:** Streamline item creation (templates, tools)
4. **Polish over features:** Better to have 6 great locations than 12 mediocre ones
5. **Modular design:** Each system should be independently improvable

#### Risk Mitigation

**Technical Risks:**

- PixiJS learning curve → **Mitigation:** Build simple prototype first (Week 1 focus)
- Audio sync issues → **Mitigation:** Test on multiple devices early (Week 6)
- Performance on older devices → **Mitigation:** Profiling tools, adjustable quality settings

**Design Risks:**

- Core loop not satisfying → **Mitigation:** Aggressive iteration, willing to rebuild
- Slip system feels unfair → **Mitigation:** Extensive playtesting, adjustable difficulty
- Too much complexity → **Mitigation:** Ruthless scope cutting, "can this wait?"

**Scope Risks:**

- Feature creep → **Mitigation:** Strict MVP definition, defer everything possible
- Art production time → **Mitigation:** Use placeholders, finalize style after mechanics work
- Solo dev burnout → **Mitigation:** Work in sprints, take breaks, celebrate milestones

---

### 12. Open Questions & Decisions Needed

**Summary of all open questions from document:**

#### Mechanics & Systems:

**Q1:** How quickly should quadrant freshness regenerate? Real-time (minutes) or fixed respawn on session start?

**Q2:** Should we show "no item present" immediately or after a brief suspense delay?

**Q3:** Do we want visual hints (ripples, shadows) indicating items are present in certain quadrants, or keep it fully blind?

**Q4:** Should we show accumulated slip value to player after drag completes (during lift phase), or only show rate of increase?

**Q5:** For the tug mini-game: should there be a limit to retry attempts (e.g., 3 tries then auto-fail), or unlimited?

**Q6:** How punishing should line snap be? Immediate session end, or just cost + continue?

**Q7:** Should current surge events be completely random or telegraphed slightly (ripple pattern changes 2s before)?

**Q8:** Should the "drop decision" window be timed (auto-commit after 3s) or wait indefinitely for player input (pausing timer)?

**Q9:** How many retry attempts should be allowed after magnet slip-off before item is lost? (Current: 3 retries)

**Q10:** Should structural break events be completely random or tied to cumulative tap frequency (damage threshold model)?

**Q11:** For container drainage: should weight reduction be instant at surface break, or gradual as lift continues?

**Q12:** Should slip limit be partially visible (e.g., bar shows estimated range based on visual placement) or completely hidden until failure?

**Q13:** Should there be a "slip forgiveness" mechanic for new players (e.g., first 5 retrieves have +20% slip limit bonus)?

**Q14:** How much should slip reset on retry? Currently 50% - too forgiving or too punishing?

**Q15:** Should certain items have "slip resistance" property independent of surface condition (e.g., ribbed surfaces grip magnet better)?

**Q16:** Should items have condition variations (pristine/worn/corroded) as separate catalog entries or single entry with "best condition" tracker?

**Q17:** For containers: should contents be rolled at moment of discovery (fixed) or at moment of opening (player can save-scum)?

**Q18:** Should there be "cursed" or "haunted" items with special negative events (for narrative flavor/humor)?

**Q19:** How many total unique items for full game? MVP target is ~135, but should we plan for 200+ eventually?

**Q20:** Should location depletion be global (affects all players) or per-save (individual progression)? Global creates FOMO, individual creates control.

**Q21:** Should locations have time-of-day restrictions (e.g., Castle Moat closes at night)? Adds realism but limits player freedom.

**Q22:** How many total locations for full game? MVP targets 6, but should we plan for 10-12 eventually?

**Q23:** Should we include "secret" locations unlocked by finding specific items (e.g., find ancient key → unlock crypt entrance)?

**Q24:** Should electromagnet have active control (player can pulse to reset slip partially) or just passive bonus (lower slip rate)? Active adds complexity.

**Q25:** Should there be cosmetic customization (magnet paint, line colors) or purely functional upgrades?

**Q26:** For winches: should battery life be a mechanic (electric winch requires recharge), or abstract it away for simplicity?

**Q27:** Should some upgrades be mutually exclusive (e.g., can only equip one detector at a time) to force strategic choice?

**Q28:** Should sleep be flexible (can sleep during any chunk, not just night), or realistic (only evening/night)?

**Q29:** For shop operation: should it be fully automated (press button, get revenue), or require light management (choose which items to display)?

**Q30:** Should there be a "fast forward" option to skip shop/refurb chunks for players who just want to fish?

**Q31:** How punishing should rent pressure be? Strictly enforced vs soft reminder?

#### Audio & Visual:

**Q32:** Should there be a music layer (ambient background music) separate from environmental sounds, or keep it purely diegetic?

**Q33:** For the tension drone: should it be subtle (barely noticeable) or prominent (clear gameplay feedback)?

**Q34:** Should rare item reveal chimes be unique melodies (composable, memorable) or just pitch variations (simpler)?

**Q35:** Should audio design include haptic feedback on mobile (vibration for tension, slip, events)?

**Q36:** For visual style: should we create a few test items in both pixel and vector styles to compare feel before committing?

**Q37:** Should the casting view show decorative background layers (castle walls, trees, buildings) or keep it minimal/abstract for performance?

**Q38:** For item scaling during lift: should it be smooth/gradual (lerp) or stepped/sudden (pop at breakpoints)?

**Q39:** Should there be animated weather effects (rain, fog, snow) or keep environmental variation to static color palettes?

---

## Next Steps

**Immediate Priorities:**

1. **Visual Style Decision:** Create 3-5 test items in both pixel and vector styles, see which feels right for scale/silhouette requirements

2. **MVP Scope Finalization:** Review open questions Q1-Q19 (mechanics), make decisions to lock MVP feature set

3. **Project Setup:** Initialize Vite + React + PixiJS project, confirm tech stack works on target devices

4. **Prototype Core Interaction:** Build tension bar (hold-to-pull) in isolation, test on iPad/desktop/phone - does it feel good?

5. **First Playable:** Combine casting + drag + lift into single retrievable item (placeholder visuals/audio), validate 60-second loop

**Questions for You (Stuart):**

1. **Visual Style:** Do you want to explore both pixel and vector styles before committing, or do you have a strong preference already?

2. **MVP Timeline:** Does 8 weeks feel realistic for your available time, or should we adjust scope to fit a shorter/longer timeline?

3. **Testing Approach:** Do you have access to playtesters (friends, family, colleagues) for early feedback, or should we plan for solo iteration first?

4. **Audio Production:** Are you comfortable sourcing/creating audio samples (Freesound, etc.), or should we budget for audio asset packs?

5. **Priority Questions:** Which of the 39 open questions are most critical to decide now vs can be deferred to playtesting?

**Document Validation:**

Please review this comprehensive document and confirm:

- ✅ Accurately captures our discussions
- ✅ No major mechanics misunderstood
- ✅ Scope feels achievable
- ✅ Tech stack aligns with your skills/preferences
- ✅ Open questions are clear and answerable

Let me know what needs clarification, correction, or expansion!
