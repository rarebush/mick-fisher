# Equipment & Progression Systems

**Overview:**
Player starts with basic equipment and upgrades over time to access deeper zones, heavier items, and reduce failure rates. Progression gated by crafting materials + cash, not just cash (prevents rushing).

## Starting Equipment

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

## Magnet Progression

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

## Line Progression

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

## Winch Progression

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

## Tool & Detector Progression

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

## Crafting System

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

## Progression Pacing

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

## Open Questions

- **Q24:** Should electromagnet have active control (player can pulse to reset slip partially) or just passive bonus (lower slip rate)? Active adds complexity.
- **Q25:** Should there be cosmetic customization (magnet paint, line colors) or purely functional upgrades?
- **Q26:** For winches: should battery life be a mechanic (electric winch requires recharge), or abstract it away for simplicity?
- **Q27:** Should some upgrades be mutually exclusive (e.g., can only equip one detector at a time) to force strategic choice?
