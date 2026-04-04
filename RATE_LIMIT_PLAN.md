## Phase 1: Backend rate-limit contract
- Add a Redis-backed page-creation rate-limit helper in `backend/src/services/redis.service.ts` or a focused service beside it.
- Use a per-user key for page creation covering both top-level pages and subpages.
- Enforce `3 creations / 60 seconds` before `Page.create` runs in `createPage` and `createSubpage`.
- Return a stable `429` error shape with:
  - `code`
  - `message`
  - `retryAfterMs`
  - `remaining`
  - `limit`
  - `windowMs`
- Fail closed only for the rate-limit path; do not change existing auth, permission, cache, or page payload behavior.

## Phase 2: Frontend error transport
- Update `src/lib/utils.ts` so API failures can expose structured response data instead of only a plain `Error` message.
- Keep existing callers working by preserving message-based throwing semantics while attaching the parsed error payload.
- Do not change success-path response handling.

## Phase 3: Shared page-creation state
- Add a small shared client state/hook for page-creation rate-limit status:
  - blocked/unblocked
  - retry deadline
  - remaining time countdown
  - setter from API `429` responses
- Keep it local to page-creation UX only; do not couple it to edit/save flows.

## Phase 4: Top-level page creation UX
- Wire the sidebar create action in `src/components/Sidebar.tsx` to:
  - stop duplicate submits while pending
  - read the structured `429` response
  - show a visible blocked state with remaining time
  - disable the create control until the timer expires
- Handle the same blocked state for the auto-create path in `src/App.tsx` so first-load behavior does not silently fail.
- Ensure normal successful navigation remains unchanged.

## Phase 5: Subpage creation UX
- Wire the subpage creation path in `src/routes/PageRoute.tsx` to the same shared rate-limit state.
- Surface a visible cue near the current page view when subpage creation is blocked.
- Ensure slash-menu subpage creation fails gracefully without inserting broken subpage nodes.

## Phase 6: UI surface
- Add one consistent visual treatment for the blocked state:
  - visible without opening devtools
  - includes remaining time
  - updates once per second until available
- Reuse existing styling patterns; avoid introducing a second notification system unless mounting the existing Sonner toaster is required.
- Do not interfere with existing share-link toast, loading skeletons, or editor layout.

## Phase 7: Verification
- Verify top-level page creation allows 3 requests and blocks the 4th within 60 seconds.
- Verify subpage creation shares the same user quota.
- Verify countdown recovers automatically without refresh.
- Verify `App.tsx` auto-create fallback does not loop or leave the user stranded on an error.
- Verify existing page listing, navigation, editing, sharing, and delete flows still behave the same.
