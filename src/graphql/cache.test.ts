import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockGraphQL } from '../test/fetchMock';
import { clearCache, evict, fetchQuery, getEntry, cacheKey, patch } from './cache';

const QUERY = 'query Thing { thing }';

afterEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

describe('cache', () => {
  it('shares one request between concurrent callers', async () => {
    const { fetchMock } = mockGraphQL({ Thing: () => ({ data: { thing: 1 } }) });
    const [a, b] = await Promise.all([
      fetchQuery(QUERY, { id: 1 }, 't:thing'),
      fetchQuery(QUERY, { id: 1 }, 't:thing'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('serves fresh data from the cache', async () => {
    const { fetchMock } = mockGraphQL({ Thing: () => ({ data: { thing: 1 } }) });
    await fetchQuery(QUERY, {}, 't:thing');
    await fetchQuery(QUERY, {}, 't:thing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed response', async () => {
    const { fetchMock } = mockGraphQL({ Thing: () => ({ errors: [{ message: 'boom' }] }) });
    const res = await fetchQuery(QUERY, {}, 't:thing');
    expect(res.errors).toEqual(['boom']);
    await fetchQuery(QUERY, {}, 't:thing');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps data and field errors from a partial response', async () => {
    mockGraphQL({
      Thing: () => ({
        data: { thing: { imsi: null } },
        errors: [{ message: 'Subscriber record unavailable', path: ['thing', 'imsi'] }],
      }),
    });
    const res = await fetchQuery(QUERY, {}, 't:thing');
    expect(res.data).toEqual({ thing: { imsi: null } });
    expect(res.errors).toEqual(['thing.imsi: Subscriber record unavailable']);
  });

  it('patch returns a rollback that restores the old data', async () => {
    mockGraphQL({ Thing: () => ({ data: { thing: 1 } }) });
    await fetchQuery(QUERY, {}, 't:thing');
    const key = cacheKey(QUERY, {});

    const rollback = patch('t:thing', () => ({ thing: 2 }));
    expect(getEntry(key)?.data).toEqual({ thing: 2 });
    rollback();
    expect(getEntry(key)?.data).toEqual({ thing: 1 });
  });

  it('evict drops entries and ignores late responses', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    mockGraphQL({
      Thing: async () => {
        await gate;
        return { data: { thing: 1 } };
      },
    });
    const pending = fetchQuery(QUERY, {}, 'tenant-a:thing').catch(() => undefined);
    evict('tenant-a:');
    release();
    await pending;
    expect(getEntry(cacheKey(QUERY, {}))).toBeUndefined();
  });
});
