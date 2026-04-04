import { io, type Socket } from 'socket.io-client'

import { apiBase } from './utils'
let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (socketInstance) return socketInstance
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null
  
  // WS base is apiBase without the trailing /api
  const wsBase = (import.meta as any).env?.VITE_WS_BASE || apiBase.replace(/\/api$/, '')
  
  socketInstance = io(wsBase, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    transports: ['websocket', 'polling'],
  })
  return socketInstance
}

export function updateSocketAuthToken(token: string) {
  const s = getSocket()
  ;(s as any).auth = { token }
}


