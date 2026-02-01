# Sprite Layer System Architecture

## Overview

The game uses a layer-based rendering system to organize sprites and tiles for proper depth sorting, performance optimization, and maintainability.

## Layer Structure

**UPDATED (January 2026):** Layers now positioned using world-space projection from `worldConstants.js`. See [Technical Architecture](Technical%20Architecture.md#world-space-coordinate-system--projection) for coordinate system details.

Layers are implemented as PixiJS Containers added to the stage in back-to-front order. Each layer serves a specific purpose:

```
┌─────────────────────────────────────┐
│ UI Layer (Z-index based)            │ ← Grid lines, notifications, HUD
├─────────────────────────────────────┤
│ Magnet (dynamic Z-based)            │ ← Position determines layer
├─────────────────────────────────────┤
│ Water Surface (Z=1)                 │ ← Semi-transparent overlay
├─────────────────────────────────────┤
│ Items on Riverbed (Z=0)             │ ← Item sprites
├─────────────────────────────────────┤
│ Riverbed (Z=0)                      │ ← River bottom surface
├─────────────────────────────────────┤
│ Wall Face (Z spans 3→0)             │ ← Vertical wall
├─────────────────────────────────────┤
│ Avatar (Z=3)                        │ ← Avatar on walkway
├─────────────────────────────────────┤
│ Walkway (Z=3)                       │ ← Pier/walkway surface (backdrop)
└─────────────────────────────────────┘

World-Space Positioning:
  All layers positioned via pure projection from world coordinates.
  No inter-layer dependencies - each calculates position independently.
```

## Layer Definitions

**World-Space Architecture:** All layers are positioned using true isometric projection from 3D world coordinates. See `worldConstants.js` for dimensions.

### Projection Formula

```
isoX = (worldX - worldY) * cos(30°)
isoY = (worldX + worldY) * sin(30°) - worldZ
screenX = isoX * pixelsPerUnit + screenXOffset
screenY = isoY * pixelsPerUnit + screenYOffset

Where:
  worldX = horizontal position
  worldY = depth into scene (toward river)
  worldZ = height/elevation
  pixelsPerUnit = screen pixels per world unit
  screenXOffset/screenYOffset = viewport offsets
```

### 1. Walkway Layer (Z=3)

- **Purpose**: Pier/walkway surface where avatar stands
- **World Position**: Z=3, Y range [-4, 0]
- **Screen Position**: Derived from `getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport)`
- **Performance**: Static background layer
- **Features**: Extends behind avatar for backdrop fill

**Implementation**:

```javascript
const viewport = createViewport(app.screen.width, app.screen.height);
const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);

const walkwayLayer = new PIXI.Graphics();
walkwayLayer.rect(
  0,
  walkwayBounds.top,
  width,
  walkwayBounds.bottom - walkwayBounds.top,
);
walkwayLayer.fill({ color: 0x7f8c8d }); // Walkway color
```

### 2. Avatar Layer (Z=3, hand at Z=4.2)

- **Purpose**: Player character on walkway
- **World Position**: Z=3 (feet), Z=4.2 (hand holding rod)
- **Performance**: Minimal animation (arm movement)
- **Z-Index**: Between walkway and wall

### 3. Wall Face Layer (Vertical surface, Y=0, Z spans 3→0)

- **Purpose**: Vertical wall connecting walkway to water/riverbed
- **World Position**: Vertical surface at Y=0, spanning Z from 3 (walkway) to 0 (riverbed)
- **Screen Position**: Height = (WORLD_Z.WALKWAY - WORLD_Z.RIVERBED) × pixelsPerUnit
- **Performance**: Static structure
- **Special**: Unlike horizontal surfaces, wall has Z-span but minimal Y-depth

**Implementation**:

```javascript
const wallTop = projectToScreen(
  0,
  WORLD_Y.WALL_EDGE,
  WORLD_Z.WALKWAY,
  viewport,
);
const wallBottom = projectToScreen(
  0,
  WORLD_Y.WALL_EDGE,
  WORLD_Z.RIVERBED,
  viewport,
);

const wallLayer = new PIXI.Graphics();
wallLayer.rect(0, wallTop.y, width, wallBottom.y - wallTop.y);
wallLayer.fill({ color: 0x6c5b4a }); // Wall color
```

### 4. Riverbed Layer (Z=0)

- **Purpose**: River bottom surface where items rest
- **World Position**: Z=0, Y range [0, 6]
- **Screen Position**: Derived from `getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport)`
- **Performance**: Static (minimal animation)
- **Features**: Texture patterns, pebbles, sand

**Implementation**:

```javascript
const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

const riverbedLayer = new PIXI.Graphics();
riverbedLayer.rect(
  0,
  riverbedBounds.top,
  width,
  riverbedBounds.bottom - riverbedBounds.top,
);
riverbedLayer.fill({ color: 0x5c4d3d }); // Riverbed color
```

### 5. Items on Riverbed Layer (Z=0)

- **Purpose**: Item sprites resting on riverbed
- **World Position**: Z=0 (on riverbed), various X and Y positions
- **Performance**: Dynamic - added/removed based on engaged items
- **Features**: Y-sorting for depth (items further away render first)

**Implementation**:

```javascript
// Item world position on riverbed
const itemWorld = { x: 250, y: 3.5, z: WORLD_Z.RIVERBED };

// Project to screen
const itemScreen = worldToScreen(itemWorld, viewport);

const itemSprite = createItemSprite(item);
itemSprite.x = itemScreen.x;
itemSprite.y = itemScreen.y;
itemLayer.addChild(itemSprite);

// Y-sort items by world Y (depth) for proper occlusion
itemLayer.children.sort((a, b) => a.worldY - b.worldY);
```

### 6. Water Surface Layer (Z=1)

- **Purpose**: Semi-transparent water overlay
- **World Position**: Z=1, Y range [0, 6]
- **Screen Position**: Derived from `getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport)`
- **Performance**: Animated (ripples, waves) or static with alpha
- **Features**: Overlays riverbed with transparency, creating underwater effect

**Implementation**:

```javascript
const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);

const waterLayer = new PIXI.Graphics();
waterLayer.rect(
  0,
  waterBounds.top,
  width,
  waterBounds.bottom - waterBounds.top,
);
waterLayer.fill({ color: 0x3498db, alpha: 0.4 }); // Translucent water
```

### 7. Magnet Layer (Dynamic Z-based positioning)

- **Purpose**: Magnet sprite during cast/drag/lift phases
- **World Position**: Variable - tracks `magnetStore.getMagnetWorld()`
- **Screen Position**: Projected from world position each frame
- **Performance**: Highly dynamic - position updates every frame
- **Features**: Render layer changes based on Z height

**Dynamic Layer Assignment**:

```javascript
function getMagnetRenderLayer(worldZ) {
  if (worldZ > WORLD_Z.WATER_SURFACE) {
    return 1.5; // In air: between avatar and wall
  } else if (worldZ > WORLD_Z.RIVERBED) {
    return 4.5; // In water: between items and water surface
  } else {
    return RENDER_LAYERS.ITEMS_ON_RIVERBED; // On riverbed
  }
}
```

**Implementation**:

```javascript
// Get magnet world position from central store
const magnetWorld = useMagnetStore.getState().getMagnetWorld();

if (magnetWorld) {
  const magnetScreen = worldToScreen(magnetWorld, viewport);

  magnetSprite.x = magnetScreen.x;
  magnetSprite.y = magnetScreen.y;
  magnetSprite.zIndex = getMagnetRenderLayer(magnetWorld.z);
}
```

### 8. UI Layer (Z-index based, not world-space)

- **Purpose**: User interface elements (overlays screen)
- **Contents**: Quadrant grid, text, notifications, debug display
- **Performance**: Updated on state changes only
- **Z-Index**: Highest (always on top)
- **Special**: Not part of world space - positioned in screen coordinates

**Example**:

```javascript
const uiLayer = new PIXI.Container();
uiLayer.zIndex = 10000; // Always on top

// Debug text positioned in screen space (bottom-left corner)
debugText.x = 10;
debugText.y = app.screen.height - 80;
uiLayer.addChild(debugText);
```

## Implementation Pattern

### Setup Phase

**UPDATED:** Layers positioned using world-space projection:

```javascript
import {
  WORLD_Z,
  createViewport,
  getSurfaceScreenBounds,
  projectToScreen,
  WORLD_Y,
} from '../mechanics/worldConstants.js';

setupScene() {
  // Create viewport for projection
  const viewport = createViewport(
    this.app.screen.width,
    this.app.screen.height
  );

  // Get screen bounds for each surface
  const walkwayBounds = getSurfaceScreenBounds(WORLD_Z.WALKWAY, viewport);
  const waterBounds = getSurfaceScreenBounds(WORLD_Z.WATER_SURFACE, viewport);
  const riverbedBounds = getSurfaceScreenBounds(WORLD_Z.RIVERBED, viewport);

  // Wall is vertical surface - calculate from Z-span
  const wallTop = projectToScreen(0, WORLD_Y.WALL_EDGE, WORLD_Z.WALKWAY, viewport);
  const wallBottom = projectToScreen(0, WORLD_Y.WALL_EDGE, WORLD_Z.RIVERBED, viewport);

  // Create layer graphics using projected bounds
  this.walkwayLayer = this.createWalkwayLayer(walkwayBounds);
  this.wallLayer = this.createWallLayer(wallTop.y, wallBottom.y - wallTop.y);
  this.riverbedLayer = this.createRiverbedLayer(riverbedBounds);
  this.waterLayer = this.createWaterLayer(waterBounds);
  this.itemLayer = new PIXI.Container();
  this.uiLayer = new PIXI.Container();

  // Add to stage in render order (back to front)
  this.app.stage.addChild(this.walkwayLayer);  // RENDER_LAYERS.WALKWAY (0)
  // Avatar added here (RENDER_LAYERS.AVATAR = 1)
  this.app.stage.addChild(this.wallLayer);     // RENDER_LAYERS.WALL_FACE (2)
  this.app.stage.addChild(this.riverbedLayer); // RENDER_LAYERS.RIVERBED (3)
  this.app.stage.addChild(this.itemLayer);     // RENDER_LAYERS.ITEMS_ON_RIVERBED (4)
  this.app.stage.addChild(this.waterLayer);    // RENDER_LAYERS.WATER_SURFACE (5)
  // Magnet added dynamically with Z-based layer
  this.app.stage.addChild(this.uiLayer);       // UI (zIndex: 10000)

  // Enable sorting for dynamic Z-ordering
  this.app.stage.sortableChildren = true;
}

createWalkwayLayer(bounds) {
  const layer = new PIXI.Graphics();
  layer.rect(0, bounds.top, this.app.screen.width, bounds.bottom - bounds.top);
  layer.fill({ color: 0x7f8c8d });
  layer.zIndex = RENDER_LAYERS.WALKWAY;
  return layer;
}

createWallLayer(y, height) {
  const layer = new PIXI.Graphics();
  layer.rect(0, y, this.app.screen.width, height);
  layer.fill({ color: 0x6c5b4a });
  layer.zIndex = RENDER_LAYERS.WALL_FACE;
  return layer;
}

// ... similar for other layers
```

### Dynamic Updates

**UPDATED:** World-space position tracking with magnet store:

```javascript
import useMagnetStore from '../state/magnetStore.js';
import { worldToScreen, createViewport } from '../mechanics/worldConstants.js';

updateSprites() {
  const viewport = createViewport(
    this.app.screen.width,
    this.app.screen.height
  );

  // Get magnet world position from central store
  const magnetWorld = useMagnetStore.getState().getMagnetWorld();

  if (magnetWorld) {
    // Create/update magnet sprite
    if (!this.magnetSprite) {
      this.magnetSprite = createMagnetSprite();
      this.app.stage.addChild(this.magnetSprite);
    }

    // Project world position to screen
    const magnetScreen = worldToScreen(magnetWorld, viewport);
    this.magnetSprite.x = magnetScreen.x;
    this.magnetSprite.y = magnetScreen.y;

    // Dynamic Z-based layer assignment
    this.magnetSprite.zIndex = getMagnetRenderLayer(magnetWorld.z);

    // Store world position for depth sorting if needed
    this.magnetSprite.worldY = magnetWorld.y;
    this.magnetSprite.worldZ = magnetWorld.z;
  } else {
    // Clean up when magnet not active
    if (this.magnetSprite) {
      this.app.stage.removeChild(this.magnetSprite);
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

**UPDATED:** Depth sorting now uses world Y coordinate:

For items on the riverbed, sprites should render based on their world Y position (depth into scene):

```javascript
// Sort item layer so items "further away" (higher worldY) render first
this.itemLayer.children.sort((a, b) => a.worldY - b.worldY);

// When adding item sprite, store world Y for sorting
const itemWorld = { x: 250, y: 3.5, z: WORLD_Z.RIVERBED };
const itemScreen = worldToScreen(itemWorld, viewport);

const itemSprite = createItemSprite(item);
itemSprite.x = itemScreen.x;
itemSprite.y = itemScreen.y;
itemSprite.worldY = itemWorld.y;  // Store for depth sorting

this.itemLayer.addChild(itemSprite);

// Resort after adding/moving sprites
updateItemDepth() {
  this.itemLayer.children.sort((a, b) => a.worldY - b.worldY);
}
```

**Why World Y for Sorting:**

- Screen Y includes Z-offset (screenY = worldY - worldZ)
- Items at same Z but different worldY should sort by worldY
- Higher worldY = further into scene = should render first (behind)
- World Y represents true depth in the 3D scene

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
