---
name: Fix Home Render Loop
overview: Prevent repeated navigations from the home page search component so `GET /` is only triggered when query state actually changes.
todos:
  - id: inspect-local-search-effect
    content: Review and adjust LocalSearch URL update effect to avoid redundant navigation calls.
    status: completed
  - id: add-no-op-navigation-guards
    content: Add guards for unchanged URL and missing query param before navigating.
    status: completed
  - id: validate-home-request-pattern
    content: Verify terminal logs show stable request pattern at / when idle and correct behavior while searching.
    status: completed
isProject: false
---

# Fix Home Page Render Loop

## Goal

Stop the repeated `GET /` requests by preventing redundant client-side navigations from the home search component.

## Root Cause

In `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/components/search/LocalSearch.tsx](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/components/search/LocalSearch.tsx)`, the `useEffect` debounce callback calls `router.push(newUrl)` even when `newUrl` is effectively the current URL (especially when `searchQuery` is empty on `/`). This repeatedly re-triggers server rendering.

## Plan

1. Update URL-sync guard logic in `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/components/search/LocalSearch.tsx](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/components/search/LocalSearch.tsx)`:
  - Compute the target URL first.
  - Compare target URL against the current URL (`pathname + '?' + searchParams`) before navigating.
  - Skip navigation when there is no effective URL change.
2. Tighten empty-query behavior:
  - Only attempt removing `query` when it actually exists in `searchParams`.
  - Avoid triggering navigation when `query` is already absent.
3. Optional behavior refinement (same file):
  - Use `router.replace` (instead of `push`) for search-param synchronization to avoid history pollution during typing.
4. Verify behavior manually with dev server:
  - Load `/` with empty query and confirm no continuous `GET /` loop.
  - Type in search input and confirm query updates still work.
  - Clear input and confirm single URL cleanup action (no loop).
5. Run lint/diagnostics for touched file to ensure no regressions.

## Expected Outcome

- No repeated `GET /` spam in terminal while idle on home page.
- Home search remains functional, but only navigates when URL state actually changes.

