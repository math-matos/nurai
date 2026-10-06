import type { Perfil } from '../db/repo.js'

/* Modo cuidador: quem lê é o responsável, e o histórico é do paciente. Visto na simulação: "você já
   realizou", "Seu histórico ainda está vazio" e "minha glicada" para os exames do pai de quem usava o app.
   O prompt pede o paciente na 3ª pessoa pelo primeiro nome; a reescrita abaixo cobre os textos fixos e
   os deslizes óbvios do modelo. Sem responsável, nada muda: fala-se com o próprio paciente ("você"). */

export type PerfilVoz = Pick<Perfil, 'nome' | 'responsavel'>

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]

export function instrucaoDeVoz({ nome, responsavel }: PerfilVoz): string {
  if (!responsavel) return ''
  const n = primeiroNome(nome)
  return `Quem usa o app é ${responsavel.nome} (${responsavel.relacao} de ${n}), que cuida do histórico de ${n}. Os registros são de ${n}, não de quem pergunta. Refira-se a ${n} na 3ª pessoa, pelo primeiro nome (ex.: "${n} realizou o exame em 12/03/2026", "o histórico de ${n}"), e use "você" só para quem cuida (ex.: "você pode levar o laudo à consulta de ${n}"). Nunca escreva "seu histórico", "seus exames", "você realizou" ou "você tem" sobre os dados de ${n}. Perguntas sugeridas são as que o responsável faria ao médico de ${n} (ex.: "A glicada de ${n} melhorou?"), nunca na 1ª pessoa ("minha glicada").`
}

/* Do que é de alguém no histórico: "seu histórico" → "histórico de Marcos". Locuções antes das palavras
   soltas ("hemoglobina glicada" antes de "glicada"). */
const COISAS = [
  'hemoglobina glicada', 'próximos passos', 'histórico', 'registros?', 'exames?', 'resultados?', 'laudos?', 'perfil',
  'médic[oa]s?', 'acompanhamento', 'tratamentos?', 'consultas?', 'dados', 'saúde', 'glicada', 'pressão', 'coração',
  'caso', 'remédios?', 'medicamentos?', 'medicações', 'medicação', 'receitas?', 'diagnósticos?', 'condições', 'alergias',
].join('|')

const ARTIGO: Record<string, string> = { seu: 'o', sua: 'a', seus: 'os', suas: 'as', meu: 'o', minha: 'a', meus: 'os', minhas: 'as' }
const EM: Record<string, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' }
const DE: Record<string, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' }

const POSSESSIVO = '(seus|suas|seu|sua|meus|minhas|meu|minha)'
/* Determinante antes do possessivo ("no seu", "com a sua"): o possessivo sai e o determinante fica. */
const COM_DETERMINANTE = new RegExp(
  `(?<![\\p{L}])(o|a|os|as|no|na|nos|nas|do|da|dos|das|ao|à|aos|às|pelo|pela|pelos|pelas)\\s+${POSSESSIVO}\\s+(${COISAS})(?![\\p{L}])`, 'giu')
/* "em seu", "de sua": a preposição vira contração com o artigo do possessivo. */
const COM_PREPOSICAO = new RegExp(`(?<![\\p{L}])(em|de)\\s+${POSSESSIVO}\\s+(${COISAS})(?![\\p{L}])`, 'giu')
const SOLTO = new RegExp(`(?<![\\p{L}])${POSSESSIVO}\\s+(${COISAS})(?![\\p{L}])`, 'giu')

/* "você já realizou" → "Marcos já realizou": o sujeito dos fatos do histórico é o paciente. */
const VERBOS = [
  'realizou', 'realizava', 'fez', 'faz', 'fazia', 'tinha', 'tem', 'teve', 'tomou', 'toma', 'tomava', 'usa', 'usou',
  'passou', 'esteve', 'está', 'estava', 'recebeu', 'apresentou', 'apresenta', 'coletou', 'colheu', 'iniciou', 'começou',
  'precisou', 'consultou', 'voltou', 'retornou', 'foi', 'ficou', 'possui',
].join('|')
const SUJEITO = new RegExp(`(?<![\\p{L}])você(\\s+(?:já|ainda|não|também|nunca)?\\s*)(${VERBOS})(?![\\p{L}])`, 'giu')
/* "a equipe que acompanha você" → "acompanha Marcos". */
const OBJETO = new RegExp('(?<![\\p{L}])(acompanha|acompanham|atende|atendem|trata|tratam|examinou|examinaram|atendeu)\\s+você(?![\\p{L}])', 'giu')

const comoNoOriginal = (original: string, novo: string) =>
  original[0] === original[0].toUpperCase() ? novo[0].toUpperCase() + novo.slice(1) : novo

export function naVozDoResponsavel(texto: string, perfil: PerfilVoz): string {
  if (!perfil.responsavel) return texto
  const n = primeiroNome(perfil.nome)
  return texto
    .replace(COM_DETERMINANTE, (_, det: string, _pos: string, coisa: string) => `${det} ${coisa} de ${n}`)
    .replace(COM_PREPOSICAO, (_, prep: string, pos: string, coisa: string) => {
      const artigo = ARTIGO[pos.toLowerCase()]
      return comoNoOriginal(prep, `${(prep.toLowerCase() === 'em' ? EM : DE)[artigo]} ${coisa} de ${n}`)
    })
    .replace(SOLTO, (_, pos: string, coisa: string) => comoNoOriginal(pos, `${ARTIGO[pos.toLowerCase()]} ${coisa} de ${n}`))
    .replace(SUJEITO, (_, meio: string, verbo: string) => `${n}${meio}${verbo}`)
    .replace(OBJETO, (_, verbo: string) => `${verbo} ${n}`)
}

export const textosNaVoz = (textos: string[], perfil: PerfilVoz) => textos.map((t) => naVozDoResponsavel(t, perfil))
