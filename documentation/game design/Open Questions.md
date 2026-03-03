### 12. Open Questions & Decisions Needed

**Summary of all open questions from document:**

#### Mechanics & Systems:

**Q40 (NEW - MVP FEATURE):** Dual-plane coordinate system for water surface vs river bed depth simulation

- **Background:** Currently, cast animations have a placeholder "sinking" wait period that creates physics discontinuities. Need proper depth model.
- **Proposed Solution:** Implement dual-plane coordinate system:
  - **Surface Plane (Y=80):** Where player casts, sees bubbles, rope endpoints visible
  - **River Bed Plane (Y=80+depth):** Where items actually exist, depth varies by location
  - **Translation:** Cast click at surface → item spawns at bed (Y + depth offset)
  - **Rope Physics:** Naturally represents depth (longer rope = deeper water)
  - **Visual Feedback:** Bubbles animate from bed → surface, only visible at surface
  - **Engaged Items:** Store bed coordinates, translate to surface for UI elements
  - **Lift Phases:** Use depth for mechanics (Phase A/B timing, player height above surface)
- **Status:** Planned for MVP implementation after core rope physics complete
- **Impact:** Eliminates arbitrary wait periods, enables realistic depth variation, sets foundation for lift mechanics

**Q41 (NEW - FISHING):** What exact curve should drive the **tension spike** when a fish runs away?

- **Background:** Fishing fight phase needs a rapid rise toward near-max tension based on fish speed/stamina.
- **Decision:** Choose a simple curve (linear vs exponential) and clamp behavior (e.g., cap at 90-95%).

**Q42 (NEW - FISHING):** What is the intended **visual scale multiplier** for the float in screen space?

- **Background:** Float world size is 0.1 units, but must be visually exaggerated for readability.
- **Decision:** Confirm a multiplier derived from `tile_pixel_multiplier` (e.g., 1.5x, 2x, 3x).

**Q7:** Should current surge events be completely random or telegraphed slightly (ripple pattern changes 2s before)?

**Q9:** How many retry attempts should be allowed after magnet slip-off before item is lost? (Current: 3 retries)

**Q10:** Should structural break events be completely random or tied to cumulative tap frequency (damage threshold model)?

**Q11:** For container drainage: should weight reduction be instant at surface break, or gradual as lift continues?

**Q13:** Should there be a "slip forgiveness" mechanic for new players (e.g., first 5 retrieves have +20% slip limit bonus)?

**Q14:** How much should slip reset on retry? Currently 50% - too forgiving or too punishing?

**Q15:** Should certain items have "slip resistance" property independent of surface condition (e.g., ribbed surfaces grip magnet better)?

**Q18:** Should there be "cursed" or "haunted" items with special negative events (for narrative flavor/humor)?

**Q19:** How many total unique items for full game? MVP target is ~135, but should we plan for 200+ eventually?

**Q20:** Should location depletion be global (affects all players) or per-save (individual progression)? Global creates FOMO, individual creates control.

**Q21:** Should locations have time-of-day restrictions (e.g., Castle Moat closes at night)? Adds realism but limits player freedom.

**Q22:** How many total locations for full game? MVP targets 6, but should we plan for 10-12 eventually?

**Q23:** Should we include "secret" locations unlocked by finding specific items (e.g., find ancient key → unlock crypt entrance)?

**Q24:** Should electromagnet have active control (player can pulse to reset slip partially) or just passive bonus (lower slip rate)? Active adds complexity.

**Q25:** Should there be cosmetic customization (magnet paint, line colors) or purely functional upgrades?

**Q26:** For winches: should battery life be a mechanic (electric winch requires recharge), or abstract it away for simplicity?

**Q27:** Should some upgrades be mutually exclusive (e.g., can only equip one detector at a time) to force strategic choice?

**Q28:** Should sleep be flexible (can sleep during any chunk, not just night), or realistic (only evening/night)?

**Q29:** For shop operation: should it be fully automated (press button, get revenue), or require light management (choose which items to display)?

**Q30:** Should there be a "fast forward" option to skip shop/refurb chunks for players who just want to fish?

**Q31:** How punishing should rent pressure be? Strictly enforced vs soft reminder?

#### Audio & Visual:

**Q32:** Should there be a music layer (ambient background music) separate from environmental sounds, or keep it purely diegetic?

**Q33:** For the tension drone: should it be subtle (barely noticeable) or prominent (clear gameplay feedback)?

**Q34:** Should rare item reveal chimes be unique melodies (composable, memorable) or just pitch variations (simpler)?

**Q35:** Should audio design include haptic feedback on mobile (vibration for tension, slip, events)?

**Q37:** Should the casting view show decorative background layers (castle walls, trees, buildings) or keep it minimal/abstract for performance?

**Q38:** For item scaling during lift: should it be smooth/gradual (lerp) or stepped/sudden (pop at breakpoints)?

**Q39:** Should there be animated weather effects (rain, fog, snow) or keep environmental variation to static color palettes?

---

## Next Steps

**Immediate Priorities:**

1. **Visual Style Decision:** Create 3-5 test items in both pixel and vector styles, see which feels right for scale/silhouette requirements

2. **MVP Scope Finalization:** Review open questions Q1-Q19 (mechanics), make decisions to lock MVP feature set

3. **Project Setup:** Initialize Vite + React + PixiJS project, confirm tech stack works on target devices

4. **Prototype Core Interaction:** Build tension bar (hold-to-pull) in isolation, test on iPad/desktop/phone - does it feel good?

5. **First Playable:** Combine casting + drag + lift into single retrievable item (placeholder visuals/audio), validate 60-second loop

**Questions for You (Stuart):**

1. **Visual Style:** Do you want to explore both pixel and vector styles before committing, or do you have a strong preference already?

2. **MVP Timeline:** Does 8 weeks feel realistic for your available time, or should we adjust scope to fit a shorter/longer timeline?

3. **Testing Approach:** Do you have access to playtesters (friends, family, colleagues) for early feedback, or should we plan for solo iteration first?

4. **Audio Production:** Are you comfortable sourcing/creating audio samples (Freesound, etc.), or should we budget for audio asset packs?

5. **Priority Questions:** Which of the 39 open questions are most critical to decide now vs can be deferred to playtesting?

**Document Validation:**

Please review this comprehensive document and confirm:

- ✅ Accurately captures our discussions
- ✅ No major mechanics misunderstood
- ✅ Scope feels achievable
- ✅ Tech stack aligns with your skills/preferences
- ✅ Open questions are clear and answerable

Let me know what needs clarification, correction, or expansion!
