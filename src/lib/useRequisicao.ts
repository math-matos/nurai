import { useCallback, useRef, useState } from 'react'
import { mensagemDeErro, podeRepetir } from './api'

interface EstadoRequisicao<T> {
  dados: T | null
  erro: string | null
  /* Repetir o mesmo pedido pode dar certo (rede, 5xx, IA instável)? */
  repetivel: boolean
  carregando: boolean
}

const INICIAL = { dados: null, erro: null, repetivel: false, carregando: false }

/* Uma requisição por vez: o ref barra o duplo clique antes de o botão
   ter tempo de renderizar desabilitado. */
export function useRequisicao<T>() {
  const [estado, setEstado] = useState<EstadoRequisicao<T>>(INICIAL)
  const emCurso = useRef(false)

  const executar = useCallback(async (acao: () => Promise<T>): Promise<T | null> => {
    if (emCurso.current) return null
    emCurso.current = true
    setEstado((e) => ({ ...e, erro: null, carregando: true }))
    try {
      const dados = await acao()
      setEstado({ dados, erro: null, repetivel: false, carregando: false })
      return dados
    } catch (erro) {
      setEstado((e) => ({ ...e, erro: mensagemDeErro(erro), repetivel: podeRepetir(erro), carregando: false }))
      return null
    } finally {
      emCurso.current = false
    }
  }, [])

  const limpar = useCallback(() => setEstado(INICIAL), [])

  return { ...estado, executar, limpar }
}
