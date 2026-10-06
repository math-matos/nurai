import { hojeIso, instanteIso } from './datas.js'
import type { AtualizacaoPerfil, NovoPaciente, Onboarding, Perfil, Responsavel } from './repo.js'

export type PerfilGravado = Omit<Perfil, 'iniciais' | 'idade'>

export function iniciaisDe(nome: string): string {
  const palavras = nome
    .replace(/\([^)]*\)?/g, ' ')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
  const letras = palavras.length > 1 ? [palavras[0], palavras.at(-1)!] : palavras
  return letras.map((p) => p[0]).join('').toUpperCase()
}

export function idadeEm(dataNascimento: string, hoje = hojeIso()): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number)
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number)
  const fezAniversario = mesHoje > mes || (mesHoje === mes && diaHoje >= dia)
  return anoHoje - ano - (fezAniversario ? 0 : 1)
}

/* Só nome, relação e o instante da declaração são gravados (no fuso de Brasília, como o Oracle devolve);
   a pendência é derivada na leitura. */
const responsavelGravado = ({ nome, relacao, autorizadoEm }: Responsavel): Responsavel =>
  ({ nome, relacao, ...(autorizadoEm && { autorizadoEm: instanteIso(new Date(autorizadoEm)) }) })

export function montarPerfil(g: PerfilGravado): Perfil {
  const { responsavel, ...resto } = g
  return {
    ...resto,
    iniciais: iniciaisDe(g.nome),
    ...(g.dataNascimento && { idade: idadeEm(g.dataNascimento) }),
    /* Conta cuidador criada antes da declaração de autorização: o front pede a declaração. */
    ...(responsavel && {
      responsavel: { ...responsavelGravado(responsavel), ...(!responsavel.autorizadoEm && { autorizacaoPendente: true as const }) },
    }),
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
    responsavel: dados.responsavel && responsavelGravado(dados.responsavel),
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
    responsavel: m.responsavel === undefined ? atual.responsavel : m.responsavel ? responsavelGravado({
      /* Trocar nome ou relação não desfaz a declaração já feita; só uma nova declaração muda o instante. */
      ...m.responsavel, autorizadoEm: m.responsavel.autorizadoEm ?? atual.responsavel?.autorizadoEm,
    }) : undefined,
  })
}
