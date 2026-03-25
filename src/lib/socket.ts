import { io, type Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (socketInstance) return socketInstance
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null
  socketInstance = io((import.meta as any).env?.VITE_WS_BASE || 'http://localhost:4000', {
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


