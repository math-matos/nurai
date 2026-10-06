/* Histórico do Marcos para os testes de IA.
   Com E2E_REAL=1 os documentos que os testes de duplicidade e de hemoglobina usam (01, 02, 08, 09)
   passam pela extração real (POST /api/extrair → POST /api/eventos): é o shape que a paciente terá.
   No modo simulado vai tudo direto por POST /api/eventos, com os valores dos gabaritos e títulos/tipos
   iguais aos da extração real — o 09 é um "Pedido de exame" do tipo documento, não uma consulta. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, type APIRequestContext } from '@playwright/test'
import type { Evento, Medida } from '../../src/data/types.ts'
import { CSRF } from '../helpers/sessao.ts'
import { GABARITOS, ehErro } from './gabaritos.ts'
import { DIR_DOCUMENTOS } from './gerar.ts'

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
  /* Exatamente o que a extração real devolveu para o PDF 09 (título genérico, exame só no resumo). */
  evento(IDS.pedidoLipidico, '09', {
    tipo: 'documento', titulo: 'Pedido de exame', instituicao: CLINICA, tags: ['colesterol'],
    resumo: 'Pedido de exame de perfil lipídico para controle de dislipidemia.',
  }),
  evento(IDS.potassio, '10', {
    tipo: 'exame', titulo: 'Potássio e creatinina', instituicao: LAB, tags: ['funcao renal'],
    resumo: 'Potássio e creatinina dentro da referência, informados pelo paciente.',
    medidas: [medida('Potássio', 4.1, 'mEq/L', 3.5, 5.1), medida('Creatinina', 1.02, 'mg/dL', 0.7, 1.3)],
  }),
]

export type ChaveMarcos = keyof typeof IDS

/* Documentos que, no modo real, entram pela extração em vez do atalho. */
const PELA_EXTRACAO: Partial<Record<ChaveMarcos, string>> = {
  hemograma1: '01', lipidico: '02', hemograma2: '08', pedidoLipidico: '09',
}

async function extrair(sessao: APIRequestContext, prefixo: string): Promise<Omit<Evento, 'id'>> {
  const arquivo = arquivoDe(prefixo)
  const res = await sessao.post('/api/extrair', {
    headers: CSRF,
    multipart: { arquivo: { name: arquivo, mimeType: 'application/pdf', buffer: await readFile(join(DIR_DOCUMENTOS, arquivo)) } },
  })
  expect(res.status(), `extrair ${arquivo}: ${await res.text()}`).toBe(200)
  return (await res.json()).evento
}

/* Grava o histórico na conta da `sessao` e devolve os eventos como o servidor os salvou, com os ids reais. */
export async function montarHistoricoMarcos(sessao: APIRequestContext, real: boolean) {
  const eventos: Evento[] = []
  const ids = { ...IDS } as Record<ChaveMarcos, string>
  for (const [chave, id] of Object.entries(IDS) as [ChaveMarcos, string][]) {
    const prefixo = PELA_EXTRACAO[chave]
    const corpo = real && prefixo ? { ...(await extrair(sessao, prefixo)), id } : HISTORICO_MARCOS.find((e) => e.id === id)!
    const res = await sessao.post('/api/eventos', { headers: CSRF, data: corpo })
    expect(res.status(), `${chave}: ${await res.text()}`).toBe(201)
    const salvo: Evento = await res.json()
    ids[chave] = salvo.id
    eventos.push(salvo)
  }
  return { eventos, ids }
}
