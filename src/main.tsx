import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Estilos globais antes de App: as folhas de cada tela precisam vir depois
   para que regras como `.barra__menu { display: none }` vençam `.btn`. */
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
