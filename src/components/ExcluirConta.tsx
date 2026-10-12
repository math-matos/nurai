import { useState } from 'react'
import { flushSync } from 'react-dom'
import { mensagemDeErro } from '../lib/api'
import { excluirConta } from '../lib/store'
import { TID } from '../lib/testids'
import { Campo } from './Campo'
import { Falha } from './ui'

const PALAVRA = 'excluir'

/* O teclado do celular põe a primeira letra em maiúscula sozinho: "Excluir" e " EXCLUIR " valem. */
const confirmaExclusao = (digitado: string) => digitado.trim().toLowerCase() === PALAVRA

export function ExcluirConta({ convidado }: { convidado: boolean }) {
  const [confirmando, setConfirmando] = useState(false)
  const [digitado, setDigitado] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [erroCampo, setErroCampo] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)

  const excluir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (excluindo) return
    if (!confirmaExclusao(digitado)) {
      flushSync(() => setErroCampo(`Para excluir, digite a palavra “${PALAVRA}” neste campo. Maiúsculas ou minúsculas, tanto faz.`))
      document.getElementById('excluir-confirmacao')?.focus()
      return
    }
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
    setErroCampo(undefined)
    setErro(null)
  }

  return (
    <section className="painel painel--perigo" aria-labelledby="excluir-conta">
      <div className="painel__cabeca">
        <h2 id="excluir-conta" tabIndex={-1}>Excluir minha conta</h2>
        <p>
          Apaga {convidado ? 'esta conta de demonstração' : 'a sua conta'}, todo o histórico,
          as permissões, os acessos compartilhados e o registro de acessos. Não dá para desfazer.
        </p>
      </div>
      {confirmando ? (
        <form className="formulario excluir" noValidate onSubmit={(e) => { void excluir(e) }} aria-busy={excluindo}>
          <Campo
            id="excluir-confirmacao" rotulo={`Para confirmar, digite ${PALAVRA}`} value={digitado}
            erro={erroCampo} autoComplete="off" spellCheck={false} autoFocus disabled={excluindo}
            onChange={(e) => { setDigitado(e.target.value); setErroCampo(undefined) }}
            data-testid={TID.excluirConfirmacao}
          />
          <div aria-live="assertive">{erro && <Falha mensagem={erro} />}</div>
          <div className="excluir__acoes">
            <button type="submit" className="btn btn--perigo" data-testid={TID.excluirBotao} disabled={excluindo}>
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
