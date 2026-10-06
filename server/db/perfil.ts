import { hojeIso } from './datas.js'
import type { AtualizacaoPerfil, NovoPaciente, Onboarding, Perfil } from './repo.js'

export type PerfilGravado = Omit<Perfil, 'iniciais' | 'idade'>

export function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean)
  const letras = palavras.length > 1 ? [palavras[0], palavras.at(-1)!] : palavras
  return letras.map((p) => p[0]).join('').toUpperCase()
}

export function idadeEm(dataNascimento: string, hoje = hojeIso()): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number)
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number)
  const fezAniversario = mesHoje > mes || (mesHoje === mes && diaHoje >= dia)
  return anoHoje - ano - (fezAniversario ? 0 : 1)
}

export function montarPerfil(g: PerfilGravado): Perfil {
  return {
    ...g,
    iniciais: iniciaisDe(g.nome),
    ...(g.dataNascimento && { idade: idadeEm(g.dataNascimento) }),
  }
}

/* O Oracle grava '' como NULL: string opcional vazia vira campo ausente nos dois repositórios. */
const opcional = (v: string | undefined) => (v ? v : undefined)

function semIndefinidos<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

export function perfilNovo(pacienteId: string, dados: NovoPaciente, onboarding: Onboarding = 'pendente'): PerfilGravado {
  return semIndefinidos({
    pacienteId,
    nome: dados.nome,
    dataNascimento: opcional(dados.dataNascimento),
    condicoes: dados.condicoes ?? [],
    alergias: dados.alergias ?? [],
    cartaoSus: opcional(dados.cartaoSus),
    plano: opcional(dados.plano),
    onboarding,
    convidado: dados.convidado,
  })
}

export function perfilAtualizado(atual: PerfilGravado, m: AtualizacaoPerfil): PerfilGravado {
  const texto = (novo: string | undefined, antigo: string | undefined) => (novo === undefined ? antigo : opcional(novo))
  return semIndefinidos({
    ...atual,
    nome: m.nome ?? atual.nome,
    dataNascimento: texto(m.dataNascimento, atual.dataNascimento),
    condicoes: m.condicoes ?? atual.condicoes,
    alergias: m.alergias ?? atual.alergias,
    cartaoSus: texto(m.cartaoSus, atual.cartaoSus),
    plano: texto(m.plano, atual.plano),
  })
}
