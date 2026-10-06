import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../../components/Icon'
import { AvisoIa, Falha, Regua, SeloIa, VazioHistorico } from '../../components/ui'
import { formatarData, ordenarRecentes } from '../../lib/formato'
import { agruparEspecialidades, chaveEspecialidade } from '../../data/especialidades'
import { MEDICACOES } from '../../data/seed'
import type { Evento, ProximoPasso } from '../../data/types'
import { api, mensagemDeErro, podeRepetir, type Compartilhamento, type PontoEmAberto, type ResumoIa } from '../../lib/api'
import { agruparPontos } from '../../lib/pontos'
import { navegar } from '../../lib/router'
import { hoje, useAcoes, useEstado, usePerfil } from '../../lib/store'
import { TID } from '../../lib/testids'

/* Médico, data de referência e destaques fixos só existem para a paciente de exemplo. */
const FOCOS_EXEMPLO: Record<string, { medico: string; desde: string; ids: string[] }> = {
  Cardiologia: { medico: 'Dra. Renata Aguiar', desde: 'a consulta de 18 fev 2026', ids: ['e23', 'e22', 'e21'] },
  Endocrinologia: { medico: 'Dr. Paulo Sarmento', desde: 'a consulta de 10 fev 2025', ids: ['e18', 'e21', 'e14'] },
  'Clínica médica': { medico: 'UBS Vila Mariana', desde: 'a consulta de 08 jul 2026', ids: ['e23', 'e22', 'e21'] },
}

const CLINICA = 'Clínica médica'
const ID_SINTESE = 'resumo-sintese'
const OUTRA = 'outra'
const MAX_ESPECIALIDADE = 80

/* Abas a partir do próprio histórico: mais frequentes primeiro, grafias agrupadas, e sempre clínica médica. */
function especialidadesDe(eventos: Evento[]): string[] {
  const grupos = agruparEspecialidades(eventos.map((e) => e.especialidade), Object.keys(FOCOS_EXEMPLO))
  const rotulos = grupos.map((g) => g.rotulo)
  const temClinica = rotulos.some((r) => chaveEspecialidade(r) === chaveEspecialidade(CLINICA))
  return temClinica ? rotulos : [...rotulos, CLINICA]
}

export function Resumo() {
  const { eventos } = useEstado()
  if (eventos.length === 0) {
    return (
      <VazioHistorico
        icone="resumo"
        titulo="O resumo nasce do seu histórico"
        texto="Quando houver documentos reunidos, esta página vira uma folha de uma página para levar à consulta — e um código de acesso temporário para o profissional."
      />
    )
  }
  return <FolhaResumo />
}

function FolhaResumo() {
  const { eventos, passos, compartilhamento } = useEstado()
  const perfil = usePerfil()
  /* Médicos, datas e medicamentos fixos só fazem sentido no histórico de exemplo. */
  const exemplo = perfil.onboarding === 'exemplo'
  const { gerarCompartilhamento } = useAcoes()
  const especialidades = especialidadesDe(eventos)
  const [escolha, setEscolha] = useState(especialidades[0])
  const [outra, setOutra] = useState('')
  const [sinteses, setSinteses] = useState<Record<string, ResumoIa>>({})
  const [gerandoPara, setGerandoPara] = useState<string | null>(null)
  const [erroIa, setErroIa] = useState<{ foco: string; mensagem: string; repetivel: boolean } | null>(null)
  const [compartilhando, setCompartilhando] = useState(false)
  const [revogado, setRevogado] = useState<{ codigo: string; quando: string } | null>(null)
  const [sintesePronta, setSintesePronta] = useState('')
  const avisoRevogado = useRef<HTMLParagraphElement>(null)

  const foco = escolha === OUTRA ? outra.trim() : escolha
  const rotuloFoco = foco || 'outra especialidade'
  const alvo = exemplo ? FOCOS_EXEMPLO[foco] : undefined
  const doExemplo = (alvo?.ids ?? [])
    .map((id) => eventos.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
  const usaExemplo = alvo !== undefined && doExemplo.length > 0
  const destaques = usaExemplo ? doExemplo : ordenarRecentes(eventos).slice(0, 3)
  const tituloDestaques = usaExemplo ? `O que mudou desde ${alvo.desde}` : 'Registros mais recentes'
  const medicacoes = ordenarRecentes(eventos).filter((e) => e.tipo === 'medicacao')
  const identificacao = [
    perfil.idade !== undefined && `${perfil.idade} anos`,
    perfil.dataNascimento && `nascimento ${formatarData(perfil.dataNascimento)}`,
    perfil.cartaoSus && `cartão SUS ${perfil.cartaoSus}`,
    perfil.plano,
  ].filter(Boolean).join(' · ')
  const pendentes = passos.filter((p) => !p.feito)
  const fontesDistintas = new Set(eventos.map((e) => e.fonte)).size
  const sintese = foco ? sinteses[foco] : undefined

  const gerarResumo = async () => {
    if (gerandoPara || !foco) return
    const alvoAtual = foco
    setGerandoPara(alvoAtual)
    setErroIa(null)
    try {
      const resumo = await api.resumo(alvoAtual)
      flushSync(() => {
        setSinteses((s) => ({ ...s, [alvoAtual]: resumo }))
        setGerandoPara(null)
        setSintesePronta(`Síntese para ${alvoAtual.toLowerCase()} pronta, logo abaixo.`)
      })
      /* A síntese nasce abaixo da dobra no celular: leva a pessoa até ela. */
      const secao = document.getElementById(ID_SINTESE)
      if (secao?.dataset.foco === alvoAtual) {
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' })
        secao.focus({ preventScroll: true })
      }
    } catch (erro) {
      setErroIa({ foco: alvoAtual, mensagem: mensagemDeErro(erro), repetivel: podeRepetir(erro) })
    } finally {
      setGerandoPara(null)
    }
  }

  const compartilhar = async () => {
    if (compartilhando) return
    setCompartilhando(true)
    setRevogado(null)
    await gerarCompartilhamento(alvo ? alvo.medico : foco ? `Profissional de ${foco.toLowerCase()}` : 'Profissional de saúde')
    setCompartilhando(false)
  }

  const eventoPorId = (id: string) => eventos.find((e) => e.id === id)

  /* O painel do código some ao revogar: a confirmação fica aqui, e o foco vem junto. */
  const aposRevogar = (codigo: string) => {
    const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(', ', ' às ')
    flushSync(() => setRevogado({ codigo, quando }))
    avisoRevogado.current?.focus()
  }

  return (
    <div className="resumo">
      <div className="resumo__controles">
        <div className="resumo__foco">
          <div className="seletor" role="group" aria-label="Especialidade de destino">
            {[...especialidades, OUTRA].map((f) => (
              <button
                key={f} type="button"
                className={`seletor__opcao${escolha === f ? ' seletor__opcao--ativa' : ''}`}
                aria-pressed={escolha === f}
                onClick={() => setEscolha(f)}
              >
                {f === OUTRA ? 'Outra…' : f}
              </button>
            ))}
          </div>
          {escolha === OUTRA && (
            <input
              className="field resumo__outra" value={outra} maxLength={MAX_ESPECIALIDADE} autoFocus
              aria-label="Qual especialidade?" placeholder="Ex.: Pneumologia"
              onChange={(e) => setOutra(e.target.value)}
            />
          )}
        </div>
        <div className="resumo__acoes">
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
            <Icon nome="papel" tamanho={16} /> Imprimir
          </button>
          <button
            type="button" className="btn" disabled={gerandoPara !== null || !foco}
            onClick={() => { void gerarResumo() }} data-testid={TID.iaResumo}
          >
            <Icon nome="copiloto" tamanho={16} />
            {gerandoPara === foco ? 'Gerando resumo…' : sintese ? 'Gerar de novo com IA' : 'Gerar resumo com IA'}
          </button>
          <button
            type="button" className="btn btn--ghost" disabled={compartilhando}
            onClick={() => { void compartilhar() }} data-testid={TID.acessoGerar}
          >
            <Icon nome="chave" tamanho={16} /> {compartilhando ? 'Gerando acesso…' : 'Gerar acesso temporário'}
          </button>
        </div>
      </div>

      <p className="resumo__explica">
        A folha abaixo é o <strong>resumo automático dos registros</strong>, montado sem IA. Para
        acrescentar uma síntese com os pontos de atenção para a especialidade escolhida, use
        {' '}<strong>Gerar resumo com IA</strong>.
      </p>
      <span className="sr-only" aria-live="polite">{sintesePronta}</span>

      {compartilhamento && (
        <PainelAcesso key={compartilhamento.codigo} compartilhamento={compartilhamento} aoRevogar={aposRevogar} />
      )}
      <div aria-live="polite">
        {revogado && !compartilhamento && (
          <p className="recado-app" tabIndex={-1} ref={avisoRevogado} data-testid={TID.acessoRevogado}>
            <Icon nome="cadeado" tamanho={16} />
            <span>
              Acesso revogado em <span className="num">{revogado.quando}</span>. O código{' '}
              <strong className="num">{revogado.codigo}</strong> não abre mais o histórico.
            </span>
          </p>
        )}
      </div>

      <article className="folha-resumo">
        <header className="folha-resumo__cabeca">
          <div>
            <p className="label">Resumo automático dos registros · {rotuloFoco}</p>
            <h2>{perfil.nome}</h2>
            {identificacao && <p className="folha-resumo__ident num">{identificacao}</p>}
            {perfil.responsavel && (
              <p className="folha-resumo__ident">
                Informações enviadas por {perfil.responsavel.nome} ({perfil.responsavel.relacao})
              </p>
            )}
          </div>
          <p className="folha-resumo__origem">
            Gerado em {hoje()} a partir de <span className="num">{eventos.length}</span> registros
            de <span className="num">{fontesDistintas}</span> fontes
          </p>
        </header>

        {/* Lista vazia é "não informado", não "sem alergias": o alerta vermelho só aparece com alergia registrada. */}
        {perfil.alergias.length > 0 ? (
          <section className="folha-resumo__alerta">
            <Icon nome="alerta" tamanho={16} />
            <div>
              <p className="label">Alergias</p>
              <p>{perfil.alergias.join(' · ')}</p>
            </div>
          </section>
        ) : (
          <section className="folha-resumo__alerta folha-resumo__alerta--neutra">
            <Icon nome="pessoa" tamanho={16} />
            <p><strong>Alergias:</strong> não informadas</p>
            <button type="button" className="folha-resumo__informar" onClick={() => navegar('/app/privacidade')}>
              Informar em Meus dados
            </button>
          </section>
        )}

        {(sintese || gerandoPara === foco || erroIa?.foco === foco) && (
          <section
            id={ID_SINTESE} data-foco={foco} className="folha-resumo__bloco sintese-ia" tabIndex={-1}
            aria-labelledby={`${ID_SINTESE}-titulo`} aria-busy={gerandoPara === foco} data-testid={TID.resumoSintese}
          >
            <h3 id={`${ID_SINTESE}-titulo`}>Síntese com IA para {rotuloFoco.toLowerCase()}</h3>
            {gerandoPara === foco && (
              <div className="sintese-ia__carregando">
                <span className="esqueleto" style={{ width: '90%' }} />
                <span className="esqueleto" style={{ width: '76%' }} />
                <span className="esqueleto" style={{ width: '84%' }} />
              </div>
            )}
            {erroIa?.foco === foco && gerandoPara !== foco && (
              <Falha mensagem={erroIa.mensagem} aoTentar={erroIa.repetivel ? () => { void gerarResumo() } : undefined} />
            )}
            {sintese && gerandoPara !== foco && (
              <>
                {sintese.sintese.map((p, i) => <p key={i} className="sintese-ia__texto">{p}</p>)}
                {sintese.pontos.length > 0 && (
                  <ul className="sintese-ia__pontos">
                    {sintese.pontos.map((p, i) => (
                      <li key={i}>
                        <p>{p.texto}</p>
                        <div className="sintese-ia__ancoras">
                          {p.ancoras.map((id) => {
                            const e = eventoPorId(id)
                            if (!e) return null
                            return (
                              <button
                                key={id} type="button" className="chip chip--botao"
                                onClick={() => navegar(`/app/linha/${id}`)}
                              >
                                <span className="num">{formatarData(e.data)}</span> · {e.titulo}
                              </button>
                            )
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {sintese.perguntasSugeridas.length > 0 && (
                  <>
                    <p className="label">Perguntas para levar à consulta</p>
                    <ul className="sintese-ia__perguntas">
                      {sintese.perguntasSugeridas.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </>
                )}
                {sintese.aviso && <AvisoIa>{sintese.aviso}</AvisoIa>}
                <SeloIa geradoPor={sintese.geradoPor} />
              </>
            )}
          </section>
        )}

        <section className="folha-resumo__bloco">
          <h3>Condições ativas</h3>
          {perfil.condicoes.length > 0 ? (
            <ul className="lista-inline">
              {perfil.condicoes.map((c) => <li key={c} className="chip">{c}</li>)}
            </ul>
          ) : (
            <p className="painel__nada">Nenhuma condição registrada em Meus dados.</p>
          )}
        </section>

        <section className="folha-resumo__bloco">
          <h3>{tituloDestaques}</h3>
          <ul className="mudancas">
            {destaques.map((e) => (
              <li key={e.id}>
                <p className="mudancas__topo">
                  <time className="num" dateTime={e.data}>{formatarData(e.data)}</time>
                  <strong>{e.titulo}</strong>
                  <span>{e.instituicao}</span>
                </p>
                <p className="mudancas__texto">{e.resumo}</p>
                {e.medidas?.map((m, i) => <Regua key={`${i}-${m.nome}`} medida={m} />)}
              </li>
            ))}
          </ul>
        </section>

        <section className="folha-resumo__bloco">
          <h3>Medicamentos em uso contínuo</h3>
          {exemplo ? (
            <div className="rolagem-x">
              <table className="tabela-med">
                <thead>
                  <tr><th>Medicamento</th><th>Dose</th><th>Posologia</th><th>Desde</th><th>Prescrito por</th></tr>
                </thead>
                <tbody>
                  {MEDICACOES.map((m) => (
                    <tr key={m.nome}>
                      <th scope="row">{m.nome}</th>
                      <td className="num">{m.dose}</td>
                      <td>{m.posologia}</td>
                      <td className="num">{m.desde}</td>
                      <td>{m.prescritor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : medicacoes.length > 0 ? (
            <ul className="pendencias">
              {medicacoes.map((m) => (
                <li key={m.id}><strong>{m.titulo}</strong><span className="num">{formatarData(m.data)} · {m.instituicao}</span></li>
              ))}
            </ul>
          ) : (
            <p className="painel__nada">Nenhuma receita ou medicação registrada no histórico.</p>
          )}
        </section>

        <PontosEmAberto eventos={eventos} pendentes={pendentes} />

        <footer className="folha-resumo__pe">
          Documento gerado pela Nurai a partir do histórico reunido pelo próprio titular.
          Demonstração acadêmica. Não é laudo, não é prescrição e não substitui a avaliação
          do profissional que assina o atendimento.
        </footer>
      </article>
    </div>
  )
}

/* Código de acesso do profissional: validade, onde usar, copiar e revogar. */
function PainelAcesso({ compartilhamento, aoRevogar }: {
  compartilhamento: Compartilhamento
  aoRevogar: (codigo: string) => void
}) {
  const { revogarCompartilhamento } = useAcoes()
  const [copia, setCopia] = useState<'ok' | 'falhou' | null>(null)
  const [revogando, setRevogando] = useState(false)
  const endereco = `${window.location.origin}/#/acesso`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Acesse ${endereco} e informe o código ${compartilhamento.codigo}.`)
      setCopia('ok')
    } catch {
      setCopia('falhou')
    }
  }

  const revogar = async () => {
    if (revogando) return
    setRevogando(true)
    const ok = await revogarCompartilhamento(compartilhamento.codigo)
    if (ok) aoRevogar(compartilhamento.codigo)
    else setRevogando(false)
  }

  return (
    <div className="acesso" role="region" aria-label="Acesso temporário para o profissional" data-testid={TID.acessoPainel}>
      <div>
        <p className="acesso__titulo">Acesso temporário criado para {compartilhamento.para}</p>
        <p className="acesso__texto" data-testid={TID.acessoValidade}>
          Válido até <strong className="num">{compartilhamento.expiraEm}</strong> (criado em{' '}
          <span className="num">{compartilhamento.criadoEm}</span>). O profissional acessa em{' '}
          <strong>{endereco}</strong> e informa o código — vê o histórico só para leitura, e
          cada acesso entra no seu registro.
        </p>
        <div className="acesso__acoes">
          <button type="button" className="btn btn--ghost" onClick={() => { void copiar() }} data-testid={TID.acessoCopiar}>
            <Icon nome="papel" tamanho={15} /> Copiar código e endereço
          </button>
          <button
            type="button" className="btn btn--ghost" onClick={() => { void revogar() }} disabled={revogando}
            data-testid={TID.acessoRevogar}
          >
            <Icon nome="cadeado" tamanho={15} /> {revogando ? 'Revogando…' : 'Revogar acesso'}
          </button>
          <span className="acesso__copia" aria-live="polite">
            {copia === 'ok' && 'Copiado.'}
            {copia === 'falhou' && 'Não foi possível copiar. Selecione o código e copie manualmente.'}
          </span>
        </div>
      </div>
      <p className="acesso__codigo num" data-testid={TID.acessoCodigo}>{compartilhamento.codigo}</p>
    </div>
  )
}

/* Simulação R2 (P13): a folha dizia "Nenhuma pendência" enquanto a tela do médico listava o exame repetido.
   Os pontos vêm do mesmo cálculo do servidor; os próximos passos marcados pelo paciente vêm depois. */
function PontosEmAberto({ eventos, pendentes }: { eventos: Evento[]; pendentes: ProximoPasso[] }) {
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState<{ pontos: PontoEmAberto[] | null; erro: string | null; de: unknown }>(
    { pontos: null, erro: null, de: null },
  )

  /* Refaz a conta quando o histórico muda (anexo ou exclusão). */
  useEffect(() => {
    let ativo = true
    api.pontosEmAberto()
      .then(({ pontosEmAberto }) => { if (ativo) setResultado({ pontos: pontosEmAberto, erro: null, de: eventos }) })
      .catch((erro: unknown) => { if (ativo) setResultado({ pontos: null, erro: mensagemDeErro(erro), de: eventos }) })
    return () => { ativo = false }
  }, [eventos, tentativa])

  const atual = resultado.de === eventos
  const grupos = atual && resultado.pontos ? agruparPontos(resultado.pontos) : []
  const titulo = (id: string) => {
    const e = eventos.find((x) => x.id === id)
    return e ? `${formatarData(e.data)} · ${e.titulo}` : null
  }

  return (
    <section className="folha-resumo__bloco" aria-busy={!atual} data-testid={TID.resumoPontos}>
      <h3>Pontos em aberto nos registros</h3>
      <p className="folha-resumo__nota">
        Os mesmos que o profissional vê pelo código de acesso: identificados a partir das datas e textos dos
        registros, sem IA. Confira no documento de origem.
      </p>
      {!atual && <p className="painel__nada">Conferindo os registros…</p>}
      {atual && resultado.erro && (
        <Falha
          mensagem={resultado.erro}
          aoTentar={() => {
            setResultado((r) => ({ ...r, de: null }))
            setTentativa((n) => n + 1)
          }}
        />
      )}
      {grupos.map((g) => (
        <div key={g.tipo} className="folha-resumo__grupo">
          <p className="label">{g.titulo}</p>
          <ul className="pendencias">
            {g.itens.map((p, i) => (
              <li key={i} data-testid={TID.resumoPonto}>
                <strong>{p.texto}</strong>
                <span>{p.ancoras.map(titulo).filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {atual && resultado.pontos?.length === 0 && (
        <p className="painel__nada">Nenhum ponto em aberto identificado nos registros.</p>
      )}
      {pendentes.length > 0 && (
        <div className="folha-resumo__grupo">
          <p className="label">Próximos passos ainda não resolvidos</p>
          <ul className="pendencias">
            {pendentes.map((p) => (
              <li key={p.id}>
                <strong>{p.titulo}</strong>
                <span>{p.prazo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
