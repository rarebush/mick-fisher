/**
 * Inventory Store - Manages player inventory and items
 * Handles session catches, collection catalog, and item management
 */

import { create } from "zustand";

const useInventoryStore = create((set, get) => ({
  // Current session items (cleared when session ends)
  sessionItems: [],

  // Persistent collection catalog
  // Format: { itemId: { discovered: true, timesFound: 3, firstFoundDate: timestamp } }
  catalog: {},

  // Session value tracking
  sessionValue: 0,

  // Actions
  addItem: (item) => {
    const itemWithMetadata = {
      ...item,
      caughtAt: Date.now(),
      sessionId: Date.now(), // Simple session ID for now
    };

    set((state) => ({
      sessionItems: [...state.sessionItems, itemWithMetadata],
      sessionValue: state.sessionValue + item.value,
    }));

    // Update catalog
    get().updateCatalog(item.id);
  },

  removeItem: (itemId) => {
    set((state) => {
      const removedItem = state.sessionItems.find((item) => item.id === itemId);
      const valueChange = removedItem ? removedItem.value : 0;

      return {
        sessionItems: state.sessionItems.filter((item) => item.id !== itemId),
        sessionValue: state.sessionValue - valueChange,
      };
    });
  },

  updateCatalog: (itemId) => {
    set((state) => {
      const existing = state.catalog[itemId];

      return {
        catalog: {
          ...state.catalog,
          [itemId]: {
            discovered: true,
            timesFound: (existing?.timesFound || 0) + 1,
            firstFoundDate: existing?.firstFoundDate || Date.now(),
            lastFoundDate: Date.now(),
          },
        },
      };
    });
  },

  clearSession: () => {
    set({
      sessionItems: [],
      sessionValue: 0,
    });
  },

  // Getters
  getSessionItemCount: () => get().sessionItems.length,

  getSessionValue: () => get().sessionValue,

  getCatalogProgress: () => {
    const catalog = get().catalog;
    const discoveredCount = Object.keys(catalog).length;
    return {
      discovered: discoveredCount,
      total: 15, // MVP has 15 items
      percentage: Math.round((discoveredCount / 15) * 100),
    };
  },

  isItemDiscovered: (itemId) => {
    return !!get().catalog[itemId]?.discovered;
  },

  reset: () =>
    set({
      sessionItems: [],
      catalog: {},
      sessionValue: 0,
    }),
}));

export default useInventoryStore;
