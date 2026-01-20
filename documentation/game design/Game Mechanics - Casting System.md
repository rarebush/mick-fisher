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

## Open Questions

- **Q1:** How quickly should quadrant freshness regenerate? Real-time (minutes) or fixed respawn on session start?
- **Q2:** Should we show "no item present" immediately or after a brief suspense delay?
- **Q3:** Do we want visual hints (ripples, shadows) indicating items are present in certain quadrants, or keep it fully blind?
