/**
 * Session Store - Manages fishing session state
 * Handles timer, active fishing mechanics (drag/lift), and temporary state
 */

import { create } from "zustand";
import useMagnetStore from "./magnetStore.js";

const DEFAULT_CAST_AIM_STATE = {
  phase: "idle", // idle | angle | power
  angle: 0, // degrees
  power: 0, // 0..1
  angleDir: 1,
  powerDir: 1,
  angleSpeed: 120, // deg/sec
  powerSpeed: 0.8, // units/sec
  lastUpdate: 0,
};

const DEFAULT_DONUT_AIM_STATE = {
  phase: "idle", // idle | target | oscillate | locked
  target: null, // { x, y }
  minRadius: 0,
  maxRadius: 0,
  currentRadius: 0,
  minRadiusX: 0,
  minRadiusY: 0,
  maxRadiusX: 0,
  maxRadiusY: 0,
  currentRadiusX: 0,
  currentRadiusY: 0,
  aspectRatioX: 1,
  aspectRatioY: 1,
  radiusDir: 1,
  radiusSpeed: 80, // pixels/sec
  lastUpdate: 0,
};

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
    distance: 0, // meters from shore (decreases as item approaches)
    totalDistance: 0, // initial distance (for progress tracking)
    magnetSurfacePosition: 50, // 0-100 units on item surface (positional slip model)
    magnetContactWidth: 6, // width of magnet contact area (reduced for more slip risk)
    slipDirection: 0, // -1 = left, 1 = right, 0 = not yet determined
    dragMemory: [], // Array of {timestamp, tension, distance} for pattern detection
    quadrant: 0, // Which quadrant was cast into
    velocity: 0, // Current drag velocity (m/s) - for easing acceleration
    accelerationTime: 0, // Time since last speed change (for easing)
    overloadTimer: 0, // Seconds at/above max tension while holding
  },

  // Lift phase state
  liftState: {
    active: false,
    depth: 0, // current depth in meters
    totalDepth: 0, // initial depth
    tapTimestamps: [], // for tap rate calculation
    slipAccumulated: 0, // carries over from drag + new accumulation
    revealed: false, // false = blind lift, true = revealed lift
    magnetSurfacePosition: null, // Optional, used by SlipMeter in revealed phase
  },

  // 3D Rope physics state
  rope: null, // Rope3D instance
  ropeTension: 0, // Single source of truth for rope tension
  phase: "idle", // Current phase: 'idle', 'cast', 'drag', 'lift'
  phaseProgress: 0, // Phase completion (0 to 1)
  castPosition: null, // Cast landing position (set before drag starts, for rope rendering)
  castInputMode: "click", // click | direction_power | donut
  castAimState: { ...DEFAULT_CAST_AIM_STATE },
  donutAimState: { ...DEFAULT_DONUT_AIM_STATE },

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
    magnetSurfacePosition = 50,
    magnetContactWidth = 6,
    quadrant = 0,
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
        distance,
        totalDistance: distance,
        magnetSurfacePosition,
        magnetContactWidth,
        slipDirection,
        dragMemory: [],
        quadrant,
        overloadTimer: 0,
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
      ropeTension: Math.max(0, tension),
      dragState: {
        ...state.dragState,
        dragMemory: newMemory,
      },
    });
  },

  setRopeTension: (tension) => {
    set({ ropeTension: Math.max(0, tension) });
  },

  updateDragProgress: (
    distance,
    magnetSurfacePosition,
    velocity,
    accelerationTime,
    overloadTimer,
  ) => {
    set((state) => ({
      dragState: {
        ...state.dragState,
        distance: Math.max(0, distance),
        magnetSurfacePosition: magnetSurfacePosition, // Allow position to go beyond 0-100 for slip-off detection
        velocity: velocity || 0,
        accelerationTime: accelerationTime || 0,
        overloadTimer:
          overloadTimer === undefined
            ? state.dragState.overloadTimer
            : Math.max(0, overloadTimer),
      },
    }));
  },

  completeDrag: () => {
    const state = get();

    // Despawn magnet
    useMagnetStore.getState().despawnMagnet();

    set({
      phase: "idle", // Reset phase
      phaseProgress: 0,
      ropeTension: 0,
      dragState: {
        ...state.dragState,
        active: false,
        dragMemory: [],
        velocity: 0,
        accelerationTime: 0,
        overloadTimer: 0,
      },
    });
    return state.dragState.magnetSurfacePosition;
  },

  // Deactivate drag without completing (for manual failure)
  deactivateDrag: () => {
    // Despawn magnet
    useMagnetStore.getState().despawnMagnet();

    set((state) => ({
      ropeTension: 0,
      dragState: {
        ...state.dragState,
        active: false,
        dragMemory: [],
        velocity: 0,
        accelerationTime: 0,
        overloadTimer: 0,
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

  setCastPosition: (x, y) =>
    set({
      castPosition: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null,
    }),

  setCastInputMode: (mode) => set({ castInputMode: mode }),

  startCastAimAngle: () =>
    set({
      castAimState: {
        ...DEFAULT_CAST_AIM_STATE,
        phase: "angle",
        lastUpdate: performance.now(),
      },
    }),

  lockCastAimAngle: () =>
    set((state) => ({
      castAimState: {
        ...state.castAimState,
        phase: "power",
        power: 0,
        powerDir: 1,
        lastUpdate: performance.now(),
      },
    })),

  resetCastAim: () =>
    set({
      castAimState: { ...DEFAULT_CAST_AIM_STATE },
    }),

  startDonutAim: (target, minRadius, maxRadius, aspectRatioX, aspectRatioY) =>
    set({
      donutAimState: {
        ...DEFAULT_DONUT_AIM_STATE,
        phase: "target",
        target,
        minRadius,
        maxRadius,
        currentRadius: minRadius,
        minRadiusX: minRadius * (aspectRatioX ?? 1),
        minRadiusY: minRadius * (aspectRatioY ?? 1),
        maxRadiusX: maxRadius * (aspectRatioX ?? 1),
        maxRadiusY: maxRadius * (aspectRatioY ?? 1),
        currentRadiusX: minRadius * (aspectRatioX ?? 1),
        currentRadiusY: minRadius * (aspectRatioY ?? 1),
        aspectRatioX: aspectRatioX ?? 1,
        aspectRatioY: aspectRatioY ?? 1,
        lastUpdate: performance.now(),
      },
    }),

  startDonutOscillation: () =>
    set((state) => ({
      donutAimState: {
        ...state.donutAimState,
        phase: "oscillate",
        lastUpdate: performance.now(),
      },
    })),

  lockDonutAim: () =>
    set((state) => ({
      donutAimState: {
        ...state.donutAimState,
        phase: "locked",
        lastUpdate: performance.now(),
      },
    })),

  resetDonutAim: () =>
    set({
      donutAimState: { ...DEFAULT_DONUT_AIM_STATE },
    }),

  updateDonutAim: (deltaTime) =>
    set((state) => {
      const aim = state.donutAimState;
      if (aim.phase !== "oscillate") return {};

      let currentRadius =
        aim.currentRadius + aim.radiusDir * aim.radiusSpeed * deltaTime;
      let radiusDir = aim.radiusDir;

      if (currentRadius > aim.maxRadius) {
        currentRadius = aim.maxRadius;
        radiusDir = -1;
      } else if (currentRadius < aim.minRadius) {
        currentRadius = aim.minRadius;
        radiusDir = 1;
      }

      return {
        donutAimState: {
          ...aim,
          currentRadius,
          currentRadiusX: currentRadius * aim.aspectRatioX,
          currentRadiusY: currentRadius * aim.aspectRatioY,
          radiusDir,
          lastUpdate: performance.now(),
        },
      };
    }),

  updateCastAim: (deltaTime) =>
    set((state) => {
      const aim = state.castAimState;
      if (aim.phase === "idle") return {};

      if (aim.phase === "angle") {
        let angle = aim.angle + aim.angleDir * aim.angleSpeed * deltaTime;
        let angleDir = aim.angleDir;

        if (angle > 90) {
          angle = 90;
          angleDir = -1;
        } else if (angle < -90) {
          angle = -90;
          angleDir = 1;
        }

        return {
          castAimState: {
            ...aim,
            angle,
            angleDir,
            lastUpdate: performance.now(),
          },
        };
      }

      if (aim.phase === "power") {
        let power = aim.power + aim.powerDir * aim.powerSpeed * deltaTime;
        let powerDir = aim.powerDir;

        if (power > 1) {
          power = 1;
          powerDir = -1;
        } else if (power < 0) {
          power = 0;
          powerDir = 1;
        }

        return {
          castAimState: {
            ...aim,
            power,
            powerDir,
            lastUpdate: performance.now(),
          },
        };
      }

      return {};
    }),

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
      castInputMode: "click",
      castAimState: { ...DEFAULT_CAST_AIM_STATE },
      donutAimState: { ...DEFAULT_DONUT_AIM_STATE },
      dragState: {
        active: false,
        distance: 0,
        totalDistance: 0,
        magnetSurfacePosition: 50,
        magnetContactWidth: 6,
        slipDirection: 0,
        dragMemory: [],
        overloadTimer: 0,
      },
      liftState: {
        active: false,
        depth: 0,
        totalDepth: 0,
        tapTimestamps: [],
        slipAccumulated: 0,
        revealed: false,
        magnetSurfacePosition: null,
      },
    }),
}));

export default useSessionStore;
