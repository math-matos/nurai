import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { GABARITOS } from './fixtures/gabaritos.ts'
import { DIR_DOCUMENTOS, gerarDocumentos } from './fixtures/gerar.ts'

/* Os documentos são artefatos (gitignored): gera na primeira execução ou quando algum sumiu. */
export default async function globalSetup() {
  const faltando = await Promise.all(
    GABARITOS.map((g) =>
      access(join(DIR_DOCUMENTOS, g.arquivo)).then(
        () => false,
        () => true,
      ),
    ),
  )
  if (faltando.some(Boolean)) await gerarDocumentos()
}
