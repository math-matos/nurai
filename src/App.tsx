import { AppShell } from './routes/AppShell'
import { Landing } from './routes/Landing'
import { Projeto } from './routes/Projeto'
import { useRota } from './lib/router'

export default function App() {
  const rota = useRota()

  if (rota.startsWith('/app')) return <AppShell rota={rota} />
  if (rota.startsWith('/projeto')) return <Projeto />
  return <Landing />
}
