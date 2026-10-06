/* Gabarito dos documentos fictícios: o que a extração (POST /api/extrair) deveria devolver.
   Mantido à mão, separado de modelos.ts — `verificar.ts` prova que os PDFs batem com isto. */
import type { TipoId } from '../../src/data/types.ts'

export type ErroEsperado = 'NAO_CLINICO' | 'PDF_SEM_TEXTO' | 'ARQUIVO_GRANDE' | 'PDF_INVALIDO' | 'NAO_PDF'

export interface MedidaEsperada {
  /* string: o nome normalizado contém o texto; RegExp: testada contra o nome normalizado
     (minúsculas, sem acento). */
  nome: RegExp | string
  valor: number
  tolerancia: number
  unidade?: RegExp | string
  /* Faixa de referência esperada: número = esse limite; null = o limite não pode existir
     (faixa unilateral "> X" guarda só refMin); ausente = não confere. */
  refMin?: number | null
  refMax?: number | null
}

export interface ExtracaoEsperada {
  /* Mais de uma data aceitável quando o documento tem coleta/emissão ou entrada/alta. */
  data?: string | string[]
  tipo?: TipoId | TipoId[]
  medidas?: MedidaEsperada[]
  /* Termos que precisam aparecer no texto do documento (e, idealmente, no título/resumo). */
  palavrasChave?: string[]
}

export interface Gabarito {
  arquivo: string
  modo: 'pdf' | 'texto'
  descricao: string
  esperado: ExtracaoEsperada | { erro: ErroEsperado }
}

const hemogramaBase = (v: {
  hemacias: number
  hemoglobina: number
  hematocrito: number
  vcm: number
  hcm: number
  chcm: number
  rdw: number
  leucocitos: number
  eosinofilos: number
  plaquetas: number
}): MedidaEsperada[] => [
  { nome: /hemacias|eritrocitos/, valor: v.hemacias, tolerancia: 0.01 },
  {
    nome: /^(hemoglobina|hb)\b(?!.*(corpuscular|glicada))/,
    valor: v.hemoglobina,
    tolerancia: 0.05,
    unidade: 'g/dl',
  },
  {
    nome: /hematocrito|^ht\b/,
    valor: v.hematocrito,
    tolerancia: 0.05,
    unidade: '%',
  },
  {
    nome: /\bvcm\b|volume corpuscular/,
    valor: v.vcm,
    tolerancia: 0.05,
    unidade: 'fl',
  },
  {
    nome: /(^|[^c])hcm\b|^hemoglobina corpuscular/,
    valor: v.hcm,
    tolerancia: 0.05,
    unidade: 'pg',
  },
  { nome: /chcm|concentracao/, valor: v.chcm, tolerancia: 0.05 },
  { nome: /\brdw\b/, valor: v.rdw, tolerancia: 0.05, unidade: '%' },
  { nome: /leucocitos/, valor: v.leucocitos, tolerancia: 0.01 },
  { nome: /eosinofilos/, valor: v.eosinofilos, tolerancia: 0.05, unidade: '%' },
  { nome: /plaquetas/, valor: v.plaquetas, tolerancia: 0.5 },
]

export const GABARITOS: Gabarito[] = [
  {
    arquivo: '01-hemograma-2026-03-10.pdf',
    modo: 'pdf',
    descricao: 'Hemograma completo, faixas bilaterais, eosinófilos acima da referência',
    esperado: {
      data: '2026-03-10',
      tipo: 'exame',
      medidas: hemogramaBase({
        hemacias: 4.85,
        hemoglobina: 14.6,
        hematocrito: 43.8,
        vcm: 90.3,
        hcm: 30.1,
        chcm: 33.3,
        rdw: 13.1,
        leucocitos: 7.2,
        eosinofilos: 7.8,
        plaquetas: 245,
      }),
    },
  },
  {
    arquivo: '02-perfil-lipidico-2026-03-12.pdf',
    modo: 'pdf',
    descricao: 'Perfil lipídico com faixas unilaterais "< X" e HDL "> 40"',
    esperado: {
      data: '2026-03-12',
      tipo: 'exame',
      medidas: [
        {
          nome: /colesterol total/,
          valor: 212,
          tolerancia: 0.5,
          unidade: 'mg/dl',
        },
        { nome: /\bldl\b/, valor: 138, tolerancia: 0.5, unidade: 'mg/dl' },
        { nome: /triglicer/, valor: 180, tolerancia: 0.5, unidade: 'mg/dl' },
        {
          nome: /\bhdl\b/,
          valor: 38,
          tolerancia: 0.5,
          unidade: 'mg/dl',
          refMin: 40,
          refMax: null,
        },
      ],
    },
  },
  {
    arquivo: '03-glicemia-hba1c-2026-03-19.pdf',
    modo: 'pdf',
    descricao: 'Glicemia de jejum normal e HbA1c em faixa de pré-diabetes',
    esperado: {
      data: '2026-03-19',
      tipo: 'exame',
      medidas: [
        {
          nome: /glicemia|glicose/,
          valor: 99,
          tolerancia: 0.5,
          unidade: 'mg/dl',
        },
        {
          nome: /glicada|hba1c|a1c/,
          valor: 5.8,
          tolerancia: 0.05,
          unidade: '%',
        },
      ],
    },
  },
  {
    arquivo: '04-raio-x-torax-2026-04-20.pdf',
    modo: 'pdf',
    descricao: 'Laudo de radiografia de tórax em texto livre, sem medidas',
    esperado: {
      data: '2026-04-20',
      tipo: 'imagem',
      medidas: [],
      palavrasChave: ['tórax', 'peribrônquico'],
    },
  },
  {
    arquivo: '05-receita-2026-04-22.pdf',
    modo: 'pdf',
    descricao: 'Receita: losartana 50 mg 1x/dia e budesonida/formoterol inalatório',
    esperado: {
      data: '2026-04-22',
      tipo: 'medicacao',
      medidas: [],
      palavrasChave: ['Losartana', 'Budesonida', 'formoterol'],
    },
  },
  {
    arquivo: '06-alta-hospitalar-2026-05-06.pdf',
    modo: 'pdf',
    descricao: 'Resumo de alta: crise asmática, internação de 03/05 a 06/05/2026',
    esperado: {
      data: ['2026-05-03', '2026-05-06'],
      tipo: 'internacao',
      palavrasChave: ['asma', '03/05/2026', '06/05/2026'],
    },
  },
  {
    arquivo: '07-ecg-2026-05-20.pdf',
    modo: 'pdf',
    descricao: 'Laudo de ECG com FC, PR, QRS e QTc',
    esperado: {
      data: '2026-05-20',
      tipo: 'exame',
      medidas: [
        {
          nome: /frequencia|\bfc\b/,
          valor: 72,
          tolerancia: 0.5,
          unidade: 'bpm',
        },
        { nome: /\bpr\b/, valor: 164, tolerancia: 0.5, unidade: 'ms' },
        { nome: /\bqrs\b/, valor: 94, tolerancia: 0.5, unidade: 'ms' },
        { nome: /\bqtc?\b/, valor: 418, tolerancia: 0.5, unidade: 'ms' },
      ],
    },
  },
  {
    arquivo: '08-hemograma-2026-06-12.pdf',
    modo: 'pdf',
    descricao: 'Hemograma repetido: hemoglobina caiu de 14,6 para 12,4 g/dL (tendência)',
    esperado: {
      data: '2026-06-12',
      tipo: 'exame',
      medidas: hemogramaBase({
        hemacias: 4.21,
        hemoglobina: 12.4,
        hematocrito: 37.9,
        vcm: 90,
        hcm: 29.5,
        chcm: 32.7,
        rdw: 14.9,
        leucocitos: 6.8,
        eosinofilos: 5.1,
        plaquetas: 228,
      }),
    },
  },
  {
    arquivo: '09-pedido-perfil-lipidico-2026-04-02.pdf',
    modo: 'pdf',
    descricao: 'Pedido de novo perfil lipídico 3 semanas após o 02 (duplicidade)',
    esperado: {
      data: '2026-04-02',
      tipo: ['documento', 'exame', 'consulta'],
      medidas: [],
      palavrasChave: ['Perfil lipídico'],
    },
  },
  {
    arquivo: '10-whatsapp-potassio-creatinina.txt',
    modo: 'texto',
    descricao: 'Texto colado do WhatsApp com potássio e creatinina ditados',
    esperado: {
      data: ['2026-06-24', '2026-06-25'],
      tipo: 'exame',
      medidas: [
        {
          nome: /potassio|^k\b/,
          valor: 4.1,
          tolerancia: 0.05,
          unidade: 'meq/l',
        },
        {
          nome: /creatinina/,
          valor: 1.02,
          tolerancia: 0.005,
          unidade: 'mg/dl',
        },
      ],
    },
  },
  {
    arquivo: '11-escaneado-sem-texto.pdf',
    modo: 'pdf',
    descricao: 'Atestado digitalizado: só imagem, sem camada de texto',
    esperado: { erro: 'PDF_SEM_TEXTO' },
  },
  {
    arquivo: '12-boleto-nao-clinico.pdf',
    modo: 'pdf',
    descricao: 'Boleto de condomínio (não clínico)',
    esperado: { erro: 'NAO_CLINICO' },
  },
  {
    arquivo: '13-arquivo-grande.pdf',
    modo: 'pdf',
    descricao: 'Laudo com imagens anexas acima de 4 MB',
    esperado: { erro: 'ARQUIVO_GRANDE' },
  },
  {
    arquivo: '14-corrompido.pdf',
    modo: 'pdf',
    descricao: 'Bytes aleatórios com extensão .pdf',
    esperado: { erro: 'PDF_INVALIDO' },
  },
  {
    arquivo: '15-texto-simples.txt',
    modo: 'pdf',
    descricao: 'Arquivo .txt enviado no seletor de arquivo (não é PDF)',
    esperado: { erro: 'NAO_PDF' },
  },
]

export function gabarito(arquivo: string): Gabarito {
  const g = GABARITOS.find((x) => x.arquivo === arquivo || x.arquivo.startsWith(`${arquivo}-`))
  if (!g) throw new Error(`gabarito não encontrado: ${arquivo}`)
  return g
}

export function ehErro(esperado: Gabarito['esperado']): esperado is { erro: ErroEsperado } {
  return 'erro' in esperado
}

/* ---------- comparação ---------- */

export interface MedidaExtraida {
  nome: string
  valor: number
  unidade?: string
  refMin?: number
  refMax?: number
}

export interface EventoExtraido {
  data?: string
  tipo?: string
  medidas?: MedidaExtraida[]
}

export interface Divergencia {
  campo: string
  motivo: 'ausente' | 'valor' | 'unidade' | 'faixa' | 'data' | 'tipo'
  esperado: string
  obtido?: string
}

export interface ResultadoComparacao {
  acertos: number
  total: number
  divergencias: Divergencia[]
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizarUnidade(u: string): string {
  return normalizar(u).replace(/µ/g, 'u').replace(/\s/g, '')
}

function casa(padrao: RegExp | string, texto: string): boolean {
  return typeof padrao === 'string' ? texto.includes(normalizar(padrao)) : padrao.test(texto)
}

function casaUnidade(padrao: RegExp | string, unidade: string): boolean {
  const u = normalizarUnidade(unidade)
  return typeof padrao === 'string' ? u === normalizarUnidade(padrao) : padrao.test(u)
}

/* Nomes podem colidir (HCM × CHCM × hemoglobina): entre os candidatos que casam o nome, fica o de
   valor mais próximo, e cada medida extraída só é usada uma vez. */
export function compararExtracao(evento: EventoExtraido, esperado: ExtracaoEsperada): ResultadoComparacao {
  const divergencias: Divergencia[] = []
  let acertos = 0
  let total = 0

  if (esperado.data !== undefined) {
    total++
    const datas = ([] as string[]).concat(esperado.data)
    if (evento.data && datas.includes(evento.data)) acertos++
    else
      divergencias.push({
        campo: 'data',
        motivo: 'data',
        esperado: datas.join(' | '),
        obtido: evento.data,
      })
  }

  if (esperado.tipo !== undefined) {
    total++
    const tipos = ([] as string[]).concat(esperado.tipo)
    if (evento.tipo && tipos.includes(evento.tipo)) acertos++
    else
      divergencias.push({
        campo: 'tipo',
        motivo: 'tipo',
        esperado: tipos.join(' | '),
        obtido: evento.tipo,
      })
  }

  const extraidas = (evento.medidas ?? []).map((m) => ({
    ...m,
    chave: normalizar(m.nome),
  }))
  const usadas = new Set<number>()

  for (const m of esperado.medidas ?? []) {
    total++
    const rotulo = String(m.nome)
    const candidatos = extraidas
      .map((e, i) => ({ e, i }))
      .filter(({ e, i }) => !usadas.has(i) && casa(m.nome, e.chave))
      .sort((a, b) => Math.abs(a.e.valor - m.valor) - Math.abs(b.e.valor - m.valor))
    const melhor = candidatos[0]
    if (!melhor) {
      divergencias.push({
        campo: rotulo,
        motivo: 'ausente',
        esperado: String(m.valor),
      })
      continue
    }
    usadas.add(melhor.i)
    if (Math.abs(melhor.e.valor - m.valor) > m.tolerancia) {
      divergencias.push({
        campo: rotulo,
        motivo: 'valor',
        esperado: String(m.valor),
        obtido: String(melhor.e.valor),
      })
      continue
    }
    if (m.unidade !== undefined && !casaUnidade(m.unidade, melhor.e.unidade ?? '')) {
      divergencias.push({
        campo: rotulo,
        motivo: 'unidade',
        esperado: String(m.unidade),
        obtido: melhor.e.unidade,
      })
      continue
    }
    const faixa = (['refMin', 'refMax'] as const).find((lado) => m[lado] !== undefined
      && (m[lado] === null ? melhor.e[lado] !== undefined : Math.abs((melhor.e[lado] ?? Number.NaN) - m[lado]) > m.tolerancia))
    if (faixa) {
      divergencias.push({
        campo: `${rotulo}.${faixa}`,
        motivo: 'faixa',
        esperado: String(m[faixa] ?? 'ausente'),
        obtido: String(melhor.e[faixa] ?? 'ausente'),
      })
      continue
    }
    acertos++
  }

  return { acertos, total, divergencias }
}
