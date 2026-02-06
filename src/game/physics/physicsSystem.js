export {
  PHYSICS_CONSTANTS,
  HEAT_CONSTANTS,
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
} from "./forceCalculations.js";
export {
  updateTensionValue,
  updateSlip,
  updateLineStress,
  updateHeat,
  updateFishAI,
} from "./stateUpdates.js";
export { updateDragPhysics, clampMagnetWorldZ } from "./dragPhysics.js";
