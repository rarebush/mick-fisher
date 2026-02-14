import { CURRENT_SHIFT_ZONE_TYPES } from "../../data/currentShiftZones.js";

export function getShiftZoneDefaults(zone) {
  const typeConfig = CURRENT_SHIFT_ZONE_TYPES?.[zone.type?.toUpperCase()];
  return typeConfig?.defaults || {};
}

export function getShiftZoneNumber(value, fallback, defaultValue) {
  if (Number.isFinite(value)) return value;
  if (Number.isFinite(fallback)) return fallback;
  return defaultValue;
}

export function applyShiftZonesToParticles({
  particles,
  zones,
  deltaTime,
  config,
  flowPhase,
}) {
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    if (!zone?.position) continue;

    const defaults = getShiftZoneDefaults(zone);
    const radiusWorld = getShiftZoneNumber(
      zone.radiusWorld,
      defaults.radiusWorld,
      0.6,
    );
    const strength = getShiftZoneNumber(zone.strength, defaults.strength, 0.2);
    const falloff = getShiftZoneNumber(zone.falloff, defaults.falloff, 2.0);

    for (let p = 0; p < particles.length; p++) {
      const particle = particles[p];
      if (!particle.active) continue;

      const dx = particle.x - zone.position.x;
      const dy = particle.y - zone.position.y;

      if (zone.type === "repel" && zone.shape?.type) {
        const shapeType = zone.shape.type;
        const size = zone.shape.size || {};
        const rotation = Number.isFinite(zone.shape.rotation)
          ? zone.shape.rotation
          : 0;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const sizeX = Number.isFinite(size.x) ? size.x : radiusWorld * 2;
        const sizeY = Number.isFinite(size.y) ? size.y : radiusWorld * 2;
        const halfX = Math.max(0.0001, sizeX / 2);
        const halfY = Math.max(0.0001, sizeY / 2);
        const solidInset = zone.isObjectRepel
          ? Math.max(0, Math.min(0.45, zone.solidInset ?? 0))
          : 0;
        const innerThreshold = Math.max(0.0001, 1 - solidInset);
        const localDx = dx * cosR + dy * sinR;
        const localDy = -dx * sinR + dy * cosR;
        let distNormalized = 0;
        let nx = 0;
        let ny = 0;

        if (shapeType === "circle" || shapeType === "ellipse") {
          const radiusX = halfX;
          const radiusY = halfY;
          distNormalized = Math.sqrt(
            (localDx * localDx) / (radiusX * radiusX) +
              (localDy * localDy) / (radiusY * radiusY),
          );
          if (distNormalized > 1) continue;
          if (solidInset > 0 && distNormalized < innerThreshold) {
            const scale = innerThreshold / Math.max(distNormalized, 0.0001);
            const scaledLocalX = localDx * scale;
            const scaledLocalY = localDy * scale;
            const worldDx = scaledLocalX * cosR - scaledLocalY * sinR;
            const worldDy = scaledLocalX * sinR + scaledLocalY * cosR;
            particle.x = zone.position.x + worldDx;
            particle.y = zone.position.y + worldDy;
            distNormalized = innerThreshold;
          }
          const localNx = localDx / (radiusX * radiusX);
          const localNy = localDy / (radiusY * radiusY);
          const normalLen = Math.hypot(localNx, localNy);
          if (normalLen > 0.0001) {
            nx = (localNx / normalLen) * cosR - (localNy / normalLen) * sinR;
            ny = (localNx / normalLen) * sinR + (localNy / normalLen) * cosR;
          } else {
            nx = cosR;
            ny = sinR;
          }
        } else if (shapeType === "rect" || shapeType === "square") {
          const ratioX = Math.abs(localDx) / halfX;
          const ratioY = Math.abs(localDy) / halfY;
          distNormalized = Math.max(ratioX, ratioY);
          if (distNormalized > 1) continue;
          if (solidInset > 0 && distNormalized < innerThreshold) {
            const scale = innerThreshold / Math.max(distNormalized, 0.0001);
            const scaledLocalX = localDx * scale;
            const scaledLocalY = localDy * scale;
            const worldDx = scaledLocalX * cosR - scaledLocalY * sinR;
            const worldDy = scaledLocalX * sinR + scaledLocalY * cosR;
            particle.x = zone.position.x + worldDx;
            particle.y = zone.position.y + worldDy;
            distNormalized = innerThreshold;
          }
          let localNx = 0;
          let localNy = 0;
          if (ratioX >= ratioY) {
            localNx = Math.sign(localDx);
            localNy = 0;
          } else {
            localNx = 0;
            localNy = Math.sign(localDy);
          }
          if (localNx === 0 && localNy === 0) {
            localNx = 1;
            localNy = 0;
          }
          nx = localNx * cosR - localNy * sinR;
          ny = localNx * sinR + localNy * cosR;
        } else {
          continue;
        }

        const falloffScale = Math.exp(-Math.pow(distNormalized, falloff));
        const scaledStrength =
          strength * falloffScale * deltaTime * config.shiftZoneParticleScale;
        particle.vx += nx * scaledStrength;
        particle.vy += ny * scaledStrength;
        continue;
      }

      const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      const dist = Math.max(0.0001, Math.sqrt(distSq));
      const falloffScale = Math.exp(-Math.pow(dist / radiusWorld, falloff));
      const scaledStrength =
        strength * falloffScale * deltaTime * config.shiftZoneParticleScale;

      if (zone.type === "whirlpool") {
        const pullStrength = getShiftZoneNumber(
          zone.pullStrength,
          defaults.pullStrength,
          0.3,
        );
        const tangentialStrength = getShiftZoneNumber(
          zone.tangentialStrength,
          defaults.tangentialStrength,
          0.5,
        );
        const nx = dx / dist;
        const ny = dy / dist;
        const tanX = -ny;
        const tanY = nx;
        // Ease overall pull for a slower spiral, but increase inward bias near the core.
        const centerT = Math.min(1, Math.max(0, 1 - dist / radiusWorld));
        const pullScale = 0.45 + centerT * 0.45;
        const tangentialScale = 0.9 - centerT * 0.5;
        particle.vx +=
          (-nx * pullStrength * pullScale +
            tanX * tangentialStrength * tangentialScale) *
          scaledStrength;
        particle.vy +=
          (-ny * pullStrength * pullScale +
            tanY * tangentialStrength * tangentialScale) *
          scaledStrength;
        continue;
      }

      if (zone.type === "repel") {
        const nx = dx / dist;
        const ny = dy / dist;
        particle.vx += nx * scaledStrength;
        particle.vy += ny * scaledStrength;
        continue;
      }

      if (zone.type === "rapid") {
        const flowDir = zone.flowDir || defaults.flowDir || { x: 1, y: 0 };
        const flowLen = Math.hypot(flowDir.x, flowDir.y) || 1;
        const fx = flowDir.x / flowLen;
        const fy = flowDir.y / flowLen;
        const lateralStrength = getShiftZoneNumber(
          zone.lateralStrength,
          defaults.lateralStrength,
          0.15,
        );
        const lateralFrequency = getShiftZoneNumber(
          zone.lateralFrequency,
          defaults.lateralFrequency,
          1.0,
        );
        const phase = (flowPhase || 0) * lateralFrequency;
        const wobble = Math.sin(phase + dist * 1.4) * lateralStrength;
        const sideX = -fy;
        const sideY = fx;
        const exitBoost = getShiftZoneNumber(
          zone.exitBoost,
          defaults.exitBoost,
          0.0,
        );
        const exitFactor = dist / radiusWorld;

        particle.vx +=
          (fx * (1 + exitBoost * exitFactor) + sideX * wobble) * scaledStrength;
        particle.vy +=
          (fy * (1 + exitBoost * exitFactor) + sideY * wobble) * scaledStrength;
      }
    }
  }
}
