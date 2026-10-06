import { useState } from 'react'
import { Campo } from '../components/Campo'
import { Icon } from '../components/Icon'
import { Porta } from '../components/Porta'
import { AvisoIa, ChipSinal, Falha, Marca, Regua, SeloIa, Vazio } from '../components/ui'
import { FONTES, TIPOS } from '../data/seed'
import type { Evento } from '../data/types'
import { api, ErroApi, mensagemDeErro, podeRepetir, type AcessoMedico as Acesso, type ResumoIa } from '../lib/api'
import { formatarData, ordenarRecentes } from '../lib/formato'
import { focarPrimeiroErro } from '../lib/formulario'
import { TID } from '../lib/testids'
import '../styles/medico.css'

type Erros = Partial<Record<'codigo' | 'profissional', string>>

const ORDEM = [{ campo: 'codigo', id: 'medico-codigo' }, { campo: 'profissional', id: 'medico-profissional' }]

interface Liberado { dados: Acesso; codigo: string; profissional: string }

/* Porta do profissional de saúde: sem conta, só com o código que o paciente gerou. Nenhuma ação de escrita. */
export function AcessoMedico() {
  const [liberado, setLiberado] = useState<Liberado | null>(null)
  if (liberado) return <VisaoMedico {...liberado} aoSair={() => setLiberado(null)} />
  return <FormularioCodigo aoLiberar={setLiberado} />
}

function FormularioCodigo({ aoLiberar }: { aoLiberar: (l: Liberado) => void }) {
  const [codigo, setCodigo] = useState('')
  const [profissional, setProfissional] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const recusar = (novos: Erros) => {
    setErros(novos)
    focarPrimeiroErro(ORDEM, novos)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErroGeral(null)
    const limpo = codigo.replace(/\s+/g, '').toUpperCase()
    const nome = profissional.trim()
    const locais: Erros = {
      ...(limpo === '' && { codigo: 'Informe o código que o paciente compartilhou' }),
      ...(nome === '' && { profissional: 'Informe seu nome e registro profissional' }),
    }
    if (Object.keys(locais).length > 0) return recusar(locais)

    setEnviando(true)
    try {
      const dados = await api.acessoMedico(limpo, nome)
      aoLiberar({ dados, codigo: limpo, profissional: nome })
    } catch (erro) {
      setEnviando(false)
      if (erro instanceof ErroApi && erro.codigo === 'CODIGO_INVALIDO') return recusar({ codigo: erro.message })
      if (erro instanceof ErroApi && erro.codigo === 'VALIDACAO' && Object.keys(erro.campos).length > 0) {
        return recusar(erro.campos)
      }
      setErroGeral(mensagemDeErro(erro))
    }
  }

  return (
    <Porta nota="Todo acesso por código fica registrado no histórico do paciente, com o nome informado aqui.">
      <h1>Acesso do profissional de saúde</h1>
      <p className="porta__intro">
        O paciente gera um código temporário no resumo para consulta da Nurai. Com ele você vê,
        só para leitura, o histórico reunido e as pendências — sem precisar de conta.
      </p>
      <form className="formulario" noValidate onSubmit={(e) => { void enviar(e) }}
        aria-busy={enviando} data-testid={TID.medicoForm}>
        <Campo
          id="medico-codigo" rotulo="Código de acesso" value={codigo} erro={erros.codigo}
          autoComplete="off" spellCheck={false} autoCapitalize="characters" maxLength={12}
          className="field num" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}
          dica="Seis letras e números, como o paciente recebeu (ex.: K7M4QX)."
          onChange={(e) => { setCodigo(e.target.value); setErros((x) => ({ ...x, codigo: undefined })) }}
          disabled={enviando} data-testid={TID.medicoCodigo}
        />
        <Campo
          id="medico-profissional" rotulo="Seu nome e registro profissional" value={profissional}
          erro={erros.profissional} autoComplete="name" placeholder="Ex.: Dra. Ana Lima — CRM-SP 123456"
          onChange={(e) => { setProfissional(e.target.value); setErros((x) => ({ ...x, profissional: undefined })) }}
          disabled={enviando} data-testid={TID.medicoProfissional}
        />
        <div aria-live="assertive" data-testid={TID.medicoErro}>
          {erroGeral && <Falha mensagem={erroGeral} />}
        </div>
        <button type="submit" className="btn btn--lg" disabled={enviando} data-testid={TID.medicoEntrar}>
          <Icon nome="chave" tamanho={16} /> {enviando ? 'Verificando o código…' : 'Abrir o histórico'}
        </button>
      </form>
    </Porta>
  )
}

function VisaoMedico({ dados, codigo, profissional, aoSair }: Liberado & { aoSair: () => void }) {
  const { paciente, eventos, passos, expiraEm, para } = dados
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  const ordenados = ordenarRecentes(eventos)
  const pendentes = passos.filter((p) => !p.feito)

  const alternar = (id: string, aberto: boolean) => setAbertos((atual) => {
    const novo = new Set(atual)
    if (aberto) novo.add(id)
    else novo.delete(id)
    return novo
  })

  const irPara = (id: string) => {
    alternar(id, true)
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`medico-evento-${id}`)
      alvo?.scrollIntoView({ block: 'center' })
      alvo?.querySelector('summary')?.focus()
    })
  }

  const meta = [paciente.idade !== undefined && `${paciente.idade} anos`].filter(Boolean).join(' · ')

  return (
    <div className="porta grid-paper">
      <header className="porta__topo">
        <span className="medico__marca">
          <Marca tamanho={24} />
          <span className="label">Acesso do profissional · somente leitura</span>
        </span>
        <button type="button" className="btn btn--ghost" onClick={aoSair} data-testid={TID.medicoSair}>
          Encerrar acesso
        </button>
      </header>

      <main className="porta__corpo">
        <div className="medico">
          <section className="medico__cabeca" data-testid={TID.medicoPaciente} aria-label="Paciente">
            <div>
              <p className="label">Paciente</p>
              <h1>{paciente.nome}</h1>
              {meta && <p className="medico__meta num">{meta}</p>}
              {paciente.condicoes.length > 0 && (
                <ul className="medico__condicoes" aria-label="Condições">
                  {paciente.condicoes.map((c) => <li key={c} className="chip">{c}</li>)}
                </ul>
              )}
              <p className="medico__alergias">
                <Icon nome="alerta" tamanho={15} />
                <span>
                  <strong>Alergias:</strong>{' '}
                  {paciente.alergias.length > 0 ? paciente.alergias.join(' · ') : 'nenhuma registrada no histórico'}
                </span>
              </p>
            </div>
          </section>

          <div className="recado" role="note" data-testid={TID.medicoAviso}>
            <Icon nome="cadeado" tamanho={15} />
            <p>
              Acesso temporário até <strong className="num">{expiraEm}</strong>, liberado para {para}.
              Esta consulta, em nome de {profissional}, foi registrada no histórico do paciente.
            </p>
          </div>

          <div className="medico__grade">
            <section className="painel" aria-labelledby="medico-linha">
              <div className="painel__cabeca">
                <h2 id="medico-linha">Linha do tempo</h2>
                <p><span className="num">{eventos.length}</span> registros, do mais recente ao mais antigo. Abra um item para ver resultados e proveniência.</p>
              </div>
              {ordenados.length === 0 ? (
                <Vazio icone="linha" titulo="Nenhum registro ainda" texto="O paciente ainda não reuniu documentos no histórico." />
              ) : (
                <ol className="compacta">
                  {ordenados.map((e) => (
                    <li key={e.id}>
                      <ItemCompacto evento={e} aberto={abertos.has(e.id)} aoAlternar={(a) => alternar(e.id, a)} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className="medico__lateral">
              <section className="painel" aria-labelledby="medico-pendencias" data-testid={TID.medicoPendencias}>
                <div className="painel__cabeca">
                  <h2 id="medico-pendencias">Pendências</h2>
                  <p>Pontas soltas identificadas no cruzamento dos registros.</p>
                </div>
                <ul className="pendencias">
                  {pendentes.map((p) => (
                    <li key={p.id}><strong>{p.titulo}</strong><span>{p.prazo}</span></li>
                  ))}
                  {pendentes.length === 0 && <li>Nenhuma pendência em aberto.</li>}
                </ul>
              </section>

              <ResumoMedico codigo={codigo} profissional={profissional} eventos={eventos} aoAncorar={irPara} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ItemCompacto({ evento: e, aberto, aoAlternar }: { evento: Evento; aberto: boolean; aoAlternar: (a: boolean) => void }) {
  return (
    <details
      id={`medico-evento-${e.id}`} className="compacta__item" open={aberto}
      style={{ ['--c' as string]: FONTES[e.fonte].cor }}
      onToggle={(ev) => aoAlternar((ev.currentTarget as HTMLDetailsElement).open)}
      data-testid={TID.medicoEvento}
    >
      <summary className="compacta__resumo">
        <time className="compacta__data num" dateTime={e.data}>{formatarData(e.data)}</time>
        <span>
          <span className="compacta__titulo">{e.titulo}</span>
          <span className="compacta__onde">{e.instituicao}{e.especialidade ? ` · ${e.especialidade}` : ''}</span>
        </span>
        <ChipSinal sinal={e.sinal} />
      </summary>
      <div className="compacta__corpo">
        <p className="compacta__texto">{e.resumo}</p>
        {e.medidas?.map((m) => <Regua key={m.nome} medida={m} />)}
        <p className="compacta__prov">
          {TIPOS[e.tipo]} · {FONTES[e.fonte].nome} · origem: {e.origem}
          {e.documento ? ` · arquivo ${e.documento}` : ''}
        </p>
      </div>
    </details>
  )
}

function ResumoMedico({ codigo, profissional, eventos, aoAncorar }: {
  codigo: string
  profissional: string
  eventos: Evento[]
  aoAncorar: (id: string) => void
}) {
  const [especialidade, setEspecialidade] = useState('')
  const [resumo, setResumo] = useState<ResumoIa | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<{ mensagem: string; repetivel: boolean } | null>(null)

  const gerar = async () => {
    if (gerando) return
    setGerando(true)
    setErro(null)
    try {
      setResumo(await api.resumoMedico(codigo, profissional, especialidade.trim() || undefined))
    } catch (e) {
      setErro({ mensagem: mensagemDeErro(e), repetivel: podeRepetir(e) })
    } finally {
      setGerando(false)
    }
  }

  const evento = (id: string) => eventos.find((e) => e.id === id)

  return (
    <section className="painel" aria-labelledby="medico-resumo">
      <div className="painel__cabeca">
        <h2 id="medico-resumo">Resumo pré-consulta</h2>
        <p>Síntese gerada por IA a partir do histórico. Organiza o contexto; não é laudo nem conduta.</p>
      </div>
      <div className="medico__especialidade">
        <label htmlFor="medico-especialidade" className="campo__rotulo">
          Especialidade <span className="campo__opcional">(opcional)</span>
        </label>
        <input
          id="medico-especialidade" className="field" value={especialidade} disabled={gerando}
          placeholder="Ex.: Cardiologia" onChange={(e) => setEspecialidade(e.target.value)}
        />
      </div>
      <button
        type="button" className="btn" disabled={gerando || eventos.length === 0}
        onClick={() => { void gerar() }} data-testid={TID.medicoGerarResumo}
      >
        <Icon nome="copiloto" tamanho={16} />
        {gerando ? 'Gerando resumo…' : resumo ? 'Gerar de novo' : 'Gerar resumo pré-consulta'}
      </button>

      <div className="sintese-ia" aria-live="polite" aria-busy={gerando} data-testid={TID.medicoResumo}
        style={{ marginTop: 'var(--sp-4)' }}>
        {gerando && (
          <div className="sintese-ia__carregando">
            <span className="sr-only">Gerando o resumo</span>
            <span className="esqueleto" style={{ width: '90%' }} />
            <span className="esqueleto" style={{ width: '76%' }} />
            <span className="esqueleto" style={{ width: '84%' }} />
          </div>
        )}
        {erro && !gerando && <Falha mensagem={erro.mensagem} aoTentar={erro.repetivel ? () => { void gerar() } : undefined} />}
        {resumo && !gerando && (
          <>
            {resumo.sintese.map((p, i) => <p key={i} className="sintese-ia__texto">{p}</p>)}
            {resumo.pontos.length > 0 && (
              <ul className="sintese-ia__pontos">
                {resumo.pontos.map((p, i) => (
                  <li key={i}>
                    <p>{p.texto}</p>
                    <div className="sintese-ia__ancoras">
                      {p.ancoras.map((id) => {
                        const e = evento(id)
                        if (!e) return null
                        return (
                          <button key={id} type="button" className="chip chip--botao" onClick={() => aoAncorar(id)}>
                            <span className="num">{formatarData(e.data)}</span> · {e.titulo}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {resumo.perguntasSugeridas.length > 0 && (
              <>
                <p className="label">Pontos para investigar na consulta</p>
                <ul className="sintese-ia__perguntas">
                  {resumo.perguntasSugeridas.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </>
            )}
            {resumo.aviso && <AvisoIa>{resumo.aviso}</AvisoIa>}
            <SeloIa geradoPor={resumo.geradoPor} />
          </>
        )}
      </div>
    </section>
  )
}
