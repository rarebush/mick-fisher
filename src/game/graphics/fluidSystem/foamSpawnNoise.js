import { WORLD_Y } from "../../mechanics/worldDimensions.js";

export function getSpawnThresholdValue({
  spawnNoiseRange,
  spawnNoiseThreshold,
}) {
  if (!spawnNoiseRange) {
    return spawnNoiseThreshold;
  }

  const { min, max } = spawnNoiseRange;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return spawnNoiseThreshold;
  }

  const span = max - min;
  if (span <= 0.00001) {
    return max;
  }

  return min + span * spawnNoiseThreshold;
}

export function updateSpawnNoiseOffset() {
  return {
    x: Math.random() * 1000,
    y: Math.random() * 1000,
  };
}

export function updateSpawnNoiseRange({
  spawnMinX,
  upstreamBand,
  config,
  spawnNoiseOffset,
}) {
  const samplesX = 28;
  const samplesY = 14;
  let minValue = Infinity;
  let maxValue = -Infinity;

  for (let iy = 0; iy < samplesY; iy++) {
    const v = samplesY === 1 ? 0.5 : iy / (samplesY - 1);
    const y = WORLD_Y.WATER_NEAR + v * (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR);
    for (let ix = 0; ix < samplesX; ix++) {
      const u = samplesX === 1 ? 0.5 : ix / (samplesX - 1);
      const x = spawnMinX + u * upstreamBand;
      const value = clusterValue({
        x,
        y,
        spawnMinX,
        upstreamBand,
        config,
        spawnNoiseOffset,
      });
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }
  }

  return {
    min: minValue,
    max: maxValue,
  };
}

export function pickSpawnCandidate({
  spawnMinX,
  upstreamBand,
  config,
  spawnNoiseOffset,
  spawnNoiseRange,
}) {
  const x = spawnMinX + Math.random() * upstreamBand;
  const y =
    WORLD_Y.WATER_NEAR +
    Math.random() * (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR);

  if (config.spawnInMainArea) {
    return { x, y };
  }

  const cluster = clusterValue({
    x,
    y,
    spawnMinX,
    upstreamBand,
    config,
    spawnNoiseOffset,
  });

  const thresholdValue = getSpawnThresholdValue({
    spawnNoiseRange,
    spawnNoiseThreshold: config.spawnNoiseThreshold,
  });
  if (cluster < thresholdValue) {
    return null;
  }

  return { x, y };
}

export function clusterValue({
  x,
  y,
  spawnMinX,
  upstreamBand,
  config,
  spawnNoiseOffset,
}) {
  const height = WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR;
  const width = upstreamBand;
  const u = (x - spawnMinX) / width;
  const v = (y - WORLD_Y.WATER_NEAR) / height;

  const aspect = width / height;
  const scaledX = u * config.spawnNoiseScale * aspect + spawnNoiseOffset.x;
  const scaledY = v * config.spawnNoiseScale + spawnNoiseOffset.y;
  const warp = fbmNoise2D(scaledX * 0.8 + 7.7, scaledY * 0.8 - 3.1, 2);
  const warpX = scaledX + (warp - 0.5) * 0.8;
  const warpY = scaledY + (warp - 0.5) * 0.8;

  const noiseValue = fbmNoise2D(warpX, warpY, 4);
  return Math.pow(noiseValue, config.spawnNoiseSharpness);
}

function perlinNoise2D(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = fade(x - x0);
  const sy = fade(y - y0);

  const g00 = grad2D(x0, y0, x - x0, y - y0);
  const g10 = grad2D(x1, y0, x - x1, y - y0);
  const g01 = grad2D(x0, y1, x - x0, y - y1);
  const g11 = grad2D(x1, y1, x - x1, y - y1);

  const ix0 = lerp(g00, g10, sx);
  const ix1 = lerp(g01, g11, sx);

  const value = lerp(ix0, ix1, sy);
  return value * 0.5 + 0.5;
}

function fbmNoise2D(x, y, octaves) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;

  for (let i = 0; i < octaves; i++) {
    const rotated = rotate2D(x * frequency, y * frequency, 0.72);
    value += perlinNoise2D(rotated.x, rotated.y) * amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }

  return value;
}

function rotate2D(x, y, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: x * cosA - y * sinA,
    y: x * sinA + y * cosA,
  };
}

function grad2D(ix, iy, dx, dy) {
  const angle = hash2D(ix, iy) * Math.PI * 2;
  const gx = Math.cos(angle);
  const gy = Math.sin(angle);
  return gx * dx + gy * dy;
}

function hash2D(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
