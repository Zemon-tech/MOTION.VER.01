# Collaborative Editing: "Anyone with the link can edit" (Login required)

This plan adds a secure, scalable, and implementable sharing mode similar to Notion: users with the share link can edit a page if they are logged in and the owner enabled link-editing. It strengthens server-side permissions, reuses existing real-time infra, and preserves a clean path to future CRDT.

## Goals
- Enable link-based editing for authenticated users without explicit invitations.
- Maintain strong server-side authorization across REST and sockets.
- Keep the implementation small and incremental; no CRDT required initially.
- Remain compatible with future switch to Yjs/Tiptap Collaboration.

## Data Model
Add to Page (Mongo):
- `linkEditEnabled: boolean` default false.
- `linkExpiresAt: Date | null` optional expiry.
- Keep existing: `isPublic: boolean`, `shareToken: string` (rotatable), `sharedWith: ObjectId[]`.

Rationale: separate viewing from editing; token + expiry allow revocation/rotation like Notion.

## Permission Rules
- Owner: read/edit.
- Shared users (`sharedWith`): read/edit.
- Link holders (must be logged in):
  - View: allowed if `isPublic` AND token valid AND not expired.
  - Edit: above + `linkEditEnabled` is true.
- Guests (not logged in): never edit; view allowed only if public + token.

Implement helpers:
- `canRead(userId, page, token) -> boolean`
- `canEdit(userId, page, token) -> boolean`

Token validity: `token === page.shareToken` and `(linkExpiresAt == null || now < linkExpiresAt)`.

## Backend API
- GET `/pages/slug/:slug`
  - Accept token via suffix `slug.token` or `?t=token` (already supported).
  - Return: `page` (without `shareToken` unless owner), `canView`, `canEdit`, `isOwner`.
- PATCH `/pages/:id/privacy` (owner only)
  - Body: `{ isPublic, linkEditEnabled, linkExpiresAt?, rotateToken? }`.
  - If enabling public and `shareToken` missing or `rotateToken` true → generate new token.
  - When disabling public → clear `shareToken`.
- Keep existing owner-only PATCH `/pages/:id` behavior; link editors will use sockets for edits to avoid broadening REST.

## Socket.IO
Events used today: `page.join`, `page.edit`, broadcast `page.updated`.

Changes:
- `page.join` payload `{ pageId, token? }`.
  - Verify `canRead` before `socket.join`.
  - Cache per-room context on socket: `{ canEdit, viaToken }`.
- `page.edit` payload `{ pageId, title?, content?, coverImageUrl?, coverPosition?, icon? }`.
  - Check `canEdit` context before applying/debounced save.
  - Continue broadcasting `page.updated` to room.
- Optional: simple server-side rate-limiting per socket to prevent floods.

Why sockets for link editors? We already sync title/content via sockets; routing cover/icon/position via sockets keeps a single permission surface.

## Frontend
- Page load (PageRoute):
  - Parse token from `slug` or `?t` and include in GET `/pages/slug/:slug`.
  - Use `canEdit` to set `Editor` `readOnly` and to conditionally emit edits.
  - On socket connect/join: `socket.emit('page.join', { pageId, token })`.
- Edits:
  - Title/content: already over `page.edit`.
  - Switch cover/icon/position saves to `page.edit` guarded by `canEdit`.
- Share UI (Header):
  - Toggles: “Share to web”, “Allow editing”.
  - Optional: set expiry (date/time) and Rotate link.
  - Copy link formats: `/<slug>.<token>` or `/<slug>?t=<token>` (standardize to one in UI).
- Banner when editing via share link (non-owner): “Editing via share link”.

## Security
- Enforce `canRead/canEdit` on server for both join and edit.
- Never expose `shareToken` to non-owners.
- Rate-limit `page.edit` per socket; autosave debounce already in place.
- Validate `pageId` existence on each edit before save.

## Migration
- Default `linkEditEnabled = false`, `linkExpiresAt = null` for existing pages.
- Generate `shareToken` on first enable of `isPublic`.
- Unique index on `slug` already present; ensure backfilled slugs for older pages (already handled on create; audit if necessary).

## Testing
- Unit: `canRead/canEdit` with owner/shared/token/no-token/expired.
- API: GET slug with/without token, privacy PATCH enforcement.
- Socket: join success/fail, edit success/fail, broadcast hygiene.
- Frontend: read-only vs editable state toggling.

## Future: CRDT (Optional Next Step)
- Adopt Yjs + `@tiptap/extension-collaboration` for conflict-free merges and awareness.
- Server: y-websocket or Socket.IO-based provider. Permissions layer remains unchanged (guard join/update by `canEdit`).

## Rollout order
1) Schema + helpers + socket permission checks.
2) Extend GET slug and privacy PATCH.
3) Frontend token parsing, `canEdit` gating, send token in join.
4) Move cover/icon/position edits to sockets.
5) Share UI toggles.
6) Tests.
