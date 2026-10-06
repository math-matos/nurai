import { useState } from 'react'
import { mensagemDeErro } from '../lib/api'
import { navegar } from '../lib/router'
import { entrarDemo } from '../lib/store'
import { TID } from '../lib/testids'
import { Falha } from './ui'

/* Cria uma conta convidada com o histórico de exemplo e entra direto no app. */
export function BotaoDemo({ className = 'btn btn--ghost', rotulo = 'Experimentar sem cadastro', children }: {
  className?: string
  rotulo?: string
  children?: React.ReactNode
}) {
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const experimentar = async () => {
    if (entrando) return
    setEntrando(true)
    setErro(null)
    try {
      await entrarDemo()
      navegar('/app/linha')
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEntrando(false)
    }
  }

  return (
    <>
      <button
        type="button" className={className} disabled={entrando} aria-busy={entrando}
        data-testid={TID.botaoDemo} onClick={() => { void experimentar() }}
      >
        {entrando ? 'Preparando a demonstração…' : rotulo}
        {!entrando && children}
      </button>
      {erro && <Falha mensagem={erro} />}
    </>
  )
}
