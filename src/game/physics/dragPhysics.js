import {
  WORLD_Y,
  WORLD_Z,
  getAvatarWorldPosition,
} from "../mechanics/worldConstants.js";
import {
  clampTargetToBounds,
  getWaterBounds,
} from "../mechanics/worldBounds.js";
import {
  LINE_CONDITION_CONSTANTS,
  PHYSICS_CONSTANTS,
} from "./physicsConstants.js";
import {
  getAvatarPullForceFromRpm,
  getCurrentForce,
  getDragThresholdCurrent,
  getDragThresholdMax,
  getDragThresholdMin,
  getFriction,
  getLineAxis,
  getSpoolCapacity,
} from "./forceCalculations.js";
import { updateFishAI, updateSlip } from "./stateUpdates.js";
import {
  add,
  clamp,
  dotProduct,
  magnitude,
  scale,
  subtract,
} from "./vectorUtils.js";

function clampTargetToWorld(target) {
  clampTargetToBounds(target, getWaterBounds());
}

export function updateDragPhysics(deltaTime, isHolding, physicsState) {
  const state = {
    ...physicsState,
    target: physicsState.target
      ? {
          ...physicsState.target,
          position: { ...physicsState.target.position },
          velocity: { ...physicsState.target.velocity },
          currentForce: physicsState.target.currentForce
            ? { ...physicsState.target.currentForce }
            : undefined,
          targetDirection: physicsState.target.targetDirection
            ? { ...physicsState.target.targetDirection }
            : undefined,
        }
      : null,
  };

  const events = {};
  if (!state.target || !state.equipment) {
    return { state, events };
  }

  const avatarWorld = getAvatarWorldPosition();
  const avatar2D = { x: avatarWorld.x, y: avatarWorld.y };
  const shoreAnchor = { x: 0, y: WORLD_Y.WALKWAY_FRONT };
  const slackEpsilon = PHYSICS_CONSTANTS.SLACK_EPSILON;

  const previousLineTaut = Boolean(state.lineTaut);
  const previousTension = state.tension ?? 0;

  if (!state.spoolCapacity) {
    state.spoolCapacity = getSpoolCapacity(state.equipment);
  }
  if (state.spoolRemaining <= 0 && state.spoolCapacity > 0) {
    const fallbackDistance =
      state.lineLength || getLineAxis(avatar2D, state.target.position).distance;
    state.spoolRemaining = Math.max(0, state.spoolCapacity - fallbackDistance);
  }

  const dragThresholdCurrent = getDragThresholdCurrent(state.equipment);
  const dragThresholdMin = getDragThresholdMin(state.equipment);
  const dragThresholdMax = getDragThresholdMax(state.equipment);
  const dragQuickReleaseActive = Boolean(state.dragQuickReleaseActive);
  const effectiveDragThreshold = dragQuickReleaseActive
    ? dragThresholdMin
    : dragThresholdCurrent;

  const playerRecoveryVelocity = Math.max(
    0,
    state.equipment.playerRecoveryVelocity ?? 0,
  );
  const avatarPullForce = getAvatarPullForceFromRpm(
    state.rpm ?? 0,
    state.equipment,
  );

  if (state.targetType === "fish") {
    state.target = updateFishAI(
      state.target,
      previousTension,
      deltaTime,
      avatar2D,
    );
  }

  let actorForce = state.target.currentForce;
  if (!Object.prototype.hasOwnProperty.call(state.target, "currentForce")) {
    actorForce = null;
  }

  const swimForceVector = actorForce ?? { x: 0, y: 0 };
  const externalForceVector = getCurrentForce(
    state.target,
    state.environment?.current,
  );

  const previousAxis = getLineAxis(avatar2D, state.target.position).axis;

  let objectVelocityVector = state.target.velocity || { x: 0, y: 0 };
  const objectVelocityBeforeIntegration = { ...objectVelocityVector };
  const speed = magnitude(objectVelocityVector);

  const kineticDragCoefficient =
    state.target.kineticDragCoefficient ??
    (state.target.dragFactor ?? 1) * PHYSICS_CONSTANTS.KINETIC_DRAG_BASE;
  const velocityDragVector =
    speed < 0.0001
      ? { x: 0, y: 0 }
      : scale(objectVelocityVector, -kineticDragCoefficient * speed);

  const useKineticFriction =
    state.targetType === "metallic" && Boolean(state.target.isMoving);
  const frictionResult = useKineticFriction
    ? getFriction(state.target, objectVelocityVector, true)
    : { x: 0, y: 0 };
  const frictionForceVector =
    frictionResult && typeof frictionResult.x === "number"
      ? frictionResult
      : { x: 0, y: 0 };

  const forceWithoutPlayer =
    state.targetType === "metallic"
      ? add(
          add(swimForceVector, velocityDragVector),
          add(externalForceVector, frictionForceVector),
        )
      : add(add(swimForceVector, velocityDragVector), externalForceVector);

  const fishOutwardForce =
    state.targetType === "fish"
      ? dotProduct(forceWithoutPlayer, previousAxis)
      : 0;
  const clutchForce =
    state.targetType === "fish"
      ? Math.min(Math.max(fishOutwardForce, 0), effectiveDragThreshold)
      : 0;
  const lineInwardForce =
    state.targetType === "fish" && previousLineTaut
      ? Math.max(clutchForce, isHolding ? avatarPullForce : 0)
      : 0;
  /*
   * Intentional clutch-reactivity asymmetry between fish and metallic paths:
   * - Fish path (`fishOutwardForce`) uses `forceWithoutPlayer`, which includes
   *   swim, current, and velocity drag. Fish body drag is transmitted through
   *   the fish to the line attachment point, so the clutch should react to it.
   * - Metallic path (`metallicLineLoadForce`) uses swim + current only,
   *   excluding velocity drag and kinetic friction. Those dissipative forces act
   *   at the object-medium interface and are absorbed by water/riverbed rather
   *   than loading the reel through the line.
   */
  const metallicLineLoadForce =
    dotProduct(swimForceVector, previousAxis) +
    dotProduct(externalForceVector, previousAxis);
  const metallicReactiveDrag = previousLineTaut
    ? Math.min(Math.max(metallicLineLoadForce, 0), effectiveDragThreshold)
    : 0;
  const metallicPlayerForce = previousLineTaut
    ? Math.max(metallicReactiveDrag, isHolding ? avatarPullForce : 0)
    : 0;
  const playerForceVectorForMotion = previousLineTaut
    ? scale(
        previousAxis,
        -(state.targetType === "fish" ? lineInwardForce : metallicPlayerForce),
      )
    : { x: 0, y: 0 };
  const isOverwhelmed =
    state.targetType === "fish" &&
    previousLineTaut &&
    fishOutwardForce > 0 &&
    fishOutwardForce > lineInwardForce;
  const isHeld =
    state.targetType === "fish" &&
    previousLineTaut &&
    fishOutwardForce > 0 &&
    !isOverwhelmed;

  const tangentialForce = subtract(
    forceWithoutPlayer,
    scale(previousAxis, fishOutwardForce),
  );
  const radialNetForce =
    state.targetType === "fish" && previousLineTaut
      ? fishOutwardForce - lineInwardForce
      : fishOutwardForce;
  const radialForceVector = scale(previousAxis, radialNetForce);
  // Fish: clutch constraint decomposes into tangential (free) + radial (clamped by clutch/player)
  // Metallic: clutch-constrained inward force opposes object forces (max of reactive drag and player pull)
  const netForceVector =
    state.targetType === "fish"
      ? add(tangentialForce, radialForceVector)
      : add(forceWithoutPlayer, playerForceVectorForMotion);

  const mass = Math.max(state.target.mass ?? 0, 0.001);
  const acceleration = scale(netForceVector, 1 / mass);

  let objectState =
    state.objectState || (state.target.isMoving ? "kinetic" : "static");
  let staticBreakTimer = Math.max(0, state.staticBreakTimer || 0);
  let postStaticBreakDebugFramesRemaining = Math.max(
    0,
    state.postStaticBreakDebugFramesRemaining || 0,
  );
  let clampActive = false;
  let intrinsicApproachRate = 0;
  let effectiveReelCap = 0;

  if (state.targetType === "metallic" && !state.target.isMoving) {
    objectVelocityVector = { x: 0, y: 0 };
  } else {
    objectVelocityVector = add(
      objectVelocityVector,
      scale(acceleration, deltaTime),
    );

    const intrinsicAcceleration = scale(forceWithoutPlayer, 1 / mass);
    const velocityWithoutPlayer = add(
      objectVelocityBeforeIntegration,
      scale(intrinsicAcceleration, deltaTime),
    );
    const intrinsicRadialVelocity = dotProduct(
      velocityWithoutPlayer,
      previousAxis,
    );
    intrinsicApproachRate =
      intrinsicRadialVelocity < 0 ? Math.abs(intrinsicRadialVelocity) : 0;

    const unclampedRadialVelocity = dotProduct(
      objectVelocityVector,
      previousAxis,
    );
    const objectApproachRateUnclamped =
      unclampedRadialVelocity < 0 ? Math.abs(unclampedRadialVelocity) : 0;

    if (state.targetType === "fish" && previousLineTaut && isHeld) {
      const outwardRadialVelocity = Math.max(
        0,
        dotProduct(objectVelocityVector, previousAxis),
      );
      if (outwardRadialVelocity > 0) {
        objectVelocityVector = subtract(
          objectVelocityVector,
          scale(previousAxis, outwardRadialVelocity),
        );
      }
    }

    if (previousLineTaut && isHolding && unclampedRadialVelocity < 0) {
      effectiveReelCap = Math.max(
        playerRecoveryVelocity,
        intrinsicApproachRate,
      );
      if (objectApproachRateUnclamped > effectiveReelCap) {
        const tangentialVelocity = subtract(
          objectVelocityVector,
          scale(previousAxis, unclampedRadialVelocity),
        );
        objectVelocityVector = add(
          tangentialVelocity,
          scale(previousAxis, -effectiveReelCap),
        );
        clampActive = true;
      }
    }

    if (!state.target.velocity) {
      state.target.velocity = { x: 0, y: 0 };
    }
    state.target.velocity.x = objectVelocityVector.x;
    state.target.velocity.y = objectVelocityVector.y;
    objectVelocityVector = state.target.velocity;

    if (
      magnitude(objectVelocityVector) < PHYSICS_CONSTANTS.MOTION_EPSILON &&
      (state.targetType !== "metallic" || staticBreakTimer <= 0)
    ) {
      objectVelocityVector = { x: 0, y: 0 };
      if (state.targetType === "metallic") {
        objectState = "static";
      }
    }

    state.target.position = add(
      state.target.position,
      scale(objectVelocityVector, deltaTime),
    );
  }

  if (!state.target.velocity) {
    state.target.velocity = { x: 0, y: 0 };
  }
  state.target.velocity.x = objectVelocityVector.x;
  state.target.velocity.y = objectVelocityVector.y;
  objectVelocityVector = state.target.velocity;
  clampTargetToWorld(state.target);

  const lineAxisResult = getLineAxis(avatar2D, state.target.position);
  const lineAxis = lineAxisResult.axis;
  let straightLineDistance = lineAxisResult.distance;
  let radialVelocity = dotProduct(objectVelocityVector, lineAxis);
  const objectApproachRate = radialVelocity < 0 ? Math.abs(radialVelocity) : 0;

  if (!Number.isFinite(state.lineLength) || state.lineLength <= 0) {
    state.lineLength = straightLineDistance;
  }

  let recoveryBudgetRemaining =
    isHolding && playerRecoveryVelocity > 0
      ? playerRecoveryVelocity * deltaTime
      : 0;

  // Recovery uses two passes that share one per-tick budget (`recoveryBudgetRemaining`).
  // This pre-taut pass consumes geometric approach first (target already moved closer),
  // then the taut-branch pass below can only use what remains for reel-rate recovery.
  // Total recovery per tick is capped at `playerRecoveryVelocity * deltaTime`.
  if (
    recoveryBudgetRemaining > 0 &&
    radialVelocity < 0 &&
    state.lineLength > straightLineDistance
  ) {
    const approachThisTick = state.lineLength - straightLineDistance;
    const recovery = Math.min(approachThisTick, recoveryBudgetRemaining);
    state.lineLength -= recovery;
    state.spoolRemaining = Math.min(
      state.spoolCapacity,
      state.spoolRemaining + recovery,
    );
    recoveryBudgetRemaining -= recovery;
  }

  let slack = Math.max(0, state.lineLength - straightLineDistance);
  let lineTaut = slack <= slackEpsilon;

  if (
    state.targetType === "fish" &&
    lineTaut &&
    !isOverwhelmed &&
    straightLineDistance > state.lineLength
  ) {
    const overshoot = straightLineDistance - state.lineLength;
    state.target.position = subtract(
      state.target.position,
      scale(lineAxis, overshoot),
    );
    const outwardRadialVelocity = Math.max(
      0,
      dotProduct(objectVelocityVector, lineAxis),
    );
    if (outwardRadialVelocity > 0) {
      objectVelocityVector = subtract(
        objectVelocityVector,
        scale(lineAxis, outwardRadialVelocity),
      );
      state.target.velocity.x = objectVelocityVector.x;
      state.target.velocity.y = objectVelocityVector.y;
      radialVelocity = dotProduct(objectVelocityVector, lineAxis);
    }
    straightLineDistance = state.lineLength;
    slack = 0;
    lineTaut = true;
  }

  if (!lineTaut) {
    clampActive = false;
  }

  const lineLoadSpeed = magnitude(objectVelocityVector);
  const velocityDragForLineLoadVector =
    lineLoadSpeed < 0.0001
      ? { x: 0, y: 0 }
      : scale(objectVelocityVector, -kineticDragCoefficient * lineLoadSpeed);

  const frictionForLineLoadResult =
    state.targetType === "metallic" && Boolean(state.target.isMoving)
      ? getFriction(state.target, objectVelocityVector, true)
      : { x: 0, y: 0 };
  const frictionForLineLoadVector =
    frictionForLineLoadResult && typeof frictionForLineLoadResult.x === "number"
      ? frictionForLineLoadResult
      : { x: 0, y: 0 };

  const swimForce = dotProduct(swimForceVector, lineAxis);
  const velocityDrag = dotProduct(velocityDragForLineLoadVector, lineAxis);
  const externalForce = dotProduct(externalForceVector, lineAxis);
  const frictionForce = dotProduct(frictionForLineLoadVector, lineAxis);
  // Total non-player radial force balance on the object along the line axis.
  // Includes swim, current, velocity drag, and (for metallic) kinetic friction.
  // Used for payout/contest decisions and tension accounting at the object end.
  const objectLineForce =
    state.targetType === "metallic"
      ? swimForce + velocityDrag + externalForce + frictionForce
      : swimForce + velocityDrag + externalForce;
  // Environmental line load transmitted to the reel mechanism.
  // Includes swim + current only; excludes dissipative medium forces.
  // Used to compute reactive drag (clutch response).
  const lineLoadForce = swimForce + externalForce;

  const fishOutwardResistance = Math.max(fishOutwardForce, 0);
  const clutchForceAccounting =
    state.targetType === "fish" && lineTaut ? clutchForce : 0;
  let reactiveDrag;
  let playerLineForce;
  let lineInwardForceAccounting;

  if (state.targetType === "fish") {
    reactiveDrag = clutchForceAccounting;
    lineInwardForceAccounting = lineTaut
      ? Math.max(clutchForceAccounting, isHolding ? avatarPullForce : 0)
      : 0;
    playerLineForce = lineInwardForceAccounting;
  } else {
    reactiveDrag = Math.min(Math.max(lineLoadForce, 0), effectiveDragThreshold);
    playerLineForce = Math.max(reactiveDrag, isHolding ? avatarPullForce : 0);
    lineInwardForceAccounting = playerLineForce;
  }
  let tension = 0;
  let linePayout = 0;
  let slackChangeRate = 0;
  let staticFrictionThreshold = null;
  let staticFrictionGateReached = false;
  let shouldPayOutLine = false;
  let recoveryApplied = 0;
  let payoutDistanceApplied = 0;

  if (!lineTaut) {
    slackChangeRate = objectApproachRate - playerRecoveryVelocity;
    lineInwardForceAccounting = 0;
    reactiveDrag = 0;
    playerLineForce = 0;

    if (recoveryBudgetRemaining > 0) {
      const desiredRecovery = recoveryBudgetRemaining;
      const maxRecovery = Math.max(0, state.lineLength - straightLineDistance);
      const recovery = Math.min(desiredRecovery, maxRecovery);
      state.lineLength -= recovery;
      state.spoolRemaining = Math.min(
        state.spoolCapacity,
        state.spoolRemaining + recovery,
      );
      recoveryApplied += recovery;
      recoveryBudgetRemaining -= recovery;
    }
  } else {
    const fishRadialResistance =
      fishOutwardResistance > 0
        ? fishOutwardResistance
        : isHolding
          ? Math.max(velocityDrag, 0) +
            Math.max(externalForce, 0) +
            Math.max(swimForce, 0)
          : 0;
    shouldPayOutLine =
      state.targetType === "fish"
        ? fishOutwardForce > 0 && fishOutwardForce > lineInwardForceAccounting
        : objectLineForce > playerLineForce;

    if (state.targetType === "fish") {
      tension = Math.min(lineInwardForceAccounting, fishRadialResistance);
    } else {
      if (shouldPayOutLine) {
        tension = playerLineForce;
      } else if (objectLineForce > 0) {
        tension = Math.min(objectLineForce, playerLineForce);
      } else {
        tension = 0;
      }
      tension = Math.max(0, tension);
    }

    if (isHolding && objectApproachRate > 0) {
      const recoveryRate = clampActive
        ? playerRecoveryVelocity
        : Math.min(objectApproachRate, playerRecoveryVelocity);
      // Second recovery pass, budget shared with pre-taut pass above.
      const desiredRecovery = Math.min(
        recoveryRate * deltaTime,
        recoveryBudgetRemaining,
      );
      const maxRecovery = Math.max(0, state.lineLength - straightLineDistance);
      const recovery = Math.min(desiredRecovery, maxRecovery);
      state.lineLength -= recovery;
      state.spoolRemaining = Math.min(
        state.spoolCapacity,
        state.spoolRemaining + recovery,
      );
      recoveryApplied += recovery;
      recoveryBudgetRemaining -= recovery;
    }

    if (shouldPayOutLine) {
      const payoutDistance = Math.max(
        0,
        straightLineDistance - state.lineLength,
      );
      if (payoutDistance > 0) {
        state.lineLength += payoutDistance;
        state.spoolRemaining = Math.max(
          0,
          state.spoolRemaining - payoutDistance,
        );
        payoutDistanceApplied = payoutDistance;
        linePayout = payoutDistance / Math.max(deltaTime, 1e-6);
      }

      if (state.spoolRemaining <= 0) {
        events.spoolEmpty = true;
        state.lineLength =
          straightLineDistance + PHYSICS_CONSTANTS.SPOOL_EMPTY_SLACK;
      }
    }
  }

  slack = Math.max(0, state.lineLength - straightLineDistance);
  lineTaut = slack <= slackEpsilon;
  if (lineTaut) {
    slack = 0;
  }

  if (state.targetType === "metallic") {
    staticFrictionThreshold =
      state.target.staticFrictionThreshold ??
      state.target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT;

    if (!state.target.isMoving) {
      const netForceMagnitude = magnitude(netForceVector);
      staticFrictionGateReached = netForceMagnitude > 0;
      const staticGateComparison = netForceMagnitude > staticFrictionThreshold;
      if (staticFrictionGateReached && staticGateComparison) {
        state.target.isMoving = true;
        objectState = "kinetic";
        staticBreakTimer = PHYSICS_CONSTANTS.STATIC_BREAK_DURATION;
        postStaticBreakDebugFramesRemaining = 20;
      } else {
        state.target.velocity = { x: 0, y: 0 };
        objectState = "static";
      }
    }

    if (
      staticBreakTimer <= 0 &&
      state.target.isMoving &&
      /*
       * Kinetic->static re-entry intentionally uses total speed magnitude,
       * not radial velocity. This only re-enters static when all velocity
       * components are near zero, preserving tangential/cross-current motion.
       *
       * If changed to radial-only, the zeroing behavior in the static branch
       * (`state.target.velocity = { x: 0, y: 0 }`) would erase tangential
       * momentum during re-entry and collapse diagonal drift into radial-only
       * trajectories.
       *
       * Note: with break timer expired and sustained force near epsilon,
       * metallic targets can toggle static/kinetic frame-to-frame. The practical
       * effect is small at current epsilon because only sub-epsilon velocity is
       * discarded; risk grows if epsilon or static-gate delay is increased.
       */
      magnitude(state.target.velocity) < PHYSICS_CONSTANTS.MOTION_EPSILON
    ) {
      state.target.isMoving = false;
      objectState = "static";
    }
  } else {
    state.target.isMoving =
      magnitude(state.target.velocity) >= PHYSICS_CONSTANTS.MOTION_EPSILON;
    objectState = state.target.isMoving ? "kinetic" : "static";
  }

  if (staticBreakTimer > 0) {
    staticBreakTimer = Math.max(0, staticBreakTimer - deltaTime);
  }

  let lineCondition = state.lineCondition;
  let hotZoneTimer = state.hotZoneTimer || 0;
  if (lineTaut) {
    if (tension >= LINE_CONDITION_CONSTANTS.HOT_ZONE_THRESHOLD) {
      hotZoneTimer += deltaTime;
      lineCondition -= LINE_CONDITION_CONSTANTS.HOT_ZONE_DECAY_RATE * deltaTime;
      const snapChance =
        LINE_CONDITION_CONSTANTS.HOT_ZONE_SNAP_BASE +
        hotZoneTimer * LINE_CONDITION_CONSTANTS.HOT_ZONE_SNAP_SCALE;
      if (Math.random() < snapChance * deltaTime) {
        events.lineSnapped = true;
      }
    } else if (tension >= effectiveDragThreshold) {
      lineCondition -= LINE_CONDITION_CONSTANTS.MID_ZONE_DECAY_RATE * deltaTime;
      hotZoneTimer = 0;
    } else {
      hotZoneTimer = 0;
    }
  } else {
    hotZoneTimer = 0;
  }

  lineCondition = clamp(lineCondition, 0, LINE_CONDITION_CONSTANTS.MAX);
  const baseBreakThreshold = state.equipment?.lineStrength ?? 0;
  const breakThreshold = baseBreakThreshold * (lineCondition / 100);
  if (tension > breakThreshold && breakThreshold > 0) {
    events.lineSnapped = true;
  }

  const rpmMax = state.equipment?.rpmMax ?? PHYSICS_CONSTANTS.RPM_MAX;
  const rampUp = state.equipment?.rpmRampUp ?? PHYSICS_CONSTANTS.RPM_RAMP_UP;
  const rampDown =
    state.equipment?.rpmRampDown ?? PHYSICS_CONSTANTS.RPM_RAMP_DOWN;

  const hasGeometricSlack =
    state.lineLength > straightLineDistance + slackEpsilon;
  const objectOutpacesReel = objectApproachRate > playerRecoveryVelocity;
  const useSlackRpmDecay =
    hasGeometricSlack &&
    staticBreakTimer <= 0 &&
    (!isHolding || objectOutpacesReel);

  let rpm = state.rpm ?? 0;
  if (useSlackRpmDecay) {
    rpm = isHolding
      ? rpm - PHYSICS_CONSTANTS.SLACK_RPM_DECAY_RATE * deltaTime
      : rpm - rampDown * deltaTime;
  } else {
    rpm = isHolding ? rpm + rampUp * deltaTime : rpm - rampDown * deltaTime;
  }
  rpm = clamp(rpm, 0, rpmMax);

  const nextAvatarPullForce = getAvatarPullForceFromRpm(rpm, state.equipment);

  state.tension = Math.max(0, tension);
  state.snapTautImpulse = 0;
  state.hotZoneTimer = hotZoneTimer;
  state.lineCondition = lineCondition;
  state.breakThreshold = breakThreshold;
  state.rpm = rpm;
  state.avatarPullForce = nextAvatarPullForce;
  state.dragThresholdMin = dragThresholdMin;
  state.dragThresholdMax = dragThresholdMax;
  state.dragThresholdCurrent = dragThresholdCurrent;
  state.dragQuickReleaseActive = dragQuickReleaseActive;
  state.reactiveDrag = reactiveDrag;
  state.clutchForce = clutchForceAccounting;
  state.lineInwardForce = lineInwardForceAccounting;
  state.playerLineForce = lineInwardForceAccounting;
  state.totalPlayerResistance = lineInwardForceAccounting;
  state.objectVelocity = radialVelocity;
  state.radialVelocity = radialVelocity;
  state.objectApproachRate = objectApproachRate;
  state.slackChangeRate = slackChangeRate;
  state.playerRecoveryVelocity = playerRecoveryVelocity;
  state.objectState = objectState;
  state.staticBreakTimer = staticBreakTimer;
  state.linePayout = linePayout;
  state.lineLength = Math.max(0, state.lineLength);
  state.straightLineDistance = straightLineDistance;
  state.slack = slack;
  state.lineTaut = lineTaut;

  const tickLogEnabled =
    typeof globalThis !== "undefined" &&
    Boolean(globalThis.__MF_DRAG_TICK_LOGS__);
  if (tickLogEnabled) {
    const forceContestMargin =
      state.targetType === "fish"
        ? fishOutwardForce - lineInwardForceAccounting
        : objectLineForce - playerLineForce;
    const tickDebugPairs = [
      ["targetType", state.targetType],
      ["isHolding", isHolding ? 1 : 0],
      ["quickRelease", dragQuickReleaseActive ? 1 : 0],
      ["prevLineTaut", previousLineTaut ? 1 : 0],
      ["lineTaut", lineTaut ? 1 : 0],
      ["slack", slack],
      ["lineLength", state.lineLength],
      ["straightLineDistance", straightLineDistance],
      ["radialVelocity", radialVelocity],
      ["objectApproachRate", objectApproachRate],
      ["lineLoadForce", lineLoadForce],
      ["objectLineForce", objectLineForce],
      ["fishOutwardForce", fishOutwardForce],
      ["clutchForce", clutchForceAccounting],
      ["lineInwardForce", lineInwardForceAccounting],
      ["isHeld", isHeld ? 1 : 0],
      ["isOverwhelmed", isOverwhelmed ? 1 : 0],
      ["reactiveDrag", reactiveDrag],
      ["reactiveCap", effectiveDragThreshold],
      ["avatarPullForce", avatarPullForce],
      ["playerLineForce", playerLineForce],
      ["forceContestMargin", forceContestMargin],
      ["shouldPayOut", shouldPayOutLine ? 1 : 0],
      ["recoveryApplied", recoveryApplied],
      ["payoutDistance", payoutDistanceApplied],
      ["linePayoutRate", linePayout],
      ["spoolRemaining", state.spoolRemaining],
      ["rpm", rpm],
      ["tension", state.tension],
    ];

    console.log(
      `[DRAG TICK] ${tickDebugPairs
        .map(([label, value]) => {
          if (typeof value === "number" && Number.isFinite(value)) {
            return `${label}=${Number(value).toFixed(6)}`;
          }
          return `${label}=${String(value)}`;
        })
        .join(", ")}`,
    );
  }

  if (
    state.targetType === "metallic" &&
    state.target?.isMoving &&
    objectState === "kinetic" &&
    postStaticBreakDebugFramesRemaining > 0
  ) {
    const speedForDebug = magnitude(objectVelocityVector);
    const lineTautNum = lineTaut ? 1 : 0;
    const clampActiveNum = clampActive ? 1 : 0;
    const hasGeometricSlackNum = hasGeometricSlack ? 1 : 0;
    const useSlackRpmDecayNum = useSlackRpmDecay ? 1 : 0;

    const debugPairs = [
      ["lineTaut", lineTautNum],
      ["slack", slack],
      ["lineLength", state.lineLength],
      ["straightLineDistance", straightLineDistance],
      ["lineLoadForce", lineLoadForce],
      ["objectLineForce", objectLineForce],
      ["reactiveDrag", reactiveDrag],
      ["playerLineForce", playerLineForce],
      ["avatarPullForce", avatarPullForce],
      ["tension", state.tension],
      ["clampActive", clampActiveNum],
      ["objectApproachRate", objectApproachRate],
      ["playerRecoveryVelocity", playerRecoveryVelocity],
      ["radialVelocity", radialVelocity],
      ["speed", speedForDebug],
      ["hasGeometricSlack", hasGeometricSlackNum],
      ["useSlackRpmDecay", useSlackRpmDecayNum],
      ["rpm", rpm],
    ];

    console.log(
      debugPairs
        .map(([label, value]) => {
          const formatted = Number.isFinite(value)
            ? Number(value).toFixed(6)
            : String(value);
          return `${label}=${formatted}`;
        })
        .join(", "),
    );

    postStaticBreakDebugFramesRemaining -= 1;
  }

  state.postStaticBreakDebugFramesRemaining =
    postStaticBreakDebugFramesRemaining;

  state.forces = {
    avatarPull: avatarPullForce,
    staticFrictionThreshold,
    staticFrictionGateReached,
    isMoving: Boolean(state.target?.isMoving),
    reactiveDrag,
    clutchForce: clutchForceAccounting,
    lineInwardForce: lineInwardForceAccounting,
    playerLineForce: lineInwardForceAccounting,
    totalPlayerResistance: lineInwardForceAccounting,
    fishOutwardForce,
    isHeld,
    isOverwhelmed,
    swim: swimForce,
    velocityDrag,
    external: externalForce,
    friction: frictionForce,
    lineLoadForce,
    totalObject: objectLineForce,
    objectLineForce,
    net: dotProduct(netForceVector, lineAxis),
    playerForceVector: playerForceVectorForMotion,
    clampActive,
    intrinsicApproachRate,
    effectiveReelCap,
  };

  if (state.targetType === "metallic") {
    if (PHYSICS_CONSTANTS.DISABLE_MAGNET_SLIP) {
      const slipLimit = state.target?.slipLimit || 1;
      state.target.slipAccumulation = 0;
      state.slip = {
        accumulation: 0,
        limit: slipLimit,
        percent: 0,
      };
    } else {
      const slip = updateSlip(
        state.target,
        state.tension,
        state.equipment,
        deltaTime,
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
    }
  }

  state.fishStatus = {
    energy: state.targetType === "fish" ? state.target.energy : 0,
    panic: state.targetType === "fish" ? state.target.panicLevel : 0,
    state: state.targetType === "fish" ? state.target.state : null,
    fightPhase: state.targetType === "fish" ? state.target.fightPhase : null,
  };

  state.distanceToShore = magnitude(
    subtract(shoreAnchor, state.target.position),
  );
  if (state.distanceToShore <= PHYSICS_CONSTANTS.REACHED_SHORE_DISTANCE) {
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
    WORLD_Z.WATER_SURFACE,
  );
}
