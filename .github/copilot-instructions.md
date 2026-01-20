# GitHub Copilot Instructions for Mick Fisher Project

## Design Documentation

### Always Reference Design Docs

- **CRITICAL**: Before implementing any game mechanic, UI component, or system change, always check the design documentation in `documentation/game design/`
- Key design documents:
  - `Game Mechanics - Horizontal Drag Phase.md` - Tension, drag speed, snag mechanics
  - `Game Mechanics - Slip System.md` - Positional slip model, magnet placement, failure conditions
  - `Game Mechanics - Vertical Lift Phase.md` - Tapping mechanics, lift phase
  - `Game Mechanics - Item System.md` - Item properties, categories, values
  - `Game Mechanics - Location System` - Quadrants, distance, locations
  - `Technical Architecture.md` - Code structure, state management, calculations
- When making decisions about game mechanics, always cite the relevant section from the design docs
- If the design docs are unclear or silent on a topic, mention this explicitly

### Design Doc Updates

- **When deviating from design docs**: If you suggest an approach that differs from the documented design, or if we agree on a better implementation that contradicts the docs:
  1. Explicitly note the deviation and explain why
  2. Ask: "Would you like me to update the design documentation to reflect this change?"
  3. If yes, update the relevant design doc(s) with the new approach
- **When finding improvements**: If you discover a better way to implement something that differs from the design:
  1. Explain both the documented approach and your proposed improvement
  2. Highlight the tradeoffs
  3. Wait for confirmation before implementing
  4. Ask if design docs should be updated
- **Keep docs in sync**: Design documentation should always reflect the current implementation decisions, not outdated plans

## Code Quality

### Implementation Standards

- Follow existing code patterns and architecture
- Use Zustand for state management (gameStore, sessionStore, inventoryStore)
- Keep game mechanics in separate files under `src/game/mechanics/`
- Component structure: `src/components/game/` for game UI, `src/components/ui/` for general UI
- Always include comments explaining complex game mechanics with references to design docs

### Testing Changes

- When making balance changes (tension rates, slip rates, speeds), suggest verbose logging to verify behavior
- Reference specific design doc formulas when implementing calculations
- Test edge cases mentioned in design docs (e.g., snag events, 100% tension, slip-off conditions)
