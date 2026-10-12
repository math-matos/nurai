import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PACIENTE, PROXIMOS_PASSOS,
} from '../../src/data/seed.js'
import { PAPEL_TITULAR, type EstadoRepositorio, type ModoOnboarding, type NovoPaciente } from './repo.js'

export type DadosIniciais = Omit<EstadoRepositorio, 'compartilhamento'>

/* Histórico de exemplo copiado para o paciente: as ações da titular no log passam a levar o nome de quem
   usa a conta (o paciente ou o responsável, com o papel dele). */
export function dadosExemplo(titular: string, papel = PAPEL_TITULAR): DadosIniciais {
  return structuredClone({
    eventos: EVENTOS,
    consentimentos: CONSENTIMENTOS,
    acessos: ACESSOS.map((a) => (a.papel === PAPEL_TITULAR ? { ...a, quem: titular, papel } : a)),
    passos: PROXIMOS_PASSOS,
    fontes: FONTES_CONECTADAS,
  })
}

export const dadosVazios = (): DadosIniciais =>
  ({ eventos: [], consentimentos: [], acessos: [], passos: [], fontes: [] })

export const dadosIniciais = (modo: ModoOnboarding | 'pendente', titular: string, papel = PAPEL_TITULAR) =>
  (modo === 'exemplo' ? dadosExemplo(titular, papel) : dadosVazios())

/* Conta de demonstração: o perfil acompanha o histórico de exemplo para a IA ter idade e condições. */
export const PERFIL_DEMO: NovoPaciente = {
  nome: 'Visitante',
  dataNascimento: PACIENTE.nascimento,
  condicoes: PACIENTE.condicoes,
  alergias: PACIENTE.alergias,
  convidado: true,
}
