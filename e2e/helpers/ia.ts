import { expect, type Page, type Response } from '@playwright/test'
import type { Evento } from '../../src/data/types.ts'

const DATA_BR = /\b\d{2}\/\d{2}\/\d{4}\b/g

const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const hojeBR = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/* Texto que chega à paciente: sem ids crus ("[e21]", "mv08"), sem data ISO e sem data que não
   esteja no histórico — uma data fora dele é sinal de resposta sobre registros que ela não tem. */
export function afirmarTextoDeIa(textos: string[], eventos: Evento[], onde: string) {
  const texto = textos.join('\n')
  expect(texto, `${onde}: marcador de id no texto`).not.toMatch(/\[\s*[a-z]{1,2}\d+/i)
  for (const { id } of eventos) expect(texto, `${onde}: id cru "${id}"`).not.toMatch(new RegExp(`\\b${id}\\b`))
  expect(texto, `${onde}: data ISO`).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/)
  const conhecidas = new Set([
    hojeBR(),
    ...eventos.flatMap((e) => [dataBR(e.data), ...(`${e.titulo} ${e.resumo}`.match(DATA_BR) ?? [])]),
  ])
  const estranhas = (texto.match(DATA_BR) ?? []).filter((d) => !conhecidas.has(d))
  expect(estranhas, `${onde}: datas que não estão no histórico`).toEqual([])
}

export function afirmarAncoras(ancoras: string[], eventos: Evento[], onde: string) {
  const ids = new Set(eventos.map((e) => e.id))
  expect(ancoras.filter((a) => !ids.has(a)), `${onde}: âncoras que não apontam para registros`).toEqual([])
}

export const respostaDe = (page: Page, metodo: string, caminho: string | RegExp) =>
  page.waitForResponse((r: Response) => {
    const { pathname } = new URL(r.url())
    return r.request().method() === metodo && (typeof caminho === 'string' ? pathname === caminho : caminho.test(pathname))
  })
