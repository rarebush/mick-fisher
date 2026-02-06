export function getPeakValue(peaks, axis) {
  if (!peaks) return undefined;
  const maxKey = `max${axis}`;
  const minKey = `min${axis}`;
  const maxValue = peaks[maxKey];
  const minValue = peaks[minKey];
  if (!Number.isFinite(maxValue) && !Number.isFinite(minValue)) {
    return undefined;
  }
  if (!Number.isFinite(maxValue)) return minValue;
  if (!Number.isFinite(minValue)) return maxValue;
  return Math.abs(maxValue) >= Math.abs(minValue) ? maxValue : minValue;
}
