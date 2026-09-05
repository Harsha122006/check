export function buildAnalysisCacheKey(imageFingerprint: string, occasion: string) {
  return `${imageFingerprint}:${occasion}`;
}

export function trimAnalysisCache<K, V>(cache: Map<K, V>, limit: number) {
  while (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export const PUBLIC_ANALYSIS_CACHE_LIMIT = 32;

