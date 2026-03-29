export const PHYSICS_CONSTANTS = {
  WATER_DENSITY: 1.0,
  BASELINE_WATER_RESISTANCE: 2.0,
  TURBULENCE_FACTOR: 0.05,
  LINE_DRAG_PER_METER: 0.02,
  REEL_EFFICIENCY_FALLOFF: 0.1,
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
  MOTION_EPSILON: 0.02,
  SLACK_EPSILON: 1e-10,
  MAX_SNAP_VELOCITY: 0.5,
  DISABLE_MAGNET_SLIP: true,
  // Fish simulation can move beyond render-framed water bounds.
  // Keep only a hard near-wall rule and broad safety caps for numeric stability.
  FISH_SIM_X_LIMIT: 300,
  FISH_SIM_Y_MAX: 300,
};

export const HEAT_CONSTANTS = {
  BUILD_RATE: 25,
  DECAY_RATE: 15,
  REDLINE_THRESHOLD: 75,
  FAILURE_THRESHOLD: 100,
};

export const LINE_CONDITION_CONSTANTS = {
  MAX: 100,
  HOT_ZONE_THRESHOLD: 85,
  HOT_ZONE_DECAY_RATE: 6,
  MID_ZONE_DECAY_RATE: 1.2,
  HOT_ZONE_SNAP_BASE: 0.02,
  HOT_ZONE_SNAP_SCALE: 0.18,
};

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
  // Debug toggle: when true, fish do not bias direction away from the player.
  DISABLE_AWAY_FROM_PLAYER_BIAS: false,
  // Debug toggle: when true, fish do not bias direction away from the wall.
  DISABLE_WALL_AVOIDANCE_BIAS: false,
  // Debug toggle: when true, direction picks ignore phase/panic/temperament
  // and smoothing is disabled so each direction change is fully random.
  DEBUG_RANDOM_DIRECTION_ONLY: false,
  DEBUG_RANDOM_DIRECTION_INTERVAL: 0.2,
};

export const STRIKE_CONSTANTS = {
  WINDOW_SECONDS: 0.85,
  SCREEN_SHAKE_INTENSITY: 6,
  SCREEN_SHAKE_DURATION: 0.25,
};

export const QUICK_RELEASE_DURATION_MS = 1500;

export const TENSION_ZONES = {
  LOW_MAX: 40,
  WORKING_MAX: 75,
  REDLINE_MAX: 100,
};

export const SLIP_CONSTANTS = {
  MASTER_MULTIPLIER: 0.1,
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

export const TEMPERAMENT_ALIASES = {
  calm: "relaxed",
  skittish: "cautious",
};
