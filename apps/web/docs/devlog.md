# Web app devlog

Short notes on completed work in `apps/web`. Newest entries first.

---

## 2026-04-30 — Home / search URL sync and mongoose log spam

**What we did**

- Stopped redundant client navigations that re-fetched the home RSC and triggered `dbConnect()` on almost every debounced tick.
- **Local search** ([`components/search/LocalSearch.tsx`](../components/search/LocalSearch.tsx)): navigate only when the `query` search param and the input disagree, or when clearing the input and the URL still has `query`. Removed brittle `targetUrl !== currentUrl` checks that could disagree with Next’s `URLSearchParams` serialization vs `query-string` (e.g. encoding and ordering).
- **Global search** ([`components/search/GlobalSearch.tsx`](../components/search/GlobalSearch.tsx)): same idea for the `global` param — no `router.push` when the URL already matches the input, and no push on the empty path when `global` is already absent.
- **Effects**: depend on `searchParams.toString()` instead of the `searchParams` object reference to avoid extra debounce churn.
- **URL helpers** ([`lib/url.ts`](../lib/url.ts)): optional `console.log` with per-helper call counters for debugging how often URLs are built (can be removed when stable).

**Why**

- Each unnecessary `router.replace` / `router.push` caused another server render; `getQuestions` in `app/(root)/page.tsx` runs in the RSC tree and [`action`](../lib/handlers/action.ts) always calls [`dbConnect()`](../lib/mongoose.ts), so the terminal filled with `Using existing mongoose connection` (one line per `dbConnect`, not a broken connection pool).

**Files touched (primary)**

- [`components/search/LocalSearch.tsx`](../components/search/LocalSearch.tsx)
- [`components/search/GlobalSearch.tsx`](../components/search/GlobalSearch.tsx)
- [`lib/url.ts`](../lib/url.ts)
- [`lib/mongoose.ts`](../lib/mongoose.ts) — hot-path reuse log may be on or off depending on whether you want visibility in dev.

**How to verify**

- Open `/`, leave search empty: no rapid repeated `GET /` in the terminal.
- Type a query with spaces: URL updates without a navigation loop.
- Browser console: `formUrlQuery` / `removeKeysFromUrlQuery` logs show bounded call counts when idle.
