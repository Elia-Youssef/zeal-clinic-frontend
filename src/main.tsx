import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'

document.documentElement.classList.add('h-full', 'antialiased', 'dark')
document.body.classList.add('min-h-full', 'flex', 'flex-col')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
