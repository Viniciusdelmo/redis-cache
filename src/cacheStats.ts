let hits = 0;
let misses = 0;

export function recordHit() { hits++; }
export function recordMiss() { misses++; }

export function getCacheStats() {
  const total = hits + misses;
  const hitRate = total === 0 ? "0%" : `${Math.round((hits / total) * 100)}%`;
  return { hits, misses, hitRate };
}