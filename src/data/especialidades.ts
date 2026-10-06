/* Chave de comparação: maiúsculas, acentos e espaços extras não distinguem especialidades. */
export const chaveEspecialidade = (nome: string) =>
  nome.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()

export interface GrupoEspecialidade {
  rotulo: string
  n: number
}

/* Uma aba por especialidade. A variante que só acrescenta palavras ("Radiologia e Diagnóstico por Imagem")
   entra na mais curta ("Radiologia"): é a mesma busca por trecho que o resumo do servidor faz com o rótulo.
   Grafias de `preferidos` ganham; senão fica a primeira que apareceu. Mais frequentes primeiro. */
export function agruparEspecialidades(nomes: (string | undefined)[], preferidos: string[] = []): GrupoEspecialidade[] {
  const preferido = new Map(preferidos.map((p) => [chaveEspecialidade(p), p]))
  const porChave = new Map<string, GrupoEspecialidade>()
  for (const nome of nomes) {
    const rotulo = nome?.trim()
    if (!rotulo) continue
    const chave = chaveEspecialidade(rotulo)
    const atual = porChave.get(chave)
    porChave.set(chave, { rotulo: atual?.rotulo ?? preferido.get(chave) ?? rotulo, n: (atual?.n ?? 0) + 1 })
  }

  const grupos = new Map<string, GrupoEspecialidade>()
  const chaves = [...porChave.keys()].sort((a, b) => a.length - b.length)
  for (const chave of chaves) {
    const base = [...grupos.keys()].find((k) => chave.startsWith(`${k} `))
    const { rotulo, n } = porChave.get(chave)!
    if (base) grupos.set(base, { ...grupos.get(base)!, n: grupos.get(base)!.n + n })
    else grupos.set(chave, { rotulo, n })
  }
  return [...grupos.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
