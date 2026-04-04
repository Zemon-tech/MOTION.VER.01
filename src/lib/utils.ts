import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple API client
// Prefer VITE_API_BASE_URL, fallback to legacy VITE_API_BASE, then localhost
const rawBase =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_BASE ||
  (typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.hostname}:4000/api` 
    : 'http://localhost:4000/api')

// Ensure apiBase ends with /api but without double slashes if the path starts with /
export const apiBase = rawBase.replace(/\/$/, '') + (rawBase.endsWith('/api') || rawBase.endsWith('/api/') ? '' : '/api')

export class ApiError extends Error {
  status: number
  data: any
  constructor(message: string, status: number, data: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null
  
  console.log(`API call to ${path}`, { token: !!token, tokenValue: token?.substring(0, 20) + '...' })
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }
  
  if (token) {
    headers.Authorization = `Bearer ${token}`
    console.log('Authorization header set:', headers.Authorization.substring(0, 20) + '...')
  } else {
    console.log('No token found, request will be unauthorized')
  }
  
  const res = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  })
  
  console.log(`API response for ${path}:`, res.status, res.statusText)
  
  if (!res.ok) {
    // If unauthorized and we have a token, try to refresh it
    if (res.status === 401 && token) {
      console.log('Token expired, attempting refresh...')
      try {
        const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          if (refreshData?.accessToken) {
            localStorage.setItem('accessToken', refreshData.accessToken)
            console.log('Token refreshed, retrying original request...')
            
            // Retry the original request with new token
            const newHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(options.headers as Record<string, string> || {})
            }
            newHeaders.Authorization = `Bearer ${refreshData.accessToken}`
            
            const retryRes = await fetch(`${apiBase}${path}`, {
              credentials: 'include',
              headers: newHeaders,
              ...options,
            })
            
            if (retryRes.ok) {
              return retryRes.json()
            }
            // If retry fails, throw with retry data
            const retryData = await retryRes.json().catch(() => ({}))
            throw new ApiError(retryData?.error?.message || `Request failed: ${retryRes.status}`, retryRes.status, retryData)
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        if (refreshError instanceof ApiError) throw refreshError
      }
    }
    
    let data: any = {}
    try {
      data = await res.json()
    } catch {
      // Use fallback if json parsing fails
    }
    console.error(`API error for ${path}:`, data)
    throw new ApiError(data?.error?.message || `Request failed: ${res.status}`, res.status, data)
  }
  
  // Handle responses with no content (like 204 DELETE)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T
  }
  
  return res.json()
}
