import { vi } from 'vitest';

type Body = { query: string; variables: Record<string, unknown> };
type Responder = (vars: Record<string, unknown>) => unknown;

// stubs global fetch and answers by operation name
export function mockGraphQL(responders: Record<string, Responder>) {
  const calls: { operation: string; variables: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    const operation = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
    calls.push({ operation, variables: body.variables });
    const responder = responders[operation];
    if (!responder) throw new Error(`no mock for ${operation}`);
    return new Response(JSON.stringify(await responder(body.variables)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
