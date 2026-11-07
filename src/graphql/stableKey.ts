// Value-based identity for variables objects.
//
// `{ page: 1, tenantId: 'a' }` and `{ tenantId: 'a', page: 1 }` are the same
// request, but JSON.stringify gives them different strings and `===` says a
// fresh object literal is new on every render. Sorting keys fixes both.
//
// Keys whose value is `undefined` are dropped (that is JSON.stringify's own
// behaviour), which is what we want: fetch drops them from the body too, so
// `{ imei: undefined }` and `{}` hit the server identically.

export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }
    return v; // primitives and arrays: arrays are ordered, so leave them alone
  }) ?? 'undefined'; // JSON.stringify(undefined) returns undefined, not a string
}
