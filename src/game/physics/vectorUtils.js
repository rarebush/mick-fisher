export function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v) {
  const mag = magnitude(v);
  if (mag < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
