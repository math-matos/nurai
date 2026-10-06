/* Prova, sem servidor, que os fixtures servem para o que o gabarito diz:
   PDFs legíveis por máquina contêm os valores esperados, o escaneado não tem texto,
   o grande passa de 4 MB e o corrompido não abre. Uso: pnpm e2e:verificar */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extractText } from 'unpdf'
import { AVISO_FICTICIO } from './modelos.ts'
import { DIR_DOCUMENTOS } from './gerar.ts'
import { GABARITOS, ehErro, normalizar, type Gabarito } from './gabaritos.ts'

const LIMITE_SERVIDOR = 4 * 1024 * 1024
const MINIMO_ARQUIVO_GRANDE = 4.2 * 1024 * 1024
/* Mesmo critério do servidor (server/ai/pdf.ts): menos de 20 caracteres úteis = sem texto. */
const MINIMO_CARACTERES = 20

const numeroBr = (n: number) => String(n).replace('.', ',')
const dataBr = (iso: string) => iso.split('-').reverse().join('/')
const ehPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'

async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(new Uint8Array(bytes), {
    mergePages: true,
  })
  return text
}

async function verificar(g: Gabarito): Promise<string[]> {
  const bytes = new Uint8Array(await readFile(join(DIR_DOCUMENTOS, g.arquivo)))
  const falhas: string[] = []
  const esperado = g.esperado

  if (ehErro(esperado)) {
    switch (esperado.erro) {
      case 'PDF_SEM_TEXTO': {
        if (!ehPdf(bytes)) falhas.push('deveria ser um PDF válido')
        const uteis = (await textoDoPdf(bytes)).replace(/\s+/g, '').length
        if (uteis >= MINIMO_CARACTERES) falhas.push(`tem ${uteis} caracteres de texto; esperado < ${MINIMO_CARACTERES}`)
        break
      }
      case 'ARQUIVO_GRANDE':
        if (bytes.length <= MINIMO_ARQUIVO_GRANDE || bytes.length <= LIMITE_SERVIDOR) {
          falhas.push(`tem ${bytes.length} bytes; esperado > ${MINIMO_ARQUIVO_GRANDE}`)
        }
        if (!ehPdf(bytes)) falhas.push('deveria ser um PDF válido (só grande demais)')
        break
      case 'PDF_INVALIDO': {
        if (ehPdf(bytes)) falhas.push('começa com %PDF-; o servidor tentaria abrir')
        const abriu = await textoDoPdf(bytes).then(
          () => true,
          () => false,
        )
        if (abriu) falhas.push('unpdf conseguiu abrir o arquivo')
        break
      }
      case 'NAO_PDF':
        if (ehPdf(bytes)) falhas.push('não deveria ser PDF')
        if (!g.arquivo.endsWith('.txt')) falhas.push('esperado arquivo .txt')
        break
      case 'NAO_CLINICO': {
        const texto = normalizar(await textoDoPdf(bytes))
        if (texto.length < 200) falhas.push('texto curto demais; o erro seria PDF_SEM_TEXTO, não NAO_CLINICO')
        if (!texto.includes(normalizar(AVISO_FICTICIO))) falhas.push('sem o aviso de documento fictício')
        break
      }
    }
    return falhas
  }

  const bruto = g.modo === 'texto' ? new TextDecoder().decode(bytes) : await textoDoPdf(bytes)
  const texto = normalizar(bruto)
  if (g.modo === 'pdf' && !ehPdf(bytes)) falhas.push('não é PDF')
  if (!texto.includes(normalizar(AVISO_FICTICIO))) falhas.push('sem o aviso de documento fictício')

  for (const data of ([] as string[]).concat(esperado.data ?? [])) {
    if (!texto.includes(dataBr(data))) falhas.push(`data ${dataBr(data)} não aparece no texto`)
  }
  for (const m of esperado.medidas ?? []) {
    if (!texto.includes(numeroBr(m.valor))) falhas.push(`valor ${numeroBr(m.valor)} (${m.nome}) não aparece`)
    if (typeof m.unidade === 'string' && !texto.includes(normalizar(m.unidade))) {
      falhas.push(`unidade ${m.unidade} (${m.nome}) não aparece`)
    }
  }
  for (const nome of esperado.medidasOmitidasEsperadas ?? []) {
    if (!new RegExp(`${normalizar(nome)}[^\\n]*>\\s*\\d`).test(texto)) {
      falhas.push(`${nome} com faixa "> X" não aparece`)
    }
  }
  for (const termo of esperado.palavrasChave ?? []) {
    if (!texto.includes(normalizar(termo))) falhas.push(`termo "${termo}" não aparece`)
  }
  return falhas
}

let reprovados = 0
for (const g of GABARITOS) {
  let falhas: string[]
  try {
    falhas = await verificar(g)
  } catch (erro) {
    falhas = [`erro inesperado: ${(erro as Error).message}`]
  }
  const alvo = ehErro(g.esperado) ? `erro ${g.esperado.erro}` : `${g.esperado.medidas?.length ?? 0} medidas`
  console.log(`${falhas.length ? 'FAIL' : 'PASS'}  ${g.arquivo.padEnd(42)} ${alvo}`)
  for (const f of falhas) console.log(`      - ${f}`)
  if (falhas.length) reprovados++
}
console.log(`\n${GABARITOS.length - reprovados}/${GABARITOS.length} documentos conferem com o gabarito`)
process.exitCode = reprovados ? 1 : 0
