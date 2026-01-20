# Time Management & Day Cycle

**Overview:**
Player owns a quirky pawn shop and must balance time between fishing (acquiring inventory), running shop (generating income), refurbishing items (increasing value), and sleep (required for health).

## Day Structure

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

**Fishing Session (1 chunk):**

**Target Duration:** 10 minutes real-time gameplay
**Session Timer:** 10-minute countdown (what player sees on screen)
**Actual Duration:** Can extend beyond 10 minutes if retrieval in progress (overtime mechanic)

- Choose location
- Timer counts down from 10:00 to 0:00
- Return with inventory of items
- Items automatically transferred to shop storage
- Can fish multiple chunks consecutively (different locations or same)

**Important:** A chunk's target is 10 minutes, but actual duration may be longer if player is mid-retrieval when timer expires (see Session Timer Overflow below).

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
