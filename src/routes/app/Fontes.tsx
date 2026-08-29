import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ChipFonte, Regua } from '../../components/ui'
import { formatarDataCurta } from '../../lib/formato'
import { FONTES } from '../../data/seed'
import type { Evento, Medida } from '../../data/types'
import { navegar } from '../../lib/router'
import { isoHoje, useAcoes, useEstado } from '../../lib/store'

const PASSOS_LEITURA = [
  'Lendo o documento e separando o que é cabeçalho, resultado e assinatura',
  'Extraindo valores, unidades e faixas de referência',
  'Ligando ao histórico: mesma paciente, mesma série de exames',
]

const MEDIDAS_EXTRAIDAS: Medida[] = [
  { nome: 'Colesterol LDL', valor: 118, unidade: 'mg/dL', refMin: 0, refMax: 100, sinal: 'alterado' },
  { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 45, refMax: 90, sinal: 'atencao' },
  { nome: 'Triglicérides', valor: 165, unidade: 'mg/dL', refMin: 0, refMax: 150, sinal: 'alterado' },
]

type Fase = 'inicio' | 'lendo' | 'revisao'

export function Fontes() {
  const { fontes } = useEstado()
  const { conectarFonte, adicionarEvento } = useAcoes()
  const [fase, setFase] = useState<Fase>('inicio')
  const [passo, setPasso] = useState(0)
  const [arquivo, setArquivo] = useState('perfil-lipidico-ago-2026.pdf')
  const [titulo, setTitulo] = useState('Perfil lipídico completo')
  const [instituicao, setInstituicao] = useState('Laboratório Vetor')
  const [data, setData] = useState(isoHoje())
  const entrada = useRef<HTMLInputElement>(null)

  const processar = (nome?: string) => {
    if (nome) setArquivo(nome)
    setFase('lendo')
    setPasso(0)
    PASSOS_LEITURA.forEach((_, i) => {
      window.setTimeout(() => setPasso(i + 1), 620 * (i + 1))
    })
    window.setTimeout(() => setFase('revisao'), 620 * PASSOS_LEITURA.length + 320)
  }

  const confirmar = () => {
    const evento: Evento = {
      id: `u${Date.now()}`,
      data,
      tipo: 'exame',
      titulo,
      instituicao,
      fonte: 'paciente',
      resumo: 'Documento enviado por você e lido automaticamente. Os três valores abaixo foram extraídos do arquivo e conferidos por você antes de entrar no histórico.',
      sinal: 'alterado',
      medidas: MEDIDAS_EXTRAIDAS,
      tags: ['colesterol', 'enviado'],
      origem: 'OCR + IA',
      confianca: 0.93,
      documento: arquivo,
      novo: true,
    }
    adicionarEvento(evento)
    navegar(`/app/linha/${evento.id}`)
  }

  const conectadas = fontes.filter((f) => f.estado === 'conectado')
  const disponiveis = fontes.filter((f) => f.estado !== 'conectado')

  return (
    <div className="fontes">
      <section className="painel">
        <div className="painel__cabeca">
          <h2>Enviar um documento</h2>
          <p>
            O que só existe em papel entra por foto ou PDF. A leitura extrai valores e
            faixas de referência, mostra o grau de confiança e espera a sua conferência
            antes de gravar qualquer coisa no histórico.
          </p>
        </div>

        {fase === 'inicio' && (
          <div className="soltar">
            <Icon nome="anexar" tamanho={26} />
            <p className="soltar__titulo">Arraste um laudo, receita ou resultado</p>
            <p className="soltar__texto">PDF ou foto. Nesta demonstração nada é enviado a lugar nenhum — o arquivo nem sai do seu computador.</p>
            <div className="soltar__acoes">
              <button type="button" className="btn" onClick={() => entrada.current?.click()}>
                Escolher arquivo
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => processar()}>
                Usar o laudo de exemplo
              </button>
            </div>
            <input
              ref={entrada} type="file" accept="image/*,application/pdf" className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                processar(f ? f.name : undefined)
              }}
            />
          </div>
        )}

        {fase === 'lendo' && (
          <div className="lendo" aria-live="polite">
            <p className="lendo__arquivo"><Icon nome="papel" tamanho={15} /> {arquivo}</p>
            <ol className="lendo__passos">
              {PASSOS_LEITURA.map((p, i) => (
                <li key={p} className={i < passo ? 'feito' : i === passo ? 'ativo' : ''}>
                  <span className="lendo__marca">
                    {i < passo ? <Icon nome="check" tamanho={13} /> : <span className="lendo__ponto" />}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        )}

        {fase === 'revisao' && (
          <div className="revisao">
            <div className="revisao__cabeca">
              <p className="revisao__arquivo"><Icon nome="papel" tamanho={15} /> {arquivo}</p>
              <span className="chip chip--confianca num">confiança 93%</span>
            </div>

            <div className="revisao__campos">
              <label>
                <span className="label">Título</span>
                <input className="field" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <label>
                <span className="label">Instituição</span>
                <input className="field" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
              </label>
              <label>
                <span className="label">Data do exame</span>
                <input className="field num" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
            </div>

            <p className="label revisao__rotulo">Valores extraídos do documento</p>
            {MEDIDAS_EXTRAIDAS.map((m) => <Regua key={m.nome} medida={m} />)}

            <p className="revisao__nota">
              Confira antes de gravar. Nada entra no histórico sem a sua confirmação, e
              qualquer campo pode ser corrigido agora ou depois.
            </p>

            <div className="revisao__acoes">
              <button type="button" className="btn" onClick={confirmar}>
                <Icon nome="check" tamanho={16} /> Adicionar ao histórico
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setFase('inicio')}>
                Descartar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="painel">
        <div className="painel__cabeca">
          <h2>Fontes conectadas</h2>
          <p>
            Cada conexão traz um pedaço do histórico e pode ser desligada a qualquer
            momento em Acessos e consentimento.
          </p>
        </div>

        <ul className="fontes__lista">
          {conectadas.map((f) => (
            <li key={f.id} className="fonte" style={{ ['--c' as string]: FONTES[f.fonte].cor }}>
              <span className="fonte__faixa" />
              <div className="fonte__corpo">
                <p className="fonte__nome">{f.nome}</p>
                <p className="fonte__meta">
                  <ChipFonte fonte={f.fonte} curto />
                  <span className="num">{f.registros} registros</span>
                  <span>última sincronia em {f.ultima}</span>
                </p>
              </div>
              <span className="chip chip--ok"><Icon nome="check" tamanho={12} /> conectada</span>
            </li>
          ))}
        </ul>

        {disponiveis.length > 0 && (
          <>
            <p className="label fontes__rotulo">Disponíveis para conectar</p>
            <ul className="fontes__lista">
              {disponiveis.map((f) => (
                <li key={f.id} className="fonte fonte--off" style={{ ['--c' as string]: FONTES[f.fonte].cor }}>
                  <span className="fonte__faixa" />
                  <div className="fonte__corpo">
                    <p className="fonte__nome">{f.nome}</p>
                    <p className="fonte__meta">{FONTES[f.fonte].nome}</p>
                  </div>
                  <button type="button" className="btn btn--ghost" onClick={() => conectarFonte(f.id)}>
                    Conectar
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="fontes__padrao">
          No produto, cada conexão fala o padrão da fonte — HL7 FHIR na rede pública e
          nos sistemas hospitalares, DICOM para imagem, leitura automática para o que só
          existe em papel. Última sincronia registrada em {formatarDataCurta(isoHoje())}.
        </p>
      </section>
    </div>
  )
}
