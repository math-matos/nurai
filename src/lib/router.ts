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

/* Troca a rota sem deixar a anterior no histórico: guarda de acesso não pode
   prender o botão Voltar num redirecionamento em laço. */
export function redirecionar(para: string) {
  if (lerRota() === para) return
  window.location.replace(`#${para}`)
}

/* '/entrar?volta=/app/fontes' → caminho '/entrar' + parâmetros. */
export function separarRota(rota: string) {
  const [caminho, busca = ''] = rota.split('?')
  return { caminho: caminho || '/', parametros: new URLSearchParams(busca) }
}

/* Só aceita voltar para dentro do app: o parâmetro vem da URL e não merece confiança. */
export function destinoSeguro(volta: string | null, padrao = '/app/linha') {
  return volta && /^\/app(\/[\w-]*)*$/.test(volta) ? volta : padrao
}
