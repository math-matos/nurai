import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ChipFonte, Falha } from '../../components/ui'
import { formatarDataCurta } from '../../lib/formato'
import { FONTES } from '../../data/seed'
import { LAUDO_EXEMPLO } from '../../data/exemplos'
import type { Evento } from '../../data/types'
import { api, type Extracao } from '../../lib/api'
import { navegar } from '../../lib/router'
import { isoHoje, useAcoes, useEstado } from '../../lib/store'
import { useRequisicao } from '../../lib/useRequisicao'
import { Conferencia } from './Conferencia'

const LIMITE_PDF = 4 * 1024 * 1024

function ehPdf(arquivo: File) {
  return arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf')
}

export function Fontes() {
  const { fontes, saude } = useEstado()
  const { conectarFonte, adicionarEvento } = useAcoes()
  const leitura = useRequisicao<Extracao>()
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState('')
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [conectando, setConectando] = useState<string | null>(null)
  const [repetir, setRepetir] = useState<(() => void) | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const ocupado = leitura.carregando || salvando
  const comOci = saude?.genai === 'oci'

  const ler = (nome: string, acao: () => Promise<Extracao>) => {
    const executar = () => { void leitura.executar(acao) }
    setArquivo(nome)
    setErroLocal(null)
    setRepetir(() => executar)
    executar()
  }

  const lerTexto = () => {
    const limpo = texto.trim()
    if (!limpo || ocupado) return
    const nome = arquivo || 'texto-colado.txt'
    ler(nome, () => api.extrairTexto(limpo, nome))
  }

  const lerPdf = (f: File | undefined) => {
    if (!f || ocupado) return
    if (!ehPdf(f)) {
      setErroLocal('Por enquanto a leitura aceita PDF com texto. Para foto, cole o texto do documento no campo abaixo.')
      return
    }
    if (f.size > LIMITE_PDF) {
      setErroLocal('O PDF passa de 4 MB. Envie um arquivo menor ou cole o texto do documento.')
      return
    }
    ler(f.name, () => api.extrairPdf(f))
  }

  const carregarExemplo = () => {
    setTexto(LAUDO_EXEMPLO.texto)
    setArquivo(LAUDO_EXEMPLO.nomeArquivo)
    setErroLocal(null)
  }

  const descartar = () => {
    leitura.limpar()
    setArquivo('')
  }

  const salvar = async (evento: Evento) => {
    if (salvando) return
    setSalvando(true)
    const salvo = await adicionarEvento(evento)
    setSalvando(false)
    if (salvo) navegar(`/app/linha/${salvo.id}`)
  }

  const conectar = async (id: string) => {
    setConectando(id)
    await conectarFonte(id)
    setConectando(null)
  }

  const conectadas = fontes.filter((f) => f.estado === 'conectado')
  const disponiveis = fontes.filter((f) => f.estado !== 'conectado')
  const erro = erroLocal ?? leitura.erro

  return (
    <div className="fontes">
      <section className="painel">
        <div className="painel__cabeca">
          <h2>Enviar um documento</h2>
          <p>
            O que só existe em papel entra por PDF ou texto colado. A leitura extrai valores e
            faixas de referência, mostra o grau de confiança e espera a sua conferência
            antes de gravar qualquer coisa no histórico.
          </p>
        </div>

        {leitura.dados && !leitura.carregando ? (
          <Conferencia
            key={arquivo}
            extracao={leitura.dados}
            arquivo={arquivo}
            salvando={salvando}
            aoSalvar={(evento) => { void salvar(evento) }}
            aoDescartar={descartar}
          />
        ) : leitura.carregando ? (
          <div className="lendo" aria-live="polite">
            <p className="lendo__arquivo"><Icon nome="papel" tamanho={15} /> {arquivo}</p>
            <ol className="lendo__passos">
              <li className="ativo">
                <span className="lendo__marca"><span className="lendo__ponto" /></span>
                {comOci ? 'Lendo documento com OCI Generative AI…' : 'Lendo documento com a IA simulada…'}
              </li>
            </ol>
            <p className="lendo__nota">
              Valores, unidades e faixas de referência são separados do resto do documento.
              Costuma levar de 5 a 20 segundos.
            </p>
          </div>
        ) : (
          <div className="enviar">
            <div
              className="soltar"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); lerPdf(e.dataTransfer.files[0]) }}
            >
              <Icon nome="anexar" tamanho={26} />
              <p className="soltar__titulo">Arraste um laudo ou resultado em PDF</p>
              <p className="soltar__texto">
                PDF com texto selecionável, até 4 MB. O conteúdo é enviado ao servidor da
                demonstração e lido pela IA; use apenas documentos fictícios.
              </p>
              <div className="soltar__acoes">
                <button type="button" className="btn" onClick={() => entrada.current?.click()}>
                  Escolher PDF
                </button>
              </div>
              <input
                ref={entrada} type="file" accept="application/pdf,.pdf" className="sr-only"
                onChange={(e) => {
                  lerPdf(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>

            <label className="colar">
              <span className="label">Ou cole o texto do documento</span>
              <textarea
                className="field colar__texto" rows={8} value={texto}
                placeholder="Cole aqui o texto de um laudo, resultado de exame ou receita"
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
            <div className="colar__acoes">
              <button type="button" className="btn" onClick={lerTexto} disabled={!texto.trim()}>
                Ler texto com IA
              </button>
              <button type="button" className="btn btn--ghost" onClick={carregarExemplo}>
                Carregar exemplo
              </button>
            </div>

            {erro && (
              <Falha
                mensagem={erro}
                aoTentar={leitura.erro && leitura.repetivel && !erroLocal && repetir ? repetir : undefined}
              />
            )}
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
                  <button
                    type="button" className="btn btn--ghost" disabled={conectando !== null}
                    onClick={() => { void conectar(f.id) }}
                  >
                    {conectando === f.id ? 'Conectando…' : 'Conectar'}
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
