import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { HomeRoute } from './routes/HomeRoute'
import { PageRoute } from './routes/PageRoute'
import { ShareRoute } from './routes/ShareRoute'
import { setFavicon } from '@/lib/meta'
// Apply saved theme on app start
try {
  const theme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | 'notion-light' | 'notion-dark' | null
  if (theme) {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else if (theme === 'light' || theme === 'dark') {
      root.classList.toggle('dark', theme === 'dark')
    } else {
      root.setAttribute('data-theme', theme)
      root.classList.remove('dark')
    }
  }
} catch {}

try { setFavicon() } catch {}

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/home', element: <HomeRoute /> },
  { path: '/s/:slug', element: <ShareRoute /> },
  { path: '/:slug', element: <PageRoute /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </StrictMode>,
)
