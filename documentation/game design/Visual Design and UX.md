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

## Visual Style: Pixel Art

**Decision:** Chunky pixel art with phased production approach - icon library placeholders → real pixel art as development progresses.

### MVP Art Strategy: Speed Over Polish

**Phase 1: Testing Game Feel (Weeks 1-4)**

- Use geometric shapes (circles, rectangles for items)
- Icon libraries for placeholders (Material Icons, Font Awesome, Game Icons)
- Single color fills with simple outlines
- **Goal:** Test mechanics, not aesthetics

**Phase 2: First Playable (Weeks 5-6)**

- Create 5-8 "real" pixel art items at target resolution
- Test production pipeline (speed benchmarking: how fast can you make one item?)
- Establish style rules (color palette, outline weight, pixel grid size)
- **Goal:** Validate art direction before full production

**Phase 3: Full Production (Weeks 7+)**

- Replace remaining placeholder items with real pixel art
- Create condition overlays (rust, sludge)
- Optional: Ship MVP with mix of real sprites + placeholders, complete post-launch

### Pixel Art Technical Specifications

**Item Sprite Specifications:**

- **Resolution:** 64x64px or 128x128px base canvas
- **Pixel grid:** 2x2 or 4x4 (chunky, clear at distance)
- **Color palette:** 16-32 colors (enough for variety, limited for consistency)
- **Outline:** 2px black outline (ensures visibility against water background)
- **Scaling:** Nearest-neighbor (keeps pixels sharp when scaled)
- **Condition overlays:** Separate layer for rust/sludge (multiply blend mode)

**Why These Specs Work:**

- 64x64 is large enough for detail but small enough for fast production
- 2x2 pixel blocks scale well (32x32 → 128x128 stays crisp)
- Black outlines ensure items pop against water background
- Condition overlays = reuse base sprite with different coatings (1 sprite + 3 overlays = 4 visual variations)

### Production Pipeline

**Tools:**

- **Aseprite** (paid, ~$20, best for pixel art) - has onion skinning, palette management, animation
- **Pixaki** (iPad, great for touch) - if you want to draw on tablet
- **Piskel** (free, browser-based) - good for quick mockups

**Workflow (Target: 20-30 minutes per item):**

1. Create 64x64 canvas with 2px black outline guides (1 min)
2. Block out basic shape (5 min)
3. Add detail within blocks (10 min)
4. Add shading/highlights (5 min)
5. Export as PNG (1 min)
6. Create condition variants (rust overlay, sludge overlay) (5 min each)

**Production Test (Pre-Development):**
Before Week 1, spend 2-4 hours creating these test items:

- **Safe** (large, rectangular, mechanical details)
- **Bicycle** (complex organic shape)
- **Wrench** (small, simple tool)

For each item, create:

- Base sprite (clean)
- Rust overlay
- Sludge overlay

Test in context:

- Scale to 200% (item approaching camera)
- Scale to 50% (catalog silhouette)
- Render on blue water background
- Check if sludge overlay is distinguishable from clean

**Decision Gate:**

- If this takes >30 min per item: Simplify your style (bigger pixels, less detail)
- If you enjoy the process: You've found your art style
- If you hate it: Reconsider vector or find an artist

### Icon Library Placeholder Strategy

**For MVP Testing (Weeks 1-4, before real sprites):**

**Source:** Game Icons (game-icons.net)

- Huge library of SVG game-related icons
- Can export as PNG at any size
- Free for use with attribution
- Examples: bicycle, safe, wrench, treasure chest

**Implementation:**

```javascript
// Temporary item data structure
items: [
  {
    id: "bike_01",
    spritePath: "/icons/bicycle.png", // placeholder icon
    // Later: spritePath: '/sprites/bike_rusty.png'
  },
];
```

**Conversion Plan:**

- Week 1-4: All icons (no custom art)
- Week 5-6: Replace 5-8 key items with real pixel art
- Week 7-8: Replace remaining items as time allows, or ship MVP with mix

### Condition Overlay System

**Strategy:** Use multiply blend layers to create condition variations without duplicating base sprites.

**Asset Structure:**

- **Base sprite:** Clean item (one sprite per item type)
- **Overlay options:**
  - `rust_light.png` - orange-brown splotches, 50% opacity
  - `rust_heavy.png` - thick corrosion, 70% opacity
  - `sludge.png` - brown-green coating, 80% opacity

**Runtime Compositing:**

```javascript
// Composite on canvas or use CSS
<div class="item-sprite">
  <img src="bike_base.png" />
  <img src="sludge.png" class="multiply" />
</div>
```

**Benefit:** 1 base sprite + 3 overlays = 4 visual variations with minimal art work

**Production Efficiency:**

- Create base sprite once
- Create 3 generic overlay textures (reuse across all items)
- Mix and match for pristine/worn/corroded conditions
- If overlay doesn't work for specific item, create item-specific variant

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
│ Casting Gear + Mode (top-left bar)  │ Timer: 8:34        │
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

**Casting Gear + Mode Bar:**

- Positioned top-left over the casting view
- Shows casting equipment presets (Hand Throw, Slingshot, Catapult)
- Displays current cast input mode (Click / Direction + Power / Donut)

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
4. Donut mode overlay: min/max accuracy rings + oscillating radius ring

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

- **Q37:** Should the casting view show decorative background layers (castle walls, trees, buildings) or keep it minimal/abstract for performance?
- **Q38:** For item scaling during lift: should it be smooth/gradual (lerp) or stepped/sudden (pop at breakpoints)?
- **Q39:** Should there be animated weather effects (rain, fog, snow) or keep environmental variation to static color palettes?

---
