/**
 * Debug Overlay for Item Spawning
 * Visualizes spawn tables, weights, and spawn events
 */

import * as PIXI from "pixi.js";
import { getLocation, getQuadrantZone } from "../data/locationDatabase.js";

export class DebugOverlay {
  constructor(app, width, height, locationStore = null) {
    this.app = app;
    this.width = width;
    this.height = height;
    this.locationStore = locationStore;
    this.currentLocationId = null; // Track current location for lazy marker creation

    // Enable sortable children on stage for z-index to work
    this.app.stage.sortableChildren = true;

    this.container = new PIXI.Container();
    this.container.zIndex = 10000; // Always on top
    this.visible = false;

    // Debug panel graphics
    this.panel = null;
    this.spawnLog = [];
    this.maxLogEntries = 10;

    // Engaged item markers
    this.engagedItemMarkers = new PIXI.Container();
    this.engagedItemMarkers.sortableChildren = true;
    this.engagedItemMarkers.zIndex = 9998; // Below panel but above game
    this.engagedItemMarkers.visible = false; // Hidden by default
    this.app.stage.addChild(this.engagedItemMarkers);

    this.setupPanel();
    this.app.stage.addChild(this.container);
    this.container.visible = false;
  }

  setupPanel() {
    // Semi-transparent black background
    this.panel = new PIXI.Graphics();
    this.panel.rect(10, 10, 400, this.height - 20).fill({
      color: 0x000000,
      alpha: 0.85,
    });
    this.container.addChild(this.panel);

    // Title
    const title = new PIXI.Text({
      text: "SPAWN DEBUG OVERLAY",
      style: {
        fontSize: 16,
        fill: 0x00ff00,
        fontFamily: "monospace",
        fontWeight: "bold",
      },
    });
    title.x = 20;
    title.y = 20;
    this.container.addChild(title);

    // Instructions
    const instructions = new PIXI.Text({
      text: "Press 'D' to toggle | 'C' to clear items",
      style: {
        fontSize: 12,
        fill: 0xaaaaaa,
        fontFamily: "monospace",
      },
    });
    instructions.x = 20;
    instructions.y = 40;
    this.container.addChild(instructions);

    // Create text container for dynamic content
    this.textContainer = new PIXI.Container();
    this.textContainer.x = 20;
    this.textContainer.y = 70;
    this.container.addChild(this.textContainer);
  }

  /**
   * Resize overlay elements on app resize
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.panel) {
      this.panel.clear();
      this.panel.rect(10, 10, 400, this.height - 20).fill({
        color: 0x000000,
        alpha: 0.85,
      });
    }
    if (this.visible) {
      this.updateDisplay();
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    this.engagedItemMarkers.visible = this.visible;

    // When becoming visible, update markers with current location
    if (this.visible && this.currentLocationId) {
      this.showEngagedItemMarkers(this.currentLocationId);
      this.updateDisplay();
    }

    console.log(`[DEBUG] Overlay ${this.visible ? "enabled" : "disabled"}`);
    console.log(
      `[DEBUG] Container visible: ${this.container.visible}, Markers visible: ${this.engagedItemMarkers.visible}`,
    );
    console.log(
      `[DEBUG] Markers has ${this.engagedItemMarkers.children.length} children`,
    );
  }

  /**
   * Log a spawn event
   * @param {object} event - Spawn event data
   */
  logSpawnEvent(event) {
    const timestamp = new Date().toLocaleTimeString();
    this.spawnLog.unshift({
      timestamp,
      ...event,
    });

    // Keep only recent entries
    if (this.spawnLog.length > this.maxLogEntries) {
      this.spawnLog.pop();
    }

    if (this.visible) {
      this.updateDisplay();
    }
  }

  /**
   * Display spawn table for a quadrant
   * @param {number} quadrant - Quadrant number (0-9)
   * @param {string} locationId - Location ID
   */
  showSpawnTable(quadrant, locationId) {
    const location = getLocation(locationId);
    if (!location) return;

    const zone = getQuadrantZone(quadrant);
    const spawnTable = location.spawnTables[zone];

    if (!spawnTable) return;

    // Calculate probabilities
    const itemWeights = Object.entries(spawnTable.items);
    const totalItemWeight = itemWeights.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    );
    const totalWeight = totalItemWeight + spawnTable.nothingWeight;

    const nothingChance = (
      (spawnTable.nothingWeight / totalWeight) *
      100
    ).toFixed(1);

    // Store for display
    this.currentSpawnTable = {
      quadrant,
      zone,
      location: locationId,
      nothingChance,
      items: itemWeights.map(([id, weight]) => ({
        id,
        weight,
        chance: ((weight / totalWeight) * 100).toFixed(1),
      })),
    };

    if (this.visible) {
      this.updateDisplay();
    }
  }

  /**
   * Update the debug display
   */
  updateDisplay() {
    // Clear previous text
    this.textContainer.removeChildren();

    let yOffset = 0;

    // Current spawn table section
    if (this.currentSpawnTable) {
      const { quadrant, zone, nothingChance, items } = this.currentSpawnTable;

      const header = this.createText(
        `QUADRANT ${quadrant} (${zone.toUpperCase()} ZONE)`,
        0xffff00,
        14,
      );
      header.y = yOffset;
      this.textContainer.addChild(header);
      yOffset += 25;

      const nothingText = this.createText(
        `Nothing: ${nothingChance}%`,
        0xff6666,
        12,
      );
      nothingText.y = yOffset;
      this.textContainer.addChild(nothingText);
      yOffset += 20;

      // Item list
      items.forEach(({ id, chance }) => {
        const itemText = this.createText(`${id}: ${chance}%`, 0x66ff66, 11);
        itemText.y = yOffset;
        itemText.x = 10;
        this.textContainer.addChild(itemText);
        yOffset += 18;
      });

      yOffset += 20;
    }

    // Spawn log section
    if (this.spawnLog.length > 0) {
      const logHeader = this.createText("RECENT SPAWNS", 0xffff00, 14);
      logHeader.y = yOffset;
      this.textContainer.addChild(logHeader);
      yOffset += 25;

      this.spawnLog.forEach((entry) => {
        const color = entry.success ? 0x00ff00 : 0xff6666;
        const result = entry.success ? entry.itemName : "NOTHING";

        const logText = this.createText(
          `[${entry.timestamp.slice(-8)}] Q${entry.quadrant} → ${result}`,
          color,
          11,
        );
        logText.y = yOffset;
        this.textContainer.addChild(logText);
        yOffset += 18;

        if (entry.success) {
          const statusTag = entry.isEngaged ? "[RE-ENGAGED]" : "[NEW]";
          const distText =
            entry.distance != null ? `${entry.distance.toFixed(1)}m` : "N/A";
          const magText =
            entry.magnetSurfacePosition != null
              ? entry.magnetSurfacePosition.toFixed(1)
              : "N/A";
          const details = this.createText(
            `  ${statusTag} Dist: ${distText} | Mag: ${magText} | ${entry.placement}`,
            entry.isEngaged ? 0xff8800 : 0xaaaaaa,
            10,
          );
          details.y = yOffset;
          this.textContainer.addChild(details);
          yOffset += 18;
        }
      });
    }

    // Engaged items section
    if (this.locationStore) {
      const currentLocation =
        this.currentSpawnTable?.location || "picturesque-river";
      const engagedItems = this.locationStore
        .getState()
        .getEngagedItems(currentLocation);
      const itemCount = Object.keys(engagedItems).length;

      if (itemCount > 0) {
        yOffset += 10;
        const engagedHeader = this.createText(
          `ENGAGED ITEMS (${itemCount})`,
          0xff8800,
          14,
        );
        engagedHeader.y = yOffset;
        this.textContainer.addChild(engagedHeader);
        yOffset += 25;

        Object.entries(engagedItems).forEach(([, data]) => {
          const itemText = this.createText(
            `Q${data.quadrant}: ${data.item.name} (${data.size}px)`,
            0xffaa00,
            11,
          );
          itemText.y = yOffset;
          itemText.x = 10;
          this.textContainer.addChild(itemText);
          yOffset += 18;
        });
      }
    }
  }

  /**
   * Show engaged item markers on the game view
   * @param {string} locationId - Current location
   */
  showEngagedItemMarkers(locationId) {
    // Clear previous markers
    this.engagedItemMarkers.removeChildren();

    if (!this.locationStore) {
      console.log("[DEBUG] No locationStore available");
      return;
    }

    const engagedItems = this.locationStore
      .getState()
      .getEngagedItems(locationId);

    const itemCount = Object.keys(engagedItems).length;
    console.log(
      `[DEBUG] Showing ${itemCount} engaged items for location: ${locationId}`,
    );

    if (itemCount === 0) {
      // Show a message that there are no engaged items
      const noItemsText = new PIXI.Text({
        text: "No engaged items yet\nCast and lose an item to see markers",
        style: {
          fontSize: 14,
          fill: 0xff8800,
          fontFamily: "monospace",
          align: "center",
        },
      });
      noItemsText.anchor.set(0.5);
      noItemsText.x = this.app.screen.width / 2;
      noItemsText.y = 150;
      this.engagedItemMarkers.addChild(noItemsText);
    } else {
      Object.entries(engagedItems).forEach(([, data]) => {
        console.log(
          `[DEBUG] Creating marker at (${data.x}, ${data.y}) for ${data.item.name}, size: ${data.size}px`,
        );

        // Draw circle at item position
        const marker = new PIXI.Graphics();
        marker
          .circle(0, 0, data.size / 2)
          .stroke({ width: 3, color: 0xff8800, alpha: 0.9 });
        marker.circle(0, 0, 5).fill({ color: 0xff8800 }); // Center dot (larger)
        marker.x = data.x;
        marker.y = data.y;
        marker.zIndex = 9999; // Ensure markers are on top

        // Add label with background
        const labelBg = new PIXI.Graphics();
        const labelText = new PIXI.Text({
          text: `${data.item.name} (${data.size}px)`,
          style: {
            fontSize: 11,
            fill: 0xffaa00,
            fontFamily: "monospace",
            fontWeight: "bold",
          },
        });
        labelText.anchor.set(0.5, 1);
        labelText.x = 0;
        labelText.y = -data.size / 2 - 8;

        // Background for label
        const padding = 4;
        labelBg
          .rect(
            -labelText.width / 2 - padding,
            labelText.y - labelText.height - padding,
            labelText.width + padding * 2,
            labelText.height + padding * 2,
          )
          .fill({ color: 0x000000, alpha: 0.7 });

        marker.addChild(labelBg);
        marker.addChild(labelText);

        this.engagedItemMarkers.addChild(marker);
      });
    }

    // Sync visibility with debug overlay
    this.engagedItemMarkers.visible = this.visible;
    console.log(
      `[DEBUG] Markers container visible: ${this.engagedItemMarkers.visible}, has ${this.engagedItemMarkers.children.length} children`,
    );
  }

  /**
   * Update engaged item display
   * Only creates markers if debug overlay is visible
   */
  updateEngagedItems(locationId) {
    // Only update markers if debug overlay is visible
    if (this.visible) {
      this.showEngagedItemMarkers(locationId);
      this.updateDisplay();
    }
    // If not visible, just store the location for when it becomes visible
    else {
      this.currentLocationId = locationId;
    }
  }

  /**
   * Create styled text
   */
  createText(text, color = 0xffffff, fontSize = 12) {
    return new PIXI.Text({
      text,
      style: {
        fontSize,
        fill: color,
        fontFamily: "monospace",
      },
    });
  }

  /**
   * Highlight quadrant on click (visual feedback)
   */
  highlightQuadrant(quadrant, x, y) {
    // Remove previous highlight
    if (this.highlight) {
      this.highlight.destroy();
    }

    // Create highlight circle at click position
    this.highlight = new PIXI.Graphics();
    this.highlight.circle(x, y, 30).fill({ color: 0xffff00, alpha: 0.3 });
    this.highlight.circle(x, y, 30).stroke({ width: 2, color: 0xffff00 });

    // Add quadrant label
    const label = new PIXI.Text({
      text: `Q${quadrant}`,
      style: {
        fontSize: 20,
        fill: 0xffff00,
        fontWeight: "bold",
      },
    });
    label.anchor.set(0.5);
    label.x = x;
    label.y = y;
    this.highlight.addChild(label);

    this.app.stage.addChild(this.highlight);

    // Fade out and remove after 0.5 seconds
    setTimeout(() => {
      if (this.highlight) {
        this.highlight.destroy();
        this.highlight = null;
      }
    }, 500);
  }

  destroy() {
    if (this.highlight) {
      this.highlight.destroy();
    }
    if (this.engagedItemMarkers) {
      this.engagedItemMarkers.destroy({ children: true });
    }
    this.container.destroy({ children: true });
  }
}
