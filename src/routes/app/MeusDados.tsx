import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Campo } from '../../components/Campo'
import { Icon } from '../../components/Icon'
import { Falha } from '../../components/ui'
import { ErroApi, mensagemDeErro, type MudancasPerfil, type Perfil } from '../../lib/api'
import { focarPrimeiroErro } from '../../lib/formulario'
import { atualizarPerfil, excluirConta, isoHoje } from '../../lib/store'
import { TID } from '../../lib/testids'

type CampoPerfil = 'nome' | 'dataNascimento' | 'condicoes' | 'alergias' | 'cartaoSus' | 'plano'
type Erros = Partial<Record<CampoPerfil, string>>

const ORDEM: { campo: CampoPerfil; id: string }[] = [
  { campo: 'nome', id: 'perfil-nome' },
  { campo: 'dataNascimento', id: 'perfil-nascimento' },
  { campo: 'condicoes', id: 'perfil-condicoes' },
  { campo: 'alergias', id: 'perfil-alergias' },
  { campo: 'cartaoSus', id: 'perfil-sus' },
  { campo: 'plano', id: 'perfil-plano' },
]

const linhas = (texto: string) => texto.split('\n').map((l) => l.trim()).filter(Boolean)

/* O servidor aponta erro de item de lista como "condicoes.2": a mensagem vai para o campo da lista. */
function errosDoServidor(campos: Record<string, string>): Erros {
  return Object.fromEntries(Object.entries(campos).map(([chave, msg]) => [chave.split('.')[0], msg])) as Erros
}

function formularioDe(p: Perfil) {
  return {
    nome: p.nome,
    dataNascimento: p.dataNascimento ?? '',
    condicoes: p.condicoes.join('\n'),
    alergias: p.alergias.join('\n'),
    cartaoSus: p.cartaoSus ?? '',
    plano: p.plano ?? '',
  }
}

export function MeusDados({ perfil }: { perfil: Perfil }) {
  const [form, setForm] = useState(() => formularioDe(perfil))
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const mudar = (campo: CampoPerfil, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    setSalvo(false)
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const recusar = (novos: Erros) => {
    flushSync(() => setErros(novos))
    focarPrimeiroErro(ORDEM, novos)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    setErroGeral(null)
    setSalvo(false)
    const locais: Erros = {
      ...(form.nome.trim() === '' && { nome: 'Informe o nome' }),
      ...(form.dataNascimento > isoHoje() && { dataNascimento: 'A data de nascimento não pode estar no futuro' }),
    }
    if (Object.keys(locais).length > 0) return recusar(locais)

    /* '' remove o opcional no servidor. */
    const mudancas: MudancasPerfil = {
      nome: form.nome.trim(),
      dataNascimento: form.dataNascimento,
      condicoes: linhas(form.condicoes),
      alergias: linhas(form.alergias),
      cartaoSus: form.cartaoSus.trim(),
      plano: form.plano.trim(),
    }
    setSalvando(true)
    try {
      const atualizado = await atualizarPerfil(mudancas)
      setForm(formularioDe(atualizado))
      setSalvo(true)
      setSalvando(false)
    } catch (erro) {
      flushSync(() => setSalvando(false))
      if (erro instanceof ErroApi && erro.codigo === 'VALIDACAO' && Object.keys(erro.campos).length > 0) {
        recusar(errosDoServidor(erro.campos))
      } else {
        setErroGeral(mensagemDeErro(erro))
      }
    }
  }

  return (
    <section className="painel" aria-labelledby="meus-dados">
      <div className="painel__cabeca">
        <h2 id="meus-dados">Meus dados</h2>
        <p>
          Identificação usada no resumo para consulta e no contexto da IA. Só o nome é
          obrigatório; deixar um campo em branco remove a informação.
        </p>
      </div>
      <form className="formulario meus-dados" noValidate onSubmit={(e) => { void salvar(e) }}
        aria-busy={salvando} data-testid={TID.perfilForm}>
        <div className="meus-dados__grade">
          <Campo id="perfil-nome" rotulo="Nome" value={form.nome} erro={erros.nome} autoComplete="name"
            onChange={(e) => mudar('nome', e.target.value)} disabled={salvando} />
          <Campo id="perfil-nascimento" rotulo="Data de nascimento" type="date" opcional max={isoHoje()}
            value={form.dataNascimento} erro={erros.dataNascimento}
            onChange={(e) => mudar('dataNascimento', e.target.value)} disabled={salvando} />
          <Campo id="perfil-sus" rotulo="Cartão SUS" opcional value={form.cartaoSus} erro={erros.cartaoSus}
            inputMode="numeric" onChange={(e) => mudar('cartaoSus', e.target.value)} disabled={salvando} />
          <Campo id="perfil-plano" rotulo="Plano de saúde" opcional value={form.plano} erro={erros.plano}
            onChange={(e) => mudar('plano', e.target.value)} disabled={salvando} />
        </div>
        <div className="meus-dados__grade">
          <AreaLista id="perfil-condicoes" rotulo="Condições de saúde" valor={form.condicoes} erro={erros.condicoes}
            exemplo="Ex.: Diabetes tipo 2" aoMudar={(v) => mudar('condicoes', v)} desabilitado={salvando} />
          <AreaLista id="perfil-alergias" rotulo="Alergias" valor={form.alergias} erro={erros.alergias}
            exemplo="Ex.: Dipirona — urticária" aoMudar={(v) => mudar('alergias', v)} desabilitado={salvando} />
        </div>
        <div aria-live="polite">
          {erroGeral && <Falha mensagem={erroGeral} />}
          {salvo && (
            <p className="meus-dados__salvo" data-testid={TID.perfilSalvo}>
              <Icon nome="check" tamanho={14} /> Dados salvos.
            </p>
          )}
        </div>
        <button type="submit" className="btn" disabled={salvando} data-testid={TID.perfilSalvar}>
          {salvando ? 'Salvando…' : 'Salvar meus dados'}
        </button>
      </form>
    </section>
  )
}

function AreaLista({ id, rotulo, valor, erro, exemplo, aoMudar, desabilitado }: {
  id: string
  rotulo: string
  valor: string
  erro?: string
  exemplo: string
  aoMudar: (v: string) => void
  desabilitado: boolean
}) {
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <label htmlFor={id} className="campo__rotulo">{rotulo} <span className="campo__opcional">(opcional)</span></label>
      <textarea
        id={id} className="field" rows={4} value={valor} placeholder={exemplo} disabled={desabilitado}
        aria-invalid={erro ? true : undefined} aria-describedby={`${id}-dica${erro ? ` ${id}-erro` : ''}`}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <p id={`${id}-dica`} className="campo__dica">Uma por linha.</p>
      {erro && <p id={`${id}-erro`} className="campo__erro">{erro}</p>}
    </div>
  )
}

const PALAVRA = 'EXCLUIR'

export function ExcluirConta({ convidado }: { convidado: boolean }) {
  const [confirmando, setConfirmando] = useState(false)
  const [digitado, setDigitado] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const excluir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (excluindo || digitado.trim() !== PALAVRA) return
    setExcluindo(true)
    setErro(null)
    try {
      await excluirConta()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setExcluindo(false)
    }
  }

  const cancelar = () => {
    setConfirmando(false)
    setDigitado('')
    setErro(null)
  }

  return (
    <section className="painel painel--perigo" aria-labelledby="excluir-conta">
      <div className="painel__cabeca">
        <h2 id="excluir-conta">Excluir minha conta</h2>
        <p>
          Apaga {convidado ? 'esta conta de demonstração' : 'a sua conta'}, todo o histórico,
          as permissões, os acessos compartilhados e o registro de acessos. Não dá para desfazer.
        </p>
      </div>
      {confirmando ? (
        <form className="formulario excluir" noValidate onSubmit={(e) => { void excluir(e) }} aria-busy={excluindo}>
          <Campo
            id="excluir-confirmacao" rotulo={`Para confirmar, digite ${PALAVRA}`} value={digitado}
            autoComplete="off" spellCheck={false} autoFocus disabled={excluindo}
            onChange={(e) => setDigitado(e.target.value)} data-testid={TID.excluirConfirmacao}
          />
          <div aria-live="assertive">{erro && <Falha mensagem={erro} />}</div>
          <div className="excluir__acoes">
            <button
              type="submit" className="btn btn--perigo" data-testid={TID.excluirBotao}
              disabled={excluindo || digitado.trim() !== PALAVRA}
            >
              {excluindo ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancelar} disabled={excluindo}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--ghost btn--perigo-leve" onClick={() => setConfirmando(true)}>
          Excluir minha conta
        </button>
      )}
    </section>
  )
}
