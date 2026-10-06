/* Modelos HTML dos documentos clínicos FICTÍCIOS usados nos testes E2E.
   Pessoas, instituições, cidade e registros profissionais são inventados.
   Os valores aqui são a fonte do PDF; `gabaritos.ts` guarda o esperado de forma
   independente e `verificar.ts` confere que os dois concordam. */

export const PACIENTE = {
  nome: 'Marcos Vinícius Teixeira',
  nascimento: '14/02/1982',
  idade: '44 anos',
  sexo: 'Masculino',
  registro: 'FIC-0044-1982',
  cidade: 'Serra Clara do Aurora — UF fictícia',
}

export const AVISO_FICTICIO = 'DOCUMENTO FICTÍCIO — USO EM TESTES'

const CSS = `
  @page { size: A4; margin: 16mm 14mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1d2327; font-size: 11pt; margin: 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-end;
         border-bottom: 3px solid var(--cor, #1f6f78); padding-bottom: 8px; margin-bottom: 12px; }
  .marca { font-size: 17pt; font-weight: 700; color: var(--cor, #1f6f78); letter-spacing: .3px; }
  .marca small { display: block; font-size: 8.5pt; font-weight: 400; color: #55636b; letter-spacing: 0; }
  .contato { text-align: right; font-size: 8.5pt; color: #55636b; line-height: 1.35; }
  .paciente { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; font-size: 9.5pt;
              background: #f4f7f8; border: 1px solid #d9e1e4; padding: 8px 10px; margin-bottom: 14px; }
  .paciente b { color: #33424a; }
  h1 { font-size: 13pt; margin: 6px 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  h2 { font-size: 10.5pt; margin: 14px 0 6px; color: #33424a; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { text-align: left; font-size: 8.5pt; color: #55636b; border-bottom: 1px solid #b9c5ca; padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #e6ecee; }
  td.res { font-weight: 700; }
  .nota { font-size: 8.5pt; color: #55636b; margin-top: 8px; }
  p { line-height: 1.45; margin: 6px 0; }
  .assinatura { margin-top: 28px; font-size: 9.5pt; }
  .assinatura .linha { border-top: 1px solid #1d2327; width: 260px; padding-top: 4px; }
  .rodape { margin-top: 32px; text-align: center; font-size: 7pt; color: #8a979d; letter-spacing: .4px; }
  @media print { .rodape { display: none; } }
  .caixa { border: 1px solid #b9c5ca; padding: 10px 12px; margin: 8px 0; }
  ol li, ul li { margin: 4px 0; line-height: 1.4; }
`

export interface Instituicao {
  nome: string
  subtitulo: string
  endereco: string
  cor: string
}

export const INST = {
  laboratorio: {
    nome: 'Laboratório Quaresmeira',
    subtitulo: 'Análises Clínicas · CNES fictício 9900001',
    endereco: 'Rua das Paineiras, 418 — Centro, Serra Clara do Aurora',
    cor: '#1f6f78',
  },
  imagem: {
    nome: 'Imagem Serra Clara',
    subtitulo: 'Radiologia e Diagnóstico por Imagem',
    endereco: 'Av. Jatobá, 1200 — Jardim Alvorada, Serra Clara do Aurora',
    cor: '#4a4e8f',
  },
  clinica: {
    nome: 'Clínica Ipê-Roxo',
    subtitulo: 'Clínica Médica · Cardiologia · Pneumologia',
    endereco: 'Rua dos Sabiás, 77 — Vila Primavera, Serra Clara do Aurora',
    cor: '#7a3b69',
  },
  hospital: {
    nome: 'Hospital Municipal Vale do Jacarandá',
    subtitulo: 'Pronto-socorro e Internação',
    endereco: 'Estrada do Jacarandá, km 3 — Serra Clara do Aurora',
    cor: '#8a4b14',
  },
  cardio: {
    nome: 'Instituto Cardiológico Sabiá',
    subtitulo: 'Métodos Gráficos em Cardiologia',
    endereco: 'Praça das Acácias, 15 — Centro, Serra Clara do Aurora',
    cor: '#a02c2c',
  },
} satisfies Record<string, Instituicao>

export const PROFISSIONAIS = {
  bioquimica: 'Dra. Helena Albuquerque Prado — CRF-FIC 00412 (responsável técnica)',
  radiologista: 'Dr. Otávio Mendonça Lessa — CRM-FIC 10.233 · RQE 4471',
  clinico: 'Dra. Beatriz Nogueira Sallum — CRM-FIC 20.918 · Clínica Médica',
  hospitalista: 'Dr. Rafael Cunha Boaventura — CRM-FIC 31.502 · Pneumologia',
  cardiologista: 'Dr. Caio Vasconcelos Ribas — CRM-FIC 18.640 · Cardiologia',
}

export function pagina(inst: Instituicao, titulo: string, meta: string[], corpo: string, assinatura: string) {
  const metaHtml = meta.map((m) => `<div>${m}</div>`).join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>${CSS}</style></head><body style="--cor:${inst.cor}">
<div class="cab">
  <div class="marca">${inst.nome}<small>${inst.subtitulo}</small></div>
  <div class="contato">${inst.endereco}<br>Tel. (00) 4000-0000 · atendimento@exemplo.test</div>
</div>
<div class="paciente">
  <div><b>Paciente:</b> ${PACIENTE.nome}</div>
  <div><b>Registro:</b> ${PACIENTE.registro}</div>
  <div><b>Nascimento:</b> ${PACIENTE.nascimento} (${PACIENTE.idade})</div>
  <div><b>Sexo:</b> ${PACIENTE.sexo}</div>
  ${metaHtml}
</div>
<h1>${titulo}</h1>
${corpo}
<div class="assinatura"><div class="linha">${assinatura}</div></div>
<div class="rodape">${AVISO_FICTICIO} · ${PACIENTE.cidade} · dados inventados, sem relação com pessoas reais</div>
</body></html>`
}

type Linha = [analito: string, resultado: string, unidade: string, referencia: string]

function tabela(linhas: Linha[]) {
  const corpo = linhas
    .map(([a, r, u, ref]) => `<tr><td>${a}</td><td class="res">${r}</td><td>${u}</td><td>${ref}</td></tr>`)
    .join('')
  return `<table><thead><tr><th>Exame</th><th>Resultado</th><th>Unidade</th><th>Valores de referência</th></tr></thead>
<tbody>${corpo}</tbody></table>`
}

function metaLab(coleta: string, emissao: string, pedido: string) {
  return [
    `<div><b>Data da coleta:</b> ${coleta}</div>`,
    `<div><b>Data de emissão:</b> ${emissao}</div>`,
    `<div><b>Solicitante:</b> ${PROFISSIONAIS.clinico.split(' — ')[0]}</div>`,
    `<div><b>Pedido nº:</b> ${pedido}</div>`,
  ]
}

export interface ValoresHemograma {
  hemacias: string
  hemoglobina: string
  hematocrito: string
  vcm: string
  hcm: string
  chcm: string
  rdw: string
  leucocitos: string
  eosinofilos: string
  plaquetas: string
}

export function hemograma(coleta: string, emissao: string, pedido: string, v: ValoresHemograma) {
  const corpo = `<h2>Eritrograma</h2>
${tabela([
  ['Hemácias', v.hemacias, 'milhões/µL', '4,50 a 5,90'],
  ['Hemoglobina', v.hemoglobina, 'g/dL', '13,5 a 17,5'],
  ['Hematócrito', v.hematocrito, '%', '41,0 a 53,0'],
  ['VCM (volume corpuscular médio)', v.vcm, 'fL', '80,0 a 100,0'],
  ['HCM (hemoglobina corpuscular média)', v.hcm, 'pg', '26,0 a 34,0'],
  ['CHCM (concentração de HCM)', v.chcm, 'g/dL', '31,0 a 36,0'],
  ['RDW', v.rdw, '%', '11,5 a 14,5'],
])}
<h2>Leucograma e plaquetas</h2>
${tabela([
  ['Leucócitos totais', v.leucocitos, 'mil/µL', '4,0 a 11,0'],
  ['Eosinófilos', v.eosinofilos, '%', '1,0 a 6,0'],
  ['Plaquetas', v.plaquetas, 'mil/µL', '150 a 450'],
])}
<p class="nota">Material: sangue total com EDTA. Método: citometria de fluxo automatizada com revisão microscópica.</p>`
  return pagina(
    INST.laboratorio,
    'Hemograma completo',
    metaLab(coleta, emissao, pedido),
    corpo,
    PROFISSIONAIS.bioquimica,
  )
}

export function perfilLipidico() {
  const corpo = `${tabela([
    ['Colesterol total', '212', 'mg/dL', 'Desejável: < 190'],
    ['LDL-colesterol', '138', 'mg/dL', 'Desejável: < 130'],
    ['HDL-colesterol', '38', 'mg/dL', 'Desejável: > 40'],
    ['Triglicerídeos', '180', 'mg/dL', 'Desejável: < 150'],
  ])}
<p class="nota">Jejum de 12 horas. LDL calculado pela equação de Martin/Hopkins. Valores de referência
conforme diretriz brasileira de dislipidemias para adultos sem fator de risco adicional.</p>`
  return pagina(
    INST.laboratorio,
    'Perfil lipídico',
    metaLab('12/03/2026', '13/03/2026', 'Q-26-031207'),
    corpo,
    PROFISSIONAIS.bioquimica,
  )
}

export function glicemia() {
  const corpo = `${tabela([
    ['Glicemia de jejum', '99', 'mg/dL', '70 a 99'],
    ['Hemoglobina glicada (HbA1c)', '5,8', '%', '4,0 a 5,6'],
  ])}
<p class="nota">HbA1c por HPLC certificado NGSP. Glicose por método enzimático (hexoquinase).
Valores de HbA1c entre 5,7% e 6,4% sugerem risco aumentado para diabetes.</p>`
  return pagina(
    INST.laboratorio,
    'Glicemia de jejum e hemoglobina glicada',
    metaLab('19/03/2026', '20/03/2026', 'Q-26-031944'),
    corpo,
    PROFISSIONAIS.bioquimica,
  )
}

export function raioXTorax() {
  const corpo = `<div class="caixa"><b>Exame:</b> Radiografia de tórax — incidências PA e perfil<br>
<b>Indicação clínica:</b> tosse seca há 3 semanas em paciente asmático e hipertenso.</div>
<h2>Técnica</h2>
<p>Exame realizado em aparelho digital, em inspiração profunda, com boa penetração e centralização.</p>
<h2>Achados</h2>
<p>Campos pulmonares com transparência preservada, sem consolidações ou nódulos. Discreto espessamento
peribrônquico bilateral, de predomínio para-hilar. Seios costofrênicos livres. Área cardíaca dentro dos
limites da normalidade. Aorta de contornos regulares. Estruturas ósseas sem alterações.</p>
<h2>Impressão diagnóstica</h2>
<p>Espessamento peribrônquico discreto, compatível com doença inflamatória de vias aéreas (asma).
Ausência de sinais de pneumonia. Correlacionar com dados clínicos.</p>`
  return pagina(
    INST.imagem,
    'Laudo de radiografia de tórax',
    [
      '<div><b>Data do exame:</b> 20/04/2026</div>',
      '<div><b>Data do laudo:</b> 20/04/2026</div>',
      '<div><b>Atendimento:</b> RX-26-08821</div>',
      '<div><b>Convênio:</b> Particular</div>',
    ],
    corpo,
    PROFISSIONAIS.radiologista,
  )
}

export function receita() {
  const corpo = `<p><b>Uso oral</b></p>
<ol>
  <li><b>Losartana potássica 50 mg</b> — 30 comprimidos.<br>
  Tomar 1 comprimido por via oral, 1 vez ao dia, pela manhã. Uso contínuo.</li>
</ol>
<p><b>Uso inalatório</b></p>
<ol start="2">
  <li><b>Budesonida 160 mcg + formoterol 4,5 mcg</b> (pó para inalação) — 1 inalador com 120 doses.<br>
  Inalar 1 dose a cada 12 horas (manhã e noite). Enxaguar a boca após o uso. Uso contínuo.</li>
</ol>
<p class="nota">Retorno em 60 dias com exames. Em caso de falta de ar intensa, procurar pronto-atendimento.</p>`
  return pagina(
    INST.clinica,
    'Receituário médico',
    [
      '<div><b>Data:</b> 22/04/2026</div>',
      '<div><b>Consulta:</b> retorno — clínica médica</div>',
      '<div><b>Diagnósticos:</b> hipertensão arterial; asma</div>',
      '<div><b>Validade:</b> 6 meses (uso contínuo)</div>',
    ],
    corpo,
    PROFISSIONAIS.clinico,
  )
}

export function altaHospitalar() {
  const corpo = `<div class="caixa"><b>Data de entrada:</b> 03/05/2026 · <b>Data da alta:</b> 06/05/2026 ·
<b>Permanência:</b> 3 dias · <b>Setor:</b> Clínica médica — leito 214</div>
<h2>Motivo da internação</h2>
<p>Crise asmática moderada a grave, sem resposta a broncodilatador de resgate no domicílio.
Diagnóstico principal: asma com exacerbação aguda (CID-10 J45.9). Comorbidade: hipertensão arterial (I10).</p>
<h2>Evolução</h2>
<p>Admitido com SpO2 de 89% em ar ambiente e sibilos difusos. Recebeu nebulização com broncodilatador,
corticoide sistêmico e oxigênio suplementar por 36 horas. Evoluiu com melhora progressiva, SpO2 de 96%
em ar ambiente no momento da alta. Pressão arterial controlada durante a internação.</p>
<h2>Prescrição de alta</h2>
<ul>
  <li>Prednisolona 40 mg, 1 vez ao dia por 5 dias.</li>
  <li>Manter budesonida + formoterol inalatório a cada 12 horas.</li>
  <li>Manter losartana potássica 50 mg, 1 vez ao dia.</li>
</ul>
<h2>Orientações</h2>
<p>Retorno ambulatorial com pneumologista em até 7 dias. Retornar ao pronto-socorro se houver piora da
falta de ar, lábios arroxeados ou dificuldade para falar.</p>`
  return pagina(
    INST.hospital,
    'Resumo de alta hospitalar',
    [
      '<div><b>Prontuário:</b> HMVJ-7781</div>',
      '<div><b>Internação:</b> 03/05/2026 a 06/05/2026</div>',
      '<div><b>Médico assistente:</b> Dr. Rafael C. Boaventura</div>',
      '<div><b>Tipo de alta:</b> melhorada</div>',
    ],
    corpo,
    PROFISSIONAIS.hospitalista,
  )
}

export function ecg() {
  const corpo = `${tabela([
    ['Frequência cardíaca', '72', 'bpm', '60 a 100'],
    ['Intervalo PR', '164', 'ms', '120 a 200'],
    ['Duração do QRS', '94', 'ms', '80 a 110'],
    ['QTc (Bazett)', '418', 'ms', '350 a 440'],
  ])}
<h2>Conclusão</h2>
<p>Ritmo sinusal regular. Eixo elétrico normal. Sem alterações de repolarização ventricular.
Discreto aumento de voltagem em derivações precordiais, sem critérios para sobrecarga ventricular esquerda.
Eletrocardiograma dentro dos limites da normalidade.</p>`
  return pagina(
    INST.cardio,
    'Laudo de eletrocardiograma de repouso',
    [
      '<div><b>Data do exame:</b> 20/05/2026</div>',
      '<div><b>Data do laudo:</b> 20/05/2026</div>',
      '<div><b>Equipamento:</b> ECG 12 derivações, 25 mm/s</div>',
      '<div><b>Indicação:</b> avaliação de hipertensão</div>',
    ],
    corpo,
    PROFISSIONAIS.cardiologista,
  )
}

export function pedidoPerfilLipidico() {
  const corpo = `<div class="caixa"><b>Guia de solicitação de exames (SP/SADT)</b> · Nº da guia: G-26-040277 ·
<b>Caráter:</b> eletivo</div>
<table><thead><tr><th>Código</th><th>Procedimento solicitado</th><th>Qtd.</th></tr></thead><tbody>
<tr><td>40301397</td><td>Perfil lipídico — colesterol total, HDL, LDL e triglicerídeos</td><td>1</td></tr>
</tbody></table>
<h2>Indicação clínica</h2>
<p>Paciente hipertenso em acompanhamento. Controle de dislipidemia. CID-10: I10, E78.5.</p>`
  return pagina(
    INST.clinica,
    'Pedido médico de exames',
    [
      '<div><b>Data da solicitação:</b> 02/04/2026</div>',
      '<div><b>Solicitante:</b> Dra. Beatriz N. Sallum</div>',
      '<div><b>Convênio:</b> Particular</div>',
      '<div><b>Validade da guia:</b> 30 dias</div>',
    ],
    corpo,
    PROFISSIONAIS.clinico,
  )
}

export function documentoEscaneado() {
  const corpo = `<p>Atesto, para os devidos fins, que o paciente acima identificado esteve em consulta médica
nesta data, devendo permanecer afastado de suas atividades por 2 (dois) dias a partir de 10/07/2026.</p>
<p>CID-10: J45.9</p>`
  return pagina(
    INST.clinica,
    'Atestado médico',
    ['<div><b>Data:</b> 10/07/2026</div>', '<div><b>Via:</b> paciente</div>'],
    corpo,
    PROFISSIONAIS.clinico,
  )
}

export function boleto() {
  const css = `${CSS} .boleto td { border: 1px solid #333; font-size: 9pt; } .linha-dig { font-family: monospace; font-size: 12pt; }`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="cab"><div class="marca">Condomínio Residencial Ipê Amarelo<small>CNPJ fictício 00.000.000/0001-00</small></div>
<div class="contato">Administração: Rua das Begônias, 90 — Serra Clara do Aurora</div></div>
<h1>Boleto de cobrança — taxa condominial</h1>
<p class="linha-dig">00190.00009 01234.567890 12345.678901 1 99990000048750</p>
<table class="boleto"><tbody>
<tr><td><b>Beneficiário</b><br>Condomínio Residencial Ipê Amarelo</td><td><b>Vencimento</b><br>10/08/2026</td></tr>
<tr><td><b>Pagador</b><br>${PACIENTE.nome} — Bloco B, apto 304</td><td><b>Valor do documento</b><br>R$ 487,50</td></tr>
<tr><td colspan="2"><b>Discriminação:</b> taxa ordinária R$ 420,00 · fundo de reserva R$ 42,00 · água R$ 25,50</td></tr>
<tr><td colspan="2"><b>Instruções:</b> após o vencimento cobrar multa de 2% e juros de 1% ao mês.
Não receber após 60 dias do vencimento.</td></tr>
</tbody></table>
<div class="rodape">${AVISO_FICTICIO} · boleto sem valor bancário</div>
</body></html>`
}

export function laudoComImagens(imagens: string[]) {
  const figuras = imagens
    .map(
      (src, i) => `<div style="page-break-before:always"><h2>Imagem anexa ${i + 1}</h2>
<img src="${src}" style="width:100%;image-rendering:pixelated"></div>`,
    )
    .join('')
  const corpo = `<p>Tomografia computadorizada de tórax sem contraste. Imagens de alta resolução anexadas ao laudo
para fins de documentação. Brônquios com discreto espessamento parietal. Sem nódulos pulmonares.</p>${figuras}`
  return pagina(
    INST.imagem,
    'Laudo de tomografia de tórax com imagens anexas',
    ['<div><b>Data do exame:</b> 15/07/2026</div>', '<div><b>Atendimento:</b> TC-26-11902</div>'],
    corpo,
    PROFISSIONAIS.radiologista,
  )
}

export const TEXTO_WHATSAPP = `[25/06/2026 08:41] Marcos Vinícius: Bom dia dra! Saiu o resultado do exame de sangue que a senhora pediu
[25/06/2026 08:42] Marcos Vinícius: Vou digitar aqui pq o app do laboratório não abre o pdf
[25/06/2026 08:44] Marcos Vinícius: Laboratório Quaresmeira, coleta dia 24/06/2026
[25/06/2026 08:44] Marcos Vinícius: Potássio: 4,1 mEq/L (referência 3,5 a 5,1)
[25/06/2026 08:45] Marcos Vinícius: Creatinina: 1,02 mg/dL (referência 0,70 a 1,30)
[25/06/2026 08:45] Marcos Vinícius: Tá tudo normal né? Continuo com a losartana igual?
[25/06/2026 09:12] Dra. Beatriz: Bom dia, Marcos! Está tudo dentro do esperado, pode manter a losartana. Abraço
(${AVISO_FICTICIO})
`

export const TEXTO_SIMPLES = `Anotações pessoais — Marcos Vinícius Teixeira
Lembrar de levar a bombinha na consulta de agosto.
Perguntar à dra. sobre a tosse à noite.
(${AVISO_FICTICIO})
`
