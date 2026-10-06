import { useEffect, useState } from 'react'
import { Icon, type NomeIcone } from '../components/Icon'
import { Falha, Marca, Vazio } from '../components/ui'
import { Link } from '../components/Link'
import { navegar } from '../lib/router'
import { concluirOnboarding, definir, sair, useAcoes, useEstado, usePerfil } from '../lib/store'
import { mensagemDeErro } from '../lib/api'
import { TID } from '../lib/testids'
import { LinhaDoTempo } from './app/LinhaDoTempo'
import { Fontes } from './app/Fontes'
import { Copiloto } from './app/Copiloto'
import { Cuidado } from './app/Cuidado'
import { Resumo } from './app/Resumo'
import { Privacidade } from './app/Privacidade'
import '../styles/app.css'

const NAV: { para: string; rotulo: string; icone: NomeIcone; nota: string }[] = [
  { para: '/app/linha', rotulo: 'Linha do tempo', icone: 'linha', nota: 'Todo o histórico reunido' },
  { para: '/app/fontes', rotulo: 'Fontes e anexos', icone: 'anexar', nota: 'Conectar e enviar documentos' },
  { para: '/app/copiloto', rotulo: 'Copiloto', icone: 'copiloto', nota: 'Perguntar sobre a própria história' },
  { para: '/app/cuidado', rotulo: 'Próximos passos', icone: 'bussola', nota: 'O que fazer com esse contexto' },
  { para: '/app/resumo', rotulo: 'Resumo para consulta', icone: 'resumo', nota: 'Uma página para o médico' },
  { para: '/app/privacidade', rotulo: 'Acessos e consentimento', icone: 'escudo', nota: 'Quem vê o quê, e desde quando' },
]

export function AppShell({ rota }: { rota: string }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false)
  const [zerando, setZerando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const estado = useEstado()
  const perfil = usePerfil()
  const { carregar, descartarFalha, reiniciar } = useAcoes()
  const exemplo = perfil.onboarding === 'exemplo'
  const meta = [
    perfil.idade !== undefined && `${perfil.idade} anos`,
    perfil.cartaoSus && `Cartão SUS ${perfil.cartaoSus.slice(-4)}`,
  ].filter(Boolean).join(' · ')

  const fecharReinicio = () => {
    setConfirmandoReinicio(false)
    setMenuAberto(false)
    navegar('/app/linha')
  }

  /* Troca o ponto de partida: apaga tudo e recomeça sem o histórico de exemplo. */
  const comecarDoZero = async () => {
    if (zerando) return
    setZerando(true)
    try {
      await concluirOnboarding('vazio')
      fecharReinicio()
    } catch (erro) {
      setZerando(false)
      setConfirmandoReinicio(false)
      definir(() => ({ falhaAcao: mensagemDeErro(erro) }))
    }
  }

  const encerrar = async (destino = '/') => {
    if (saindo) return
    setSaindo(true)
    await sair(destino)
  }

  /* A sessão muda de identidade a cada troca de usuário ou de ponto de partida: aí o histórico é buscado de novo. */
  useEffect(() => { void carregar() }, [carregar, estado.sessao])

  const segmentos = rota.split('/').filter(Boolean) // ['app', 'linha', 'e09']
  const secao = segmentos[1] ?? 'linha'
  const parametro = segmentos[2]

  const atual = NAV.find((n) => n.para === `/app/${secao}`)
  const titulo = atual?.rotulo ?? 'Página não encontrada'
  const pendencias = estado.passos.filter((p) => !p.feito).length

  useEffect(() => { document.title = `${titulo} · Nurai` }, [titulo])

  return (
    <div className="app">
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>

      <aside className={`lateral${menuAberto ? ' lateral--aberta' : ''}`}>
        <div className="lateral__topo">
          <Link para="/" aria-label="Nurai, página inicial"><Marca tamanho={24} /></Link>
          <button
            type="button" className="btn btn--quiet lateral__fechar"
            onClick={() => setMenuAberto(false)}
          >
            <Icon nome="fechar" tamanho={18} />
            <span className="sr-only">Fechar menu</span>
          </button>
        </div>

        <div className="paciente" data-testid={TID.shellPerfil}>
          <span className="paciente__iniciais" aria-hidden="true">{perfil.iniciais}</span>
          <div>
            <p className="paciente__nome" data-testid={TID.shellPerfilNome}>{perfil.nome}</p>
            {meta && <p className="paciente__meta num">{meta}</p>}
          </div>
        </div>
        {perfil.condicoes.length > 0 && (
          <ul className="paciente__condicoes" aria-label="Condições">
            {perfil.condicoes.map((c) => <li key={c} className="chip">{c}</li>)}
          </ul>
        )}

        {perfil.convidado && (
          <div className="convidado" data-testid={TID.seloConvidado}>
            <span className="chip chip--convidado"><Icon nome="olho" tamanho={12} /> Conta de demonstração</span>
            <p className="convidado__texto">
              Os dados desta conta são temporários. Para guardar um histórico seu, crie uma conta
              — a demonstração não é transferida.
            </p>
            <button
              type="button" className="btn btn--ghost" disabled={saindo}
              onClick={() => { void encerrar('/cadastro') }}
            >
              Criar minha conta
            </button>
          </div>
        )}

        <nav className="lateral__nav" aria-label="Seções">
          {NAV.map((n) => {
            const ativo = n.para === `/app/${secao}`
            return (
              <Link
                key={n.para} para={n.para}
                className={`navitem${ativo ? ' navitem--ativo' : ''}`}
                aria-current={ativo ? 'page' : undefined}
                onClick={() => setMenuAberto(false)}
              >
                <Icon nome={n.icone} tamanho={18} />
                <span className="navitem__rotulo">{n.rotulo}</span>
                {n.para === '/app/cuidado' && pendencias > 0 && (
                  <span className="navitem__conta num">{pendencias}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="lateral__rodape">
          <p className="lateral__aviso">
            {exemplo
              ? 'Histórico de exemplo com dados sintéticos. Reiniciar restaura o exemplo original.'
              : 'Use apenas documentos fictícios nesta demonstração. Reiniciar apaga o que você anexou.'}
          </p>
          {confirmandoReinicio ? (
            <div className="reinicio" role="group" aria-labelledby="reinicio-pergunta">
              <p id="reinicio-pergunta" className="reinicio__pergunta">
                {exemplo
                  ? 'Restaurar apaga os documentos anexados, os passos marcados e as permissões alteradas, e volta ao histórico de exemplo. Começar do zero apaga também o exemplo. Continuar?'
                  : 'Reiniciar apaga todos os documentos que você anexou e deixa o histórico vazio de novo. Continuar?'}
              </p>
              <div className="reinicio__acoes">
                <button
                  type="button" className="btn" disabled={zerando} data-testid={TID.reinicioConfirmar}
                  onClick={() => { reiniciar(); fecharReinicio() }}
                >
                  {exemplo ? 'Restaurar o exemplo' : 'Apagar e reiniciar'}
                </button>
                {exemplo && (
                  <button
                    type="button" className="btn btn--ghost" disabled={zerando} data-testid={TID.reinicioZerar}
                    onClick={() => { void comecarDoZero() }}
                  >
                    {zerando ? 'Apagando…' : 'Começar do zero'}
                  </button>
                )}
                <button
                  type="button" className="btn btn--ghost" autoFocus disabled={zerando}
                  onClick={() => setConfirmandoReinicio(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button" className="btn btn--quiet" data-testid={TID.botaoReiniciar}
              onClick={() => setConfirmandoReinicio(true)}
            >
              <Icon nome="recomecar" tamanho={16} /> {exemplo ? 'Reiniciar o histórico de exemplo' : 'Reiniciar meu histórico'}
            </button>
          )}
          <button
            type="button" className="btn btn--quiet" disabled={saindo} data-testid={TID.botaoSair}
            onClick={() => { void encerrar() }}
          >
            <Icon nome="seta" tamanho={16} /> {saindo ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </aside>

      {menuAberto && (
        <button
          type="button" className="lateral__veu" aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <div className="palco">
        <header className="barra">
          <button
            type="button" className="btn btn--ghost barra__menu"
            onClick={() => setMenuAberto(true)}
          >
            <Icon nome="menu" tamanho={18} />
            <span className="sr-only">Abrir menu</span>
          </button>
          <div className="barra__titulo">
            <h1>{titulo}</h1>
            {atual && <p>{atual.nota}</p>}
          </div>
          {estado.saude && (
            <div className="selos" aria-label="Infraestrutura em uso">
              <span className={`selo selo--${estado.saude.genai}`}>
                <span className="chip__dot" />
                IA: {estado.saude.genai === 'oci' ? 'OCI Generative AI' : 'simulada'}
              </span>
              <span className={`selo selo--${estado.saude.db}`}>
                <span className="chip__dot" />
                Dados: {estado.saude.db === 'oracle' ? 'Oracle DB' : 'memória'}
              </span>
            </div>
          )}
          <Link para="/projeto" className="btn btn--ghost barra__dossie">
            Dossiê do projeto
          </Link>
        </header>

        <main id="conteudo" className="palco__corpo">
          {estado.falhaAcao && (
            <div className="palco__falha">
              <Falha mensagem={estado.falhaAcao} />
              <button type="button" className="btn btn--quiet" onClick={descartarFalha}>
                <Icon nome="fechar" tamanho={14} /> Fechar
              </button>
            </div>
          )}

          {estado.erro ? (
            <Vazio
              icone="alerta"
              titulo="Não foi possível carregar o histórico"
              texto={estado.erro}
              acao={
                <button
                  type="button" className="btn" disabled={estado.carregando}
                  onClick={() => { void carregar(true) }}
                >
                  <Icon nome="recomecar" tamanho={16} />
                  {estado.carregando ? 'Tentando…' : 'Tentar de novo'}
                </button>
              }
            />
          ) : estado.carregando ? (
            <div className="carregando-app" aria-live="polite">
              <p className="label">Reunindo o histórico</p>
              <span className="esqueleto" style={{ width: '64%' }} />
              <span className="esqueleto" style={{ width: '82%' }} />
              <span className="esqueleto" style={{ width: '71%' }} />
              <span className="esqueleto" style={{ width: '58%' }} />
            </div>
          ) : (
            <>
              {secao === 'linha' && <LinhaDoTempo selecionado={parametro} />}
              {secao === 'fontes' && <Fontes />}
              {secao === 'copiloto' && <Copiloto />}
              {secao === 'cuidado' && <Cuidado />}
              {secao === 'resumo' && <Resumo />}
              {secao === 'privacidade' && <Privacidade />}
              {!atual && (
                <Vazio
                  icone="busca"
                  titulo="Página não encontrada"
                  texto="Este endereço não corresponde a nenhuma tela do app."
                  acao={<Link para="/app/linha" className="btn btn--ghost">Ir para a linha do tempo</Link>}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
