/* Histórico do Marcos montado direto pela API (POST /api/eventos), com os valores dos gabaritos:
   deixa os testes de IA rápidos e independentes da qualidade da extração. */
import type { Evento, Medida } from '../../src/data/types.ts'
import { GABARITOS, ehErro } from './gabaritos.ts'

function dataDe(prefixo: string): string {
  const g = GABARITOS.find((x) => x.arquivo.startsWith(prefixo))!
  if (ehErro(g.esperado) || g.esperado.data === undefined) throw new Error(`gabarito ${prefixo} sem data`)
  return ([] as string[]).concat(g.esperado.data)[0]
}

const arquivoDe = (prefixo: string) => GABARITOS.find((x) => x.arquivo.startsWith(prefixo))!.arquivo

function medida(nome: string, valor: number, unidade: string, refMin: number, refMax: number): Medida {
  return { nome, valor, unidade, refMin, refMax, sinal: valor < refMin || valor > refMax ? 'alterado' : 'normal' }
}

const LAB = 'Laboratório Quaresmeira'
const CLINICA = 'Clínica Ipê-Roxo'

function hemograma(v: [number, number, number, number, number, number, number, number, number, number]): Medida[] {
  const [hemacias, hemoglobina, hematocrito, vcm, hcm, chcm, rdw, leucocitos, eosinofilos, plaquetas] = v
  return [
    medida('Hemácias', hemacias, 'milhões/µL', 4.5, 5.9),
    medida('Hemoglobina', hemoglobina, 'g/dL', 13.5, 17.5),
    medida('Hematócrito', hematocrito, '%', 41, 53),
    medida('VCM', vcm, 'fL', 80, 100),
    medida('HCM', hcm, 'pg', 26, 34),
    medida('CHCM', chcm, 'g/dL', 31, 36),
    medida('RDW', rdw, '%', 11.5, 14.5),
    medida('Leucócitos', leucocitos, 'mil/µL', 4, 11),
    medida('Eosinófilos', eosinofilos, '%', 1, 6),
    medida('Plaquetas', plaquetas, 'mil/µL', 150, 450),
  ]
}

type Base = Pick<Evento, 'tipo' | 'titulo' | 'instituicao' | 'resumo' | 'tags'> & Partial<Pick<Evento, 'especialidade' | 'medidas'>>

function evento(id: string, prefixo: string, base: Base): Evento {
  const medidas = base.medidas
  return {
    id,
    data: dataDe(prefixo),
    fonte: 'paciente',
    origem: 'OCR + IA',
    confianca: 0.9,
    documento: arquivoDe(prefixo),
    sinal: medidas?.length ? (medidas.some((m) => m.sinal === 'alterado') ? 'alterado' : 'normal') : 'info',
    ...base,
  }
}

export const IDS = {
  hemograma1: 'mv01', lipidico: 'mv02', glicemia: 'mv03', raioX: 'mv04', receita: 'mv05',
  alta: 'mv06', ecg: 'mv07', hemograma2: 'mv08', pedidoLipidico: 'mv09', potassio: 'mv10',
} as const

export const HISTORICO_MARCOS: Evento[] = [
  evento(IDS.hemograma1, '01', {
    tipo: 'exame', titulo: 'Hemograma completo', instituicao: LAB, tags: ['hemograma'],
    resumo: 'Hemograma com eosinófilos acima da referência; demais índices dentro da faixa.',
    medidas: hemograma([4.85, 14.6, 43.8, 90.3, 30.1, 33.3, 13.1, 7.2, 7.8, 245]),
  }),
  evento(IDS.lipidico, '02', {
    tipo: 'exame', titulo: 'Perfil lipídico', instituicao: LAB, tags: ['colesterol'],
    resumo: 'Colesterol total, LDL e triglicerídeos acima do desejável. HDL de 38 mg/dL, abaixo do desejável (> 40).',
    medidas: [
      medida('Colesterol total', 212, 'mg/dL', 0, 190),
      medida('LDL-colesterol', 138, 'mg/dL', 0, 130),
      medida('Triglicerídeos', 180, 'mg/dL', 0, 150),
    ],
  }),
  evento(IDS.glicemia, '03', {
    tipo: 'exame', titulo: 'Glicemia de jejum e hemoglobina glicada', instituicao: LAB, tags: ['glicemia', 'hba1c'],
    resumo: 'Glicemia de jejum no limite superior e hemoglobina glicada na faixa de pré-diabetes.',
    medidas: [medida('Glicemia de jejum', 99, 'mg/dL', 70, 99), medida('Hemoglobina glicada (HbA1c)', 5.8, '%', 4, 5.6)],
  }),
  evento(IDS.raioX, '04', {
    tipo: 'imagem', titulo: 'Radiografia de tórax', instituicao: 'Imagem Serra Clara', tags: ['torax'],
    resumo: 'Espessamento peribrônquico discreto, sem consolidações nem derrame pleural.',
  }),
  evento(IDS.receita, '05', {
    tipo: 'medicacao', titulo: 'Receita de losartana e budesonida/formoterol', instituicao: CLINICA,
    especialidade: 'Clínica médica', tags: ['receita'],
    resumo: 'Losartana 50 mg uma vez ao dia e budesonida/formoterol inalatório duas vezes ao dia.',
  }),
  evento(IDS.alta, '06', {
    tipo: 'internacao', titulo: 'Internação por crise asmática', instituicao: 'Hospital Municipal Vale do Jacarandá',
    especialidade: 'Pneumologia', tags: ['asma'],
    resumo: 'Internado de 03/05/2026 a 06/05/2026 por crise de asma. Alta com retorno à pneumologia em 30 dias.',
  }),
  evento(IDS.ecg, '07', {
    tipo: 'exame', titulo: 'Eletrocardiograma de repouso', instituicao: 'Instituto Cardiológico Sabiá',
    especialidade: 'Cardiologia', tags: ['ecg'],
    resumo: 'Ritmo sinusal, intervalos dentro da normalidade.',
    medidas: [
      medida('Frequência cardíaca', 72, 'bpm', 60, 100),
      medida('Intervalo PR', 164, 'ms', 120, 200),
      medida('Duração do QRS', 94, 'ms', 80, 110),
      medida('QTc', 418, 'ms', 350, 440),
    ],
  }),
  evento(IDS.hemograma2, '08', {
    tipo: 'exame', titulo: 'Hemograma completo de controle', instituicao: LAB, tags: ['hemograma'],
    resumo: 'Hemoglobina de 12,4 g/dL, abaixo da referência, com hemácias e hematócrito também abaixo.',
    medidas: hemograma([4.21, 12.4, 37.9, 90, 29.5, 32.7, 14.9, 6.8, 5.1, 228]),
  }),
  evento(IDS.pedidoLipidico, '09', {
    tipo: 'consulta', titulo: 'Consulta de rotina com pedido de exames', instituicao: CLINICA,
    especialidade: 'Clínica médica', tags: ['colesterol'],
    resumo: 'Consulta de rotina. Solicitado novo perfil lipídico.',
  }),
  evento(IDS.potassio, '10', {
    tipo: 'exame', titulo: 'Potássio e creatinina', instituicao: LAB, tags: ['funcao renal'],
    resumo: 'Potássio e creatinina dentro da referência, informados pelo paciente.',
    medidas: [medida('Potássio', 4.1, 'mEq/L', 3.5, 5.1), medida('Creatinina', 1.02, 'mg/dL', 0.7, 1.3)],
  }),
]
