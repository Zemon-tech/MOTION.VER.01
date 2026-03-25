## Backend Plan (Node.js + Express + MongoDB + Mongoose + JWT)

This document outlines the backend plan to power the current frontend editor experience (Tiptap-based) with authentication, pages, blocks, and image storage, including privacy controls (private/public) and sharing.

### Goals
- User authentication (signup, login, logout) via JWT (access + refresh tokens)
- Persist users, pages, blocks (rich content), images, and sharing/privacy metadata
- CRUD for pages and their content, with ownership and permission checks
- Efficient image uploads with validation and optional external storage
- Secure, validated, rate-limited API with clear error semantics
- Structured project layout, environment configuration, and production readiness

---

## 1) Functional Scope inferred from Frontend

From the existing codebase (`src/components/Editor.tsx`, Tiptap nodes, and UI):
- Page has a `title` and a Tiptap document JSON (top-level blocks like paragraphs, headings, hr, lists, task lists, code blocks, images, blockquote, alignment, highlight, sub/superscript).
- Image uploads are currently simulated via `handleImageUpload(file)` returning a `blob:` URL; backend should provide real upload endpoint and persistent URL.
- Sidebar hints at multiple pages per user, basic navigation, and user panel.
- Header shows privacy indicator ("Private"); need `isPublic` flag and possibly `share` capability.
- Blocks can be reordered (drag-and-drop of top-level nodes) — this is contained in the Tiptap JSON content itself, not separate block records.

Conclusion: Backend primarily stores Pages as documents with fields for title, owner, privacy, timestamps, and a `content` field holding the Tiptap JSON.

---

## 2) Data Model (Mongoose)

### User
- _id: ObjectId
- email: string (unique, required, lowercase)
- passwordHash: string (bcrypt)
- name: string (optional, display name)
- avatarUrl: string (optional)
- createdAt, updatedAt: Date
- settings: { theme?: 'light'|'dark' } (optional)

Indexes:
- unique on email

### Page
- _id: ObjectId
- ownerId: ObjectId (ref User, required)
- title: string (required, default 'Untitled', max ~256)
- content: object (required) — Tiptap JSON doc (validated as JSON)
- isPublic: boolean (default false)
- sharedWith: [ObjectId] (ref User) — optional invite list (read access)
- favoritedBy: [ObjectId] (ref User) — optional for "Star"
- tags: [string] (optional)
- coverImageUrl: string (optional)
- createdAt, updatedAt: Date

Indexes:
- ownerId + createdAt (for listing by user)
- isPublic (for discovering public pages)

Validation notes:
- `content` stored as arbitrary JSON; use schema type `Schema.Types.Mixed` with additional lightweight validation to prevent extremely large payloads and ensure `type: 'doc'` root.

### Image (optional collection if needed)
If storing metadata for images beyond the URL:
- _id: ObjectId
- ownerId: ObjectId (ref User)
- pageId: ObjectId (ref Page, optional)
- url: string (required)
- size: number (bytes)
- mimeType: string
- createdAt: Date

Alternatively, skip collection and only store the URL within `content`. Use object storage (S3/GCS) and generate URLs via backend.

### Session / Token Blacklist (optional)
- For refresh tokens (if persisted) or blacklist of revoked tokens

---

## 3) Authentication and Authorization

### JWT Strategy
- Access token: short-lived (e.g., 15m), signed with `JWT_ACCESS_SECRET`.
- Refresh token: long-lived (e.g., 7d or 30d), signed with `JWT_REFRESH_SECRET`.
- Store refresh token in httpOnly, secure cookie; access token returned in response body or header.
- Rotate refresh tokens on refresh.

### Flows
- Signup: POST /auth/signup → create user → issue tokens → set refresh cookie → return profile + access token
- Login: POST /auth/login → verify email/password → issue tokens → set refresh cookie → return profile + access token
- Refresh: POST /auth/refresh → validate refresh cookie → issue new tokens
- Logout: POST /auth/logout → clear cookie (and optionally revoke refresh token)

### Passwords
- bcrypt with cost factor 10-12
- Rate-limit login
- Optional email verification (out of scope for MVP)

### Authorization
- Page read/write rules:
  - Owner: full access
  - Shared user: read (and optionally write if we add `role` in `sharedWith` entries)
  - Public: read without auth when `isPublic=true`
  - Everyone else: 403

---

## 4) API Design

Base URL: `/api`
Content-Type: `application/json`

### Auth
- POST `/api/auth/signup` { email, password, name? }
  - 201 { user: {id,email,name}, accessToken }
- POST `/api/auth/login` { email, password }
  - 200 { user, accessToken }
- POST `/api/auth/refresh`
  - 200 { accessToken }
- POST `/api/auth/logout`
  - 204

### Users
- GET `/api/users/me` (auth)
  - 200 { user }
- PATCH `/api/users/me` (auth) { name?, avatarUrl?, settings? }
  - 200 { user }

### Pages
- POST `/api/pages` (auth) { title?, content? }
  - creates new page for owner; default empty doc content `{ type: 'doc', content: [{ type: 'paragraph' }] }`
  - 201 { page }
- GET `/api/pages` (auth) [query: search?, limit?, cursor?]
  - list pages owned by user (and optionally shared with user)
  - 200 { pages, pagination }
- GET `/api/pages/public` [query: search?, ownerId?, limit?, cursor?]
  - list public pages
  - 200 { pages, pagination }
- GET `/api/pages/:id`
  - If `isPublic` → public access, else require auth and permissions
  - 200 { page }
- PATCH `/api/pages/:id` (auth) { title?, content?, coverImageUrl? }
  - Owner (or editor collaborator) only
  - 200 { page }
- PATCH `/api/pages/:id/privacy` (auth) { isPublic }
  - Owner only
  - 200 { page }
- PATCH `/api/pages/:id/share` (auth) { userId, action: 'add'|'remove' }
  - Owner only
  - 200 { page }
- DELETE `/api/pages/:id` (auth)
  - Owner only
  - 204

### Stars / Favorites
- POST `/api/pages/:id/star` (auth)
- DELETE `/api/pages/:id/star` (auth)

### Images
- POST `/api/uploads/images` (auth, multipart/form-data) { file }
  - Validates type & size (≤ 5MB per current UI), stores in S3/local, returns public URL
  - 201 { url }

Error format (example):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "title is required", "details": {...} } }
```

---

## 5) Project Structure

```
backend/
  src/
    app.ts
    server.ts
    config/
      env.ts
      logger.ts
      rateLimit.ts
      cors.ts
    db/
      connection.ts
      models/
        User.ts
        Page.ts
        Image.ts
    middleware/
      auth.ts
      errorHandler.ts
      validate.ts
    routes/
      index.ts
      auth.routes.ts
      user.routes.ts
      page.routes.ts
      upload.routes.ts
    controllers/
      auth.controller.ts
      user.controller.ts
      page.controller.ts
      upload.controller.ts
    services/
      auth.service.ts
      user.service.ts
      page.service.ts
      upload.service.ts
      token.service.ts
    schemas/
      auth.schema.ts (zod)
      page.schema.ts (zod)
      user.schema.ts (zod)
    utils/
      asyncHandler.ts
      responses.ts
      pagination.ts
    types/
      express.d.ts
  package.json
  tsconfig.json
  .env.example
  README.md
```

---

## 6) Validation, Security, and Middleware

Validation: Use `zod` or `yup` for request bodies and query params.

Security:
- CORS configured for the frontend origin
- Helmet for HTTP headers
- Rate limiting (login, signup, refresh)
- Cookie flags: httpOnly, secure (prod), sameSite
- CSRF not needed with JWT + same-origin XHR and proper CORS; consider CSRF for cookie + same-site flows

Middleware:
- `auth` verifies access token and injects `req.user`
- `optionalAuth` for routes that allow public access
- `validate(schema)` to validate inputs
- `errorHandler` centralized with consistent JSON errors

---

## 7) Persistence Details

MongoDB:
- Use a capped max document size guard for `content` (Tiptap JSON). Set max content length (e.g., 1 MB) to avoid abuse.
- Store `content` as `Mixed` but validate presence of `{ type: 'doc' }`.
- Use timestamps and indexes as noted.

Mongoose plugins:
- `mongoose-lean-virtuals` for lean queries if needed
- `mongoose-unique-validator`

---

## 8) Image Uploads

MVP options:
1) Local disk storage (multer diskStorage) with static serving under `/uploads/...` (dev only)
2) S3-compatible storage (prod-ready):
   - `POST /api/uploads/images` → store to S3 bucket → return public URL
   - Validate file type (startsWith('image/')) and size (<= 5MB to match frontend MAX_FILE_SIZE)

The frontend’s `ImageUploadNode` calls `upload(file)`; wire this to call the backend endpoint and return the hosted URL, then persist in page `content` on save.

---

## 9) Integration with Frontend

Frontend changes:
- Add auth pages/components: login, signup forms
- Store access token (in memory) and rely on refresh cookie for rotation
- API wrapper for authenticated requests with bearer token
- Replace `handleImageUpload` to call `/api/uploads/images` and return URL
- Add persistence for pages:
  - On create: POST `/api/pages`
  - On save: PATCH `/api/pages/:id` with `title` and `content` (editor.getJSON())
  - On load: GET `/api/pages/:id` then hydrate editor with returned `content`
  - Respect privacy: show lock/public indicator from `isPublic`

---

## 10) Environment and Config

Required variables (`.env`):
- PORT=4000
- MONGO_URI=mongodb+srv://...
- JWT_ACCESS_SECRET=...
- JWT_REFRESH_SECRET=...
- CORS_ORIGIN=http://localhost:5173
- NODE_ENV=development
- FILE_MAX_SIZE_BYTES=5242880
- STORAGE_PROVIDER=local|s3
- (if S3) S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT?

---

## 11) Error Handling and Response Conventions

Standard error envelope:
- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 403 FORBIDDEN
- 404 NOT_FOUND
- 409 CONFLICT (email taken)
- 413 PAYLOAD_TOO_LARGE (content or file)
- 429 TOO_MANY_REQUESTS
- 500 INTERNAL_SERVER_ERROR

Use problem details style where helpful; always include a stable `code` and human message.

---

## 12) Testing Strategy

- Unit: services and controllers (Jest)
- Integration: supertest for route flows (auth, pages CRUD)
- E2E: minimal smoke flows (signup → create page → upload image → set public → fetch public)

---

## 13) Roadmap Extensions

- Collaborative editing (roles in `sharedWith` with read/write distinction)
- Page history/versions
- Comments/annotations per block range
- Full-text search (Atlas Search) on titles and text content
- Organizations/workspaces and multi-tenancy
- Webhooks for media processing

---

## 14) Acceptance Criteria (MVP)

- Users can signup/login, receive tokens; refresh works via cookie.
- Authenticated users can create, read, update, delete their pages.
- Public pages are readable without auth; private pages are protected.
- Image uploads validate type/size and return stable URLs.
- Frontend can load/save Tiptap JSON seamlessly.
- Security controls (CORS, rate-limit, helmet) enabled; inputs validated.


