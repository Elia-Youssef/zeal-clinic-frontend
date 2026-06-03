import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/shared/error-boundary'

document.documentElement.classList.add('h-full', 'antialiased')
document.body.classList.add('min-h-full', 'flex', 'flex-col')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
