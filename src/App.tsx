import { useEffect } from 'react'
import { AppShell } from './routes/AppShell'
import { Landing } from './routes/Landing'
import { Projeto } from './routes/Projeto'
import { useRota } from './lib/router'

const TITULO_PADRAO = document.title

export default function App() {
  const rota = useRota()

  /* As telas de /app definem o próprio título no AppShell. */
  useEffect(() => {
    if (rota.startsWith('/app')) return
    document.title = rota.startsWith('/projeto') ? 'Dossiê do projeto · Nurai' : TITULO_PADRAO
  }, [rota])

  if (rota.startsWith('/app')) return <AppShell rota={rota} />
  if (rota.startsWith('/projeto')) return <Projeto />
  return <Landing />
}
