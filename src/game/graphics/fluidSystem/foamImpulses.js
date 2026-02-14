export function applyRadialImpulseToParticles({
  particles,
  config,
  worldX,
  worldY,
  options = {},
  applyDamping,
}) {
  const radiusWorld = Number.isFinite(options.radiusWorld)
    ? options.radiusWorld
    : Number.isFinite(config.landingSplatRadius)
      ? config.landingSplatRadius
      : 0.9;
  const strength = Number.isFinite(options.strength)
    ? options.strength
    : Number.isFinite(config.landingSplatStrength)
      ? config.landingSplatStrength
      : 6.0;

  const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (!particle.active) continue;

    let dx = particle.x - worldX;
    let dy = particle.y - worldY;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    if (distSq < 0.000001) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }

    const dist = Math.max(0.0001, Math.sqrt(distSq));
    const falloff = Math.exp(-distSq / radiusSq);
    const impulse = strength * falloff;
    const impulseX = (dx / dist) * impulse;
    const impulseY = (dy / dist) * impulse;
    particle.vx += impulseX;
    particle.vy += impulseY;
    if (applyDamping) {
      particle.splashDamping = Math.max(
        Number.isFinite(particle.splashDamping) ? particle.splashDamping : 0,
        0.6,
      );
    }
  }
}

export function applyDirectionalShearToParticles({
  particles,
  worldX,
  worldY,
  dirX,
  dirY,
  options = {},
}) {
  const radiusWorld = Number.isFinite(options.radiusWorld)
    ? options.radiusWorld
    : 0.25;
  const strength = Number.isFinite(options.strength) ? options.strength : 0.02;

  const dirLen = Math.hypot(dirX, dirY);
  if (!Number.isFinite(dirLen) || dirLen < 0.0001) {
    return;
  }

  const dirNx = dirX / dirLen;
  const dirNy = dirY / dirLen;
  const tanX = -dirNy;
  const tanY = dirNx;

  const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (!particle.active) continue;

    const dx = particle.x - worldX;
    const dy = particle.y - worldY;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    const side = Math.sign(dx * dirNy - dy * dirNx) || 1;
    const falloff = Math.exp(-distSq / radiusSq);
    const impulse = strength * falloff * side;
    particle.vx += tanX * impulse;
    particle.vy += tanY * impulse;
  }
}

export function applySplatToParticles({
  particles,
  config,
  worldX,
  worldY,
  deltaWorldX,
  deltaWorldY,
  options = {},
}) {
  const radiusWorld = Number.isFinite(options.radiusWorld)
    ? options.radiusWorld
    : Number.isFinite(config.splatDirectRadius)
      ? config.splatDirectRadius
      : 0.7;
  const strength = Number.isFinite(options.strength)
    ? options.strength
    : Number.isFinite(config.splatDirectStrength)
      ? config.splatDirectStrength
      : 8.0;
  const maxForce = Number.isFinite(options.maxForce)
    ? options.maxForce
    : Number.isFinite(config.splatDirectMaxForce)
      ? config.splatDirectMaxForce
      : null;

  const radiusSq = Math.max(0.0001, radiusWorld * radiusWorld);
  let impulseX = deltaWorldX * strength;
  let impulseY = deltaWorldY * strength;
  if (Number.isFinite(maxForce)) {
    const mag = Math.hypot(impulseX, impulseY);
    if (mag > maxForce && mag > 0) {
      const scale = maxForce / mag;
      impulseX *= scale;
      impulseY *= scale;
    }
  }

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (!particle.active) continue;

    const dx = particle.x - worldX;
    const dy = particle.y - worldY;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    const falloff = Math.exp(-distSq / radiusSq);
    particle.vx += impulseX * falloff;
    particle.vy += impulseY * falloff;
  }
}
