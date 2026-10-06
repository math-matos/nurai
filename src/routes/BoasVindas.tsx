import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Campo } from '../components/Campo'
import { Icon } from '../components/Icon'
import { Porta } from '../components/Porta'
import { Falha } from '../components/ui'
import type { ModoOnboarding, PacienteCuidado } from '../lib/api'
import { ErroApi, mensagemDeErro, RELACOES } from '../lib/api'
import { ERRO_AUTORIZACAO, textoDeclaracao } from '../lib/autorizacao'
import { focarPrimeiroErro } from '../lib/formulario'
import { navegar } from '../lib/router'
import { concluirOnboarding, isoHoje, sair, useSessao } from '../lib/store'
import { TID } from '../lib/testids'

type ParaQuem = 'mim' | 'cuidado'
type CampoPaciente = 'nome' | 'dataNascimento' | 'relacao'
type Erros = Partial<Record<CampoPaciente | 'autorizacao', string>>

const ORDEM: { campo: CampoPaciente | 'autorizacao'; id: string }[] = [
  { campo: 'nome', id: 'cuidado-nome' },
  { campo: 'dataNascimento', id: 'cuidado-nascimento' },
  { campo: 'relacao', id: 'cuidado-relacao' },
  { campo: 'autorizacao', id: 'cuidado-autorizacao' },
]

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function validar(p: Record<CampoPaciente, string>, autorizacao: boolean): Erros {
  return {
    ...(p.nome.trim() === '' && { nome: 'Informe o nome de quem você cuida' }),
    ...(p.dataNascimento > isoHoje() && { dataNascimento: 'A data de nascimento não pode estar no futuro' }),
    ...(p.relacao === '' && { relacao: 'Escolha o que você é dessa pessoa' }),
    ...(!autorizacao && { autorizacao: ERRO_AUTORIZACAO }),
  }
}

/* O servidor aponta o erro como "paciente.nome" ou "paciente.autorizacao": a mensagem vai para o campo. */
const errosDoServidor = (campos: Record<string, string>): Erros =>
  Object.fromEntries(Object.entries(campos).map(([chave, msg]) => [chave.split('.').at(-1), msg])) as Erros

export function BoasVindas() {
  const { perfil } = useSessao()
  const [escolhendo, setEscolhendo] = useState<ModoOnboarding | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [paraQuem, setParaQuem] = useState<ParaQuem>('mim')
  const [paciente, setPaciente] = useState<Record<CampoPaciente, string>>({ nome: '', dataNascimento: '', relacao: '' })
  const [autorizacao, setAutorizacao] = useState(false)
  const [erros, setErros] = useState<Erros>({})

  const mudar = (campo: CampoPaciente, valor: string) => {
    setPaciente((p) => ({ ...p, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const recusar = (novos: Erros) => {
    flushSync(() => setErros(novos))
    focarPrimeiroErro(ORDEM, novos)
  }

  const escolher = async (modo: ModoOnboarding) => {
    if (escolhendo) return
    let cuidado: PacienteCuidado | undefined
    if (paraQuem === 'cuidado') {
      const locais = validar(paciente, autorizacao)
      if (Object.keys(locais).length > 0) return recusar(locais)
      cuidado = {
        nome: paciente.nome.trim(),
        relacao: paciente.relacao,
        autorizacao: true,
        ...(paciente.dataNascimento && { dataNascimento: paciente.dataNascimento }),
      }
    }
    setEscolhendo(modo)
    setErro(null)
    try {
      await concluirOnboarding(modo, cuidado)
      navegar('/app/linha')
    } catch (e) {
      flushSync(() => setEscolhendo(null))
      if (e instanceof ErroApi && e.codigo === 'VALIDACAO' && Object.keys(e.campos).length > 0) {
        recusar(errosDoServidor(e.campos))
      } else {
        setErro(mensagemDeErro(e))
      }
    }
  }

  const primeiroNome = perfil?.nome.split(' ')[0]

  return (
    <Porta largo>
      <h1>Boas-vindas{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
      <p className="porta__intro">
        Como você quer começar? Dá para mudar de ideia depois: no menu do app, o histórico de
        exemplo pode ser reiniciado ou apagado para você recomeçar do zero.
      </p>

      <div className="formulario" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="campo" role="radiogroup" aria-labelledby="para-quem">
          <p id="para-quem" className="campo__rotulo">Para quem é este histórico?</p>
          <div className="escolhas">
            <label className="consentimento" htmlFor="para-mim">
              <input
                id="para-mim" type="radio" name="para-quem" checked={paraQuem === 'mim'} disabled={escolhendo !== null}
                onChange={() => setParaQuem('mim')}
              />
              <span className="consentimento__texto">
                <strong>Para mim</strong> — os documentos e o histórico são meus.
              </span>
            </label>
            <label className="consentimento" htmlFor="para-cuidado">
              <input
                id="para-cuidado" type="radio" name="para-quem" checked={paraQuem === 'cuidado'} disabled={escolhendo !== null}
                onChange={() => setParaQuem('cuidado')}
              />
              <span className="consentimento__texto">
                <strong>Para alguém que eu cuido</strong> — organizo o histórico de outra pessoa, como pai, mãe ou filho.
              </span>
            </label>
          </div>
        </div>

        {paraQuem === 'cuidado' && (
          <>
            <Campo
              id="cuidado-nome" rotulo="Nome de quem você cuida" value={paciente.nome} erro={erros.nome}
              autoComplete="off" disabled={escolhendo !== null} onChange={(e) => mudar('nome', e.target.value)}
              dica="Como aparece nos exames e laudos: é com ele que a Nurai confere de quem é cada documento."
            />
            <Campo
              id="cuidado-nascimento" rotulo="Data de nascimento" type="date" opcional max={isoHoje()}
              value={paciente.dataNascimento} erro={erros.dataNascimento} disabled={escolhendo !== null}
              onChange={(e) => mudar('dataNascimento', e.target.value)}
            />
            <div className={`campo${erros.relacao ? ' campo--erro' : ''}`}>
              <label htmlFor="cuidado-relacao" className="campo__rotulo">O que você é dessa pessoa?</label>
              <select
                id="cuidado-relacao" className="field" value={paciente.relacao} disabled={escolhendo !== null}
                aria-invalid={erros.relacao ? true : undefined}
                aria-describedby={`cuidado-relacao-dica${erros.relacao ? ' cuidado-relacao-erro' : ''}`}
                onChange={(e) => mudar('relacao', e.target.value)}
              >
                <option value="">Escolha…</option>
                {RELACOES.map((r) => <option key={r} value={r}>{maiuscula(r)}</option>)}
              </select>
              <p id="cuidado-relacao-dica" className="campo__dica">
                As ações que você fizer ficam registradas no seu nome, como responsável.
              </p>
              {erros.relacao && <p id="cuidado-relacao-erro" className="campo__erro">{erros.relacao}</p>}
            </div>
            <div className={`campo${erros.autorizacao ? ' campo--erro' : ''}`}>
              <label className="consentimento" htmlFor="cuidado-autorizacao">
                <input
                  id="cuidado-autorizacao" type="checkbox" checked={autorizacao} disabled={escolhendo !== null}
                  aria-invalid={erros.autorizacao ? true : undefined}
                  aria-describedby={erros.autorizacao ? 'cuidado-autorizacao-erro' : undefined}
                  onChange={(e) => {
                    setAutorizacao(e.target.checked)
                    if (erros.autorizacao) setErros((er) => ({ ...er, autorizacao: undefined }))
                  }}
                  data-testid={TID.onboardingAutorizacao}
                />
                <span className="consentimento__texto">{textoDeclaracao(paciente.nome)}</span>
              </label>
              {erros.autorizacao && <p id="cuidado-autorizacao-erro" className="campo__erro">{erros.autorizacao}</p>}
            </div>
          </>
        )}
      </div>

      <div className="escolhas" role="group" aria-label="Ponto de partida" aria-busy={escolhendo !== null}>
        <button
          type="button" className="escolha" disabled={escolhendo !== null}
          onClick={() => { void escolher('vazio') }} data-testid={TID.onboardingVazio}
        >
          <span className="escolha__icone"><Icon nome="anexar" tamanho={20} /></span>
          <span className="escolha__titulo">Começar do zero</span>
          <span className="escolha__texto">
            O histórico começa vazio e cresce com os documentos que você anexar — laudos,
            resultados de exame, receitas. A IA lê cada um e espera a sua conferência antes de gravar.
          </span>
          <span className="escolha__acao">
            {escolhendo === 'vazio' ? 'Preparando…' : <>Começar do zero <Icon nome="seta" tamanho={15} /></>}
          </span>
        </button>

        <button
          type="button" className="escolha" disabled={escolhendo !== null}
          onClick={() => { void escolher('exemplo') }} data-testid={TID.onboardingExemplo}
        >
          <span className="escolha__icone"><Icon nome="linha" tamanho={20} /></span>
          <span className="escolha__titulo">Explorar com histórico de exemplo</span>
          <span className="escolha__texto">
            Carregamos sete anos de registros fictícios de uma paciente com diabetes e arritmia,
            para você ver a linha do tempo, o copiloto e o resumo para consulta funcionando.
            O exemplo pode ser reiniciado ou apagado a qualquer momento.
          </span>
          <span className="escolha__acao">
            {escolhendo === 'exemplo' ? 'Carregando o exemplo…' : <>Explorar o exemplo <Icon nome="seta" tamanho={15} /></>}
          </span>
        </button>
      </div>

      <div aria-live="assertive">{erro && <Falha mensagem={erro} />}</div>

      <div className="porta__rodape">
        <button type="button" className="btn btn--quiet" onClick={() => { void sair() }} disabled={escolhendo !== null}>
          Sair desta conta
        </button>
      </div>
    </Porta>
  )
}
