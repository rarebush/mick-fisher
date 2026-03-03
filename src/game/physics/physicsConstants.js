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
  calm: {
    panicBuildRate: 0.7,
    panicDecayRate: 1.3,
    energyDrainRate: 0.8,
    directionChangeMod: 1.5,
    strengthWhenCalm: 0.3,
    strengthWhenPanicked: 0.9,
  },
  skittish: {
    panicBuildRate: 1.5,
    panicDecayRate: 0.8,
    energyDrainRate: 1.2,
    directionChangeMod: 0.6,
    strengthWhenCalm: 0.5,
    strengthWhenPanicked: 1.0,
  },
  aggressive: {
    panicBuildRate: 1.0,
    panicDecayRate: 0.5,
    energyDrainRate: 1.0,
    directionChangeMod: 0.8,
    strengthWhenCalm: 0.7,
    strengthWhenPanicked: 1.2,
  },
};
