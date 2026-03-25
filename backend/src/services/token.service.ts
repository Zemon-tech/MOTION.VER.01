import jwt from 'jsonwebtoken'

const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret'
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret'

export function signAccessToken(payload: object, expiresIn: string | number = '15m'): string {
  return jwt.sign(payload, accessSecret, { expiresIn } as any)
}

export function signRefreshToken(payload: object, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, refreshSecret, { expiresIn } as any)
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, accessSecret)
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, refreshSecret)
}


