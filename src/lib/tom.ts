import type { Perfil } from './api'
import { usePerfil } from './store'

type Genero = 'm' | 'f' | 'mp' | 'fp'
const POSSESSIVO: Record<Genero, string> = { m: 'seu', f: 'sua', mp: 'seus', fp: 'suas' }

export const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* Com responsável, a conta é de quem cuida e o histórico é de outra pessoa: "seu histórico" vira
   "histórico de Marcos". Sem responsável os textos ficam como estão. */
export function tomDe(perfil: Perfil) {
  const nome = perfil.responsavel ? perfil.nome.trim().split(/\s+/)[0] : null
  return {
    /* Primeiro nome do paciente quando a conta é de um cuidador. */
    nome,
    /* dono('histórico') → "seu histórico" | "histórico de Marcos"; dono('pendências', 'fp') → "suas pendências". */
    dono: (coisa: string, genero: Genero = 'm') => (nome ? `${coisa} de ${nome}` : `${POSSESSIVO[genero]} ${coisa}`),
    /* Quem é atendido pelo profissional: "você" | "Marcos". */
    paciente: nome ?? 'você',
  }
}

export type Tom = ReturnType<typeof tomDe>

export const useTom = () => tomDe(usePerfil())
