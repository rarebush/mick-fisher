/**
 * Session Store - Manages fishing session state
 * Handles timer, active fishing mechanics (drag/lift), and temporary state
 */

import { create } from "zustand";

const useSessionStore = create((set, get) => ({
  // Session timing
  sessionTimeRemaining: 600, // 10 minutes in seconds
  sessionActive: false,

  // Drag phase state
  dragState: {
    active: false,
    tension: 0, // 0-100%
    distance: 0, // meters from shore (decreases as item approaches)
    totalDistance: 0, // initial distance (for progress tracking)
    magnetPosition: 50, // 0-100 units on item surface (positional slip model)
    magnetContactWidth: 10, // width of magnet contact area
    slipDirection: 0, // -1 = left, 1 = right, 0 = not yet determined
    dragMemory: [], // Array of {timestamp, tension, distance} for pattern detection
  },

  // Lift phase state
  liftState: {
    active: false,
    depth: 0, // current depth in meters
    totalDepth: 0, // initial depth
    tapTimestamps: [], // for tap rate calculation
    slipAccumulated: 0, // carries over from drag + new accumulation
    revealed: false, // false = blind lift, true = revealed lift
  },

  // Actions - Session Control
  startSession: () => {
    set({
      sessionActive: true,
      sessionTimeRemaining: 600,
    });
  },

  endSession: () => {
    set({
      sessionActive: false,
      sessionTimeRemaining: 0,
    });
  },

  tickTimer: () => {
    const state = get();
    if (state.sessionActive && state.sessionTimeRemaining > 0) {
      set({ sessionTimeRemaining: state.sessionTimeRemaining - 1 });

      // Auto-end session when time runs out
      if (state.sessionTimeRemaining <= 1) {
        state.endSession();
      }
    }
  },

  // Actions - Drag Phase
  startDrag: (distance, magnetPosition = 50, magnetContactWidth = 10) => {
    // Determine slip direction based on initial position
    const distanceToLeftEdge = magnetPosition;
    const distanceToRightEdge = 100 - magnetPosition;
    const slipDirection = distanceToLeftEdge < distanceToRightEdge ? -1 : 1;

    set({
      dragState: {
        active: true,
        tension: 0,
        distance,
        totalDistance: distance,
        magnetPosition,
        magnetContactWidth,
        slipDirection,
        dragMemory: [],
      },
    });
  },

  updateDragTension: (tension) => {
    const state = get();
    const timestamp = performance.now();

    // Update drag memory (keep last 10 seconds)
    const newMemory = [
      ...state.dragState.dragMemory.filter(
        (m) => timestamp - m.timestamp < 10000,
      ),
      { timestamp, tension, distance: state.dragState.distance },
    ];

    set({
      dragState: {
        ...state.dragState,
        tension: Math.max(0, Math.min(100, tension)),
        dragMemory: newMemory,
      },
    });
  },

  updateDragProgress: (distance, magnetPosition) => {
    set((state) => ({
      dragState: {
        ...state.dragState,
        distance: Math.max(0, distance),
        magnetPosition: Math.max(0, Math.min(100, magnetPosition)),
      },
    }));
  },

  completeDrag: () => {
    const state = get();
    set({
      dragState: {
        ...state.dragState,
        active: false,
      },
    });
    return state.dragState.magnetPosition;
  },

  // Actions - Lift Phase
  startLift: (depth, carryOverSlip = 0) => {
    set({
      liftState: {
        active: true,
        depth,
        totalDepth: depth,
        tapTimestamps: [],
        slipAccumulated: carryOverSlip,
        revealed: false,
      },
    });
  },

  recordTap: () => {
    const state = get();
    const timestamp = performance.now();

    // Keep only taps from last 2 seconds for rate calculation
    const recentTaps = state.liftState.tapTimestamps.filter(
      (t) => timestamp - t < 2000,
    );

    set({
      liftState: {
        ...state.liftState,
        tapTimestamps: [...recentTaps, timestamp],
      },
    });
  },

  updateLiftProgress: (depth, slipAccumulated) => {
    set((state) => ({
      liftState: {
        ...state.liftState,
        depth: Math.max(0, depth),
        slipAccumulated: Math.max(0, Math.min(100, slipAccumulated)),
      },
    }));
  },

  revealItem: () => {
    set((state) => ({
      liftState: {
        ...state.liftState,
        revealed: true,
      },
    }));
  },

  completeLift: () => {
    const state = get();
    const finalSlip = state.liftState.slipAccumulated;

    set({
      liftState: {
        active: false,
        depth: 0,
        totalDepth: 0,
        tapTimestamps: [],
        slipAccumulated: 0,
        revealed: false,
      },
    });

    return finalSlip;
  },

  // Utility
  getTapRate: () => {
    const state = get();
    const now = performance.now();
    const recentTaps = state.liftState.tapTimestamps.filter(
      (t) => now - t < 2000,
    );

    if (recentTaps.length < 2) return 0;

    // Calculate taps per second
    const timeSpan = (recentTaps[recentTaps.length - 1] - recentTaps[0]) / 1000;
    return timeSpan > 0 ? recentTaps.length / timeSpan : 0;
  },

  reset: () =>
    set({
      sessionActive: false,
      sessionTimeRemaining: 600,
      dragState: {
        active: false,
        tension: 0,
        distance: 0,
        totalDistance: 0,
        magnetPosition: 50,
        magnetContactWidth: 10,
        slipDirection: 0,
        dragMemory: [],
      },
      liftState: {
        active: false,
        depth: 0,
        totalDepth: 0,
        tapTimestamps: [],
        slipAccumulated: 0,
        revealed: false,
      },
    }),
}));

export default useSessionStore;
