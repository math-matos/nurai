import { MEDICACOES } from '../../src/data/seed.js'
import { normalizar } from './casos/comum.js'

/* Guardrails no servidor: o prompt pede, mas o modelo às vezes devolve passo de conduta
   ("Confirmar ... a manutenção da rivaroxabana") ou esquece o aviso numa pergunta sobre remédio. */

export const AVISO_MEDICO = 'Qualquer decisão sobre remédios ou tratamento deve ser confirmada com o seu médico ou com a equipe que acompanha você.'

const REMEDIOS = MEDICACOES.map((m) => normalizar(m.nome))
const GENERICOS = ['doses?', 'medicament\\w*', 'medicac\\w*', 'remedio\\w*', 'anticoagula\\w*', 'insulina', 'estatina']
const ALVO = `(?:${[...REMEDIOS, ...GENERICOS, 'tratamento\\w*'].join('|')})`
/* Infinitivo/imperativo e "manutenção" = recomendação. Particípio ("iniciada", "mantida") é fato
   histórico do registro e passa. */
const VERBO = '(?:manter|mantenha|manutencao|continuar|continue|suspender|suspenda|suspensao|parar|pare|interromper|interrompa|iniciar|inicie|comecar|comece|aumentar|aumente|reduzir|reduza|diminuir|diminua|trocar|troque|substituir|substitua|ajustar|alterar|altere|mudar|mude|modificar|modifique|retirar|retire)'
const CONDUTA = new RegExp(`\\b${VERBO}\\b[^.;]{0,40}\\b${ALVO}`)
/* Substantivo de mudança + remédio ("necessidade de ajuste da metformina"). Sem "tratamento":
   "ajuste de tratamento" nomeia uma consulta antiga do histórico. */
const MUDANCA = '(?:ajustes?|alteracao|alteracoes|trocas?|suspensao|aumento|reducao|diminuicao|mudanca|substituicao|interrupcao|retirada)'
const MEDICAMENTO = `(?:${[...REMEDIOS, ...GENERICOS].join('|')})`
const CONDUTA_NOMINAL = new RegExp(`\\b${MUDANCA}\\s+(?:d[aoe]s?|n[ao]s?)\\s+(?:[^\\s.;]+\\s+){0,3}?${MEDICAMENTO}\\b`)
const PERGUNTA_MEDICAMENTO = new RegExp(`\\b(?:${[...REMEDIOS, 'remedio', 'medicament', 'medicac', 'dose', 'tomar', 'tomo', 'parar', 'suspender', 'interromper', 'trocar', 'tratamento', 'anticoagul'].join('|')})`)

/* "Confirmar a dosagem de losartana com o médico" (visto em produção, prioridade alta): conferir,
   rever ou discutir dose é decisão de conduta, mesmo sem verbo de mudança. */
const SOBRE_DOSE = /\b(?:confirm|verific|avali|revis|rever|chec|discut|reavali|defin|pergunt|consult)\w*\b[^.;]{0,40}\b(?:dosage(?:m|ns)|doses?|posologia)\b/

export function recomendaConduta(texto: string): boolean {
  const t = normalizar(texto)
  return CONDUTA.test(t) || CONDUTA_NOMINAL.test(t) || SOBRE_DOSE.test(t)
}

export const envolveMedicamento = (pergunta: string) => PERGUNTA_MEDICAMENTO.test(normalizar(pergunta))

export function avisoPara(pergunta: string, doModelo: string | null | undefined): string | undefined {
  return doModelo?.trim() || (envolveMedicamento(pergunta) ? AVISO_MEDICO : undefined)
}
