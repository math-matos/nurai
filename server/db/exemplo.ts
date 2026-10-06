import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PACIENTE, PROXIMOS_PASSOS,
} from '../../src/data/seed.js'
import type { EstadoRepositorio, ModoOnboarding, NovoPaciente } from './repo.js'

export type DadosIniciais = Omit<EstadoRepositorio, 'compartilhamento'>

/* Histórico de exemplo copiado para o paciente: as ações da titular no log passam a levar o nome dele. */
export function dadosExemplo(titular: string): DadosIniciais {
  return structuredClone({
    eventos: EVENTOS,
    consentimentos: CONSENTIMENTOS,
    acessos: ACESSOS.map((a) => (a.papel === 'Titular' ? { ...a, quem: titular } : a)),
    passos: PROXIMOS_PASSOS,
    fontes: FONTES_CONECTADAS,
  })
}

export const dadosVazios = (): DadosIniciais =>
  ({ eventos: [], consentimentos: [], acessos: [], passos: [], fontes: [] })

export const dadosIniciais = (modo: ModoOnboarding | 'pendente', titular: string) =>
  (modo === 'exemplo' ? dadosExemplo(titular) : dadosVazios())

/* Conta de demonstração: o perfil acompanha o histórico de exemplo para a IA ter idade e condições. */
export const PERFIL_DEMO: NovoPaciente = {
  nome: 'Visitante',
  dataNascimento: PACIENTE.nascimento,
  condicoes: PACIENTE.condicoes,
  alergias: PACIENTE.alergias,
  convidado: true,
}
