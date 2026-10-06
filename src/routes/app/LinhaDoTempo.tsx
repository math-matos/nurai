import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Ancoras, AvisoIa, ChipFonte, ChipSinal, Falha, Regua, SeloIa, Vazio, VazioHistorico } from '../../components/ui'
import { ICONE_TIPO, ano, formatarData, ordenarRecentes } from '../../lib/formato'
import { FONTES, TIPOS } from '../../data/seed'
import type { Evento, FonteId, TipoId } from '../../data/types'
import { api, type Explicacao } from '../../lib/api'
import { navegar } from '../../lib/router'
import { perguntar, useEstado } from '../../lib/store'
import { useRequisicao } from '../../lib/useRequisicao'
import { TID } from '../../lib/testids'

const TIPOS_FILTRO: TipoId[] = ['exame', 'consulta', 'imagem', 'internacao', 'cirurgia', 'vacina', 'documento']
const FONTES_FILTRO: FonteId[] = ['sus', 'laboratorio', 'hospital', 'clinica', 'operadora', 'paciente']

/* Mesmo ponto de quebra de `.linha` em app.css: abaixo dele o detalhe vai para baixo da lista. */
const EMPILHADO = '(max-width: 1180px)'

const empilhado = () => window.matchMedia(EMPILHADO).matches
const idDoItem = (id: string) => `evento-${id}`

/* Desconta a barra superior grudenta, que no celular pode passar de 100px. */
function rolarAte(alvo: HTMLElement | null) {
  if (!alvo) return
  const barra = document.querySelector('.barra')?.getBoundingClientRect().height ?? 0
  const topo = alvo.getBoundingClientRect().top + window.scrollY - barra - 12
  window.scrollTo({ top: Math.max(topo, 0) })
}

export function LinhaDoTempo({ selecionado }: { selecionado?: string }) {
  const { eventos } = useEstado()
  const [busca, setBusca] = useState('')
  const [tipos, setTipos] = useState<TipoId[]>([])
  const [fontes, setFontes] = useState<FonteId[]>([])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ordenarRecentes(eventos).filter((e) => {
      if (tipos.length && !tipos.includes(e.tipo)) return false
      if (fontes.length && !fontes.includes(e.fonte)) return false
      if (!termo) return true
      const alvo = [e.titulo, e.resumo, e.instituicao, e.especialidade ?? '', ...e.tags,
        ...(e.medidas ?? []).map((m) => m.nome)].join(' ').toLowerCase()
      return alvo.includes(termo)
    })
  }, [eventos, busca, tipos, fontes])

  const naoEncontrado = selecionado !== undefined && !eventos.some((e) => e.id === selecionado)
  const atual: Evento | undefined = naoEncontrado
    ? undefined
    : lista.find((e) => e.id === selecionado) ?? eventos.find((e) => e.id === selecionado) ?? lista[0]

  const detalhe = useRef<HTMLElement>(null)
  const tituloDetalhe = useRef<HTMLHeadingElement>(null)

  /* Em tela estreita o detalhe fica empilhado abaixo da lista inteira: ao escolher
     um registro, leva a pessoa até ele em vez de deixá-lo milhares de pixels abaixo. */
  const mostrarDetalhe = () => {
    if (!empilhado()) return
    rolarAte(detalhe.current)
    tituloDetalhe.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (selecionado) mostrarDetalhe()
  }, [selecionado])

  const voltarALista = () => {
    const item = atual && document.getElementById(idDoItem(atual.id))
    if (!item) return
    rolarAte(item)
    item.focus({ preventScroll: true })
  }

  const alterna = <T,>(valor: T, atuais: T[], set: (v: T[]) => void) =>
    set(atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor])

  const filtrando = tipos.length > 0 || fontes.length > 0 || busca.trim() !== ''

  if (eventos.length === 0) {
    return (
      <VazioHistorico
        icone="linha"
        titulo="Seu histórico ainda está vazio"
        texto="Anexe um laudo, resultado de exame ou receita. A IA lê o documento, você confere, e ele vira o primeiro ponto desta linha do tempo."
      />
    )
  }

  return (
    <div className="linha">
      <div className="linha__coluna">
        <div className="filtros">
          <label className="filtros__busca">
            <Icon nome="busca" tamanho={17} />
            <input
              className="field" type="search" value={busca} placeholder="Buscar por exame, instituição ou sintoma"
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar no histórico"
            />
          </label>
          <div className="filtros__grupos">
            <div className="filtros__grupo" role="group" aria-label="Filtrar por tipo">
              {TIPOS_FILTRO.map((t) => (
                <button
                  key={t} type="button"
                  className={`chip chip--botao${tipos.includes(t) ? ' chip--ligado' : ''}`}
                  aria-pressed={tipos.includes(t)}
                  onClick={() => alterna(t, tipos, setTipos)}
                >
                  <Icon nome={ICONE_TIPO[t]} tamanho={13} />
                  {TIPOS[t]}
                </button>
              ))}
            </div>
            <div className="filtros__grupo" role="group" aria-label="Filtrar por fonte">
              {FONTES_FILTRO.map((f) => (
                <button
                  key={f} type="button"
                  className={`chip chip--botao chip--fonte${fontes.includes(f) ? ' chip--ligado' : ''}`}
                  style={{ ['--c' as string]: FONTES[f].cor }}
                  aria-pressed={fontes.includes(f)}
                  onClick={() => alterna(f, fontes, setFontes)}
                >
                  <span className="chip__faixa" />
                  {FONTES[f].curto}
                </button>
              ))}
            </div>
          </div>
          <p className="filtros__conta">
            <span className="num">{lista.length}</span> de <span className="num">{eventos.length}</span> registros
            {filtrando && (
              <button
                type="button" className="btn btn--quiet"
                onClick={() => { setBusca(''); setTipos([]); setFontes([]) }}
              >
                Limpar filtros
              </button>
            )}
          </p>
        </div>

        {lista.length === 0 ? (
          <Vazio
            icone="busca"
            titulo="Nenhum registro com esses filtros"
            texto={`O histórico tem ${eventos.length} registros. Tente afrouxar a busca ou desmarcar um filtro.`}
            acao={
              <button type="button" className="btn btn--ghost"
                onClick={() => { setBusca(''); setTipos([]); setFontes([]) }}>
                Limpar filtros
              </button>
            }
          />
        ) : (
          <ol className="tempo">
            {lista.map((e, i) => {
              const novoAno = i === 0 || ano(lista[i - 1].data) !== ano(e.data)
              return (
                <li key={e.id}>
                  {novoAno && <p className="tempo__ano num">{ano(e.data)}</p>}
                  <button
                    type="button" id={idDoItem(e.id)}
                    className={`evento${atual?.id === e.id ? ' evento--ativo' : ''}`}
                    style={{ ['--c' as string]: FONTES[e.fonte].cor }}
                    onClick={() => (e.id === selecionado ? mostrarDetalhe() : navegar(`/app/linha/${e.id}`))}
                    aria-current={atual?.id === e.id ? 'true' : undefined}
                    data-testid={TID.eventoItem}
                  >
                    <span className="evento__no" />
                    <span className="evento__data num">{formatarData(e.data)}</span>
                    <span className="evento__icone"><Icon nome={ICONE_TIPO[e.tipo]} tamanho={16} /></span>
                    <span className="evento__corpo">
                      <span className="evento__titulo">{e.titulo}</span>
                      <span className="evento__onde">{e.instituicao}</span>
                    </span>
                    <span className="evento__marcas">
                      {e.sinal === 'alterado' && <span className="evento__sinal sinal-alterado" aria-label="Fora da faixa" />}
                      {e.novo && <span className="chip chip--novo">novo</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <aside className="detalhe" aria-label="Detalhe do registro" ref={detalhe}>
        {naoEncontrado && (
          <Vazio
            icone="alerta"
            titulo="Registro não encontrado"
            texto={`Não há um registro “${selecionado}” neste histórico. O endereço pode estar incompleto ou o registro ter sido apagado ao reiniciar a demonstração.`}
            acao={
              <button type="button" className="btn btn--ghost" onClick={() => navegar('/app/linha')}>
                Ver o registro mais recente
              </button>
            }
          />
        )}
        {atual && (
          <div className="detalhe__caixa" data-testid={TID.eventoDetalhe}>
            <button type="button" className="btn btn--quiet detalhe__voltar" onClick={voltarALista}>
              <Icon nome="linha" tamanho={16} /> Voltar à lista
            </button>
            <div className="detalhe__cabeca">
              <div className="detalhe__meta">
                <ChipFonte fonte={atual.fonte} />
                <span className="chip">{TIPOS[atual.tipo]}</span>
              </div>
              <time className="detalhe__data num" dateTime={atual.data}>{formatarData(atual.data)}</time>
            </div>

            <h2 className="detalhe__titulo" ref={tituloDetalhe} tabIndex={-1}>{atual.titulo}</h2>
            <p className="detalhe__inst">
              <Icon nome="instituicao" tamanho={15} />
              {atual.instituicao}{atual.especialidade ? ` · ${atual.especialidade}` : ''}
            </p>

            <p className="detalhe__resumo">{atual.resumo}</p>

            {atual.medidas && (
              <div className="detalhe__medidas">
                <p className="label">Resultados</p>
                {atual.medidas.map((m, i) => <Regua key={`${i}-${m.nome}`} medida={m} />)}
              </div>
            )}

            <dl className="proveniencia">
              <div>
                <dt>Origem do registro</dt>
                <dd>{atual.origem}</dd>
              </div>
              {atual.documento && (
                <div>
                  <dt>Arquivo</dt>
                  <dd className="proveniencia__arquivo"><Icon nome="papel" tamanho={14} />{atual.documento}</dd>
                </div>
              )}
              {atual.confianca !== undefined && (
                <div>
                  <dt>Confiança da extração</dt>
                  <dd className="num">
                    {Math.round(atual.confianca * 100)}%
                    <span className="proveniencia__nota">revisável por você</span>
                  </dd>
                </div>
              )}
              <div>
                <dt>Estado clínico</dt>
                <dd><ChipSinal sinal={atual.sinal} /></dd>
              </div>
            </dl>

            <div className="detalhe__acoes">
              <button
                type="button" className="btn"
                onClick={() => {
                  perguntar(`Me explique o registro de ${formatarData(atual.data)}: ${atual.titulo}`)
                  navegar('/app/copiloto')
                }}
              >
                <Icon nome="copiloto" tamanho={16} /> Perguntar ao copiloto
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => navegar('/app/privacidade')}>
                <Icon nome="escudo" tamanho={16} /> Quem acessou
              </button>
            </div>

            <ExplicarEvento key={atual.id} evento={atual} eventos={eventos} />
          </div>
        )}
      </aside>
    </div>
  )
}

function ExplicarEvento({ evento, eventos }: { evento: Evento; eventos: Evento[] }) {
  const { dados, erro, repetivel, carregando, executar } = useRequisicao<Explicacao>()
  const explicar = () => { void executar(() => api.explicarExame(evento.id)) }
  const outrasAncoras = dados?.ancoras.filter((id) => id !== evento.id) ?? []

  return (
    <section className="explicacao" aria-live="polite">
      {!dados && (
        <button type="button" className="btn btn--ghost" onClick={explicar} disabled={carregando} data-testid={TID.iaExplicar}>
          <Icon nome="copiloto" tamanho={16} />
          {carregando ? 'Preparando a explicação…' : 'Explicar em linguagem simples'}
        </button>
      )}

      {carregando && (
        <div className="explicacao__carregando">
          <span className="esqueleto" style={{ width: '94%' }} />
          <span className="esqueleto" style={{ width: '81%' }} />
          <span className="esqueleto" style={{ width: '88%' }} />
        </div>
      )}

      {erro && <Falha mensagem={erro} aoTentar={repetivel ? explicar : undefined} tentando={carregando} />}

      {dados && (
        <div className="explicacao__corpo" data-testid={TID.iaExplicacao}>
          <p className="label">Em linguagem simples</p>
          {dados.explicacao.map((p, i) => <p key={i} className="explicacao__texto">{p}</p>)}

          {dados.pontosDeAtencao.length > 0 && (
            <>
              <p className="label">Pontos de atenção</p>
              <ul className="explicacao__lista">
                {dados.pontosDeAtencao.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </>
          )}

          {dados.perguntasParaMedico.length > 0 && (
            <>
              <p className="label">Perguntas para levar ao médico</p>
              <ul className="explicacao__lista explicacao__lista--perguntas">
                {dados.perguntasParaMedico.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </>
          )}

          {dados.aviso && <AvisoIa>{dados.aviso}</AvisoIa>}
          <Ancoras ids={outrasAncoras} eventos={eventos} titulo="Outros registros citados" />
          <SeloIa geradoPor={dados.geradoPor} />
        </div>
      )}
    </section>
  )
}
