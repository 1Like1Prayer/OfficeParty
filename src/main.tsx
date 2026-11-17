import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { backgroundMusic } from './audio/backgroundMusic.ts'
import { sfxEngine } from './audio/sfx/index.ts'

// The background music starts with the page (or on the first click, if the browser holds it back).
backgroundMusic.start()
// Sound effects wait, silent, for the same first click.
sfxEngine.start()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
