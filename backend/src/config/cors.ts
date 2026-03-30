import type { CorsOptions } from 'cors'

const origin = process.env.CORS_ORIGIN || 'http://localhost:5173'

export const corsConfig: CorsOptions = {
  origin: (originProp: string | undefined, callback: (err: Error | null, allow?: boolean | string | string[]) => void) => {
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:5173'
    if (!originProp || process.env.NODE_ENV === 'development' || originProp === allowed) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-page-unlock', 'X-Page-Unlock'],
}
