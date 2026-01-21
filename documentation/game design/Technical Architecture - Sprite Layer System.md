# Sprite Layer System Architecture

## Overview

The game uses a layer-based rendering system to organize sprites and tiles for proper depth sorting, performance optimization, and maintainability.

## Layer Structure

Layers are implemented as PixiJS Containers added to the stage in back-to-front order. Each layer serves a specific purpose:

```
┌─────────────────────────────────────┐
│ UI Layer                            │ ← Grid lines, notifications, HUD
├─────────────────────────────────────┤
│ Gameplay Layer                      │ ← Magnet, caught items, fishing line
├─────────────────────────────────────┤
│ Object Layer                        │ ← Trees, rocks, debris, decorations
├─────────────────────────────────────┤
│ Terrain Layer                       │ ← Ground tiles, river walls, shore
├─────────────────────────────────────┤
│ Background Layer                    │ ← Animated water tiles
└─────────────────────────────────────┘
```

## Layer Definitions

### 1. Background Layer

- **Purpose**: Animated environmental backgrounds
- **Contents**: Water tiles, sky, distant backgrounds
- **Performance**: Can be animated or static
- **Z-Index**: Lowest (renders first)

**Example**:

```javascript
this.backgroundLayer = new PIXI.Container();
this.app.stage.addChild(this.backgroundLayer);

// Add animated water tiles
createTiledBackground(this.backgroundLayer, waterSheet, ...);
```

### 2. Terrain Layer

- **Purpose**: Ground surfaces and structural elements
- **Contents**: Shore tiles, river walls, ground tiles, walkable areas
- **Performance**: Usually static (no animation)
- **Features**: Can include collision boundaries

**Example**:

```javascript
this.terrainLayer = new PIXI.Container();
this.app.stage.addChild(this.terrainLayer);

// Add river walls
const wall = new PIXI.Sprite(wallTexture);
wall.x = riverEdgeX;
wall.y = riverEdgeY;
this.terrainLayer.addChild(wall);

// Add shore/ground tiles
createTiledBackground(this.terrainLayer, groundSheet, ...);
```

### 3. Object Layer

- **Purpose**: Environmental objects and decorations
- **Contents**: Trees, rocks, bushes, debris, environmental storytelling
- **Performance**: Static or minimal animation (wind sway)
- **Features**: Y-sorting for depth illusion

**Example**:

```javascript
this.objectLayer = new PIXI.Container();
this.app.stage.addChild(this.objectLayer);

// Add trees
const tree = new PIXI.Sprite(treeTexture);
tree.x = 200;
tree.y = 150;
this.objectLayer.addChild(tree);

// Y-sort for depth (sprites at higher Y render in front)
this.objectLayer.children.sort((a, b) => a.y - b.y);
```

### 4. Gameplay Layer

- **Purpose**: Interactive game elements
- **Contents**: Magnet sprite, caught items, fishing line, visual effects
- **Performance**: Highly dynamic, updated every frame during gameplay
- **Features**: Responds to game state changes

**Example**:

```javascript
this.gameplayLayer = new PIXI.Container();
this.app.stage.addChild(this.gameplayLayer);

// Add magnet and items (created dynamically during gameplay)
this.magnetSprite = createMagnetSprite();
this.gameplayLayer.addChild(this.magnetSprite);
```

### 5. UI Layer

- **Purpose**: User interface elements
- **Contents**: Quadrant grid, text, notifications, HUD elements
- **Performance**: Updated on state changes only
- **Z-Index**: Highest (always on top)

**Example**:

```javascript
this.uiLayer = new PIXI.Container();
this.app.stage.addChild(this.uiLayer);

// Add grid lines
const gridLine = new PIXI.Graphics()
  .moveTo(x1, y1)
  .lineTo(x2, y2)
  .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
this.uiLayer.addChild(gridLine);
```

## Implementation Pattern

### Setup Phase

```javascript
setupScene() {
  // 1. Create layer containers
  this.backgroundLayer = new PIXI.Container();
  this.terrainLayer = new PIXI.Container();
  this.objectLayer = new PIXI.Container();
  this.gameplayLayer = new PIXI.Container();
  this.uiLayer = new PIXI.Container();

  // 2. Add to stage in order (back to front)
  this.app.stage.addChild(this.backgroundLayer);
  this.app.stage.addChild(this.terrainLayer);
  this.app.stage.addChild(this.objectLayer);
  this.app.stage.addChild(this.gameplayLayer);
  this.app.stage.addChild(this.uiLayer);

  // 3. Populate layers
  this.setupWaterBackground();   // → backgroundLayer
  this.setupTerrain();           // → terrainLayer
  this.setupEnvironment();       // → objectLayer
  this.drawQuadrantGrid();       // → uiLayer
}
```

### Dynamic Updates

```javascript
// Gameplay sprites are added/removed as needed
updateSprites() {
  if (gamePhase === "dragging") {
    if (!this.magnetSprite) {
      this.magnetSprite = createMagnetSprite();
      this.gameplayLayer.addChild(this.magnetSprite);
    }
    // Update position
    this.magnetSprite.x = newX;
    this.magnetSprite.y = newY;
  } else {
    // Clean up when not in use
    if (this.magnetSprite) {
      this.gameplayLayer.removeChild(this.magnetSprite);
      this.magnetSprite.destroy();
      this.magnetSprite = null;
    }
  }
}
```

## Benefits

### 1. Performance Optimization

- **Selective Updates**: Only update layers that change
- **Culling**: Hide entire layers if off-screen
- **Batch Rendering**: PixiJS automatically batches sprites in same container

### 2. Organization

- **Logical Grouping**: Related sprites in same container
- **Easy Management**: Find and modify sprites by layer
- **Clean Separation**: Gameplay vs UI vs environment

### 3. Visual Control

- **Depth Sorting**: Automatic Z-ordering
- **Layer Effects**: Apply filters/effects to entire layers
- **Show/Hide**: Toggle visibility of entire categories

### 4. Advanced Features

- **Parallax Scrolling**: Move layers at different speeds for depth
- **Camera Effects**: Pan/zoom specific layers
- **Y-Sorting**: Within layers, sort by Y position for top-down depth

## Y-Sorting for Depth

For top-down views, sprites should render based on their Y position to create depth illusion:

```javascript
// Sort object layer so sprites "behind" (lower Y) render first
this.objectLayer.children.sort((a, b) => a.y - b.y);

// Call after adding/moving sprites
updateObjectDepth() {
  this.objectLayer.children.sort((a, b) => a.y - b.y);
}
```

## Location-Specific Layers

Different locations may have different layer configurations:

```javascript
// Picturesque River
setupPicturesqueRiver() {
  this.backgroundLayer.addChild(waterTiles);
  this.terrainLayer.addChild(riverWalls, shoreSand);
  this.objectLayer.addChild(trees, rocks, debris);
}

// Urban Canal
setupUrbanCanal() {
  this.backgroundLayer.addChild(waterTiles);
  this.terrainLayer.addChild(concretePiers, sidewalk);
  this.objectLayer.addChild(graffiti, trashCans, streetLights);
}
```

## Best Practices

1. **Layer Order**: Always add layers in back-to-front order
2. **Naming**: Use descriptive layer names (`backgroundLayer`, not `layer1`)
3. **Cleanup**: Destroy sprites when removing from layers
4. **Z-Index**: Don't mix layer purposes (keep UI separate from gameplay)
5. **Performance**: Static layers don't need frequent updates
6. **Sorting**: Only Y-sort layers that need depth (not UI or background)

## Future Enhancements

- **Parallax Scrolling**: Background layers move slower for depth effect
- **Dynamic Loading**: Load/unload layers based on location
- **Layer Masking**: Clip sprites to specific areas
- **Blend Modes**: Layer-wide blend effects (multiply, screen, etc.)
- **Camera System**: Independent camera control per layer
