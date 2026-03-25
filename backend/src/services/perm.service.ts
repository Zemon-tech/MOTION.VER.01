import { Page } from '../db/models/Page'

export function isTokenValid(page: any, token?: string | null) {
  if (!page?.shareToken) return false
  if (!token || token !== page.shareToken) return false
  const exp: Date | null = page.linkExpiresAt ? new Date(page.linkExpiresAt) : null
  if (exp && Date.now() >= exp.getTime()) return false
  return true
}

export function canRead(userId: string | undefined | null, page: any, token?: string | null) {
  const isOwner = !!userId && page.ownerId?.toString?.() === String(userId)
  const isShared = !!userId && Array.isArray(page.sharedWith) && page.sharedWith.some((u: any) => String(u) === String(userId))
  const collab = !!userId && Array.isArray(page.collaborators) && page.collaborators.find((c: any) => String(c?.userId) === String(userId))
  // Viewing policy: public pages are viewable by anyone (lock is enforced separately)
  if (!!page.isPublic) return true
  // Private page readable via a valid share token (even without login). Lock is enforced separately.
  if (isTokenValid(page, token)) return true
  // Otherwise require ownership, explicit share, or collaborator access
  return isOwner || isShared || !!collab
}

export function canEdit(userId: string | undefined | null, page: any, token?: string | null) {
  const isOwner = !!userId && page.ownerId?.toString?.() === String(userId)
  const isShared = !!userId && Array.isArray(page.sharedWith) && page.sharedWith.some((u: any) => String(u) === String(userId))
  const collab = !!userId && Array.isArray(page.collaborators) && page.collaborators.find((c: any) => String(c?.userId) === String(userId))
  if (isOwner || isShared) return true
  if (collab && collab.role === 'editor') return true
  const tokenOk = isTokenValid(page, token)
  return !!userId && !!page.isPublic && !!page.linkEditEnabled && tokenOk
}
