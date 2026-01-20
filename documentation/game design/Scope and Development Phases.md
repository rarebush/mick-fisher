### 11. Scope & Development Phases

**Overview:**
Clear MVP definition to validate core loop, followed by iterative expansion phases.

#### MVP Scope (Prove the Core Loop)

**Objective:** Validate that cast → drag → lift → reveal loop is satisfying and has "one more cast" appeal

**Included in MVP:**

- 2 locations (Picturesque River, City River)
- 10-15 unique items with varying weights, slip rates, values
- Full two-phase retrieval (horizontal drag + blind lift + revealed lift)
- Slip system (placement RNG, surface condition, tension/tap mechanics)
- Quadrant casting system (9 quadrants + edge)
- Session timer (10 minutes)
- Basic snag event + tug mini-game
- Basic onlooker event (pause, dismiss)
- Tension bar, slip meter, item reveal screen
- Collection catalog (silhouette system, 15 entries)
- Basic audio (Howler samples for key events, optional Tone.js drone)
- Manual retrieve only (no winch yet)
- Hold-to-pull (drag) + tap-to-lift (lift) interactions
- 1 container type (basic safe, RNG open, simple loot table)

**Excluded from MVP:**

- Shop ownership, day cycle, time management (defer to Phase 2)
- Equipment upgrades, crafting system (defer to Phase 2)
- Refurbishment system (defer to Phase 2)
- Material scrapping (defer to Phase 2)
- Additional locations (Castle Moat, Industrial, Sewage, Nature - Phase 2+)
- Winch system (Phase 2)
- Detector tools (Phase 3)
- Advanced container opening (lockpick, crowbar mini-games - Phase 2)
- Night fishing special rules (Phase 3)
- Event variety (limit to 2-3 event types for MVP)
- Weather systems (Phase 4)
- Real-world map integration (Phase 5+)
- Multiplayer/co-op (Phase 5+)

**MVP Success Criteria:**

1. Core loop feels satisfying (playtesters want "one more cast")
2. Slip system creates meaningful tension without feeling unfair
3. Item reveal moment is exciting
4. Session timer creates appropriate urgency without stress
5. Players understand mechanics without excessive tutorial
6. Performance: stable 60fps on target devices
7. Audio enhances feel (doesn't distract or annoy)

**MVP Development Timeline (Estimate):**

- Week 1: Project setup, PixiJS integration, basic casting view
- Week 2: Drag phase mechanics (tension, snag, drag memory)
- Week 3: Lift phase mechanics (blind lift, surface break, revealed lift)
- Week 4: Slip system, failure states, retry mechanic
- Week 5: Item system, reveal screen, basic catalog
- Week 6: Audio integration (Howler samples, optional Tone.js)
- Week 7: UI polish, responsiveness (landscape/portrait)
- Week 8: Playtesting, iteration, bug fixes
  **Total: ~8 weeks for MVP**

#### Phase 2: Meta-Game Systems

**Objective:** Add progression hooks and economic pressure

**Additions:**

- Shop ownership + day cycle (4× 6-hour chunks)
- Economic pressure (rent, overhead costs)
- Equipment upgrades (magnet tiers 1-3, line tiers 1-2)
- Crafting system (material scrapping, upgrade crafting)
- Refurbishment system (basic, increase item value)
- Portable winch (ratchet type)
- Container opening choices (crowbar/lockpick/professional)
- 2 additional locations (Castle Moat, Industrial Canal)
- 25-30 more items (total 40-45 items)
- Catalog milestones (unlock locations at 10, 25 items)

**Development Timeline:** ~6 weeks

#### Phase 3: Depth & Variety

**Objective:** Expand content, add strategic tools

**Additions:**

- 2 more locations (Sewage Works, Nature Reserve)
- Night fishing special rules
- Detector tools (sonar, item detector)
- Event variety (10+ event types, location-specific)
- Advanced winch (electric portable, mountable)
- Magnet shape variations (bar, horseshoe)
- 30-40 more items (total 75-85 items)
- Container variety (chests, crates, bags)
- Advanced opening mini-games

**Development Timeline:** ~6 weeks

#### Phase 4: Polish & Expansion

**Objective:** Refine systems, add atmospheric depth

**Additions:**

- Weather systems (rain, fog, affects visibility/events)
- Time-of-day visual variations (dawn, dusk lighting)
- Shop customization (cosmetic upgrades)
- Special NPC customers (story events, unique requests)
- Advanced electromagnet (active slip control)
- Rarity scanner detector
- 50+ more items (total 135+ items, full catalog)
- Location variations (seasonal changes)
- Achievement system

**Development Timeline:** ~8 weeks

#### Phase 5+: Future Vision (Post-Launch)

**Potential Additions:**

- Real-world map integration (GPS-based locations)
- Multiplayer/co-op (real-time or asynchronous)
- User-generated content (custom locations, item mods)
- Narrative expansion (story mode, character arcs)
- Advanced shop management (manual sales, decoration)
- Competitive modes (leaderboards, challenges)
- Mobile-specific features (AR mode, camera integration)

**Development Timeline:** Ongoing, based on player feedback

#### Development Priorities

**Phase 1 (MVP) Focus:**

1. **Feel first:** Core interactions must feel good before adding systems
2. **Performance:** Optimize early, avoid tech debt
3. **Iteration:** Expect to rebuild drag/lift mechanics 2-3 times based on feel
4. **Audio:** Implement early (critical to feel), even with placeholder sounds
5. **Testing:** Playtest with non-developers every 2 weeks

**Post-MVP Focus:**

1. **Data-driven balance:** Log player session data (if privacy-compliant)
2. **Community feedback:** Reddit/Discord for direct player input
3. **Content pipeline:** Streamline item creation (templates, tools)
4. **Polish over features:** Better to have 6 great locations than 12 mediocre ones
5. **Modular design:** Each system should be independently improvable

#### Risk Mitigation

**Technical Risks:**

- PixiJS learning curve → **Mitigation:** Build simple prototype first (Week 1 focus)
- Audio sync issues → **Mitigation:** Test on multiple devices early (Week 6)
- Performance on older devices → **Mitigation:** Profiling tools, adjustable quality settings

**Design Risks:**

- Core loop not satisfying → **Mitigation:** Aggressive iteration, willing to rebuild
- Slip system feels unfair → **Mitigation:** Extensive playtesting, adjustable difficulty
- Too much complexity → **Mitigation:** Ruthless scope cutting, "can this wait?"

**Scope Risks:**

- Feature creep → **Mitigation:** Strict MVP definition, defer everything possible
- Art production time → **Mitigation:** Use placeholders, finalize style after mechanics work
- Solo dev burnout → **Mitigation:** Work in sprints, take breaks, celebrate milestones

---
