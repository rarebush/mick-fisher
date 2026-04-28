/**
 * Game Store - Global game state management
 * Handles overall game state, phase transitions, and game loop
 */

import { create } from "zustand";
import { getDefaultFishingEquipment } from "../data/fishingEquipmentDatabase.js";
import { clamp } from "../physics/vectorUtils.js";

const useGameStore = create((set, get) => ({
  // Game phase state machine
  gamePhase: "idle", // 'idle' | 'casting' | 'waiting' | 'attaching' | 'dragging' | 'lifting-blind' | 'revealing' | 'lifting-revealed' | 'complete'

  // Current location
  currentLocation: "picturesque-river",

  // Equipment stats (MVP: basic equipment, no upgrades yet)
  equipment: {
    magnetStrength: 50, // kg capacity
    lineTension: 100, // max tension before break
    hasWinch: false, // Phase 2 feature
  },
  selectedCastingEquipmentId: "hand",
  fishingEquipment: getDefaultFishingEquipment(),

  // Current cast data
  currentCast: {
    quadrant: null, // 0-9
    distance: 0, // meters from shore
    depth: 0, // meters underwater
    itemId: null, // ID of caught item (null if nothing)
    tension: 0, // Rope tension throughout cast sequence (0-100)
  },

  // Last completed cast (for notifications)
  lastCompletedCast: null,

  // Session statistics
  sessionStats: {
    castsTotal: 0,
    castsSuccessful: 0,
    itemsCaught: 0,
    itemsLost: 0,
  },

  // Visual toggles
  renderScaleMode: "auto", // 'auto' | 'integer'
  renderResolutionScale: 1, // Internal render resolution multiplier
  currentSpeed: 1, // Water flow speed multiplier (1 = default)
  choppiness: 1, // Water choppiness multiplier (1 = default)
  cloudCover: 0.5, // Cloud cover 0-1 (0 = clear, 1 = overcast)
  windSpeed: 1, // Wind speed multiplier for cloud drift (1 = default)
  windDirAngle: 0.5, // Wind direction slider 0-1 (0.5 = up)
  reflectionAlpha: 0.35, // Reflection opacity 0-1 (default 0.35)
  waterAlpha: 0.7, // Water surface base opacity (default 0.7)

  // Layer visibility toggles (for performance debugging)
  layerVisibility: {
    riverbed: true,
    submergedWalls: true,
    waterSurface: true,
    reflections: true,
    sparkles: true,
    sparkleBlooms: true,
    fluidFoam: true,
    edgeFoam: true,
    waterObjectsBelow: true,
    waterObjectsAbove: true,
    displacement: true,
    riverWall: true,
    walkway: true,
  },

  // Actions
  setGamePhase: (phase) => set({ gamePhase: phase }),

  setLocation: (locationId) => set({ currentLocation: locationId }),

  setCastingEquipmentId: (equipmentId) =>
    set({ selectedCastingEquipmentId: equipmentId }),

  setFishingEquipment: (type, tierId) =>
    set({
      fishingEquipment: {
        type,
        tierId,
      },
    }),

  setCurrentSpeed: (speed) => {
    const val = parseFloat(speed);
    set({ currentSpeed: Number.isFinite(val) ? val : 1 });
  },

  setChoppiness: (choppiness) => {
    const val = parseFloat(choppiness);
    set({ choppiness: Number.isFinite(val) ? val : 1 });
  },

  setCloudCover: (cloudCover) => {
    const val = parseFloat(cloudCover);
    set({
      cloudCover: Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.5,
    });
  },

  setWindSpeed: (windSpeed) => {
    const val = parseFloat(windSpeed);
    set({ windSpeed: Number.isFinite(val) ? val : 1 });
  },

  setWindDirAngle: (angle) => {
    const val = parseFloat(angle);
    set({ windDirAngle: Number.isFinite(val) ? clamp(val, 0, 1) : 0.5 });
  },

  setReflectionAlpha: (alpha) => {
    const val = parseFloat(alpha);
    set({
      reflectionAlpha: Number.isFinite(val)
        ? Math.max(0, Math.min(1, val))
        : 0.35,
    });
  },

  setWaterAlpha: (alpha) => {
    const val = parseFloat(alpha);
    set({
      waterAlpha: Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.7,
    });
  },

  toggleLayerVisibility: (layerKey) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerKey]: !state.layerVisibility[layerKey],
      },
    })),

  setRenderScaleMode: (mode) =>
    set({
      renderScaleMode: mode === "integer" ? "integer" : "auto",
    }),

  setRenderResolutionScale: (scale) => {
    const nextScale = Number.isFinite(scale) ? scale : 1;
    set({
      renderResolutionScale: clamp(nextScale, 1, 4),
    });
  },

  startCast: (quadrant, distance, depth) => {
    set({
      gamePhase: "casting",
      currentCast: { quadrant, distance, depth, itemId: null, tension: 40 }, // Start with throw momentum
    });

    // Increment cast counter
    set((state) => ({
      sessionStats: {
        ...state.sessionStats,
        castsTotal: state.sessionStats.castsTotal + 1,
      },
    }));
  },

  // Update tension during cast animation
  updateCastTension: (tension) => {
    set((state) => ({
      currentCast: { ...state.currentCast, tension },
    }));
  },

  setCaughtItem: (itemId) => {
    set((state) => ({
      currentCast: { ...state.currentCast, itemId },
    }));
  },

  completeCast: (success) => {
    const state = get();

    // Store the completed cast for notifications (both success and failure)
    const lastCompletedCast = { ...state.currentCast };

    set({
      gamePhase: "idle",
      lastCompletedCast,
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

  clearLastCompletedCast: () => {
    set({ lastCompletedCast: null });
  },

  reset: () =>
    set({
      gamePhase: "idle",
      currentCast: { quadrant: null, distance: 0, depth: 0, itemId: null },
      selectedCastingEquipmentId: "hand",
      fishingEquipment: getDefaultFishingEquipment(),
      renderScaleMode: "auto",
      renderResolutionScale: 1,
      currentSpeed: 1,
      choppiness: 1,
      cloudCover: 0.5,
      windSpeed: 1,
      windDirAngle: 0.5,
      reflectionAlpha: 0.35,
      waterAlpha: 0.7,
      sessionStats: {
        castsTotal: 0,
        castsSuccessful: 0,
        itemsCaught: 0,
        itemsLost: 0,
      },
    }),
}));

export default useGameStore;
