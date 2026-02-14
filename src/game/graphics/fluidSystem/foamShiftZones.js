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

    const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);
    for (let p = 0; p < particles.length; p++) {
      const particle = particles[p];
      if (!particle.active) continue;

      const dx = particle.x - zone.position.x;
      const dy = particle.y - zone.position.y;
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
        particle.vx +=
          (-nx * pullStrength + tanX * tangentialStrength) * scaledStrength;
        particle.vy +=
          (-ny * pullStrength + tanY * tangentialStrength) * scaledStrength;
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
