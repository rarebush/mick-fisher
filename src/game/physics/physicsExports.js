/**
 * Public physics module barrel.
 *
 * Re-exports constants, math helpers, factories, and update functions used
 * across game systems.
 */

export {
  ENGINE_TORQUE_CONSTANTS,
  PHYSICS_CONSTANTS,
  FISH_FIGHT_CONSTANTS,
  FISH_TARGET_CONSTANTS,
  HEAT_CONSTANTS,
  LINE_CONDITION_CONSTANTS,
  METALLIC_TARGET_CONSTANTS,
  STRIKE_CONSTANTS,
  TENSION_ZONES,
  WAIT_PHASE_CONSTANTS,
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
export { updateSlip, updateFishAI } from "./targetStateUpdates.js";
export { updateDragPhysics, clampMagnetWorldZ } from "./dragPhysics.js";
