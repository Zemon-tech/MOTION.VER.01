import type { CorsOptions } from 'cors'

const allowedOrigins = [
  'https://motion-gamma-one.vercel.app',
  'http://localhost:5173',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [])
]

export const corsConfig: CorsOptions = {
  origin: (originProp: string | undefined, callback: (err: Error | null, allow?: boolean | string | string[]) => void) => {
    if (!originProp || process.env.NODE_ENV === 'development' || allowedOrigins.includes(originProp)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-page-unlock', 'X-Page-Unlock'],
}
