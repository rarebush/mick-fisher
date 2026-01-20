# Visual Design & UI/UX

**Overview:**
Consistent experience across device sizes (iPad, desktop, phones). Visual style undecided (pixel art vs vector illustration) but must support scaling items gracefully and clear silhouettes for collection catalog.

## Responsive Design Constraints

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

## Visual Style (To Be Determined)

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

## Core UI Screens

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

## Animation & VFX

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

## Accessibility Considerations

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

## Performance Targets

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

## Open Questions

- **Q36:** For visual style: should we create a few test items in both pixel and vector styles to compare feel before committing?
- **Q37:** Should the casting view show decorative background layers (castle walls, trees, buildings) or keep it minimal/abstract for performance?
- **Q38:** For item scaling during lift: should it be smooth/gradual (lerp) or stepped/sudden (pop at breakpoints)?
- **Q39:** Should there be animated weather effects (rain, fog, snow) or keep environmental variation to static color palettes?

---
