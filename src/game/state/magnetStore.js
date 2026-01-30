/**
 * Magnet Store - Centralized magnet state management
 * Manages magnet world position and lifecycle from spawn through all phases
 */

import { create } from "zustand";
import {
  WORLD_Z,
  WORLD_Y,
  getAvatarHandWorldPosition,
} from "../mechanics/worldConstants.js";

const useMagnetStore = create((set, get) => ({
  // Magnet world position (null when not spawned)
  magnetWorld: null, // { x, y, z } in world space

  // Magnet lifecycle state
  magnetActive: false, // true from throw start until retrieve/failure

  // Phase tracking
  magnetPhase: null, // 'throwing' | 'sinking' | 'settling' | 'dragging' | 'lifting'

  // Peak values for debugging
  peakValues: null, // { maxX, maxY, maxZ, minX, minY, minZ }

  /**
   * Spawn magnet at avatar position (start of cast)
   * @param {number} avatarWorldX - Avatar world X position
   */
  spawnMagnet: (avatarWorldX) => {
    const avatarHandWorld = getAvatarHandWorldPosition();
    const initialPos = {
      x: avatarWorldX,
      y: avatarHandWorld.y,
      z: avatarHandWorld.z,
    };
    set({
      magnetWorld: initialPos,
      magnetActive: true,
      magnetPhase: "throwing",
      peakValues: {
        maxX: initialPos.x,
        maxY: initialPos.y,
        maxZ: initialPos.z,
        minX: initialPos.x,
        minY: initialPos.y,
        minZ: initialPos.z,
      },
    });
  },

  /**
   * Update magnet world position and track peaks
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} z - World Z
   */
  updateMagnetPosition: (x, y, z) => {
    set((state) => {
      if (!state.magnetActive) return { magnetWorld: null };

      const newWorld = { x, y, z };
      const newPeaks = state.peakValues
        ? {
            maxX: Math.max(state.peakValues.maxX, x),
            maxY: Math.max(state.peakValues.maxY, y),
            maxZ: Math.max(state.peakValues.maxZ, z),
            minX: Math.min(state.peakValues.minX, x),
            minY: Math.min(state.peakValues.minY, y),
            minZ: Math.min(state.peakValues.minZ, z),
          }
        : null;

      return {
        magnetWorld: newWorld,
        peakValues: newPeaks,
      };
    });
  },

  /**
   * Set magnet phase
   * @param {string} phase - Current phase
   */
  setMagnetPhase: (phase) => {
    set({ magnetPhase: phase });
  },

  /**
   * Despawn magnet (end of retrieve or failure)
   */
  despawnMagnet: () => {
    set({
      magnetWorld: null,
      magnetActive: false,
      magnetPhase: null,
      peakValues: null,
    });
  },

  /**
   * Get magnet world position (null if not active)
   */
  getMagnetWorld: () => get().magnetWorld,

  /**
   * Get peak values (null if not active)
   */
  getPeakValues: () => get().peakValues,

  /**
   * Check if magnet is currently active
   */
  isMagnetActive: () => get().magnetActive,
}));

export default useMagnetStore;
