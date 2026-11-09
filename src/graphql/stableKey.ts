// Builds a string key for a variables object so the same values give the
// same key no matter the key order. Undefined values are dropped, same as
// JSON.stringify, which matches what gets sent in the request body.

export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }
    return v;
  }) ?? 'undefined';
}
