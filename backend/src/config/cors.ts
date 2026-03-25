import type { CorsOptions } from 'cors'

const origin = process.env.CORS_ORIGIN || 'http://localhost:5173'

export const corsConfig: CorsOptions = {
  origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-page-unlock', 'X-Page-Unlock'],
}
