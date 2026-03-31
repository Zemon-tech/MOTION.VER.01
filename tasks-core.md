# Tasks Core

## Context

- Workspace: MOTION.VER.01 (frontend + backend)
- Main goals completed in this update cycle:
  - Improve auth validation/messages (signup/login)
  - Prevent backend startup blocking when Mongo is unavailable
  - Fix page star toggle behavior
  - Improve Notion-style sidebar behavior for Recents/Favorites/Shared/Private
  - Improve Notion-like table boundaries and remove extra right-side table space
  - Reduce delay when adding/deleting table rows/columns

## What Updated

1. Auth improvements

- Strong password validation for signup (8+ chars, lower, upper, digit, special)
- Better login/signup error feedback in UI

2. Backend startup reliability

- API now listens first, Mongo retries in background
- Added faster Mongo server selection timeout for quicker retry loop

3. Star behavior

- Header star action now calls backend star/unstar endpoints
- Added optimistic UI update and error fallback
- Hidden star on views where no page context exists

4. Table UI and performance

- Reworked table border styling to look closer to Notion
- Fixed wrapper sizing so table border does not create extra empty right area
- Reduced table action lag by syncing content only on doc changes and debouncing content emit

5. Sidebar UX and state behavior

- Updated sidebar sections to Notion-like structure with collapsible headers:
  Recents, Favorites, Agents (Beta), Shared, Private
- Recents now renders directly under the Recents header and uses real recent activity
- Starred pages are synced into Favorites with immediate UI updates and server reconciliation
- Locked pages are shown in Private section consistently
- Collapse/expand states are persisted in localStorage and restored on reload

## How To Use

1. Start frontend

- From project root:

```bash
npm run dev
```

2. Start backend

- From backend folder:

```bash
npm run dev
```

3. If port 4000 is busy

- In PowerShell:

```powershell
$pids = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) { foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } }
```

4. Verify auth updates

- Signup with weak password to confirm clear rule messages
- Login with wrong email/password to confirm specific failure reason

5. Verify star updates

- Open a page route (not Home)
- Click Star in header
- Confirm icon fill/state persists after reload

6. Verify table updates

- Insert a table in editor
- Add/Delete row/column from table controls
- Confirm operations feel instant and no extra right-side bordered blank space appears

7. Verify sidebar updates

- Expand/collapse Recents/Favorites/Agents/Shared/Private and reload page; states should persist
- Open pages and confirm they appear under Recents
- Star/unstar a page and confirm it appears/disappears in Favorites immediately
- Lock/unlock a page and confirm it appears/disappears in Private immediately

## Files Modified

- backend/src/schemas/auth.schema.ts
- backend/src/controllers/auth.controller.ts
- backend/src/server.ts
- backend/src/db/connection.ts
- src/components/Auth.tsx
- src/components/Header.tsx
- src/routes/PageRoute.tsx
- src/components/Sidebar.tsx
- src/components/tiptap-node/table-node/table-node.scss
- src/components/Editor.tsx
