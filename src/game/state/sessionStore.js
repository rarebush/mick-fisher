/**
 * Session Store - Manages fishing session state
 * Handles timer, active fishing mechanics (drag/lift), and temporary state
 */

import { create } from "zustand";

const useSessionStore = create((set, get) => ({
  // Session timing
  sessionTimeRemaining: 600, // 10 minutes in seconds
  sessionActive: false,
  isPaused: false,

  // Drag hold state (managed by PixiApp)
  isDragging: false,

  // Drag phase state
  dragState: {
    active: false,
    tension: 0, // 0-100%
    distance: 0, // meters from shore (decreases as item approaches)
    totalDistance: 0, // initial distance (for progress tracking)
    magnetPosition: 50, // 0-100 units on item surface (positional slip model)
    magnetContactWidth: 6, // width of magnet contact area (reduced for more slip risk)
    slipDirection: 0, // -1 = left, 1 = right, 0 = not yet determined
    dragMemory: [], // Array of {timestamp, tension, distance} for pattern detection
    castPosition: { x: 0, y: 0 }, // Where the cast landed (for visual effects)
    quadrant: 0, // Which quadrant was cast into
    velocity: 0, // Current drag velocity (m/s) - for easing acceleration
    accelerationTime: 0, // Time since last speed change (for easing)
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

  // 3D Rope physics state
  rope: null, // Rope3D instance
  phase: "idle", // Current phase: 'idle', 'cast', 'drag', 'lift'
  phaseProgress: 0, // Phase completion (0 to 1)
  castPosition: null, // Cast landing position (set before drag starts, for rope rendering)

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

  pauseTimer: () => {
    set({ isPaused: true });
  },

  resumeTimer: () => {
    set({ isPaused: false });
  },

  tickTimer: () => {
    const state = get();
    if (
      state.sessionActive &&
      !state.isPaused &&
      state.sessionTimeRemaining > 0
    ) {
      set({ sessionTimeRemaining: state.sessionTimeRemaining - 1 });

      // Auto-end session when time runs out
      if (state.sessionTimeRemaining <= 1) {
        state.endSession();
      }
    }
  },

  // Actions - Drag Phase
  startDrag: (
    distance,
    magnetPosition = 50,
    magnetContactWidth = 6,
    castPosition = { x: 0, y: 0 },
    quadrant = 0,
    initialTension = 10, // Tension from end of cast animation
    slipDirection = 0, // Calculated by caller using calculateSlipDirection()
  ) => {
    // Reset rope physics state to prevent velocity carryover from animation
    const rope = get().rope;
    if (rope && rope.resetPhysicsState) {
      rope.resetPhysicsState();
    }

    set({
      isDragging: false, // Reset to ensure no auto-dragging
      phase: "drag", // Set phase for 3D rope physics
      phaseProgress: 0,
      dragState: {
        active: true,
        tension: initialTension, // Use tension from cast animation
        distance,
        totalDistance: distance,
        magnetPosition,
        magnetContactWidth,
        slipDirection,
        dragMemory: [],
        castPosition,
        quadrant,
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
        tension: Math.max(0, tension), // Allow tension > 100% for failure detection
        dragMemory: newMemory,
      },
    });
  },

  updateDragProgress: (
    distance,
    magnetPosition,
    velocity,
    accelerationTime,
  ) => {
    set((state) => ({
      dragState: {
        ...state.dragState,
        distance: Math.max(0, distance),
        magnetPosition: magnetPosition, // Allow position to go beyond 0-100 for slip-off detection
        velocity: velocity || 0,
        accelerationTime: accelerationTime || 0,
      },
    }));
  },

  completeDrag: () => {
    const state = get();
    set({
      phase: "idle", // Reset phase
      phaseProgress: 0,
      dragState: {
        ...state.dragState,
        active: false,
      },
    });
    return state.dragState.magnetPosition;
  },

  // Deactivate drag without completing (for manual failure)
  deactivateDrag: () => {
    set((state) => ({
      dragState: {
        ...state.dragState,
        active: false,
      },
    }));
  },

  // Actions - Lift Phase
  startLift: (depth, carryOverSlip = 0) => {
    set({
      phase: "lift", // Set phase for 3D rope physics
      phaseProgress: 0,
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
      phase: "idle", // Reset phase
      phaseProgress: 0,
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

  // Actions - 3D Rope Physics
  setRope: (rope) => set({ rope }),

  setPhase: (phase) => set({ phase }),

  setPhaseProgress: (progress) =>
    set({ phaseProgress: Math.max(0, Math.min(1, progress)) }),

  setCastPosition: (x, y) => set({ castPosition: { x, y } }),

  updatePhaseProgress: (delta) => {
    const state = get();
    const newProgress = state.phaseProgress + delta;
    set({ phaseProgress: Math.max(0, Math.min(1, newProgress)) });
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
      rope: null,
      phase: "idle",
      phaseProgress: 0,
      dragState: {
        active: false,
        tension: 0,
        distance: 0,
        totalDistance: 0,
        magnetPosition: 50,
        magnetContactWidth: 6,
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
