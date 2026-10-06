export type FonteId =
  | 'sus' | 'laboratorio' | 'hospital' | 'clinica' | 'operadora' | 'paciente'

export type TipoId =
  | 'exame' | 'consulta' | 'imagem' | 'cirurgia' | 'medicacao'
  | 'internacao' | 'vacina' | 'documento'

export type Sinal = 'normal' | 'atencao' | 'alterado' | 'info'

export type Origem = 'RNDS' | 'API da instituição' | 'OCR + IA' | 'Registro manual'

export interface Medida {
  nome: string
  valor: number
  unidade: string
  /* Faixa de referência: o laudo pode trazer só um lado ("< 130", "> 40"); ao menos um existe. */
  refMin?: number
  refMax?: number
  sinal: Sinal
}

export interface Evento {
  id: string
  data: string           // ISO — AAAA-MM-DD
  tipo: TipoId
  titulo: string
  instituicao: string
  fonte: FonteId
  especialidade?: string
  resumo: string
  sinal: Sinal
  medidas?: Medida[]
  tags: string[]
  origem: Origem
  confianca?: number     // 0–1, quando extraído por IA
  documento?: string     // nome do arquivo de origem
  novo?: boolean         // gravado ao anexar; o selo da linha do tempo usa os ids da sessão (store.novos)
}

export interface Consentimento {
  id: string
  instituicao: string
  fonte: FonteId
  escopo: string
  ativo: boolean
  desde: string
}

export interface AcessoLog {
  id: string
  quando: string
  quem: string
  papel: string
  acao: string
  itens: string
}

export interface ProximoPasso {
  id: string
  titulo: string
  porque: string
  ancoras: string[]      // ids de eventos que sustentam a recomendação
  prazo: string
  prioridade: 'alta' | 'media' | 'baixa'
  feito: boolean
}

export interface Centro {
  id: string
  nome: string
  cidade: string
  foco: string
  motivo: string
  distancia: string
  convenio: string
}

export interface Ensaio {
  id: string
  codigo: string
  titulo: string
  fase: string
  local: string
  match: number          // 0–100
  criterios: { texto: string; atende: boolean | null }[]
}
