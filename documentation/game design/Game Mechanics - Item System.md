# Item System

**Overview:**
Items are the core reward and discovery mechanic. Each item has mechanical properties (weight, slip rate, value) and narrative properties (description, lore, rarity). Items populate the collection catalog and drive progression.

## Item Properties Schema

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

## Item Categories & Spawn Tables

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

## Container System (Special Items)

**Container Properties:**
Containers are special items that hold other items inside. Their contents are **rolled at spawn time** (when container appears in quadrant), making the contents "real" before the player even discovers them.

**Q17 Resolution: Contents Roll at Spawn**

**When contents are determined:** The moment the container spawns in a quadrant (before player casts)

**Why spawn-time rolling is best:**

- Contents are "real" from the start - the safe genuinely contains something
- Allows opening method to affect contents (damage/preserve items)
- Allows drop mechanics to damage contents (container cracks, some items lost)
- No save-scum issue - contents already exist, player just doesn't know them
- Creates authentic risk/reward: "This safe HAS something valuable, but can I get it out intact?"

```javascript
// When quadrant spawns a container
{
  id: 'rusted_safe_medium_12345',
  name: 'Rusted Safe',
  category: 'containers',
  containerType: 'safe',

  // Physical properties
  weight: 65,
  surfaceCondition: 'heavy_rust',
  locked: true,
  baseValue: 200, // safe itself has value (collectors)
  refurbValue: 500, // restored safe is decorative item

  // Contents rolled NOW (at spawn, before discovery)
  contentsRoll: 'safe_medium_loot_table',
  contents: [
    { item: 'cash_small', quantity: 150, damaged: false },
    { item: 'jewelry_ring', quantity: 1, damaged: false },
    { item: 'photos', quantity: 5, damaged: false }
  ],
  contentsIntact: true, // tracks if container has been compromised

  // Opening state
  opened: false,
  openMethod: null, // 'crowbar', 'lockpick', 'professional'
  damageEvents: [], // tracks what damaged the contents

  // Mystery Appeal
  description: 'A locked safe. What could be inside?',
  discoveryQuote: '"NO WAY. What are the odds? I need to get this open."'
}
```

**Opening Method Effects on Contents:**

Opening method creates meaningful strategic choices - fast and risky vs slow and safe:

**1. Crowbar (On-Site) - Fast but Risky**

```javascript
openMethod: 'crowbar',
time: 45, // seconds
damageChance: 0.7, // 70% chance to damage contents
damageEffect: {
  // Per-item damage probability
  cash: 0.5,       // 50% of cash survives
  jewelry: 0.3,    // 30% chance jewelry breaks
  photos: 0.8,     // 80% destroyed (paper tears)
  documents: 0.2   // mostly destroyed
}
```

**Example result:**

- Original contents: $150 cash, ring, 5 photos
- After crowbar: $75 cash, ring (survived!), 1 photo
- **Trade-off:** Fast (45s, minimal session time), but lost $75 + 4 photos

**2. Lockpick (Careful) - Slow but Safe**

```javascript
openMethod: 'lockpick',
time: 120, // seconds (burns significant session time)
damageChance: 0.1, // 10% chance of damage
damageEffect: {
  // Minimal damage, mostly intact
  cash: 0.9,
  jewelry: 0.95,
  photos: 0.9,
  documents: 0.85
}
```

**Example result:**

- Original contents: $150 cash, ring, 5 photos
- After lockpick: $150 cash, ring, 5 photos (all intact!)
- **Trade-off:** Slow (120s burns precious session time), but preserves value

**3. Professional Opening - Expensive but Perfect**

```javascript
openMethod: 'professional',
cost: 150, // upfront fee
time: 0, // instant (handled at shop)
damageChance: 0 // guaranteed no damage
```

**Example result:**

- Original contents: $150 cash, ring, 5 photos
- After professional: $150 cash, ring, 5 photos (perfect)
- Cost: $150 fee
- **Trade-off:** Expensive upfront, but maximizes contents value

**Strategic Decision Tree:**

**Find safe at session end, 45 seconds remaining:**

```
Option 1: Crowbar on-site (45s)
  - Fast, fits in session
  - 70% damage risk
  - Gamble: contents might be cash (survives 50%) or photos (80% destroyed)

Option 2: Take to shop, lockpick later
  - Burns refurb chunk (120 min chunk time)
  - Only 10% damage risk
  - Safe choice if you suspect valuables

Option 3: Pay professional $150
  - Instant, perfect reveal
  - Worth it if contents > $150
  - But you don't know contents value!
```

**Drop Mechanics Integration (Phase 2+):**

When drop decision is implemented at surface break, containers can be damaged by gameplay events:

**Scenario: Player Drops Container During Lift**

```javascript
// Container was at surface, player chose to drop
onDrop(container, dropHeight) {
  // Container falls back to water
  const impactDamage = calculateImpactDamage(dropHeight, container.weight);

  if (impactDamage > container.structuralIntegrity) {
    container.contentsIntact = false;
    container.damageEvents.push({
      type: 'impact_damage',
      height: dropHeight,
      damagePercent: 0.3 // lost 30% of contents
    });

    // Randomly remove some items
    container.contents.forEach(item => {
      if (Math.random() < 0.3) {
        item.damaged = true;
        item.quantity = Math.floor(item.quantity * 0.5); // half destroyed
      }
    });
  }
}
```

**Scenario: Container Slips Off During Lift (Retry Mechanic)**

```javascript
// Multiple retries degrade container integrity
onSlipOff(container, attemptNumber) {
  const degradation = attemptNumber * 0.15; // 15% per retry

  container.damageEvents.push({
    type: 'slip_damage',
    attempt: attemptNumber,
    damagePercent: degradation
  });

  // Cumulative damage threshold
  if (attemptNumber >= 3) {
    // 3rd retry = container cracked badly
    container.contentsIntact = false;

    // Example: safe cracks, water gets in
    container.contents.forEach(item => {
      if (item.item === 'cash_small') {
        item.damaged = true;
        item.quantity = Math.floor(item.quantity * 0.3); // soggy, ruined
      }
      if (item.item === 'photos') {
        item.quantity = 0; // completely destroyed by water
      }
    });
  }
}
```

**Strategic Implications:**

**Find safe at surface, slip meter shows 85/90:**

```
Option 1: Continue lift
  - High slip risk (only 5 margin)
  - If succeed: intact contents
  - If fail + retry: damage accumulates

Option 2: Drop now
  - Preserve some contents (30% loss from impact)
  - Safer than risking slip-off + retries
  - Can recast, try again later with better prep

Option 3: Drop and abandon
  - Save time, move on
  - Accept total loss
```

**Damage Display UI:**

When container is opened and damaged, show player consequences:

```
╔══════════════════════════════════════╗
║   SAFE CONTENTS (DAMAGED)            ║
╠══════════════════════════════════════╣
║                                      ║
║  💵 Cash: $75 / $150 (50% lost)     ║
║     └─ Crowbar damage               ║
║                                      ║
║  💍 Ring: Intact ✓                  ║
║                                      ║
║  📷 Photos: 1 / 5 (80% destroyed)   ║
║     └─ Crowbar damage               ║
║                                      ║
║  Total Value: $XXX                   ║
║  Potential Value: $YYY (if intact)   ║
║                                      ║
╚══════════════════════════════════════╝
```

**Shows player:**

- What they got
- What they lost
- Why it was damaged (crowbar, drop, water damage)
- Teaches consequences for next time

**Narrative Flavor:**

**Crowbar damage:**

- "The safe lid bent during forcing. Some contents were crushed."
- Photos description: "Torn and crumpled from the crowbar."

**Drop damage:**

- "The impact cracked the safe. Water seeped in."
- Cash description: "Soggy and waterlogged. Only half is salvageable."

**Multiple retries:**

- "The safe took multiple drops. The lock mechanism broke and contents spilled."
- "You hear something rattling inside... that's not a good sign."

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

**Session-End Gacha Reveal:**

Containers function as a gacha-style reward system. When fishing session ends:

**Phase 1: Automatic Opening (Session End)**

1. Session timer expires or player ends session
2. All retrieved containers are processed automatically
3. **Unlocked/Basic containers:** Open instantly, contents revealed in sequence
4. **Locked containers:** Remain closed, flagged for shop service
5. Gacha-style reveal screen:
   - Each container opens with animation
   - Contents cascade out one by one
   - Rarity flash effects (common = gray, rare = blue, epic = purple, legendary = gold)
   - Running total of session value updates
6. No player input required - pure reveal moment
7. No time consumed - happens between fishing chunk and next chunk

**Phase 2: Locked Container Service (Shop)**

Containers that couldn't auto-open require paid shop service:

- Locked containers appear in inventory with "LOCKED" tag
- Player must pay shop NPC to open them
- Cost based on lock difficulty:
  - Basic lock: $50
  - Medium lock: $150
  - Advanced lock: $300
  - Master lock: $500
- Opening happens instantly (no mini-game, no chunk time consumed)
- Contents revealed immediately after payment
- Strategic choice: pay to open OR sell locked container to collector (some containers valuable unopened)

**MVP Scope:**

- All containers auto-open at session end (no locked containers in MVP)
- Gacha reveal screen shows contents
- Phase 2+: Introduce locked containers requiring shop service

**Container Types by Opening Method:**

| Container Type | Opens Automatically? | Shop Service Cost | MVP Status |
| -------------- | -------------------- | ----------------- | ---------- |
| Wooden crate   | Yes                  | N/A               | ✓ MVP      |
| Cardboard box  | Yes                  | N/A               | ✓ MVP      |
| Plastic bin    | Yes                  | N/A               | ✓ MVP      |
| Rusted safe    | No                   | $150              | Phase 2+   |
| Lockbox        | No                   | $50-300           | Phase 2+   |
| Antique chest  | No                   | $500              | Phase 2+   |

**Strategic Container Decisions:**

| Scenario                             | Decision                             | Reasoning                                  |
| ------------------------------------ | ------------------------------------ | ------------------------------------------ |
| Common crate retrieved               | Auto-opens at session end            | Free reveal, contents shown automatically  |
| Locked safe retrieved                | Pay shop $150 to open                | Gamble on contents vs sell safe for $200   |
| Antique chest (valuable unopened)    | Sell unopened to collector for $800  | Guaranteed profit vs risky $500 open cost  |
| Multiple locked containers, low cash | Prioritize opening higher-tier locks | Better loot tables = higher expected value |
| Locked container, already rich       | Open everything                      | Discovery > profit at this point           |

## Material Yield System

Items can be scrapped for materials used in crafting upgrades:

**Material Types:**

| Material           | Sources              | Rarity   | Used For                                  |
| ------------------ | -------------------- | -------- | ----------------------------------------- |
| Steel Scrap        | Bikes, tools, frames | Common   | Basic magnet upgrades, line reinforcement |
| Copper Wire        | Electronics, motors  | Uncommon | Advanced magnets, detector circuits       |
| Brass Components   | Locks, fixtures      | Uncommon | Precision parts, decorative elements      |
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

## Refurbishment System

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

## Collection Catalog

**Purpose:**

- Track all items discovered (Pokemon-style gotta-catch-em-all)
- Show silhouettes of undiscovered items (creates curiosity)
- Provide lore/descriptions for found items (narrative reward)
- Unlock rewards at milestones (new locations, equipment, story beats)

**Catalog Structure:**

**Single Entry with Condition Tracking:**

Each unique item has ONE catalog entry that tracks the best condition found:

```javascript
catalogEntry: {
  itemId: 'bicycle',
  name: 'Bicycle',
  category: 'vehicle_parts',

  // Discovery tracking
  discovered: true,
  discoveryDate: '2025-01-18T14:32:00Z',
  timesFound: 5,

  // Condition tracking (replayability goal)
  bestCondition: 'worn', // pristine > worn > corroded
  conditionsFound: ['corroded', 'worn'], // collection progress
  pristineFound: false, // still hunting for perfect specimen!

  // Variants (cosmetic differences, same base item)
  variants: ['blue_bike', 'red_bike'], // color/style variations

  // Lore and narrative
  loreUnlocked: true, // unlocks on first discovery regardless of condition
  loreText: 'A child\'s bicycle, rusted from years underwater...'
}
```

**Condition System Benefits:**

**Replayability Goal:**

- "I found the rusty bike, but can I find a pristine one?"
- Creates reason to revisit locations
- Collectors aim for 100% pristine catalog
- Casual players satisfied with any condition discovery

**Catalog Size Management:**

- 135 unique items (manageable, not overwhelming)
- NOT 400+ entries (135 items × 3 conditions)
- Reduces art asset production (one sprite + condition overlays)
- Clearer progression tracking

**Condition Impact on Gameplay:**

| Condition | Visual        | Refurb Value | Sale Value | Catalog Display   |
| --------- | ------------- | ------------ | ---------- | ----------------- |
| Pristine  | Clean, shiny  | +50%         | +30%       | Gold star badge   |
| Worn      | Scratched     | Base         | Base       | Silver star badge |
| Corroded  | Rusty, sludge | -30%         | -20%       | Bronze star badge |

**Catalog UI Display:**

- Item thumbnail shows BEST condition found
- Condition badges: 🏆 (pristine) / ⭐ (worn) / 🟫 (corroded)
- "Upgrade available!" indicator if better condition exists
- Clicking entry shows all conditions discovered

**Example Progression:**

```
Day 1: Find corroded bicycle → Catalog entry created, bronze badge
Day 5: Find worn bicycle → Catalog updates, silver badge replaces bronze
Day 12: Find pristine bicycle → Catalog updates, gold badge! Completionist satisfied
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

| Milestone | Reward                | Mechanical Benefit                     |
| --------- | --------------------- | -------------------------------------- |
| 10 items  | Line upgrade          | +5m casting range                      |
| 25 items  | New location unlock   | Access to "Sewage Works"               |
| 50 items  | Detector upgrade      | Shows "hot" quadrants                  |
| 75 items  | New location unlock   | Access to "Industrial Runoff"          |
| 100 items | Professional contacts | 25% discount on shop container opening |
| All items | Legendary magnet      | Access to "deepest" depth zone         |

## Item Balance & Tuning

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

## Open Questions

- **Q18:** Should there be "cursed" or "haunted" items with special negative events (for narrative flavor/humor)?
- **Q19:** How many total unique items for full game? MVP target is ~135, but should we plan for 200+ eventually?
