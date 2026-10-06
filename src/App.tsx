import { useEffect } from 'react'
import { Abrindo } from './components/Porta'
import { AcessoMedico } from './routes/AcessoMedico'
import { AppShell } from './routes/AppShell'
import { BoasVindas } from './routes/BoasVindas'
import { Cadastro } from './routes/Cadastro'
import { Entrar } from './routes/Entrar'
import { Landing } from './routes/Landing'
import { Projeto } from './routes/Projeto'
import { destinoSeguro, lerRota, redirecionar, separarRota, useRota } from './lib/router'
import { useSessao, verificarSessao, type Sessao } from './lib/store'

const TITULO_PADRAO = document.title

const TITULOS: Record<string, string> = {
  '/entrar': 'Entrar',
  '/cadastro': 'Criar conta',
  '/boas-vindas': 'Boas-vindas',
  '/acesso': 'Acesso do profissional de saúde',
  '/projeto': 'Dossiê do projeto',
}

/* Para onde mandar quem não pode ver a rota pedida; null = pode ver. */
function destinoDaGuarda(caminho: string, volta: string | null, { status, perfil }: Sessao): string | null {
  if (status === 'carregando') return null
  const conta = status === 'autenticado' ? perfil : null

  if (caminho.startsWith('/app')) {
    if (!conta) return `/entrar?volta=${encodeURIComponent(caminho)}`
    return conta.onboarding === 'pendente' ? '/boas-vindas' : null
  }
  if (caminho === '/boas-vindas') {
    if (!conta) return '/entrar'
    return conta.onboarding === 'pendente' ? null : '/app/linha'
  }
  if (caminho === '/entrar' || caminho === '/cadastro') {
    if (!conta) return null
    return conta.onboarding === 'pendente' ? '/boas-vindas' : destinoSeguro(volta)
  }
  return null
}

const precisaDeSessao = (caminho: string) =>
  caminho.startsWith('/app') || ['/boas-vindas', '/entrar', '/cadastro'].includes(caminho)

export default function App() {
  const rota = useRota()
  const sessao = useSessao()
  const { caminho, parametros } = separarRota(rota)
  const volta = parametros.get('volta')
  const destino = destinoDaGuarda(caminho, volta, sessao)

  useEffect(() => { void verificarSessao() }, [])

  /* Se a URL já mudou (sair, excluir conta), quem manda é a navegação nova, não a guarda. */
  useEffect(() => {
    if (destino && lerRota() === rota) redirecionar(destino)
  }, [destino, rota])

  /* As telas de /app definem o próprio título no AppShell. */
  useEffect(() => {
    if (caminho.startsWith('/app')) return
    const titulo = TITULOS[caminho]
    document.title = titulo ? `${titulo} · Nurai` : TITULO_PADRAO
  }, [caminho])

  if (caminho === '/acesso') return <AcessoMedico />
  if (caminho.startsWith('/projeto')) return <Projeto />
  if (precisaDeSessao(caminho) && (destino || sessao.status === 'carregando')) return <Abrindo />

  if (caminho.startsWith('/app')) return <AppShell rota={caminho} />
  if (caminho === '/entrar') return <Entrar volta={volta} />
  if (caminho === '/cadastro') return <Cadastro volta={volta} />
  if (caminho === '/boas-vindas') return <BoasVindas />
  return <Landing />
}
