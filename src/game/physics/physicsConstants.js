/**
 * Simulation tuning hub for drag-phase systems.
 *
 * This module intentionally contains multiple constant groups used across:
 * - Core drag/line physics
 * - Fish fight behavior and fish target initialization
 * - Metallic target profile derivation and slip
 * - Wait/strike phase timing
 *
 * Keeping these in one file preserves a single balancing surface while
 * making ownership explicit via grouped exports.
 */

// Core line/drag simulation constants.
export const PHYSICS_CONSTANTS = {
  STATIC_FRICTION_COEFFICIENT: 0.8,
  KINETIC_FRICTION_COEFFICIENT: 0.2,
  KINETIC_DRAG_BASE: 5,
  ROPE_SYSTEM_INERTIA: 50,
  TENSION_DECAY_BASE: 30,
  REACHED_SHORE_DISTANCE: 0.35,
  RPM_MAX: 1,
  RPM_RAMP_UP: 1.6,
  RPM_RAMP_DOWN: 1.2,
  SLACK_RPM_DECAY_RATE: 30,
  RPM_POWER_EXPONENT: 1.4,
  DEFAULT_DRAG_THRESHOLD_MAX: 35,
  DEFAULT_DRAG_THRESHOLD_MIN: 0,
  DEFAULT_SPOOL_CAPACITY: 30,
  LINE_PAYOUT_PER_FORCE: 0.025,
  LINE_RECOVERY_SCALE: 1.0,
  AUTO_REEL_RATE: 1.5,
  AUTO_REEL_SAFE_FORCE: 6,
  AUTO_REEL_SAFE_SPEED: 0.2,
  SPOOL_EMPTY_SLACK: 0.4,
  STATIC_BREAK_DURATION: 0.15,
  STATIC_BREAK_RESISTANCE_SCALE: 0.55,
  // General numeric cutoffs used in physics integration.
  MOTION_EPSILON: 0.02,
  SLACK_EPSILON: 1e-10,
  LINE_AXIS_MIN_DISTANCE: 0.0001,
  FORCE_INTEGRATION_MIN_MASS: 0.001,
  VELOCITY_DRAG_MIN_SPEED: 0.0001,
  FRICTION_MIN_SPEED: 0.01,
  MAX_SNAP_VELOCITY: 0.5,
  POST_STATIC_BREAK_DEBUG_FRAMES: 20,
  DISABLE_MAGNET_SLIP: true,
  // Fish simulation can move beyond render-framed water bounds.
  // Keep only a hard near-wall rule and broad safety caps for numeric stability.
  FISH_SIM_X_LIMIT: 300,
  FISH_SIM_Y_MAX: 300,
};

// Legacy heat model constants retained for compatibility.
export const HEAT_CONSTANTS = {
  BUILD_RATE: 25,
  DECAY_RATE: 15,
  REDLINE_THRESHOLD: 75,
  FAILURE_THRESHOLD: 100,
};

// Line wear and snap-risk accumulation while under load.
export const LINE_CONDITION_CONSTANTS = {
  MAX: 100,
  HOT_ZONE_THRESHOLD: 85,
  HOT_ZONE_DECAY_RATE: 6,
  MID_ZONE_DECAY_RATE: 1.2,
  HOT_ZONE_SNAP_BASE: 0.02,
  HOT_ZONE_SNAP_SCALE: 0.18,
};

// Fish behavior and force-intent tuning used by updateFishAI.
export const FISH_FIGHT_CONSTANTS = {
  RUN_DURATION_RANGE: { min: 1.1, max: 2.2 },
  REST_DURATION_RANGE: { min: 0.9, max: 1.8 },
  RUN_FORCE_MULTIPLIER: 0.6,
  REST_FORCE_MULTIPLIER: 0.05,
  ENERGY_RESUME_THRESHOLD: 0.2,
  DIRECTION_AWAY_FROM_AVATAR_BIAS: 0.05,
  RUN_DIRECTION_CHANGE_RATE: 1.0,
  REST_DIRECTION_CHANGE_RATE: 0.42,
  RUN_DIRECTION_VOLATILITY: 0.9,
  REST_DIRECTION_VOLATILITY: 0.3,
  PANIC_DIRECTION_BONUS: 0.55,
  PANIC_AWAY_BIAS_BONUS: 0.2,
  WALL_AVOIDANCE_DISTANCE: 1.25,
  WALL_AVOIDANCE_WEIGHT: 0.85,
  MIN_REST_DURATION: 0.25,
  MIN_RUN_DURATION: 0.35,
  DIRECTION_BLEND_RATE: 12,
  FORCE_BLEND_RATE: 14,
  TENSION_ACTIVE_EPSILON: 0.0001,
  ZERO_VECTOR_EPSILON: 0.0001,
  PANIC_INCREASE_BASE: 8,
  PANIC_OVERLOAD_BONUS: 6,
  PANIC_DECAY_BASE: 20,
  FIGHTING_ENTER_THRESHOLD: 50,
  FIGHTING_EXIT_THRESHOLD: 20,
  DIRECTION_RATE_PANIC_REDUCTION: 0.5,
  DIRECTION_CHANGE_MIN_INTERVAL: 0.12,
  DIRECTION_CHANGE_RANDOM_JITTER: 0.35,
  DEBUG_RANDOM_DIRECTION_MIN_INTERVAL: 0.01,
  RUN_ENERGY_DRAIN_RATE: 6,
  REST_ENERGY_DRAIN_RATE: 1.8,
  // Debug toggle: when true, fish do not bias direction away from the player.
  DISABLE_AWAY_FROM_PLAYER_BIAS: false,
  // Debug toggle: when true, fish do not bias direction away from the wall.
  DISABLE_WALL_AVOIDANCE_BIAS: false,
  // Debug toggle: when true, direction picks ignore phase/panic/temperament
  // and smoothing is disabled so each direction change is fully random.
  DEBUG_RANDOM_DIRECTION_ONLY: false,
  DEBUG_RANDOM_DIRECTION_INTERVAL: 0.2,
};

// Wait/strike phase timing and feedback values.
export const STRIKE_CONSTANTS = {
  WINDOW_SECONDS: 0.85,
  SCREEN_SHAKE_INTENSITY: 6,
  SCREEN_SHAKE_DURATION: 0.25,
};

// Input quick-release activation window.
export const QUICK_RELEASE_DURATION_MS = 1500;

// UI-facing tension range labels.
export const TENSION_ZONES = {
  LOW_MAX: 40,
  WORKING_MAX: 75,
  REDLINE_MAX: 100,
};

// Metallic slip accumulation and detachment multipliers.
export const SLIP_CONSTANTS = {
  MASTER_MULTIPLIER: 0.1,
  BASE_RATE_OFFSET: 0.25,
  TENSION_NORMALIZATION_MAX: 100,
  ACCUMULATION_SCALE: 100,
  SURFACE_MULTIPLIERS: {
    clean: 1.0,
    rusty: 1.5,
    sludge: 2.5,
  },
  ATTACHMENT_MULTIPLIERS: {
    center: 1.2,
    edge: 1.0,
    corner: 0.7,
  },
};

// Metallic target profile derivation defaults and clamps.
export const METALLIC_TARGET_CONSTANTS = {
  ATTACHMENT_ROLL_CENTER_MAX: 0.3,
  ATTACHMENT_ROLL_EDGE_MAX: 0.7,
  DEFAULT_WEIGHT: 5,
  DRAG_FACTOR_BASE: 0.2,
  DRAG_FACTOR_WEIGHT_SCALE: 1.4,
  DRAG_FACTOR_WEIGHT_DIVISOR: 60,
  DRAG_FACTOR_MIN: 0.2,
  DRAG_FACTOR_MAX: 2.4,
  MAGNETIC_STRENGTH_BASE: 1.2,
  MAGNETIC_STRENGTH_DEFAULT_SLIP_RATE: 1,
  MAGNETIC_STRENGTH_SLIP_SCALE: 0.35,
  MAGNETIC_STRENGTH_MIN: 0.2,
  MAGNETIC_STRENGTH_MAX: 1.3,
  BASE_SLIP_LIMIT_START: 120,
  BASE_SLIP_LIMIT_WEIGHT_SCALE: 0.8,
  BASE_SLIP_LIMIT_MIN: 30,
  BASE_SLIP_LIMIT_MAX: 140,
};

// Fish target initialization defaults and spawn guards.
export const FISH_TARGET_CONSTANTS = {
  DEFAULT_SIZE: "medium",
  SPAWN_X_FALLBACK: 0,
  SPAWN_Y_WALL_BUFFER: 0.05,
  SPAWN_Y_FALLBACK_OFFSET: 1.5,
};

// Wait-phase nibble cadence and bob spring tuning.
export const WAIT_PHASE_CONSTANTS = {
  BOB_SPRING_FREQUENCY: 8.0,
  BOB_SPRING_DAMPING: 0.85,
  INITIAL_NIBBLE_DELAY_MIN: 2,
  INITIAL_NIBBLE_DELAY_MAX: 5,
  NEXT_NIBBLE_DELAY_MIN: 1,
  NEXT_NIBBLE_DELAY_MAX: 3,
  MAX_NIBBLES: 3,
};

// Temperament shaping for fish panic, force, and direction behavior.
export const TEMPERAMENT_MODIFIERS = {
  relaxed: {
    panicBuildRate: 0.72,
    panicDecayRate: 1.35,
    energyDrainRate: 0.8,
    baseForceMultiplier: 0.82,
    panicForceBonus: 0.35,
    directionChangeRateMultiplier: 0.82,
    directionVolatilityMultiplier: 0.72,
    restDurationMultiplier: 1.2,
    runDurationMultiplier: 0.95,
    awayBiasBonus: 0.02,
  },
  normal: {
    panicBuildRate: 1.0,
    panicDecayRate: 1.0,
    energyDrainRate: 1.0,
    baseForceMultiplier: 1.0,
    panicForceBonus: 0.5,
    directionChangeRateMultiplier: 1.0,
    directionVolatilityMultiplier: 1.0,
    restDurationMultiplier: 1.0,
    runDurationMultiplier: 1.0,
    awayBiasBonus: 0.04,
  },
  cautious: {
    panicBuildRate: 1.5,
    panicDecayRate: 0.9,
    energyDrainRate: 1.08,
    baseForceMultiplier: 0.96,
    panicForceBonus: 0.62,
    directionChangeRateMultiplier: 1.22,
    directionVolatilityMultiplier: 1.18,
    restDurationMultiplier: 0.9,
    runDurationMultiplier: 1.05,
    awayBiasBonus: 0.08,
  },
  aggressive: {
    panicBuildRate: 1.2,
    panicDecayRate: 0.7,
    energyDrainRate: 1.15,
    baseForceMultiplier: 1.16,
    panicForceBonus: 0.72,
    directionChangeRateMultiplier: 1.4,
    directionVolatilityMultiplier: 1.35,
    restDurationMultiplier: 0.78,
    runDurationMultiplier: 1.1,
    awayBiasBonus: 0.1,
  },
};

// Backward-compatibility aliases for older temperament labels.
export const TEMPERAMENT_ALIASES = {
  calm: "relaxed",
  skittish: "cautious",
};
