import { describe, expect, it } from 'vitest';
import { stableKey } from './stableKey';

describe('stableKey', () => {
  it('ignores key order', () => {
    expect(stableKey({ page: 1, tenantId: 'a' })).toBe(stableKey({ tenantId: 'a', page: 1 }));
  });

  it('drops undefined values', () => {
    expect(stableKey({ imei: undefined, page: 1 })).toBe(stableKey({ page: 1 }));
  });

  it('keeps array order', () => {
    expect(stableKey([1, 2])).not.toBe(stableKey([2, 1]));
  });
});
