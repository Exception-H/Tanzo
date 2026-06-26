import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = document.documentElement
const electron = window.electron
const platform = electron?.platformInfo.platform ?? 'unknown'
const effect = electron?.platformInfo.effect ?? null

root.classList.add('electron', `platform-${platform}`)
if (effect) root.dataset.windowEffect = effect

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
