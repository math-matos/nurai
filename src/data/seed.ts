import type {
  AcessoLog, Centro, Consentimento, Ensaio, Evento, FonteId, ProximoPasso, TipoId,
} from './types'

/* ------------------------------------------------------------------ *
 * Dados sintéticos. Nenhuma pessoa, instituição ou resultado é real.  *
 * Construídos para demonstrar a mecânica do produto.                  *
 * ------------------------------------------------------------------ */

export const PACIENTE = {
  nome: 'Helena Duarte Nogueira',
  iniciais: 'HN',
  idade: 58,
  nascimento: '1968-02-11',
  cidade: 'São Paulo, SP',
  cartaoSus: '898 0011 4522 3317',
  plano: 'Vitalis Saúde · Essencial 300',
  condicoes: ['Diabetes tipo 2', 'Fibrilação atrial paroxística', 'Hipotireoidismo', 'Dislipidemia'],
  alergias: ['Dipirona — urticária'],
}

export const FONTES: Record<FonteId, { nome: string; curto: string; cor: string }> = {
  sus:         { nome: 'Rede pública (SUS)',      curto: 'SUS',         cor: 'var(--src-sus)' },
  laboratorio: { nome: 'Laboratório',              curto: 'Laboratório', cor: 'var(--src-lab)' },
  hospital:    { nome: 'Hospital',                 curto: 'Hospital',    cor: 'var(--src-hospital)' },
  clinica:     { nome: 'Clínica / consultório',    curto: 'Clínica',     cor: 'var(--src-clinica)' },
  operadora:   { nome: 'Operadora de saúde',       curto: 'Operadora',   cor: 'var(--src-operadora)' },
  paciente:    { nome: 'Enviado por você',         curto: 'Papel',       cor: 'var(--src-paciente)' },
}

export const TIPOS: Record<TipoId, string> = {
  exame: 'Exame laboratorial',
  consulta: 'Consulta',
  imagem: 'Exame de imagem',
  cirurgia: 'Procedimento',
  medicacao: 'Medicação',
  internacao: 'Internação',
  vacina: 'Vacina',
  documento: 'Documento',
}

export const EVENTOS: Evento[] = [
  {
    id: 'e01', data: '2019-03-14', tipo: 'consulta', titulo: 'Diagnóstico de diabetes tipo 2',
    instituicao: 'UBS Vila Mariana', fonte: 'sus', especialidade: 'Clínica médica',
    resumo: 'Encaminhada após glicemia de jejum alterada em campanha. Iniciada metformina 500 mg, orientação nutricional e retorno em 90 dias.',
    sinal: 'info', tags: ['diabetes', 'diagnóstico'], origem: 'RNDS',
  },
  {
    id: 'e02', data: '2019-04-02', tipo: 'exame', titulo: 'Hemoglobina glicada e glicemia de jejum',
    instituicao: 'Laboratório da UBS Vila Mariana', fonte: 'sus',
    resumo: 'Primeiro painel após o diagnóstico. Ambos os marcadores acima da faixa.',
    sinal: 'alterado', origem: 'RNDS', tags: ['diabetes', 'hba1c'],
    medidas: [
      { nome: 'Hemoglobina glicada (HbA1c)', valor: 7.8, unidade: '%', refMin: 4, refMax: 5.7, sinal: 'alterado' },
      { nome: 'Glicemia de jejum', valor: 148, unidade: 'mg/dL', refMin: 70, refMax: 99, sinal: 'alterado' },
    ],
  },
  {
    id: 'e03', data: '2020-06-18', tipo: 'vacina', titulo: 'Influenza trivalente',
    instituicao: 'UBS Vila Mariana', fonte: 'sus',
    resumo: 'Campanha anual, grupo prioritário por condição crônica.',
    sinal: 'normal', tags: ['vacina'], origem: 'RNDS',
  },
  {
    id: 'e04', data: '2021-02-09', tipo: 'exame', titulo: 'Perfil lipídico completo',
    instituicao: 'Laboratório Vetor', fonte: 'laboratorio',
    resumo: 'Solicitado em consulta particular. LDL bem acima do alvo para paciente diabética.',
    sinal: 'alterado', origem: 'API da instituição', tags: ['colesterol', 'risco cardiovascular'],
    medidas: [
      { nome: 'Colesterol LDL', valor: 168, unidade: 'mg/dL', refMin: 0, refMax: 100, sinal: 'alterado' },
      { nome: 'Colesterol HDL', valor: 41, unidade: 'mg/dL', refMin: 45, refMax: 90, sinal: 'atencao' },
      { nome: 'Triglicérides', valor: 210, unidade: 'mg/dL', refMin: 0, refMax: 150, sinal: 'alterado' },
    ],
  },
  {
    id: 'e05', data: '2021-11-30', tipo: 'consulta', titulo: 'Endocrinologia — ajuste de tratamento',
    instituicao: 'Clínica Endócrino Paulista', fonte: 'clinica', especialidade: 'Endocrinologia',
    resumo: 'Metformina elevada para 850 mg duas vezes ao dia. Introduzida atorvastatina 20 mg pelo LDL de fevereiro.',
    sinal: 'info', tags: ['diabetes', 'medicação'], origem: 'API da instituição',
  },
  {
    id: 'e06', data: '2022-05-21', tipo: 'imagem', titulo: 'Ultrassonografia de abdome total',
    instituicao: 'Instituto de Imagem Anhangá', fonte: 'clinica',
    resumo: 'Esteatose hepática de grau leve. Demais órgãos sem alterações. Imagens em DICOM, laudo em PDF.',
    sinal: 'atencao', tags: ['fígado', 'imagem'], origem: 'API da instituição',
  },
  {
    id: 'e07', data: '2022-09-08', tipo: 'documento', titulo: 'Receituário de metformina (papel)',
    instituicao: 'Consultório particular', fonte: 'paciente',
    resumo: 'Receita em papel fotografada pela paciente. A leitura automática extraiu prescrição, posologia e validade, e ligou o registro ao histórico de medicação.',
    sinal: 'info', tags: ['medicação', 'papel'], origem: 'OCR + IA', confianca: 0.94,
    documento: 'receita-set-2022.jpg',
  },
  {
    id: 'e08', data: '2023-01-27', tipo: 'internacao', titulo: 'Pronto-socorro por palpitações',
    instituicao: 'Hospital Santa Clemência', fonte: 'hospital', especialidade: 'Cardiologia',
    resumo: 'Entrada com palpitação e tontura. Eletrocardiograma mostrou fibrilação atrial. Reversão espontânea em 6 horas. Alta em 2 dias com encaminhamento para cardiologia.',
    sinal: 'alterado', tags: ['fibrilação atrial', 'cardiologia'], origem: 'API da instituição',
  },
  {
    id: 'e09', data: '2023-02-03', tipo: 'exame', titulo: 'Holter de 24 horas',
    instituicao: 'Hospital Santa Clemência', fonte: 'hospital',
    resumo: 'Fibrilação atrial paroxística em 4,1% do registro, sem pausas significativas.',
    sinal: 'alterado', origem: 'API da instituição', tags: ['fibrilação atrial', 'holter'],
    medidas: [
      { nome: 'Carga de fibrilação atrial', valor: 4.1, unidade: '% do tempo', refMin: 0, refMax: 0.5, sinal: 'alterado' },
      { nome: 'Frequência cardíaca média', valor: 78, unidade: 'bpm', refMin: 60, refMax: 100, sinal: 'normal' },
    ],
  },
  {
    id: 'e10', data: '2023-02-15', tipo: 'consulta', titulo: 'Cardiologia — início de anticoagulação',
    instituicao: 'Clínica Cardio Paulista', fonte: 'clinica', especialidade: 'Cardiologia',
    resumo: 'Escore CHA₂DS₂-VASc igual a 3. Iniciada rivaroxabana 20 mg ao dia. Orientado controle de pressão e retorno semestral.',
    sinal: 'info', tags: ['fibrilação atrial', 'anticoagulação'], origem: 'API da instituição',
  },
  {
    id: 'e11', data: '2023-08-11', tipo: 'exame', titulo: 'Painel metabólico e função renal',
    instituicao: 'Laboratório Vetor', fonte: 'laboratorio',
    resumo: 'Glicada em queda após o ajuste. Função renal ainda preservada.',
    sinal: 'atencao', origem: 'API da instituição', tags: ['diabetes', 'rim'],
    medidas: [
      { nome: 'Hemoglobina glicada (HbA1c)', valor: 7.1, unidade: '%', refMin: 4, refMax: 5.7, sinal: 'alterado' },
      { nome: 'Creatinina', valor: 0.98, unidade: 'mg/dL', refMin: 0.5, refMax: 1.1, sinal: 'normal' },
      { nome: 'Taxa de filtração glomerular', valor: 74, unidade: 'mL/min', refMin: 90, refMax: 130, sinal: 'atencao' },
    ],
  },
  {
    id: 'e12', data: '2024-03-02', tipo: 'exame', titulo: 'Hemoglobina glicada de controle',
    instituicao: 'UBS Vila Mariana', fonte: 'sus',
    resumo: 'Melhor resultado da série desde o diagnóstico.',
    sinal: 'atencao', origem: 'RNDS', tags: ['diabetes', 'hba1c'],
    medidas: [
      { nome: 'Hemoglobina glicada (HbA1c)', valor: 6.9, unidade: '%', refMin: 4, refMax: 5.7, sinal: 'atencao' },
    ],
  },
  {
    id: 'e13', data: '2024-07-19', tipo: 'imagem', titulo: 'Ecocardiograma transtorácico',
    instituicao: 'Clínica Cardio Paulista', fonte: 'clinica', especialidade: 'Cardiologia',
    resumo: 'Função sistólica preservada. Átrio esquerdo levemente aumentado, compatível com a fibrilação atrial.',
    sinal: 'atencao', origem: 'API da instituição', tags: ['coração', 'imagem'],
    medidas: [
      { nome: 'Fração de ejeção (FEVE)', valor: 58, unidade: '%', refMin: 55, refMax: 70, sinal: 'normal' },
      { nome: 'Diâmetro do átrio esquerdo', valor: 42, unidade: 'mm', refMin: 27, refMax: 38, sinal: 'atencao' },
    ],
  },
  {
    id: 'e14', data: '2024-11-05', tipo: 'consulta', titulo: 'Oftalmologia — mapeamento de retina',
    instituicao: 'Rede credenciada Vitalis Saúde', fonte: 'operadora', especialidade: 'Oftalmologia',
    resumo: 'Retinopatia diabética não proliferativa leve em ambos os olhos. Recomendado retorno anual.',
    sinal: 'atencao', tags: ['diabetes', 'olhos'], origem: 'API da instituição',
  },
  {
    id: 'e15', data: '2025-01-22', tipo: 'exame', titulo: 'Lipídios e função tireoidiana',
    instituicao: 'Laboratório Vetor', fonte: 'laboratorio',
    resumo: 'TSH acima da faixa levantou a hipótese de hipotireoidismo subclínico.',
    sinal: 'alterado', origem: 'API da instituição', tags: ['tireoide', 'colesterol'],
    medidas: [
      { nome: 'Colesterol LDL', valor: 132, unidade: 'mg/dL', refMin: 0, refMax: 100, sinal: 'alterado' },
      { nome: 'TSH', valor: 6.8, unidade: 'mUI/L', refMin: 0.4, refMax: 4.0, sinal: 'alterado' },
    ],
  },
  {
    id: 'e16', data: '2025-02-10', tipo: 'consulta', titulo: 'Endocrinologia — início de levotiroxina',
    instituicao: 'Clínica Endócrino Paulista', fonte: 'clinica', especialidade: 'Endocrinologia',
    resumo: 'Levotiroxina 50 mcg em jejum. Reavaliar TSH em 8 semanas — a reavaliação não aparece em nenhuma fonte conectada.',
    sinal: 'info', tags: ['tireoide', 'medicação'], origem: 'API da instituição',
  },
  {
    id: 'e17', data: '2025-06-30', tipo: 'cirurgia', titulo: 'Exérese de lesão cutânea no dorso',
    instituicao: 'Hospital Santa Clemência', fonte: 'hospital', especialidade: 'Dermatologia',
    resumo: 'Procedimento ambulatorial sob anestesia local. Anatomopatológico: queratose seborreica, sem malignidade.',
    sinal: 'normal', tags: ['pele', 'procedimento'], origem: 'API da instituição',
  },
  {
    id: 'e18', data: '2025-09-14', tipo: 'exame', titulo: 'Controle metabólico e albuminúria',
    instituicao: 'UBS Vila Mariana', fonte: 'sus',
    resumo: 'Glicada voltou a subir e apareceu albuminúria — primeiro sinal de repercussão renal.',
    sinal: 'alterado', origem: 'RNDS', tags: ['diabetes', 'rim'],
    medidas: [
      { nome: 'Hemoglobina glicada (HbA1c)', valor: 7.4, unidade: '%', refMin: 4, refMax: 5.7, sinal: 'alterado' },
      { nome: 'Albuminúria', valor: 42, unidade: 'mg/g', refMin: 0, refMax: 30, sinal: 'alterado' },
    ],
  },
  {
    id: 'e19', data: '2025-12-01', tipo: 'vacina', titulo: 'Influenza e pneumocócica 23-valente',
    instituicao: 'UBS Vila Mariana', fonte: 'sus',
    resumo: 'Ambas aplicadas na mesma visita, grupo prioritário.',
    sinal: 'normal', tags: ['vacina'], origem: 'RNDS',
  },
  {
    id: 'e20', data: '2026-02-18', tipo: 'consulta', titulo: 'Cardiologia — retorno semestral',
    instituicao: 'Clínica Cardio Paulista', fonte: 'clinica', especialidade: 'Cardiologia',
    resumo: 'Sem novos episódios sintomáticos. Mantida a rivaroxabana. Solicitados novo Holter e ultrassom de carótidas.',
    sinal: 'info', tags: ['fibrilação atrial', 'cardiologia'], origem: 'API da instituição',
  },
  {
    id: 'e21', data: '2026-03-05', tipo: 'exame', titulo: 'Hemograma, glicada e função renal',
    instituicao: 'Laboratório Vetor', fonte: 'laboratorio',
    resumo: 'Filtração glomerular em queda lenta e contínua desde 2023.',
    sinal: 'alterado', origem: 'API da instituição', tags: ['diabetes', 'rim'],
    medidas: [
      { nome: 'Hemoglobina glicada (HbA1c)', valor: 7.2, unidade: '%', refMin: 4, refMax: 5.7, sinal: 'alterado' },
      { nome: 'Creatinina', valor: 1.1, unidade: 'mg/dL', refMin: 0.5, refMax: 1.1, sinal: 'atencao' },
      { nome: 'Taxa de filtração glomerular', valor: 68, unidade: 'mL/min', refMin: 90, refMax: 130, sinal: 'alterado' },
      { nome: 'Hemoglobina', valor: 12.6, unidade: 'g/dL', refMin: 12, refMax: 16, sinal: 'normal' },
    ],
  },
  {
    id: 'e22', data: '2026-05-27', tipo: 'imagem', titulo: 'Ultrassom Doppler de carótidas',
    instituicao: 'Instituto de Imagem Anhangá', fonte: 'clinica',
    resumo: 'Espessamento médio-intimal difuso, sem placas com repercussão hemodinâmica.',
    sinal: 'atencao', tags: ['carótidas', 'imagem'], origem: 'API da instituição',
  },
  {
    id: 'e23', data: '2026-06-12', tipo: 'documento', titulo: 'Laudo de Holter de 24 h (impresso)',
    instituicao: 'Clínica Cardio Paulista', fonte: 'paciente',
    resumo: 'Laudo entregue em papel no consultório e fotografado pela paciente. A leitura automática extraiu carga de fibrilação, frequência média e conclusão, e comparou com o Holter de 2023.',
    sinal: 'atencao', origem: 'OCR + IA', confianca: 0.91, documento: 'holter-jun-2026.pdf',
    tags: ['fibrilação atrial', 'holter', 'papel'],
    medidas: [
      { nome: 'Carga de fibrilação atrial', valor: 6.3, unidade: '% do tempo', refMin: 0, refMax: 0.5, sinal: 'alterado' },
      { nome: 'Frequência cardíaca média', valor: 81, unidade: 'bpm', refMin: 60, refMax: 100, sinal: 'normal' },
    ],
  },
  {
    id: 'e24', data: '2026-07-08', tipo: 'consulta', titulo: 'UBS — renovação de receitas',
    instituicao: 'UBS Vila Mariana', fonte: 'sus', especialidade: 'Clínica médica',
    resumo: 'Receitas renovadas. Solicitado ultrassom de carótidas — sem acesso ao exame feito seis semanas antes na rede privada.',
    sinal: 'atencao', tags: ['duplicidade', 'exame repetido'], origem: 'RNDS',
  },
]

export const MEDICACOES = [
  { nome: 'Metformina', dose: '850 mg', posologia: '2× ao dia', desde: '2021', prescritor: 'Endocrinologia' },
  { nome: 'Rivaroxabana', dose: '20 mg', posologia: '1× ao dia', desde: '2023', prescritor: 'Cardiologia' },
  { nome: 'Atorvastatina', dose: '20 mg', posologia: '1× à noite', desde: '2021', prescritor: 'Endocrinologia' },
  { nome: 'Levotiroxina', dose: '50 mcg', posologia: 'em jejum', desde: '2025', prescritor: 'Endocrinologia' },
  { nome: 'Losartana', dose: '50 mg', posologia: '1× ao dia', desde: '2024', prescritor: 'Clínica médica' },
]

export const CONSENTIMENTOS: Consentimento[] = [
  { id: 'c1', instituicao: 'Rede Nacional de Dados em Saúde (RNDS)', fonte: 'sus', escopo: 'Histórico completo da rede pública', ativo: true, desde: '2026-01-12' },
  { id: 'c2', instituicao: 'Laboratório Vetor', fonte: 'laboratorio', escopo: 'Resultados de exames desde 2019', ativo: true, desde: '2026-01-12' },
  { id: 'c3', instituicao: 'Hospital Santa Clemência', fonte: 'hospital', escopo: 'Internações, cirurgias e laudos', ativo: true, desde: '2026-01-14' },
  { id: 'c4', instituicao: 'Clínica Cardio Paulista', fonte: 'clinica', escopo: 'Consultas e exames de cardiologia', ativo: true, desde: '2026-01-20' },
  { id: 'c5', instituicao: 'Vitalis Saúde (operadora)', fonte: 'operadora', escopo: 'Autorizações e rede credenciada', ativo: false, desde: '2026-02-02' },
  { id: 'c6', instituicao: 'Dra. Renata Aguiar — Cardiologia', fonte: 'clinica', escopo: 'Resumo de consulta, por 30 dias', ativo: true, desde: '2026-08-20' },
]

export const ACESSOS: AcessoLog[] = [
  { id: 'a1', quando: '27/08/2026 14:02', quem: 'Dra. Renata Aguiar', papel: 'Cardiologista', acao: 'Abriu o resumo pré-consulta', itens: '9 eventos cardiológicos' },
  { id: 'a2', quando: '22/08/2026 09:41', quem: 'Laboratório Vetor', papel: 'Fonte conectada', acao: 'Enviou novo resultado', itens: '1 exame' },
  { id: 'a3', quando: '20/08/2026 18:10', quem: 'Helena Duarte Nogueira', papel: 'Titular', acao: 'Concedeu acesso temporário', itens: 'Dra. Renata Aguiar, 30 dias' },
  { id: 'a4', quando: '11/08/2026 07:55', quem: 'RNDS', papel: 'Fonte conectada', acao: 'Sincronizou registros', itens: '3 eventos' },
  { id: 'a5', quando: '30/07/2026 16:23', quem: 'Vitalis Saúde', papel: 'Operadora', acao: 'Solicitou acesso — negado por você', itens: 'Histórico completo' },
]

export const PROXIMOS_PASSOS: ProximoPasso[] = [
  {
    id: 'p1', titulo: 'Cancelar o ultrassom de carótidas pedido na UBS',
    porque: 'O mesmo exame foi feito em 27/05/2026 no Instituto de Imagem Anhangá, seis semanas antes do pedido. O laudo já está no seu histórico e pode ser levado à UBS.',
    ancoras: ['e22', 'e24'], prazo: 'Antes da data marcada', prioridade: 'alta', feito: false,
  },
  {
    id: 'p2', titulo: 'Levar o Holter de junho ao retorno da cardiologia',
    porque: 'A carga de fibrilação atrial subiu de 4,1% em 2023 para 6,3% em 2026. O laudo de junho entrou por foto de papel e ainda não foi visto pela cardiologista.',
    ancoras: ['e09', 'e23'], prazo: 'Próxima consulta', prioridade: 'alta', feito: false,
  },
  {
    id: 'p3', titulo: 'Agendar avaliação com nefrologia',
    porque: 'A filtração glomerular caiu de 74 para 68 mL/min entre 2023 e 2026, e apareceu albuminúria de 42 mg/g em 2025. O conjunto sugere avaliação especializada.',
    ancoras: ['e11', 'e18', 'e21'], prazo: 'Em até 60 dias', prioridade: 'media', feito: false,
  },
  {
    id: 'p4', titulo: 'Repetir o TSH — a reavaliação de 8 semanas nunca aconteceu',
    porque: 'A levotiroxina começou em 10/02/2025 com pedido de reavaliação em 8 semanas. Não há nenhum TSH posterior a essa data em nenhuma fonte conectada.',
    ancoras: ['e15', 'e16'], prazo: 'Em até 30 dias', prioridade: 'media', feito: false,
  },
  {
    id: 'p5', titulo: 'Marcar o mapeamento de retina anual',
    porque: 'A última avaliação oftalmológica foi em 05/11/2024, com retinopatia leve e recomendação de retorno anual. Já se passaram 21 meses.',
    ancoras: ['e14'], prazo: 'Em até 30 dias', prioridade: 'alta', feito: false,
  },
]

export const CENTROS: Centro[] = [
  { id: 'ct1', nome: 'Centro de Arritmias do Hospital Universitário', cidade: 'São Paulo, SP', foco: 'Fibrilação atrial e ablação', motivo: 'Carga de fibrilação em elevação com átrio esquerdo aumentado', distancia: '7 km', convenio: 'SUS e convênios' },
  { id: 'ct2', nome: 'Ambulatório de Doença Renal do Diabetes', cidade: 'São Paulo, SP', foco: 'Nefropatia diabética', motivo: 'Filtração glomerular em queda e albuminúria persistente', distancia: '12 km', convenio: 'SUS' },
  { id: 'ct3', nome: 'Programa de Retinopatia da Rede Estadual', cidade: 'São Paulo, SP', foco: 'Rastreio de retinopatia', motivo: 'Retinopatia leve com rastreio anual em atraso', distancia: '4 km', convenio: 'SUS' },
]

export const ENSAIOS: Ensaio[] = [
  {
    id: 'en1', codigo: 'RBR-8k2mq4x', titulo: 'Controle de ritmo precoce em fibrilação atrial paroxística com comorbidade metabólica',
    fase: 'Fase III · multicêntrico', local: 'São Paulo, SP · 3 centros', match: 86,
    criterios: [
      { texto: 'Fibrilação atrial paroxística documentada em Holter', atende: true },
      { texto: 'Idade entre 45 e 75 anos', atende: true },
      { texto: 'Diabetes tipo 2 em tratamento', atende: true },
      { texto: 'Sem ablação prévia', atende: true },
      { texto: 'Fração de ejeção acima de 40%', atende: true },
      { texto: 'Clearance de creatinina acima de 60 mL/min', atende: null },
    ],
  },
  {
    id: 'en2', codigo: 'RBR-3p9wz1t', titulo: 'Intervenção digital de adesão ao anticoagulante oral em pacientes com múltiplos prescritores',
    fase: 'Fase II · unicêntrico', local: 'São Paulo, SP · 1 centro', match: 71,
    criterios: [
      { texto: 'Uso contínuo de anticoagulante oral direto', atende: true },
      { texto: 'Três ou mais medicamentos de uso contínuo', atende: true },
      { texto: 'Acompanhamento em mais de um serviço de saúde', atende: true },
      { texto: 'Uso de smartphone próprio', atende: null },
    ],
  },
  {
    id: 'en3', codigo: 'RBR-5v7hd2c', titulo: 'Rastreio ampliado de doença renal em diabetes tipo 2 na atenção primária',
    fase: 'Estudo observacional', local: 'São Paulo, SP · rede pública', match: 64,
    criterios: [
      { texto: 'Diabetes tipo 2 com mais de 5 anos de diagnóstico', atende: true },
      { texto: 'Albuminúria documentada', atende: true },
      { texto: 'Acompanhamento em unidade básica de saúde', atende: true },
      { texto: 'Sem diálise ou transplante prévio', atende: true },
      { texto: 'Não participar de outro ensaio intervencionista', atende: false },
    ],
  },
]

export const FONTES_CONECTADAS: {
  id: string; nome: string; fonte: FonteId; estado: 'conectado' | 'disponivel'; registros: number; ultima: string
}[] = [
  { id: 'f1', nome: 'RNDS · Conecte SUS', fonte: 'sus', estado: 'conectado', registros: 9, ultima: '11/08/2026' },
  { id: 'f2', nome: 'Laboratório Vetor', fonte: 'laboratorio', estado: 'conectado', registros: 5, ultima: '22/08/2026' },
  { id: 'f3', nome: 'Hospital Santa Clemência', fonte: 'hospital', estado: 'conectado', registros: 3, ultima: '02/07/2026' },
  { id: 'f4', nome: 'Clínica Cardio Paulista', fonte: 'clinica', estado: 'conectado', registros: 5, ultima: '18/08/2026' },
  { id: 'f5', nome: 'Vitalis Saúde', fonte: 'operadora', estado: 'disponivel', registros: 0, ultima: '—' },
  { id: 'f6', nome: 'Instituto de Imagem Anhangá', fonte: 'clinica', estado: 'disponivel', registros: 0, ultima: '—' },
]
