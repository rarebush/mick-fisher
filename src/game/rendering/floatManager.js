/**
 * Float Manager
 * Renders the fishing float as two passes split by the waterline, with bobbing.
 */

import * as PIXI from "pixi.js";
import {
  WORLD_Z,
  createViewport,
  worldToScreen,
  projectToScreen,
  getProjectionMetrics,
} from "../mechanics/worldConstants.js";
import { FLOAT_WORLD_RADIUS, FLOAT_VISUAL_SCALE } from "./floatConstants.js";

const FLOAT_BOB_AMPLITUDE = 0.015; // World units
const FLOAT_BOB_SPEED = 1.6; // Radians/sec

const FLOAT_COLORS = {
  above: { body: 0xe24b3a, band: 0xe24b3a, alpha: 1 },
  below: { body: 0xffd400, band: 0xffd400, alpha: 0.9 },
};

function drawFloatPass(body, radius, colors) {
  body.clear();
  body.circle(0, 0, radius).fill({ color: colors.body, alpha: colors.alpha });
}

function sampleArc(radius, start, end, steps, offsetX = 0, offsetY = 0) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const angle = start + (end - start) * t;
    points.push(
      offsetX + Math.cos(angle) * radius,
      offsetY + Math.sin(angle) * radius,
    );
  }
  return points;
}

function sampleEllipse(rx, ry, centerY, start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const angle = start + (end - start) * t;
    points.push(Math.cos(angle) * rx, centerY + Math.sin(angle) * ry);
  }
  return points;
}

function updateAboveMask(aboveMask, localWaterY, radiusPx, sliceRx, sliceRy) {
  aboveMask.clear();
  const steps = 36;
  const ellipseBottom = sampleEllipse(
    sliceRx,
    sliceRy,
    localWaterY,
    0,
    Math.PI,
    steps,
  );
  const circleTop = sampleArc(radiusPx, Math.PI, 2 * Math.PI, steps);
  const abovePoints = [...circleTop, ...ellipseBottom];
  aboveMask.poly(abovePoints).fill({ color: 0xffffff });
}

function updateBelowMask(belowMask, localWaterY, radiusPx, sliceRx, sliceRy) {
  belowMask.clear();
  const steps = 36;
  const circleBottom = sampleArc(radiusPx, 0, Math.PI, steps);
  const ellipseBottom = sampleEllipse(
    sliceRx,
    sliceRy,
    localWaterY,
    Math.PI,
    2 * Math.PI,
    steps,
  );
  const belowPoints = [...circleBottom, ...ellipseBottom];
  belowMask.poly(belowPoints).fill({ color: 0xffffff });
}

export class FloatManager {
  constructor(app, layerContainers = null) {
    this.app = app;
    this.layerContainers = layerContainers;
    this.aboveContainer = null;
    this.belowContainer = null;
    this.aboveBody = null;
    this.belowBody = null;
    this.aboveMask = null;
    this.belowMask = null;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.lastRadiusPx = null;
    this.lastScreenPosition = null;
    this.lastWorldPosition = null;
  }

  ensureContainers() {
    if (!this.app || this.aboveContainer || this.belowContainer) return;

    this.aboveContainer = new PIXI.Container();
    this.belowContainer = new PIXI.Container();
    this.aboveContainer.roundPixels = true;
    this.belowContainer.roundPixels = true;

    this.aboveBody = new PIXI.Graphics();
    this.belowBody = new PIXI.Graphics();
    this.aboveMask = new PIXI.Graphics();
    this.belowMask = new PIXI.Graphics();

    this.aboveContainer.addChild(this.aboveBody, this.aboveMask);
    this.belowContainer.addChild(this.belowBody, this.belowMask);

    this.aboveContainer.mask = this.aboveMask;
    this.belowContainer.mask = this.belowMask;

    const aboveTarget = this.layerContainers?.aboveWater || this.app.stage;
    const belowTarget = this.layerContainers?.underwater || this.app.stage;
    aboveTarget.addChild(this.aboveContainer);
    belowTarget.addChild(this.belowContainer);
  }

  update(waitState, timeSeconds) {
    if (!this.app) return;
    if (!waitState?.castPosition) {
      this.clear();
      return;
    }

    this.ensureContainers();

    const viewport = createViewport(
      this.app.screen.width,
      this.app.screen.height,
    );

    const idleBob =
      Math.sin(timeSeconds * FLOAT_BOB_SPEED + this.bobPhase) *
      FLOAT_BOB_AMPLITUDE;
    const physicsBob = Number.isFinite(waitState.bobOffset)
      ? waitState.bobOffset
      : 0;
    const bobOffset = idleBob + physicsBob;

    const floatWorld = {
      x: waitState.castPosition.x,
      y: waitState.castPosition.y,
      z: WORLD_Z.WATER_SURFACE + bobOffset,
    };

    const centerScreen = worldToScreen(floatWorld, viewport);
    const waterlineScreenY = projectToScreen(
      floatWorld.x,
      floatWorld.y,
      WORLD_Z.WATER_SURFACE,
      viewport,
    ).y;

    const metrics = getProjectionMetrics(viewport);
    const radiusPx =
      FLOAT_WORLD_RADIUS *
      ((metrics.screenXPerWorldUnit + metrics.screenYPerWorldUnit) / 2) *
      FLOAT_VISUAL_SCALE;

    const heightToWater = floatWorld.z - WORLD_Z.WATER_SURFACE;
    const clampedHeight = Math.max(
      -FLOAT_WORLD_RADIUS,
      Math.min(FLOAT_WORLD_RADIUS, heightToWater),
    );
    const sliceRadiusWorld = Math.sqrt(
      Math.max(0, FLOAT_WORLD_RADIUS ** 2 - clampedHeight ** 2),
    );
    const sliceRx =
      sliceRadiusWorld * metrics.screenXPerWorldUnit * FLOAT_VISUAL_SCALE;
    const sliceRy =
      sliceRadiusWorld * metrics.screenYPerWorldUnit * FLOAT_VISUAL_SCALE;

    if (!this.lastRadiusPx || Math.abs(this.lastRadiusPx - radiusPx) > 0.25) {
      drawFloatPass(this.aboveBody, radiusPx, FLOAT_COLORS.above);
      drawFloatPass(this.belowBody, radiusPx, FLOAT_COLORS.below);
      this.lastRadiusPx = radiusPx;
    }

    this.aboveContainer.position.set(centerScreen.x, centerScreen.y);
    this.belowContainer.position.set(centerScreen.x, centerScreen.y);

    const localWaterY = waterlineScreenY - centerScreen.y;
    const aboveVisible = heightToWater >= -FLOAT_WORLD_RADIUS;
    const belowVisible = heightToWater <= FLOAT_WORLD_RADIUS;
    this.aboveContainer.visible = aboveVisible;
    this.belowContainer.visible = belowVisible;
    this.aboveBody.visible = true;
    this.belowBody.visible = true;
    if (sliceRadiusWorld > 0) {
      if (aboveVisible) {
        updateAboveMask(
          this.aboveMask,
          localWaterY,
          radiusPx,
          sliceRx,
          sliceRy,
        );
      } else {
        this.aboveMask.clear();
      }
      if (belowVisible) {
        updateBelowMask(
          this.belowMask,
          localWaterY,
          radiusPx,
          sliceRx,
          sliceRy,
        );
      } else {
        this.belowMask.clear();
      }
    } else {
      this.aboveMask.clear();
      this.belowMask.clear();
      if (aboveVisible) {
        this.aboveMask.circle(0, 0, radiusPx).fill({ color: 0xffffff });
      }
      if (belowVisible) {
        this.belowMask.circle(0, 0, radiusPx).fill({ color: 0xffffff });
      }
    }
    this.lastScreenPosition = { x: centerScreen.x, y: centerScreen.y };
    this.lastWorldPosition = { ...floatWorld };
  }

  clear() {
    if (this.aboveContainer?.parent) {
      this.aboveContainer.parent.removeChild(this.aboveContainer);
    }
    if (this.belowContainer?.parent) {
      this.belowContainer.parent.removeChild(this.belowContainer);
    }
    this.aboveContainer = null;
    this.belowContainer = null;
    this.aboveBody = null;
    this.belowBody = null;
    this.aboveMask = null;
    this.belowMask = null;
    this.lastRadiusPx = null;
    this.lastScreenPosition = null;
    this.lastWorldPosition = null;
  }

  destroy() {
    this.clear();
    this.app = null;
  }
}
