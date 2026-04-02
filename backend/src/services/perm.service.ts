import crypto from 'crypto'

// ─── Timing-safe token comparison ────────────────────────────────────────────
// WHY: String !== comparison is vulnerable to timing attacks. An attacker can
// measure response time differences to brute-force the token character by
// character. crypto.timingSafeEqual always compares in constant time.
function timingSafeTokenEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    // Must be same length for timingSafeEqual; pad to avoid length leaks
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// ─── Token validity ──────────────────────────────────────────────────────────
// Checks that the page has a shareToken, the supplied token matches (timing-safe),
// and the token has not expired. null linkExpiresAt means "never expires".
export function isTokenValid(page: any, token?: string | null): boolean {
  // WHY: Reject immediately if the page has no shareToken — it was never made public
  //      or the token was rotated/cleared. Checking this first avoids calling
  //      timingSafeEqual with an empty reference string.
  if (!page?.shareToken) return false

  // WHY: Reject a missing or empty token without leaking timing info; we still
  //      return false quickly but there's nothing to compare against.
  if (!token) return false

  // WHY: Timing-safe comparison prevents brute-force enumeration of token bytes.
  if (!timingSafeTokenEqual(token, page.shareToken)) return false

  // WHY: Check expiry only after token is confirmed valid.
  //      null/undefined linkExpiresAt = perpetual token (explicitly allowed by design).
  const exp: Date | null = page.linkExpiresAt ? new Date(page.linkExpiresAt) : null
  if (exp && Date.now() >= exp.getTime()) return false

  return true
}

// ─── Read permission ─────────────────────────────────────────────────────────
// Returns true if userId (may be null for anonymous) may read the page.
// Token is the optional share-link token from ?t= or slug suffix.
export function canRead(userId: string | undefined | null, page: any, token?: string | null): boolean {
  // WHY: Compute isOwner with string coercion because page.ownerId may be an
  //      ObjectId instance or a plain string depending on whether .lean() was used.
  const isOwner = !!userId && String(page.ownerId) === String(userId)

  // WHY: Both legacy sharedWith and the new collaborators array must be checked
  //      so upgraded and non-upgraded pages behave identically.
  const isSharedWith = !!userId && Array.isArray(page.sharedWith)
    && page.sharedWith.some((u: any) => String(u) === String(userId))

  const collab = !!userId && Array.isArray(page.collaborators)
    && page.collaborators.find((c: any) => String(c?.userId) === String(userId))

  // Owner always has access
  if (isOwner) return true

  // Explicit invite (legacy sharedWith) always grants read
  if (isSharedWith) return true

  // Collaborator of any role grants read
  if (collab) return true

  // Public pages are readable by anyone (anonymous or authenticated, no token needed)
  // WHY: isPublic is the owner's explicit declaration that the page is world-readable.
  //      The share token is an additional layer for link-based sharing, but a page
  //      marked isPublic is already discoverable.
  if (!!page.isPublic) return true

  // WHY: Private page can still be read with a valid share token — this is the
  //      "share via link" flow. Works for both anonymous and authenticated users.
  if (isTokenValid(page, token)) return true

  return false
}

// ─── Edit permission ─────────────────────────────────────────────────────────
// Returns true if userId may write to the page.
// Anonymous users (userId null) can NEVER edit — even with a valid token.
export function canEdit(userId: string | undefined | null, page: any, token?: string | null): boolean {
  // WHY: Editing always requires authentication. Anonymous reads are fine
  //      for public pages but anonymous writes open the door to spam/abuse.
  if (!userId) return false

  const isOwner = String(page.ownerId) === String(userId)
  if (isOwner) return true

  // WHY: Legacy sharedWith users are treated as editors (backwards-compatibility).
  const isSharedWith = Array.isArray(page.sharedWith)
    && page.sharedWith.some((u: any) => String(u) === String(userId))
  if (isSharedWith) return true

  // WHY: New collaborators model supports granular roles. Only 'editor' grants writes.
  const collab = Array.isArray(page.collaborators)
    && page.collaborators.find((c: any) => String(c?.userId) === String(userId))
  if (collab && collab.role === 'editor') return true

  // WHY: Link-edit requires ALL of: valid user session (userId), page is public,
  //      linkEditEnabled is explicitly true, and token passes timing-safe check.
  //      Omitting any one of these would create an escalation path.
  const tokenOk = isTokenValid(page, token)
  return !!page.isPublic && !!page.linkEditEnabled && tokenOk
}

// ─── Response sanitization ───────────────────────────────────────────────────
// Strips sensitive fields from page documents before sending to clients.
// Must be called on every response that returns a page object.
export function sanitizePage(page: any, userId: string | null | undefined): Record<string, any> {
  const isOwner = !!userId && String(page.ownerId) === String(userId)
  const token = undefined // no token context here; caller should pass if needed
  const userCanEdit = canEdit(userId, page, token)

  // WHY: Spread into a plain object first so we're not mutating the Mongoose document
  //      or the result of .lean(). We strip __v since it's an internal Mongoose field
  //      that has no meaning to API consumers.
  const { __v, lockPasswordHash, ...safe } = typeof page.toObject === 'function'
    ? page.toObject()
    : { ...page }

  // WHY: shareToken grants write access when linkEditEnabled is true. Exposing it
  //      to non-owners means any reader could escalate to editor by re-using the token.
  //      Only the owner needs it to build the shareable URL.
  if (!isOwner) {
    delete safe.shareToken
  }

  // WHY: lockPasswordHash is a bcrypt hash. Even though it cannot be reversed easily,
  //      there is zero reason to ever expose it over the API. It would allow offline
  //      dictionary attacks against the hash.
  // (already destructured out above)

  return {
    ...safe,
    // WHY: Computed booleans let the frontend know what the current user can do
    //      without re-implementing the same permission logic in JS.
    isOwner,
    canEdit: userCanEdit,
  }
}
