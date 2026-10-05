import { useEffect, useState } from 'react'
import { Icon, type NomeIcone } from '../components/Icon'
import { Falha, Marca, Vazio } from '../components/ui'
import { Link } from '../components/Link'
import { navegar } from '../lib/router'
import { useAcoes, useEstado } from '../lib/store'
import { PACIENTE } from '../data/seed'
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
  const estado = useEstado()
  const { carregar, descartarFalha, reiniciar } = useAcoes()

  useEffect(() => { void carregar() }, [carregar])

  const segmentos = rota.split('/').filter(Boolean) // ['app', 'linha', 'e09']
  const secao = segmentos[1] ?? 'linha'
  const parametro = segmentos[2]

  const atual = NAV.find((n) => n.para === `/app/${secao}`) ?? NAV[0]
  const pendencias = estado.passos.filter((p) => !p.feito).length

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

        <div className="paciente">
          <span className="paciente__iniciais" aria-hidden="true">{PACIENTE.iniciais}</span>
          <div>
            <p className="paciente__nome">{PACIENTE.nome}</p>
            <p className="paciente__meta num">
              {PACIENTE.idade} anos · Cartão SUS {PACIENTE.cartaoSus.slice(-4)}
            </p>
          </div>
        </div>
        <ul className="paciente__condicoes">
          {PACIENTE.condicoes.map((c) => <li key={c} className="chip">{c}</li>)}
        </ul>

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
            Demonstração com dados sintéticos. Reiniciar restaura o histórico original no servidor.
          </p>
          <button
            type="button" className="btn btn--quiet"
            onClick={() => {
              reiniciar()
              navegar('/app/linha')
            }}
          >
            <Icon nome="recomecar" tamanho={16} /> Reiniciar a demonstração
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
            <h1>{atual.rotulo}</h1>
            <p>{atual.nota}</p>
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
