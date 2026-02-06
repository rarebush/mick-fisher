import {
  WORLD_Y,
  WORLD_Z,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import { clampTargetToBounds, getWaterBounds } from "../mechanics/worldBounds.js";
import { PHYSICS_CONSTANTS } from "./physicsConstants.js";
import {
  getCurrentForce,
  getFriction,
  getPullForce,
  getWaterDrag,
} from "./forceCalculations.js";
import {
  updateFishAI,
  updateHeat,
  updateLineStress,
  updateSlip,
  updateTensionValue,
} from "./stateUpdates.js";
import { clamp, magnitude, subtract } from "./vectorUtils.js";

function clampTargetToWorld(target) {
  clampTargetToBounds(target, getWaterBounds());
}

export function updateDragPhysics(deltaTime, isHolding, physicsState) {
  const state = { ...physicsState };
  const events = {};
  if (!state.target || !state.equipment) {
    return { state, events };
  }

  const avatarWorld = getAvatarWorldPosition();
  const avatar2D = { x: avatarWorld.x, y: avatarWorld.y };
  const shoreAnchor = { x: 0, y: WORLD_Y.WALKWAY_FRONT };

  state.tension = updateTensionValue(
    state.tension,
    deltaTime,
    isHolding,
    state.target,
    state.equipment,
    avatar2D
  );

  const lineLength = magnitude(subtract(avatar2D, state.target.position));
  state.lineLength = lineLength;
  state.distanceToShore = magnitude(
    subtract(shoreAnchor, state.target.position)
  );

  if (!state.target.isMoving && state.targetType === "metallic") {
    const staticFriction =
      state.target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT;
    const pullForce = getPullForce(
      state.tension,
      state.equipment,
      state.target,
      avatar2D
    );
    const pullMagnitude = magnitude(pullForce);
    if (pullMagnitude > staticFriction) {
      state.target.isMoving = true;
    } else {
      state.forces.pull = pullForce;
      state.forces.net = pullForce;
      state.lastTension = state.tension;
      return { state, events };
    }
  }

  if (state.targetType === "fish") {
    updateFishAI(state.target, state.tension, deltaTime);
  }

  const pullForce = getPullForce(
    state.tension,
    state.equipment,
    state.target,
    avatar2D
  );
  const waterDrag = getWaterDrag(
    state.target,
    state.target.velocity,
    lineLength
  );
  const currentForce = getCurrentForce(
    state.target,
    state.environment?.current
  );
  const friction = getFriction(
    state.target,
    state.target.velocity,
    state.target.isMoving
  );
  const additionalForce =
    state.targetType === "fish" && state.target.currentForce
      ? state.target.currentForce
      : { x: 0, y: 0 };

  const netForce = {
    x:
      pullForce.x +
      waterDrag.x +
      currentForce.x +
      (friction.x || 0) +
      additionalForce.x,
    y:
      pullForce.y +
      waterDrag.y +
      currentForce.y +
      (friction.y || 0) +
      additionalForce.y,
  };

  const acceleration = {
    x: netForce.x / state.target.mass,
    y: netForce.y / state.target.mass,
  };

  state.target.velocity.x += acceleration.x * deltaTime;
  state.target.velocity.y += acceleration.y * deltaTime;
  state.target.position.x += state.target.velocity.x * deltaTime;
  state.target.position.y += state.target.velocity.y * deltaTime;

  clampTargetToWorld(state.target);

  state.forces = {
    pull: pullForce,
    waterDrag,
    current: currentForce,
    friction: friction.type ? { x: 0, y: 0 } : friction,
    additional: additionalForce,
    net: netForce,
  };

  const heatResult = updateHeat(deltaTime, state.tension, state.heat);
  state.heat = heatResult.heat;
  if (heatResult.overheated) {
    events.overheated = true;
  }

  if (state.targetType === "metallic") {
    const slip = updateSlip(
      state.target,
      state.tension,
      state.equipment,
      state.lastTension
    );
    state.target.slipAccumulation = slip.slipAccumulation;
    state.slip = {
      accumulation: slip.slipAccumulation,
      limit: slip.slipLimit,
      percent: slip.slipPercent,
    };
    if (slip.detached) {
      events.detached = true;
    }
  } else if (state.targetType === "fish") {
    const stress = updateLineStress(
      state.target,
      state.tension,
      state.equipment,
      deltaTime
    );
    state.target.lineStress = stress.lineStress;
    state.lineStress = {
      value: stress.lineStress,
      percent: stress.stressPercent,
    };
    if (stress.lineSnapped) {
      events.lineSnapped = true;
    }
  }

  state.fishStatus = {
    energy: state.targetType === "fish" ? state.target.energy : 0,
    panic: state.targetType === "fish" ? state.target.panicLevel : 0,
    state: state.targetType === "fish" ? state.target.state : null,
  };

  const newLineLength = magnitude(subtract(avatar2D, state.target.position));
  state.lineLength = newLineLength;
  const newDistanceToShore = magnitude(
    subtract(shoreAnchor, state.target.position)
  );
  state.distanceToShore = newDistanceToShore;
  if (newDistanceToShore <= PHYSICS_CONSTANTS.REACHED_SHORE_DISTANCE) {
    events.reachedShore = true;
  }

  state.lastTension = state.tension;
  return { state, events };
}

export function clampMagnetWorldZ(target) {
  if (!target) return WORLD_Z.RIVERBED;
  return clamp(
    target.position.z ?? WORLD_Z.RIVERBED,
    WORLD_Z.RIVERBED,
    WORLD_Z.WATER_SURFACE
  );
}
