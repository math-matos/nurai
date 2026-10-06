import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { AvisoIa, Regua, SeloIa } from '../../components/ui'
import { TIPOS } from '../../data/seed'
import type { Evento, Medida, Sinal, TipoId } from '../../data/types'
import type { Extracao } from '../../lib/api'
import { TID } from '../../lib/testids'

const GRAVIDADE: Record<Sinal, number> = { info: 0, normal: 1, atencao: 2, alterado: 3 }
const CONFIANCA_BAIXA = 0.75

/* Números ficam como texto durante a edição para não engolir a vírgula ou o
   ponto no meio da digitação. */
interface Linha {
  nome: string
  valor: string
  unidade: string
  refMin: string
  refMax: string
  sinal: Sinal
  editada: boolean
}

const paraTexto = (n: number) => (Number.isFinite(n) ? String(n).replace('.', ',') : '')
const paraNumero = (t: string) => (t.trim() === '' ? Number.NaN : Number(t.trim().replace(',', '.')))

function linhaDe(m: Medida): Linha {
  return {
    nome: m.nome, valor: paraTexto(m.valor), unidade: m.unidade,
    refMin: paraTexto(m.refMin), refMax: paraTexto(m.refMax), sinal: m.sinal, editada: false,
  }
}

/* Linha editada à mão ganha o sinal da simples comparação com a faixa de
   referência da própria folha — não uma interpretação clínica. */
function medidaDe(l: Linha): Medida | null {
  const valor = paraNumero(l.valor)
  const refMin = paraNumero(l.refMin)
  const refMax = paraNumero(l.refMax)
  if (l.nome.trim() === '' || ![valor, refMin, refMax].every(Number.isFinite) || refMin > refMax) return null
  const sinal: Sinal = l.editada ? (valor >= refMin && valor <= refMax ? 'normal' : 'alterado') : l.sinal
  return { nome: l.nome.trim(), valor, unidade: l.unidade.trim(), refMin, refMax, sinal }
}

function piorSinal(medidas: Medida[], padrao: Sinal): Sinal {
  if (medidas.length === 0) return padrao
  return medidas.reduce<Sinal>((pior, m) => (GRAVIDADE[m.sinal] > GRAVIDADE[pior] ? m.sinal : pior), 'normal')
}

interface Props {
  extracao: Extracao
  arquivo: string
  salvando: boolean
  aoSalvar: (evento: Evento) => void
  aoDescartar: () => void
}

export function Conferencia({ extracao, arquivo, salvando, aoSalvar, aoDescartar }: Props) {
  const original = extracao.evento
  const [data, setData] = useState(original.data)
  const [tipo, setTipo] = useState<TipoId>(original.tipo)
  const [titulo, setTitulo] = useState(original.titulo)
  const [instituicao, setInstituicao] = useState(original.instituicao)
  const [especialidade, setEspecialidade] = useState(original.especialidade ?? '')
  const [resumo, setResumo] = useState(original.resumo)
  const [linhas, setLinhas] = useState<Linha[]>(() => (original.medidas ?? []).map(linhaDe))

  const editarLinha = (indice: number, mudanca: Partial<Linha>, numerica = false) => {
    setLinhas((atuais) => atuais.map((l, i) =>
      (i === indice ? { ...l, ...mudanca, editada: l.editada || numerica } : l)))
  }

  const adicionarLinha = () => setLinhas((atuais) => [
    ...atuais,
    { nome: '', valor: '', unidade: '', refMin: '', refMax: '', sinal: 'info', editada: true },
  ])

  const removerLinha = (indice: number) => setLinhas((atuais) => atuais.filter((_, i) => i !== indice))

  const medidas = linhas.map(medidaDe)
  const valido = titulo.trim() !== '' && instituicao.trim() !== ''
    && /^\d{4}-\d{2}-\d{2}$/.test(data) && medidas.every((m) => m !== null)

  const salvar = () => {
    if (!valido || salvando) return
    const confirmadas = medidas.filter((m): m is Medida => m !== null)
    aoSalvar({
      ...original,
      id: `u${Date.now()}`,
      data,
      tipo,
      titulo: titulo.trim(),
      instituicao: instituicao.trim(),
      especialidade: especialidade.trim() || undefined,
      resumo: resumo.trim(),
      fonte: original.fonte ?? 'paciente',
      tags: original.tags ?? [],
      medidas: confirmadas.length > 0 ? confirmadas : undefined,
      sinal: piorSinal(confirmadas, original.sinal),
      origem: 'OCR + IA',
      documento: arquivo,
      novo: true,
    })
  }

  const confianca = original.confianca
  const baixa = confianca !== undefined && confianca < CONFIANCA_BAIXA

  return (
    <div className="revisao" data-testid={TID.conferencia}>
      <div className="revisao__cabeca">
        <p className="revisao__arquivo"><Icon nome="papel" tamanho={15} /> {arquivo}</p>
        <div className="revisao__selos">
          {confianca !== undefined && (
            <span className={`chip chip--confianca num${baixa ? ' chip--baixa' : ''}`}>
              confiança {Math.round(confianca * 100)}%{baixa && ' · confira com atenção'}
            </span>
          )}
          <SeloIa geradoPor={extracao.geradoPor} />
        </div>
      </div>

      {extracao.avisos.map((a, i) => <AvisoIa key={i}>{a}</AvisoIa>)}

      <div className="revisao__campos">
        <label>
          <span className="label">Título</span>
          <input className="field" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-testid={TID.conferenciaTitulo} />
        </label>
        <label>
          <span className="label">Tipo</span>
          <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value as TipoId)}>
            {(Object.keys(TIPOS) as TipoId[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Data</span>
          <input className="field num" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          <span className="label">Instituição</span>
          <input className="field" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
        </label>
        <label>
          <span className="label">Especialidade</span>
          <input
            className="field" value={especialidade} placeholder="Opcional"
            onChange={(e) => setEspecialidade(e.target.value)}
          />
        </label>
      </div>

      <label className="revisao__resumo">
        <span className="label">Resumo</span>
        <textarea className="field" rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} />
      </label>

      <p className="label revisao__rotulo">Valores extraídos do documento</p>
      {linhas.length === 0 && (
        <p className="revisao__nota">Nenhum valor numérico foi encontrado. Adicione se o documento tiver algum.</p>
      )}
      <ul className="medidas-edicao">
        {linhas.map((l, i) => {
          const medida = medidas[i]
          return (
            <li key={i} className="medida-edicao">
              <div className="medida-edicao__campos">
                <label className="medida-edicao__nome">
                  <span className="label">Nome</span>
                  <input className="field" value={l.nome} onChange={(e) => editarLinha(i, { nome: e.target.value })} />
                </label>
                <label>
                  <span className="label">Valor</span>
                  <input
                    className="field num" inputMode="decimal" value={l.valor}
                    onChange={(e) => editarLinha(i, { valor: e.target.value }, true)}
                  />
                </label>
                <label>
                  <span className="label">Unidade</span>
                  <input className="field" value={l.unidade} onChange={(e) => editarLinha(i, { unidade: e.target.value })} />
                </label>
                <label>
                  <span className="label">Ref. mín.</span>
                  <input
                    className="field num" inputMode="decimal" value={l.refMin}
                    onChange={(e) => editarLinha(i, { refMin: e.target.value }, true)}
                  />
                </label>
                <label>
                  <span className="label">Ref. máx.</span>
                  <input
                    className="field num" inputMode="decimal" value={l.refMax}
                    onChange={(e) => editarLinha(i, { refMax: e.target.value }, true)}
                  />
                </label>
                <button type="button" className="btn btn--quiet medida-edicao__remover" onClick={() => removerLinha(i)}>
                  <Icon nome="fechar" tamanho={14} />
                  <span className="sr-only">Remover {l.nome || 'valor'}</span>
                </button>
              </div>
              {medida
                ? <Regua medida={medida} />
                : <p className="medida-edicao__erro">Preencha nome, valor e faixa de referência (mínimo menor ou igual ao máximo).</p>}
            </li>
          )
        })}
      </ul>
      <div>
        <button type="button" className="btn btn--quiet" onClick={adicionarLinha}>Adicionar valor</button>
      </div>

      <p className="revisao__nota">
        Confira antes de gravar. Nada entra no histórico sem a sua confirmação, e a leitura
        automática pode errar — principalmente em documentos digitalizados.
      </p>

      <div className="revisao__acoes">
        <button type="button" className="btn" onClick={salvar} disabled={!valido || salvando} data-testid={TID.conferenciaSalvar}>
          <Icon nome="check" tamanho={16} /> {salvando ? 'Salvando…' : 'Salvar no histórico'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={aoDescartar} disabled={salvando} data-testid={TID.conferenciaDescartar}>
          Descartar
        </button>
      </div>
    </div>
  )
}
