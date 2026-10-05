import { useCallback, useRef, useState } from 'react'
import { mensagemDeErro } from './api'

interface EstadoRequisicao<T> {
  dados: T | null
  erro: string | null
  carregando: boolean
}

/* Uma requisição por vez: o ref barra o duplo clique antes de o botão
   ter tempo de renderizar desabilitado. */
export function useRequisicao<T>() {
  const [estado, setEstado] = useState<EstadoRequisicao<T>>({ dados: null, erro: null, carregando: false })
  const emCurso = useRef(false)

  const executar = useCallback(async (acao: () => Promise<T>): Promise<T | null> => {
    if (emCurso.current) return null
    emCurso.current = true
    setEstado((e) => ({ ...e, erro: null, carregando: true }))
    try {
      const dados = await acao()
      setEstado({ dados, erro: null, carregando: false })
      return dados
    } catch (erro) {
      setEstado((e) => ({ ...e, erro: mensagemDeErro(erro), carregando: false }))
      return null
    } finally {
      emCurso.current = false
    }
  }, [])

  const limpar = useCallback(() => setEstado({ dados: null, erro: null, carregando: false }), [])

  return { ...estado, executar, limpar }
}
