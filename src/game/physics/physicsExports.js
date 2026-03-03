export {
  PHYSICS_CONSTANTS,
  FISH_FIGHT_CONSTANTS,
  HEAT_CONSTANTS,
  LINE_CONDITION_CONSTANTS,
  STRIKE_CONSTANTS,
  TENSION_ZONES,
  SLIP_CONSTANTS,
  TEMPERAMENT_MODIFIERS,
} from "./physicsConstants.js";
export { createInitialPhysicsState } from "./physicsState.js";
export {
  magnitude,
  normalize,
  subtract,
  add,
  scale,
  dotProduct,
  clamp,
} from "./vectorUtils.js";
export {
  createMetallicTargetFromItem,
  createFishTarget,
} from "./targetFactory.js";
export { initializeWaitPhase, updateWaitPhase } from "./waitPhase.js";
export {
  getEngineTorque,
  getPullForce,
  getWaterDrag,
  getCurrentForce,
  getFriction,
  getLineAxis,
  getSignedAxisVelocity,
  getAvatarPullForceFromRpm,
  getDragThresholdCurrent,
  getDragThresholdMax,
  getDragThresholdMin,
  getSpoolCapacity,
} from "./forceCalculations.js";
export { updateSlip, updateFishAI } from "./stateUpdates.js";
export { updateDragPhysics, clampMagnetWorldZ } from "./dragPhysics.js";
