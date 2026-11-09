# ALPS Device Console

A small React + TypeScript console for operators to search devices, inspect a
device, read its history and apply actions (lock / unlock / release). All data
is scoped to a tenant, which can be switched from the header.

There is no real backend. The GraphQL endpoint `http://localhost:3000/graphql`
is served by [MSW](https://mswjs.io) from inside the browser, using the handlers in
[src/mocks/handlers.ts](src/mocks/handlers.ts) and the schema in
[src/mocks/schema.graphql](src/mocks/schema.graphql).

## Requirements

- Node.js 20.19+ or 22.12+ (needed by Vite 8, tested on Node 24)
- npm
- A modern browser (the mock runs as a service worker)

## Running

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The mock service
worker (`public/mockServiceWorker.js`) is registered automatically before the
app renders, so nothing else has to be started.

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the dev server with the mocked API      |
| `npm test`           | Run the unit and component tests once         |
| `npm run test:watch` | Run the tests in watch mode                   |
| `npm run lint`       | Run ESLint                                    |
| `npm run build`      | Type-check and build to `dist/`               |
| `npm run preview`    | Serve the production build                    |

## Things to try

- **Search and filter**: type digits to search by IMEI, anything else searches
  by serial number. The state dropdown filters by device state. The mock
  replies out of order on purpose; only the latest request's result is shown.
- **Tenant switch**: switching tenant aborts in-flight requests, drops the old
  tenant's cache and resets the selection, page and search.
- **Partial response**: in `tenant-alpha`, search `POISON` and open
  `SN-0000-POISON`. The detail returns data plus errors for `imsi` and
  `policy`; the other fields render and the two failed fields show
  "Unavailable" with the reason.
- **Actions**: select a device and use the buttons under "Actions". The state
  changes immediately in the detail and the list, then the detail, history
  and list are refetched. If the server rejects the action (for example
  locking a device that is already locked), the change is rolled back and
  the error is shown.

## Project layout

```
src/
  App.tsx                     page layout, selected device
  operations.ts               GraphQL documents and response types
  graphql/
    client.ts                 fetch wrapper, normalises errors to string[]
    cache.ts                  shared request cache (dedupe, TTL, invalidate, evict, patch)
    stableKey.ts              order-independent key for variables
  hooks/
    useQuery.ts               cached query hook with request-id race guard
    useMutation.ts            mutation hook (bypasses the cache)
    useTenantQuery.ts         useQuery that always adds the current tenant
    useTenantMutation.ts      useMutation that always adds the current tenant
    useDebouncedValue.ts
    useTenant.ts
  tenant/
    context.ts                tenant context and tenant list
    TenantContext.tsx         provider (evicts cache on switch) and switcher
  features/
    devices/DeviceList.tsx    search, state filter, pagination
    device/DeviceDetail.tsx   detail view with per-field error display
    device/DeviceActions.tsx  available actions, optimistic assign with rollback
    device/HistoryList.tsx    paginated device history
  mocks/                      MSW handlers, worker setup, schema
  test/fetchMock.ts           fetch stub used by the tests
```

### Cache keys

Every tenant query has a `queryKey` prefixed with the tenant, for example
`tenant-alpha:devices` or `tenant-alpha:device:dev-0042:detail`. Invalidation,
eviction and optimistic patches all work by prefix, so one call can target a
single device (`tenant-alpha:device:dev-0042:`) or a whole tenant
(`tenant-alpha:`). Cached entries live for 30 seconds; our own mutations
invalidate the affected keys straight away.

## Thought process

The mock API is built to misbehave: responses arrive out of order, a device
returns data and errors together, and some actions get rejected. Most of the
design follows from handling those cases, so the data layer came first and the
screens were built on top of it.

- **Plain fetch and a small cache instead of a GraphQL client.** The app only
  needs deduping, a TTL, invalidation and optimistic patches, and that fits in
  one file where the behaviour is easy to follow and test.
- **Out-of-order responses.** Each hook tracks a request id and ignores anything
  that isn't the latest. The 300 ms debounce on search only reduces how often
  this happens; the request id is what makes it correct.
- **Tenant isolation.** Components can't pass `tenantId`. `useTenantQuery` and
  `useTenantMutation` add it last, so it can't be forgotten or overridden.
  Switching tenant aborts in-flight requests, evicts the old tenant's cache and
  remounts the tree, so nothing from the previous tenant can render.
- **Partial responses.** GraphQL can return useful data alongside errors, so the
  two are kept separate. Errors keep their field path, which lets the detail
  view mark only the fields that failed.
- **Cache TTL of 30 seconds.** Other operators can change a device, so data
  shouldn't be held for long. Our own mutations invalidate straight away, so the
  TTL only matters for changes made by someone else.
- **Optimistic actions.** The state changes immediately, is rolled back if the
  server rejects the action, and the device and list are refetched either way so
  the server has the final say. Mutations skip the cache because running the
  same one twice should reach the server twice.
- **One search box.** The API ANDs `imei` and `serialNumber`, so sending both
  would rarely match. All-digit input is treated as an IMEI and anything else as
  a serial number.

## TODO

Known gaps and follow-ups:

- **Mocking in production builds**: `src/main.tsx` always starts MSW. It should
  only start in development (for example behind `import.meta.env.DEV`) once a
  real API exists. This is also why the production bundle is over 500 kB.
- **Rollback can restore stale data**: if a refetch lands between an
  optimistic patch and its rollback, the rollback puts back data older than
  the server's ([src/graphql/cache.ts](src/graphql/cache.ts)). It should check
  that the entry is unchanged before restoring, and invalidate otherwise.
- **Old rows shown next to an error**: when a new request fails, `useQuery`
  keeps showing the previous rows alongside the error
  ([src/hooks/useQuery.ts](src/hooks/useQuery.ts)). They should be cleared once
  the request has settled.
- **Abort on unmount**: `useQuery` lets the request finish after unmount. It is
  harmless (the result just fills the cache) but wastes a request.
- **Reset without a queryKey**: `reset()` can only cancel requests when a
  `queryKey` is present; otherwise only local state is cleared.
- **Partial mutation responses**: with `throwError: true`, `useMutation` drops
  `data` when the response also has errors. Fine for `assignAction` (a
  boolean), not in general.
- **Search matches IMEI or serial, not both**: the API ANDs `imei` and
  `serialNumber`, so the single search box picks one based on whether the
  input is all digits. A "match either" search would need two queries merged.
- **Optimistic update covers state only**: the action response does not give
  the new policy's id or color, so the policy updates after the refetch. A row
  patched to a new state can also briefly stay visible in a list filtered by
  the old state until the list refetches.
- **History rows have no id**: rows are keyed by date and index.
- **Tenants are hard-coded** in [src/tenant/context.ts](src/tenant/context.ts);
  they should come from the signed-in user's token.
- **Mock data quirk**: the mock records a "Release device" action in history
  as "Unlock device".
- **More tests**: add tests for the device list (out-of-order responses,
  pagination) and for switching tenant mid-request.
- **Styling and accessibility**: the UI is functional but minimal. Table rows
  are clickable but not keyboard-focusable.
