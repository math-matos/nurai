import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { AvisoIa, Falha, Regua, SeloIa, VazioHistorico } from '../../components/ui'
import { formatarData, ordenarRecentes } from '../../lib/formato'
import { MEDICACOES } from '../../data/seed'
import type { Evento } from '../../data/types'
import { api, mensagemDeErro, podeRepetir, type Compartilhamento, type ResumoIa } from '../../lib/api'
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
const OUTRA = 'outra'
const MAX_ESPECIALIDADE = 80

/* Abas a partir do próprio histórico: mais frequentes primeiro, sem repetir grafias, e sempre clínica médica. */
function especialidadesDe(eventos: Evento[]): string[] {
  const contagem = new Map<string, { rotulo: string; n: number }>()
  for (const e of eventos) {
    const rotulo = e.especialidade?.trim()
    if (!rotulo) continue
    const chave = rotulo.toLocaleLowerCase('pt-BR')
    const atual = contagem.get(chave)
    contagem.set(chave, { rotulo: atual?.rotulo ?? rotulo, n: (atual?.n ?? 0) + 1 })
  }
  const rotulos = [...contagem.values()]
    .sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
    .map((x) => x.rotulo)
  return contagem.has(CLINICA.toLocaleLowerCase('pt-BR')) ? rotulos : [...rotulos, CLINICA]
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
      setSinteses((s) => ({ ...s, [alvoAtual]: resumo }))
    } catch (erro) {
      setErroIa({ foco: alvoAtual, mensagem: mensagemDeErro(erro), repetivel: podeRepetir(erro) })
    } finally {
      setGerandoPara(null)
    }
  }

  const compartilhar = async () => {
    if (compartilhando) return
    setCompartilhando(true)
    await gerarCompartilhamento(alvo ? alvo.medico : foco ? `Profissional de ${foco.toLowerCase()}` : 'Profissional de saúde')
    setCompartilhando(false)
  }

  const eventoPorId = (id: string) => eventos.find((e) => e.id === id)

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
            type="button" className="btn btn--ghost" disabled={gerandoPara !== null || !foco}
            onClick={() => { void gerarResumo() }} data-testid={TID.iaResumo}
          >
            <Icon nome="copiloto" tamanho={16} />
            {gerandoPara === foco ? 'Gerando resumo…' : sintese ? 'Gerar de novo com IA' : 'Gerar resumo com IA'}
          </button>
          <button
            type="button" className="btn" disabled={compartilhando}
            onClick={() => { void compartilhar() }} data-testid={TID.acessoGerar}
          >
            <Icon nome="chave" tamanho={16} /> {compartilhando ? 'Gerando acesso…' : 'Gerar acesso temporário'}
          </button>
        </div>
      </div>

      {compartilhamento && <PainelAcesso key={compartilhamento.codigo} compartilhamento={compartilhamento} />}

      <article className="folha-resumo">
        <header className="folha-resumo__cabeca">
          <div>
            <p className="label">Resumo pré-consulta · {rotuloFoco}</p>
            <h2>{perfil.nome}</h2>
            {identificacao && <p className="folha-resumo__ident num">{identificacao}</p>}
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
          <section className="folha-resumo__bloco sintese-ia" aria-live="polite" data-testid={TID.resumoSintese}>
            <h3>Síntese para {rotuloFoco.toLowerCase()}</h3>
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

        <section className="folha-resumo__bloco">
          <h3>Pendências identificadas no histórico</h3>
          <ul className="pendencias">
            {pendentes.map((p) => (
              <li key={p.id}>
                <strong>{p.titulo}</strong>
                <span>{p.prazo}</span>
              </li>
            ))}
            {pendentes.length === 0 && <li>Nenhuma pendência em aberto.</li>}
          </ul>
        </section>

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
function PainelAcesso({ compartilhamento }: { compartilhamento: Compartilhamento }) {
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
    if (!ok) setRevogando(false)
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
