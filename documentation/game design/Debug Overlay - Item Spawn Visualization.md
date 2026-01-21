# Debug Overlay - Item Spawn Visualization

## Overview

The debug overlay is a developer tool that helps visualize and understand the item spawning system in real-time.

## Activation

Press **D** key to toggle the debug overlay on/off.

## Features

### 1. Spawn Table Display

When you click on a quadrant to cast, the overlay shows:

- **Quadrant number** (0-9)
- **Zone type** (edge, near, mid, far)
- **"Nothing" spawn chance** (% probability)
- **Item spawn probabilities** (% for each item in that zone)

### 2. Spawn Event Log

Displays the 10 most recent spawn events with:

- **Timestamp** of the cast
- **Quadrant** where the cast was made
- **Result**: Either the item name (green) or "NOTHING" (red)
- **Details** (for successful spawns):
  - Distance from shore
  - Magnet position on item surface
  - Placement quality label

### 3. Visual Quadrant Highlight

When you click to cast, a yellow highlight appears briefly showing which quadrant you clicked on.

## Understanding the Data

### Spawn Flow

1. **User clicks** on water → determines quadrant based on position
2. **executeCast()** is called in castMechanics.js
3. **rollForItem()** checks the spawn table for that quadrant's zone
4. **Weighted random roll** determines if "nothing" or which item spawns
5. **Distance & depth** are randomized within quadrant range
6. **Magnet position** is rolled (0-100 on item surface)
7. **Debug overlay logs** the complete spawn event

### Spawn Tables by Zone

Locations have 4 spawn zones based on distance:

- **Edge** (Q0): 0-2m - Mostly light trash, 50% nothing chance
- **Near** (Q1-Q3): 2-8m - Mix of light/medium items, 40% nothing
- **Mid** (Q4-Q6): 8-15m - Medium items, some rare, 30% nothing
- **Far** (Q7-Q9): 15-25m - Heavy items, highest rare chance, 20% nothing

### Reading the Percentages

Example spawn table for Mid zone:

```
QUADRANT 5 (MID ZONE)
Nothing: 30.0%
bicycle: 12.9%
shopping-cart: 10.8%
traffic-cone: 8.6%
...
```

This means:

- 30% chance to get nothing at all
- 12.9% chance to spawn a bicycle
- 10.8% chance to spawn a shopping cart
- etc.

The percentages are calculated from the weight values defined in `locationDatabase.js`.

## Technical Details

### Files Modified

- `src/game/graphics/debugOverlay.js` - New debug overlay component
- `src/game/PixiApp.js` - Integration with main game app

### Key Functions

- `showSpawnTable(quadrant, locationId)` - Displays spawn probabilities
- `logSpawnEvent(event)` - Records spawn results
- `highlightQuadrant(quadrant, x, y)` - Visual feedback
- `toggle()` - Show/hide overlay

### Debug Overlay Structure

- Position: Left side of screen
- Z-index: 10000 (always on top)
- Semi-transparent black background
- Monospace font for data clarity
- Color coding: Yellow (headers), Green (success), Red (failure)

## Use Cases

### Verifying Spawn Weights

Cast multiple times in the same quadrant and check if spawn rates match expected percentages.

### Testing Distance Ranges

Verify that items spawn at appropriate distances for their quadrant.

### Debugging Magnet Position

Check if magnet position affects slip rate as expected.

### Balancing Spawn Tables

Identify if certain zones are too easy/hard by observing success rates.

## Future Enhancements

Potential additions:

- Toggle between different locations to compare spawn tables
- Statistics tracking (total spawns per item, success rate by zone)
- Spawn probability heatmap overlay on quadrant grid
- Export spawn log to file for analysis
