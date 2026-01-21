# Location System

**Overview:**
Locations are thematic fishing spots, each with unique spawn tables, visual aesthetics, events, and progression requirements. Locations are NOT geographically simulated in MVP - they're discrete themed experiences.

## Location Structure

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

  // Spawn Timers (Phase 2+ Feature)
  spawnTimers: [
    {
      chunksRequired: 2,  // 12 in-game hours
      rollChance: 0.6,    // 60% chance
      itemTable: 'common_medieval',
      quantity: { min: 4, max: 7 }
    },
    {
      chunksRequired: 4,  // 24 hours (1 day)
      rollChance: 0.4,    // 40% chance
      itemTable: 'rare_historical',
      quantity: { min: 2, max: 4 }
    },
    {
      chunksRequired: 8,  // 48 hours (2 days)
      rollChance: 0.15,   // 15% chance
      itemTable: 'legendary_artifacts',
      quantity: { min: 1, max: 2 }
    }
  ],

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

## MVP Location Roster

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

## Spawn Timer System (Phase 2+ Feature)

**Chunk-Based Regeneration:**

Locations regenerate their item spawns based on in-game time chunks (6 hours each):

**Mechanics:**

1. **Initial Spawn:** Location has full spawn table on first visit
2. **Depletion:** Fishing session retrieves items from available pool
3. **Timer Tracking:** Each chunk spent elsewhere increments location's respawn timer
4. **Spawn Rolls:** When timer thresholds reached, game rolls for new item spawns
5. **Multiple Timers:** Different rarity tiers respawn on different schedules

**Location-Specific Timer Examples:**

**Picturesque River (Easy, Common-focused):**

- 2 chunks (12h): 70% chance for 5-8 common items
- 4 chunks (24h): 40% chance for 2-4 uncommon items
- 6 chunks (36h): 15% chance for 1-2 rare items

**Industrial Canal (Heavy, Material-focused):**

- 3 chunks (18h): 50% chance for 3-6 heavy tools/scrap
- 6 chunks (36h): 30% chance for 1-3 machinery/engines
- 10 chunks (60h): 10% chance for 1 legendary industrial item

**Castle Moat (Historical, Narrative-focused):**

- 2 chunks (12h): 60% chance for 4-7 historical common
- 4 chunks (24h): 40% chance for 2-4 medieval artifacts
- 8 chunks (48h): 15% chance for 1-2 legendary historical pieces

**Strategic Implications:**

- **Route Planning:** "Fish River today, Industrial tomorrow when heavy items respawn"
- **Diminishing Returns:** Farming same location repeatedly = fewer finds
- **Time Pressure:** Rare spawns might occur while you sleep/shop (FOMO)
- **Location Diversity:** Encourages exploring all unlocked locations

**Visual Feedback (Late Game Unlock):**

"Detector" upgrade milestone shows spawn status:

- **Cold:** Just fished, minimal spawns likely
- **Warm:** Some time passed, common spawns likely
- **Hot:** Timer thresholds reached, rare spawns possible
- **Pulsing:** Legendary spawn window active

**MVP:** Infinite spawns, no timers - focus on core mechanics

## Location-Specific Mechanics

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

## Location Progression Path

**Progression Arc:**

1. **Picturesque River:** Learn mechanics, build confidence
2. **City River:** Experience variety, discover first safe (hook moment)
3. **Castle Moat:** Unlock (10 items), explore historical theme
4. **Industrial Canal:** Unlock (25 items), challenge difficulty spike, upgrade equipment
5. **Sewage Works:** Unlock (40 items), risk/reward mastery
6. **Nature Reserve:** Unlock (60 items), completionist content

## Location Selection UI

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

## Open Questions

- **Q20:** Should spawn timers be global (affects all players, creates FOMO) or per-save (individual progression, more control)? Global = competitive, individual = relaxed.
- **Q21:** Should locations have time-of-day restrictions (e.g., Castle Moat closes at night)? Adds realism but limits player freedom.
- **Q22:** How many total locations for full game? MVP targets 6, but should we plan for 10-12 eventually?
- **Q23:** Should we include "secret" locations unlocked by finding specific items (e.g., find ancient key → unlock crypt entrance)?
