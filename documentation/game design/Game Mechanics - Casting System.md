# Casting System

## Quadrant Layout

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

**MVP Spawn System:**

- **Infinite spawns** - all locations have unlimited items
- **No depletion** - quadrants remain equally viable throughout session
- **Pure RNG** - each cast has independent chance based on quadrant's loot table
- **Location variety** - different spawn tables per location (e.g., Industrial has more metal, River has more historical items)
- **Depth-based rarity** - far quadrants (Q7-Q9) have higher rare item rates than near quadrants (Q1-Q3)

_Note: Depletion & spawn timer system is planned for Phase 2+ - see Phase 2+ Features appendix_

**Equipment Range Limitation:\*\***

- Starting equipment: Can only reach Q0-Q3 (edge + near zones)
- Upgraded line length: Unlocks Q4-Q6 (mid zones)
- Max upgraded line: Unlocks Q7-Q9 (far zones)
- Greyed-out quadrants indicate inaccessible zones
- Casting equipment accuracy (hand/slingshot/catapult) defines minimum/maximum accuracy radius for donut mode, separate from line length

## Cast Input Modes (Press `M` to Cycle)

**Modes:**

1. **Click Mode (Quadrant Cast)**  
   - Single click on water surface selects a quadrant and begins cast sequence.
2. **Direction + Power Mode**  
   - Click 1: Start oscillating angle  
   - Click 2: Lock angle and start oscillating power  
   - Click 3: Lock power and cast to computed target
3. **Donut Mode (Accuracy Zone)**  
   - Click 1: Choose target on water surface, show min/max accuracy rings  
   - Click 2: Start oscillating ring between min and max radii  
   - Click 3: Lock current radius; final landing point is randomized within the donut area

**Notes:**
- Donut mode requires the target to be within the water surface bounds.
- Final landing point is sampled uniformly by area within the donut.

**Click Interaction (Click Mode):**

**UPDATED (January 2026):** Cast animations now use world-space projection with centralized magnet state management.

**Phase 1: Cast Animation (Arc Trajectory)**

1. Player clicks quadrant on riverbed (Z=0)
2. Cast animation begins:
   - Magnet spawns at avatar hand (Z=4.2, Y=0)
   - `magnetStore.spawnMagnet(avatarX)` called
   - Arc trajectory calculated with peak height of 2.0 world units
   - Duration: 800ms base + 1.5ms per horizontal distance unit
3. **Throwing Phase** (`magnetPhase = 'throwing'`):
   - Magnet follows parabolic arc from hand to water surface
   - Position tracked in magnetStore: `updateMagnetPosition(x, y, z)`
   - Peak values automatically recorded (maxX, maxY, maxZ)
   - Visual: Magnet sprite follows arc, rope connects to hand
4. **Splash Phase**:
   - Magnet reaches water surface (Z=1)
   - Audio: Splash sound
   - Visual: Water impact ripples at surface position
5. **Sinking Phase** (`magnetPhase = 'sinking'`):
   - Magnet descends from water surface (Z=1) to riverbed (Z=0)
   - Position interpolated: `z = lerp(WATER_SURFACE, RIVERBED, progress)`
   - Visual: Bubbles, underwater effects
6. **Settling Phase** (`magnetPhase = 'settling'`):
   - Magnet rests on riverbed (Z=0) at cast position
   - Brief pause (200ms) for suspense
   - Final position: `{ x: targetX, y: targetY, z: 0 }`

**Total Arc Animation Time:**

- Close casts (Q1-Q3): ~950ms
- Medium casts (Q4-Q6): ~1100ms
- Far casts (Q7-Q9): ~1400ms

**Phase 2: Item Detection & Transition**

7. Contact check occurs (instant, server-side feel):
   - RNG determines if item is present in quadrant
   - If yes: Check if magnet contacted item (placement quality)
   - Magnet position stored in world space for drag mechanics

**Phase 3a: Item Detected - Drag Begins**

8. Immediate transition to drag phase:
   - `magnetPhase = 'dragging'`
   - Drag mechanics start (tension, slip calculations)
   - Player sees tension bar, begins hold-to-drag
   - Item position calculated in world space on riverbed (Z=0)
   - As item approaches: `itemWorld.y` decreases (toward avatar at Y=0)

**Phase 3b: Nothing Found**

8. Ripples dissipate
   - Audio: Ambient water sounds
   - Message: "Nothing here..."
   - magnetStore.despawnMagnet() called
   - Button prompt: "Reel in" or immediate recast available

**World-Space Integration:**

```javascript
// Cast click on riverbed
const castScreenX = clickEvent.x;
const castScreenY = clickEvent.y;

// Convert to world position on riverbed (Z=0)
const viewport = createViewport(screenWidth, screenHeight);
const castWorld = screenToWorld(
  castScreenX,
  castScreenY,
  WORLD_Z.RIVERBED,
  viewport,
);
// Returns: { x: castScreenX, y: worldY, z: 0 }

// Spawn magnet at avatar hand
const avatarX = screenWidth / 2;
magnetStore.spawnMagnet(avatarX);
// Sets: magnetWorld = { x: avatarX, y: WORLD_Y.AVATAR, z: WORLD_Z.AVATAR_HAND }

// During arc animation, update position each frame
magnetStore.updateMagnetPosition(arcX, arcY, arcZ);
// Automatically tracks peaks for debugging

// Transition to drag - magnet already at target world position
magnetStore.setMagnetPhase("dragging");
// Item world position: { x: castWorld.x, y: castWorld.y, z: 0 }
```

**Suspense & Game Feel:**

**Quadrant Selection Strategy:**

- Near quadrants: Fast retrieves, common items, good for volume fishing
- Far quadrants: Slow retrieves, rare items, target-hunting strategy
- Location-specific spawn tables: Some items only spawn in certain depth zones
- MVP: No depletion system - player can fish same quadrant repeatedly

**Item Detection & Visual Hints:**

**MVP Approach: Fully Blind Fishing**

- No visual hints indicating item presence in quadrants
- Player casts into "unknown" - core mystery/discovery appeal
- "What will I find?" tension is preserved
- Encourages exploration and experimentation
- Experienced players develop intuition through:
  - Location spawn table knowledge
  - Depth zone preferences (rare items in far quadrants)
  - Pattern recognition over time

**Beginner Exception - Edge Quadrant (Q0):**

- Optional: Subtle visual hint in Q0 only (visible from shore)
- Example: Faint shimmer or ripple pattern if item present
- Teaches mechanic: "Hints mean something's there"
- Doesn't spoil mystery (only affects 1 of 9 quadrants)
- Helps new players get first successful cast quickly

---

## Phase 2+ Features (Post-MVP)

_This appendix contains detailed future feature designs. None of these systems are implemented in MVP._

### Depletion & Spawn Timer System

_Future enhancement to encourage location rotation and create strategic time-based decisions._

**Spawn Timer Mechanics:**

Each location tracks spawn state across time using chunk-based regeneration:

```javascript
location: {
  initialSpawn: {
    // Full loot table on first visit or after long absence
    common: 15,
    uncommon: 8,
    rare: 3,
    epic: 1
  },
  spawnTimers: [
    {
      chunksRequired: 2,  // 12 in-game hours (2 chunks × 6 hours)
      rollChance: 0.6,    // 60% chance to spawn
      itemTable: 'common_items',
      quantity: { min: 3, max: 6 }
    },
    {
      chunksRequired: 4,  // 24 in-game hours (1 full day)
      rollChance: 0.3,    // 30% chance to spawn
      itemTable: 'rare_items',
      quantity: { min: 1, max: 3 }
    },
    {
      chunksRequired: 8,  // 48 in-game hours (2 days)
      rollChance: 0.1,    // 10% chance to spawn
      itemTable: 'legendary_items',
      quantity: { min: 1, max: 1 }
    }
  ]
}
```

**How It Works:**

1. **Initial Visit:** Location spawns full initial table (e.g., 15 common, 8 uncommon, 3 rare, 1 epic)
2. **Fishing Session:** Player retrieves items, depleting location's available spawns
3. **Chunk Tracking:** Each chunk spent NOT fishing that location = +1 to spawn timer
4. **Spawn Rolls:** When timer thresholds reached, game rolls chance to add new items
5. **Stale Locations:** Even fully depleted locations have small chance (5-10%) of random spawn

**Example Player Experience:**

```
Day 1, Morning Chunk: Fish Picturesque River (depletes 8 common items)
Day 1, Afternoon: Fish Industrial Canal (different location)
Day 1, Evening: Shop operations
Day 1, Night: Sleep
  → Picturesque River timer: +3 chunks (18 hours)

Day 2, Morning: Fish Picturesque River again
  → 2-chunk timer triggered: 60% roll → SUCCESS, 4 common items respawned
  → 4-chunk timer NOT triggered yet (only 3 chunks passed)
  → Player fishes newly spawned items + any remaining from Day 1

Day 3, Morning: Return to Picturesque River
  → 2-chunk timer: 60% roll → SUCCESS, 5 common items
  → 4-chunk timer: 30% roll → SUCCESS!, 2 rare items spawned
  → Player finds rare item they hadn't seen before
```

**Strategic Depth:**

- **Location Rotation:** Fishing same location repeatedly yields diminishing returns
- **Planning Ahead:** "I'll fish Industrial today, River tomorrow when rares have chance to spawn"
- **FOMO Element:** Rare spawns might trigger while you're shopping/sleeping
- **Late-game Unlock:** "Detector" upgrade shows spawn timer status per location
  - Early game: Blind (must guess when to return)
  - Mid game: "Cold/Warm/Hot" indicator per location
  - Late game: Shows estimated chunks until next spawn window

**Visual Indicator:**

- Green (fresh): Initial spawn or recently respawned
- Yellow (depleted): Some items remain, timers active
- Red (exhausted): Fully fished, waiting on spawn rolls
- Pulsing icon: Spawn timer threshold reached, likely new items

### Detector Upgrades

_Unlockable equipment that reveals item presence in quadrants._

**Basic Detector (Milestone: 50 items discovered)**

- Shows "hot" quadrants (item definitely present)
- Visual: Pulsing glow on quadrants with items
- Still blind to rarity/type - just presence/absence
- Strategic choice: use detector (slower, guaranteed) vs blind cast (faster, risky)

**Advanced Sonar (Milestone: 100 items discovered)**

- Shows item size category (small/medium/large/container)
- Visual: Color-coded quadrant overlays
  - Green: Small items (tools, jewelry)
  - Blue: Medium items (bikes, safes)
  - Purple: Large/containers (engines, chests)
- Doesn't reveal exact item or rarity
- Enables targeted hunting ("I need large items for materials")

**Legendary Detector (End-game unlock)**

- Shows estimated rarity tier
- Visual: Star rating overlay on quadrants
- Still requires cast to see exact item
- Late-game quality-of-life for completionists

**Design Philosophy:**

- MVP = Pure mystery and discovery
- Mid-game = Player choice between speed and certainty
- End-game = Convenience without eliminating all surprise

---

## Open Questions

(All major casting system questions resolved - section kept for future additions)
