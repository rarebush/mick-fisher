# Time Management & Day Cycle

**Overview:**
Player owns a quirky pawn shop and must balance time between fishing (acquiring inventory), running shop (generating income), refurbishing items (increasing value), and sleep (required for health).

## Day Structure

**Core Concept: In-Game Time vs Real-World Time**

**1 Chunk = 6 In-Game Hours**
- A full in-game day (24 hours) is divided into 4 chunks
- Each chunk represents a 6-hour period in the game world
- Different activity types consume real-world time differently:

**Real-World Time Per Activity Type:**

| Activity Type              | Real-World Duration            | In-Game Time Consumed |
| -------------------------- | ------------------------------ | --------------------- |
| **Fishing**                | ~10 minutes gameplay           | 1 chunk (6 hours)     |
| **Shop Operation**         | ~10 minutes gameplay (optional) | 1 chunk (6 hours)     |
| **Sleep**                  | Instant (fade to black)        | 1 chunk (6 hours)     |
| **Refurb/Crafting**        | Instant (queue processing)     | 1 chunk (6 hours)     |
| **Container Opening**      | Instant (gacha reveal)         | 0 chunks (free)       |
| **Equipment Upgrades**     | Instant (immediate)            | 0 chunks (free)       |
| **3rd Party Services**     | Instant (shop NPC)             | 0 chunks (free)       |

**Why This Matters:**
- **Fishing chunks** are the primary gameplay - player actively plays for ~10 real-world minutes
- **Shop chunks** could optionally be real-time simulation (customers browsing) or instant skip
- **Sleep/Refurb/Other chunks** are instant - no waiting, just resource allocation
- **Services** (container opening, repairs) happen instantly without consuming chunk time

**Example Session:**
- Morning chunk: Fish for 10 real minutes → catch 8-12 items
- Afternoon chunk: Refurb (instant) → process 4 items from morning
- Evening chunk: Shop (instant or 10 min simulation) → sell refurbed items
- Night chunk: Sleep (instant fade to black) → next day begins
- **Total real-world gameplay:** 10-30 minutes depending on skip preferences

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

## Activity Breakdown

**Fishing Chunk (1 chunk = 6 in-game hours):**

**Real-World Duration:** ~10 minutes active gameplay (target)
**Session Timer Display:** 10:00 countdown (what player sees)
**In-Game Time Consumed:** 6 hours (Morning 06:00→12:00, Afternoon 12:00→18:00, etc.)
**Actual Real-World Duration:** Can extend beyond 10 minutes if retrieval in progress (overtime mechanic)

**How It Works:**
- Player selects "Fishing" activity for a chunk slot
- Chooses location (Picturesque River, City River, etc.)
- **Active gameplay begins:** 10-minute countdown timer starts
- Player completes multiple cast-retrieve cycles during session
  - Each retrieve: ~30s drag + 15-40s lift = 45-70s per item
  - **Expected catches per session:** 8-12 items in 10 minutes
- Timer reaches 0:00 → session ends (or overtime if mid-retrieve)
- Items automatically transferred to shop storage
- **In-game clock advances 6 hours** (e.g., Morning chunk ends at 12:00)

**Key Point:** The 10-minute timer represents the "fishing window" within that 6-hour in-game period. You're not fishing for 6 real-world hours - you're fishing for 10 real-world minutes, which narratively represents utilizing that 6-hour morning/afternoon/evening/night time slot.

**Can fish multiple chunks consecutively:**
- Morning chunk: Fish City River (10 min real-time, 06:00→12:00 in-game)
- Afternoon chunk: Fish Industrial Canal (10 min real-time, 12:00→18:00 in-game)
- Result: 20 minutes total gameplay, 12 in-game hours consumed

**Shop Operation (1 chunk = 6 in-game hours):**

**Real-World Duration Options:**
- **MVP (Instant):** Skip to results screen (no real-time gameplay)
- **Optional (10-minute simulation):** Watch customers browse/buy in real-time
**In-Game Time Consumed:** 6 hours (opens shop for morning/afternoon/evening period)

**How It Works:**
- Player selects "Shop" activity for a chunk slot
- Pre-shop setup (instant):
  - Choose which items to put "For Sale"
  - Adjust prices (basic slider: low/fair/high)
  - Set shop policies
- **Option A (Instant - MVP):**
  - Click "Open Shop"
  - Simulation runs instantly
  - Results screen: "8 items sold, $450 revenue"
  - In-game clock advances 6 hours
- **Option B (Real-Time - Future):**
  - NPC customers enter shop (visible sprites)
  - Customers browse items (AI behavior)
  - Purchases occur dynamically over 10 real minutes
  - Player can interact with special customers (dialogue events)
  - More engaging but slower

**Revenue Factors:**
- Customer flow: morning/afternoon = high traffic, evening = moderate
- Item value and condition (refurbed items sell faster/higher)
- Shop reputation (unlocked through progression)
- Pricing strategy (low = fast sales, high = slow sales)

**Refurbishment (1 chunk = 6 in-game hours):**

**Real-World Duration:** Instant (no real-time gameplay)
**In-Game Time Consumed:** 6 hours (refurb work happens during chunk)

**How It Works:**
- Player selects "Refurb" activity for a chunk slot
- Opens refurb queue interface
- Adds items to queue (each item has in-game time cost: 15-60 minutes)
- **Queue Processing:**
  - Chunk provides 360 in-game minutes (6 hours)
  - Items process until time budget exhausted
  - Example: 6× 60-min refurbs OR 12× 30-min refurbs OR 24× 15-min refurbs
- Quality mini-game (optional for MVP):
  - Simple: automatic refurb, standard quality (instant)
  - Advanced: quick mini-game per item (~10s each), better quality result
- Click "Start Refurb" → instant processing → results screen
- Refurbed items moved to "for sale" inventory
- In-game clock advances 6 hours

**Key Point:** The in-game "15-60 minutes" refurb time determines how many items fit in the 6-hour chunk budget. Real-world, this is instant - no waiting.

**Sleep (1 chunk minimum required = 6 in-game hours):**

**Real-World Duration:** Instant (fade to black animation, ~2 seconds)
**In-Game Time Consumed:** 6 hours (rests during evening or night period)

**How It Works:**
- Player selects "Sleep" activity for a chunk slot (usually evening or night)
- Click "Sleep" → fade to black animation
- In-game clock advances 6 hours instantly
- Fade in to next chunk's start time
- **Total real-world time:** ~2 seconds (just the transition)

**Effects:**
- Restores energy (cosmetic, no mechanical fatigue system for MVP)
- Required once per day (cannot skip)
- If neglected: warning appears during day planning
- If completely skipped: negative events trigger next day (oversleeping, missed rent)

**Services & Instant Activities (0 chunks consumed):**

These activities happen **between chunks** and don't consume chunk time:

**Container Opening (Session-End Gacha):**
- Happens automatically when fishing session ends
- Gacha reveal animation (~30s real-time for 3-5 containers)
- No chunk time consumed
- Can also use shop service for locked containers (instant, pay fee)

**Equipment Upgrades:**
- Visit shop NPC during any non-chunk time
- Purchase/install instantly
- No waiting, no chunk consumed
- Immediate effect (next fishing session uses new gear)

**Crafting/Materials:**
- Crafting UI accessible between chunks
- Click "Craft Magnet Upgrade" → instant result
- Materials consumed, item created immediately
- Could optionally require refurb chunk if complexity desired (TBD)

**3rd Party Services:**
- Line repair after snap: Pay $100-200, instant fix
- Professional container opening: Pay $150, instant reveal
- Equipment rental: Pay fee, immediate availability
- All handled via shop interface, no chunk time

**Summary:** Only fishing consumes meaningful real-world time (~10 min). Everything else is instant or optional real-time simulation.

## Chunk Timing & Continuity

**Session Timer Overflow (Overtime Mechanic):**
As discussed in mechanics section:

**Trigger:** Session timer reaches 0:00 while player is mid-retrieval (casting, dragging, or lifting)

**Player Options:**

- Abandon current retrieval (lose item, chunk ends immediately)
- Continue retrieval (overtime - chunk extends beyond target 10 minutes)

**If player continues:**

- **Current chunk extends until retrieve completes** (no time limit during overtime)
- Chunk's actual duration = 10 minutes (target) + overtime duration
- Next chunk starts after current retrieval finishes

**Example:**

- Session timer: 9:45 remaining
- Player hooks heavy item, starts drag phase
- Timer expires (0:00) while dragging (2 minutes left to shore)
- Player continues → overtime begins
- Completes drag + lift (3 more minutes)
- **Chunk actual duration: 10 minutes (target) + 3 minutes (overtime) = 13 minutes total**
- Next chunk starts at 12:03 in-game time (real-time: 06:03 gameplay)

**Cascading Effects (Future Scope, note for later):**

- Shop chunk starts late → fewer customers
- Refurb chunk starts late → fewer items processable
- Sleep chunk starts late → energy penalty next day

**For MVP:** No cascading effects, just delayed start time.

## Strategic Planning

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

## Economic Pressure

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

## Night Fishing Special Rules

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

## Time Management Mastery

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

## Shop Interface (Brief)

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

## Open Questions

- **Q28:** Should sleep be flexible (can sleep during any chunk, not just night), or realistic (only evening/night)?
- **Q29:** For shop operation: should it be fully automated (press button, get revenue), or require light management (choose which items to display)?
- **Q30:** Should there be a "fast forward" option to skip shop/refurb chunks for players who just want to fish?
- **Q31:** How punishing should rent pressure be? Strictly enforced vs soft reminder?
