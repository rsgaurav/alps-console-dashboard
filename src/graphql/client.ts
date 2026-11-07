export const GRAPHQL_ENDPOINT = 'http://localhost:3000/graphql';

export type Variables = Record<string, unknown>;

/** Normalised result every layer above the transport works with. */
export type GraphQLResult<TData> = {
  data: TData | undefined;
  errors: string[];
};

type RawGraphQLError = {
  message: string;
  path?: Array<string | number>;
};

type RawGraphQLResponse<TData> = {
  data?: TData | null;
  errors?: RawGraphQLError[];
};

/* Sends one GraphQL operation over plain fetch. */
export async function gqlFetch<TData>(
  query: string,
  variables?: Variables,
  signal?: AbortSignal,
): Promise<GraphQLResult<TData>> {
  let response: Response;

  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { data: undefined, errors: ['Network error: could not reach the server'] };
  }

  if (!response.ok) {
    return { data: undefined, errors: [`HTTP ${response.status} ${response.statusText}`] };
  }

  let body: RawGraphQLResponse<TData>;
  try {
    body = await response.json();
  } catch (err) {
    if (signal?.aborted) throw err;
    return { data: undefined, errors: ['Malformed response from server'] };
  }

  return {
    data: body.data ?? undefined,
    errors: (body.errors ?? []).map(formatError),
  };
}

/** "deviceDetail.imsi: Subscriber record unavailable" — keeps the field path
 *  inside the string[] the contract allows, so the UI can still say WHICH
 *  field failed. */
function formatError(e: RawGraphQLError): string {
  return e.path?.length ? `${e.path.join('.')}: ${e.message}` : e.message;
}