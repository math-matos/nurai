import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from './Icon'
import { Falha } from './ui'
import { ErroApi, mensagemDeErro, type Perfil } from '../lib/api'
import { ERRO_AUTORIZACAO, textoDeclaracao } from '../lib/autorizacao'
import { focar } from '../lib/formulario'
import { atualizarPerfil } from '../lib/store'
import { TID } from '../lib/testids'

/* Conta cuidador criada antes de a declaração existir: o servidor marca autorizacaoPendente e o app pede a
   declaração aqui, no topo de qualquer tela, até o responsável confirmar. */
export function PedidoAutorizacao({ perfil }: { perfil: Perfil }) {
  const [marcado, setMarcado] = useState(false)
  const [erroCampo, setErroCampo] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [registrada, setRegistrada] = useState(false)
  const responsavel = perfil.responsavel

  if (registrada) {
    return (
      <div className="recado-app" role="status" data-testid={TID.pedidoAutorizacao}>
        <Icon nome="check" tamanho={16} />
        <p>Declaração registrada. Ela aparece em Acessos e consentimento, no registro de acessos.</p>
        <button type="button" className="btn btn--quiet" onClick={() => setRegistrada(false)}>Fechar</button>
      </div>
    )
  }
  if (!responsavel?.autorizacaoPendente) return null

  const recusar = (mensagem: string) => {
    flushSync(() => {
      setEnviando(false)
      setErroCampo(mensagem)
    })
    focar('pedido-autorizacao-caixa')
  }

  const declarar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErroGeral(null)
    if (!marcado) return recusar(ERRO_AUTORIZACAO)
    setEnviando(true)
    try {
      await atualizarPerfil({ responsavel: { nome: responsavel.nome, relacao: responsavel.relacao, autorizacao: true } })
      setRegistrada(true)
    } catch (erro) {
      const campo = erro instanceof ErroApi ? erro.campos['responsavel.autorizacao'] : undefined
      if (campo) return recusar(campo)
      setEnviando(false)
      setErroGeral(mensagemDeErro(erro))
    }
  }

  return (
    <form
      className="pedido-autorizacao" noValidate aria-labelledby="pedido-autorizacao-titulo" aria-busy={enviando}
      onSubmit={(e) => { void declarar(e) }} data-testid={TID.pedidoAutorizacao}
    >
      <h2 id="pedido-autorizacao-titulo">Falta a sua declaração como responsável</h2>
      <p>
        Os dados deste histórico são de saúde de {perfil.nome}, e a LGPD trata dado de saúde como sensível. Para
        seguir organizando o histórico, confirme que você pode cuidar desses dados.
      </p>
      <div className={`campo${erroCampo ? ' campo--erro' : ''}`}>
        <label className="consentimento" htmlFor="pedido-autorizacao-caixa">
          <input
            id="pedido-autorizacao-caixa" type="checkbox" checked={marcado} disabled={enviando}
            aria-invalid={erroCampo ? true : undefined}
            aria-describedby={erroCampo ? 'pedido-autorizacao-erro' : undefined}
            onChange={(e) => {
              setMarcado(e.target.checked)
              setErroCampo(null)
            }}
          />
          <span className="consentimento__texto">{textoDeclaracao(perfil.nome)}</span>
        </label>
        {erroCampo && <p id="pedido-autorizacao-erro" className="campo__erro">{erroCampo}</p>}
      </div>
      <div aria-live="polite">{erroGeral && <Falha mensagem={erroGeral} />}</div>
      <button type="submit" className="btn" disabled={enviando}>
        {enviando ? 'Registrando…' : 'Confirmar declaração'}
      </button>
    </form>
  )
}
