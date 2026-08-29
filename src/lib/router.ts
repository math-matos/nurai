import { useCallback, useEffect, useState } from 'react'

/* Roteador por hash: sem dependências, e o deploy estático continua servindo
   qualquer rota sem configuração de servidor. */

export function lerRota() {
  const bruto = window.location.hash.replace(/^#/, '')
  return bruto === '' ? '/' : bruto
}

export function useRota() {
  const [rota, setRota] = useState(lerRota)

  useEffect(() => {
    const aoMudar = () => setRota(lerRota())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  return rota
}

export function navegar(para: string) {
  if (lerRota() === para) return
  window.location.hash = para
  window.scrollTo({ top: 0 })
}

export function useNavegar() {
  return useCallback((para: string) => navegar(para), [])
}
