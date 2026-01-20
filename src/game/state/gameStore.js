/**
 * Game Store - Global game state management
 * Handles overall game state, phase transitions, and game loop
 */

import { create } from "zustand";

const useGameStore = create((set, get) => ({
  // Game phase state machine
  gamePhase: "idle", // 'idle' | 'casting' | 'sinking' | 'dragging' | 'lifting-blind' | 'revealing' | 'lifting-revealed' | 'complete'

  // Current location
  currentLocation: "picturesque-river",

  // Equipment stats (MVP: basic equipment, no upgrades yet)
  equipment: {
    magnetStrength: 50, // kg capacity
    lineLength: 8, // meters (allows Q0-Q3 only)
    lineTension: 100, // max tension before break
    hasWinch: false, // Phase 2 feature
  },

  // Current cast data
  currentCast: {
    quadrant: null, // 0-9
    distance: 0, // meters from shore
    depth: 0, // meters underwater
    itemId: null, // ID of caught item (null if nothing)
  },

  // Session statistics
  sessionStats: {
    castsTotal: 0,
    castsSuccessful: 0,
    itemsCaught: 0,
    itemsLost: 0,
  },

  // Actions
  setGamePhase: (phase) => set({ gamePhase: phase }),

  setLocation: (locationId) => set({ currentLocation: locationId }),

  startCast: (quadrant, distance, depth) => {
    set({
      gamePhase: "casting",
      currentCast: { quadrant, distance, depth, itemId: null },
    });

    // Increment cast counter
    set((state) => ({
      sessionStats: {
        ...state.sessionStats,
        castsTotal: state.sessionStats.castsTotal + 1,
      },
    }));
  },

  setCaughtItem: (itemId) => {
    set((state) => ({
      currentCast: { ...state.currentCast, itemId },
    }));
  },

  completeCast: (success) => {
    const state = get();

    set({
      gamePhase: "idle",
      sessionStats: {
        ...state.sessionStats,
        castsSuccessful: success
          ? state.sessionStats.castsSuccessful + 1
          : state.sessionStats.castsSuccessful,
        itemsCaught: success
          ? state.sessionStats.itemsCaught + 1
          : state.sessionStats.itemsCaught,
        itemsLost:
          !success && state.currentCast.itemId
            ? state.sessionStats.itemsLost + 1
            : state.sessionStats.itemsLost,
      },
      currentCast: {
        quadrant: null,
        distance: 0,
        depth: 0,
        itemId: null,
      },
    });
  },

  reset: () =>
    set({
      gamePhase: "idle",
      currentCast: { quadrant: null, distance: 0, depth: 0, itemId: null },
      sessionStats: {
        castsTotal: 0,
        castsSuccessful: 0,
        itemsCaught: 0,
        itemsLost: 0,
      },
    }),
}));

export default useGameStore;
