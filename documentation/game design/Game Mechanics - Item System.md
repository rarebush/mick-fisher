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

## Material Yield System

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

- **Q16:** Should items have condition variations (pristine/worn/corroded) as separate catalog entries or single entry with "best condition" tracker?
- **Q17:** For containers: should contents be rolled at moment of discovery (fixed) or at moment of opening (player can save-scum)?
- **Q18:** Should there be "cursed" or "haunted" items with special negative events (for narrative flavor/humor)?
- **Q19:** How many total unique items for full game? MVP target is ~135, but should we plan for 200+ eventually?
