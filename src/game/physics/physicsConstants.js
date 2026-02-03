export const PHYSICS_CONSTANTS = {
  WATER_DENSITY: 1.0,
  BASELINE_WATER_RESISTANCE: 2.0,
  TURBULENCE_FACTOR: 0.05,
  LINE_DRAG_PER_METER: 0.02,
  REEL_EFFICIENCY_FALLOFF: 0.1,
  STATIC_FRICTION_COEFFICIENT: 0.8,
  KINETIC_FRICTION_COEFFICIENT: 0.2,
  ROPE_SYSTEM_INERTIA: 50,
  TENSION_DECAY_BASE: 30,
  REACHED_SHORE_DISTANCE: 0.35,
};

export const HEAT_CONSTANTS = {
  BUILD_RATE: 25,
  DECAY_RATE: 15,
  REDLINE_THRESHOLD: 75,
  FAILURE_THRESHOLD: 100,
};

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
