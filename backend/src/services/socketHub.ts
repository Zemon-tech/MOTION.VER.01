import type { Server as SocketIOServer } from 'socket.io'

let ioRef: SocketIOServer | null = null

export function setIO(io: SocketIOServer) {
  ioRef = io
}

export function getIO(): SocketIOServer | null {
  return ioRef
}

export function emitPageUpdated(pageId: string, payload: any) {
  if (!ioRef) return
  ioRef.to(`page:${pageId}`).emit('page.updated', payload)
}

export function emitSubpageMetaToAncestors(ancestorIds: string[], payload: { pageId: string; title?: string; icon?: string | null; slug?: string }) {
  if (!ioRef) return
  for (const pid of ancestorIds) {
    ioRef.to(`page:${pid}`).emit('subpage.meta', payload)
  }
}

export function emitSubpageDeletedToAncestors(ancestorIds: string[], payload: { pageId: string }) {
  if (!ioRef) return
  for (const pid of ancestorIds) {
    ioRef.to(`page:${pid}`).emit('subpage.deleted', payload)
  }
}
