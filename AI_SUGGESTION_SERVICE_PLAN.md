# AI Suggestion Service Plan

## Goals
- Enable AI to suggest, write, and edit content while keeping the final result in Markdown format.
- Provide live, debounced suggestions to guide brainstorming and word-choice.
- Safely apply suggestions inside the existing Tiptap editor (TipTap JSON is canonical storage).

## Current State (Summary)
- Frontend editor: Tiptap v3 with custom nodes (tables, task list, mermaid, toggle list, images, etc.).
- Storage format: TipTap/ProseMirror JSON in MongoDB via backend pages controller.
- Realtime: Socket.IO for debounced autosave/broadcast; no AI integration yet.
- No Markdown import/export tooling present.

## High-Level Architecture
- Frontend
  - Serialize selection + context from TipTap JSON to Markdown before request.
  - Debounced calls to backend `/api/ai/suggest` for guidance and `/api/ai/edit` for transformations.
  - Deserialize returned Markdown back to TipTap JSON; replace/insert in editor.
  - Surfaces: inline ghost completion, selection popover suggestions, optional sidebar.
- Backend
  - New AI routes with Zod validation, auth, rate limit, SSE streaming (optional).
  - Provider abstraction (OpenAI/Anthropic/etc.) behind a single API.
  - Content windowing, caching selective prompts (Redis), observability/logging.
- Conversion Layer
  - Markdown <-> TipTap JSON serializer/deserializer with mappings for custom nodes.

## Markdown Conversion Strategy
- Use remark + remark-gfm for Markdown parsing and stringification.
- Map core elements: paragraphs, headings, lists, links, emphasis/strong, code/blockquote.
- Custom/node mappings:
  - Task list: GFM task list → TipTap `taskList`/`taskItem`.
  - Tables: GFM tables → TipTap `table`/`tableRow`/`tableCell`/`tableHeader`.
  - Images: `![alt](url)` → TipTap Image node.
  - Mermaid: fenced code block ```mermaid → TipTap `mermaid` node.
  - Toggle list: HTML `<details><summary>...</summary>...</details>` → TipTap `toggleList/toggleSummary/toggleContent`.
- Fallback: unknown structures → code blocks to preserve content.
- Testing: unit tests for roundtrip fidelity on core and custom fixtures.

## Backend API Design
- POST `/api/ai/suggest`
  - Body: `{ mode, selectionMarkdown, contextMarkdown, pageMeta?, constraints?, stream? }`
  - Modes: `brainstorm`, `continue`, `find_words`, `clarify`, `outline`.
  - Returns: `{ suggestions: [{ markdown, label? }], usage? }` or SSE streaming chunks of `{ markdown }`.
- POST `/api/ai/edit`
  - Body: `{ mode, selectionMarkdown, contextMarkdown, constraints?, stream? }`
  - Modes: `rewrite`, `expand`, `shorten`, `improve_style`, `fix_grammar`.
  - Returns: `{ markdown }` or SSE.
- Middleware & Limits
  - Auth required (reuse existing JWT infra).
  - Zod validation schemas for both endpoints.
  - Rate-limiter per user; body size limits.
  - Truncate context window to N blocks; redact PII/secrets.
- Provider Abstraction
  - `AiProvider.generate({ system, messages, stream })` → string or async iterator.
  - Env-configured provider selection; retries/backoff; redacted audit logs.

## Frontend UX and Debounce
- Trigger
  - On editor transaction and user stop-typing pause (600–800ms), call `/ai/suggest` with current selection + nearby context.
  - Only for eligible nodes (paragraph/headings) to reduce noise.
- Surfaces
  - Inline ghost text completion at caret for `continue`.
  - Selection popover with 2–3 suggestions (brainstorm/wording).
  - Optional sidebar for rich operations and controls.
- Apply Flow
  - Accept: convert returned Markdown → TipTap JSON; replace selection or insert below.
  - Controls: Replace • Insert below • Try again; keyboard Tab accept, Esc dismiss.
- User Controls
  - Per-page toggle to enable/disable suggestions.
  - Slash commands `/brainstorm`, `/rewrite`, `/find-words`.

## Privacy, Safety, and Observability
- Redact: emails, tokens, secrets, full URLs with query params before sending to provider.
- Configurable opt-in telemetry (counts/latency/acceptance rate), no raw content logging by default.
- Error handling: sensible fallbacks, safe timeouts, provider retries, user-facing toasts.

## Milestones & Sequencing
1) Serializer MVP
   - Implement Markdown → TipTap JSON and TipTap JSON → Markdown for core nodes.
   - Basic mappings for images, task list, tables, mermaid, toggle (HTML fallback OK initially).
   - Add unit tests.
2) Backend MVP
   - Create `/api/ai/suggest` non-streaming with provider mock; Zod schemas, auth, rate-limit.
   - Add provider abstraction; wire a real provider via env when available.
3) Frontend MVP
   - `useAiSuggestions` hook with debounce; minimal popover showing a single suggestion.
   - Apply/replace integration with editor.
4) Stream & Quality
   - Enable SSE streaming; add caching for `find_words` prompts; refine truncation rules.
   - Expand modes and UX surfaces (inline completion, sidebar, slash commands).
5) Fidelity & Nodes
   - Strengthen serializer mappings for toggle list and tables; add more fixtures/tests.
6) Observability & Safety
   - Metrics, privacy redaction, admin toggles; per-user feature flags.

## Risks & Mitigations
- Markdown fidelity for custom nodes → Explicit mappings + HTML fallback + tests.
- Latency and cost → Debounce + streaming + context truncation + caching.
- UX noise → Eligible-node filter + user toggle + small, high-signal suggestions.

## Implementation Tasks (Backlog)
- Backend
  - [ ] `ai.routes.ts`, `ai.controller.ts`, `ai.service.ts`, `ai.schema.ts`.
  - [ ] SSE helper; rate-limiter; provider env config.
  - [ ] Integrate with `routes/index.ts`.
- Frontend
  - [ ] `src/lib/markdown/` with serializer/deserializer + tests.
  - [ ] `useAiSuggestions` hook; debounce infra; API client.
  - [ ] `SuggestionPopover` and inline ghost component; apply actions.
  - [ ] Slash menu items and feature toggle.
- QA
  - [ ] Roundtrip test coverage; latency/acceptance metrics; accessibility review.

## Decisions Needed
- Pick Markdown conversion approach: remark-based custom mapping (recommended) vs. Tiptap Markdown extension if sufficient.
- Choose initial provider (OpenAI/Anthropic) and streaming readiness.
- Finalize debounce delay (600–800ms suggested).
