/**
 * Location Store - Manages location-specific state
 * Tracks engaged items (items that have been contacted but lost)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isPointInCircle } from "../mechanics/hitDetection.js";
import {
  WORLD_Z,
  createViewport,
  screenToWorld,
} from "../mechanics/worldConstants.js";

const useLocationStore = create(
  persist(
    (set, get) => ({
      // Location-specific engaged items
      // Structure: { locationId: { itemId: { item, x, y, worldX, worldY, size, sizeWorld, quadrant } } }
      engagedItems: {},

      /**
       * Save an item that was engaged with (magnet made contact)
       * @param {string} locationId - Location ID
       * @param {string} itemId - Unique item instance ID
       * @param {object} itemData - Item data with position and size
       */
      engageItem: (locationId, itemId, itemData) => {
        set((state) => ({
          engagedItems: {
            ...state.engagedItems,
            [locationId]: {
              ...state.engagedItems[locationId],
              [itemId]: {
                ...itemData,
                engagedAt: Date.now(),
              },
            },
          },
        }));
        const logX = Number.isFinite(itemData.worldX)
          ? itemData.worldX
          : itemData.x;
        const logY = Number.isFinite(itemData.worldY)
          ? itemData.worldY
          : itemData.y;
        console.log(
          `[LOCATION] Item engaged: ${itemData.item.name} at (${logX.toFixed(1)}, ${logY.toFixed(1)})`,
        );
      },

      /**
       * Remove an engaged item (successfully retrieved)
       * @param {string} locationId - Location ID
       * @param {string} itemId - Item instance ID
       */
      removeEngagedItem: (locationId, itemId) => {
        set((state) => {
          const locationItems = { ...state.engagedItems[locationId] };
          delete locationItems[itemId];
          return {
            engagedItems: {
              ...state.engagedItems,
              [locationId]: locationItems,
            },
          };
        });
        console.log(`[LOCATION] Item retrieved: ${itemId}`);
      },

      /**
       * Get all engaged items for a location
       * @param {string} locationId - Location ID
       * @returns {object} - Engaged items for location
       */
      getEngagedItems: (locationId) => {
        return get().engagedItems[locationId] || {};
      },

      /**
       * Check if cast position hits any engaged items
       * @param {string} locationId - Location ID
       * @param {number} x - Cast x position
       * @param {number} y - Cast y position
       * @param {number} quadrant - Quadrant number
       * @returns {object|null} - Hit item data or null
       */
      checkForHit: (locationId, x, y, quadrant) => {
        const locationItems = get().engagedItems[locationId] || {};
        const viewport = createViewport(window.innerWidth, window.innerHeight);
        const castWorld = screenToWorld(x, y, WORLD_Z.RIVERBED, viewport);

        // Check each engaged item in this quadrant
        for (const [itemId, itemData] of Object.entries(locationItems)) {
          if (itemData.quadrant !== quadrant) continue;

          const itemWorld =
            Number.isFinite(itemData.worldX) && Number.isFinite(itemData.worldY)
              ? { x: itemData.worldX, y: itemData.worldY }
              : screenToWorld(
                  itemData.x,
                  itemData.y,
                  WORLD_Z.RIVERBED,
                  viewport,
                );
          const sizeWorld = Number.isFinite(itemData.sizeWorld)
            ? itemData.sizeWorld
            : itemData.size / viewport.pixelsPerUnit;

          // Use pure function for hit detection
          if (
            isPointInCircle(
              castWorld.x,
              castWorld.y,
              itemWorld.x,
              itemWorld.y,
              sizeWorld / 2,
            )
          ) {
            console.log(
              `[LOCATION] HIT! Cast hit engaged item: ${itemData.item.name}`,
            );
            return {
              itemId,
              ...itemData,
              worldX: itemWorld.x,
              worldY: itemWorld.y,
              sizeWorld,
            };
          }
        }

        return null;
      },

      /**
       * Clear all engaged items for a location
       * @param {string} locationId - Location ID
       */
      clearLocation: (locationId) => {
        set((state) => {
          const newEngaged = { ...state.engagedItems };
          delete newEngaged[locationId];
          return { engagedItems: newEngaged };
        });
      },

      /**
       * Clear all engaged items (debug/reset)
       */
      clearAll: () => {
        set({ engagedItems: {} });
      },
    }),
    {
      name: "mick-fisher-locations", // localStorage key
      version: 1,
    },
  ),
);

export default useLocationStore;
