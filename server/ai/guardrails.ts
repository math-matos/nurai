import { MEDICACOES } from '../../src/data/seed.js'
import { normalizar } from './casos/comum.js'

/* Guardrails no servidor: o prompt pede, mas o modelo às vezes devolve passo de conduta
   ("Confirmar ... a manutenção da rivaroxabana") ou esquece o aviso numa pergunta sobre remédio. */

export const AVISO_MEDICO = 'Qualquer decisão sobre remédios ou tratamento deve ser confirmada com o seu médico ou com a equipe que acompanha você.'

const REMEDIOS = MEDICACOES.map((m) => normalizar(m.nome))
const ALVO = `(?:${[...REMEDIOS, 'dose', 'medicament\\w*', 'medicac\\w*', 'remedio\\w*', 'tratamento\\w*', 'anticoagula\\w*', 'insulina', 'estatina'].join('|')})`
/* Infinitivo/imperativo e "manutenção" = recomendação. Particípio ("iniciada", "mantida") é fato
   histórico do registro e passa; "ajuste"/"troca" ficam de fora porque nomeiam consultas antigas. */
const VERBO = '(?:manter|mantenha|manutencao|continuar|continue|suspender|suspenda|suspensao|parar|pare|interromper|interrompa|iniciar|inicie|comecar|comece|aumentar|aumente|reduzir|reduza|diminuir|diminua|trocar|troque|substituir|substitua|ajustar|retirar|retire)'
const CONDUTA = new RegExp(`\\b${VERBO}\\b[^.;]{0,40}\\b${ALVO}`)
const PERGUNTA_MEDICAMENTO = new RegExp(`\\b(?:${[...REMEDIOS, 'remedio', 'medicament', 'medicac', 'dose', 'tomar', 'tomo', 'parar', 'suspender', 'interromper', 'trocar', 'tratamento', 'anticoagul'].join('|')})`)

export const recomendaConduta = (texto: string) => CONDUTA.test(normalizar(texto))

export const envolveMedicamento = (pergunta: string) => PERGUNTA_MEDICAMENTO.test(normalizar(pergunta))

export function avisoPara(pergunta: string, doModelo: string | null | undefined): string | undefined {
  return doModelo?.trim() || (envolveMedicamento(pergunta) ? AVISO_MEDICO : undefined)
}
