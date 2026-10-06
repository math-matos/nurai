import { geometriaRegua } from '../data/referencia'
import { FONTES } from '../data/seed'
import { ROTULO_SINAL, formatarData } from '../lib/formato'
import { navegar } from '../lib/router'
import { TID } from '../lib/testids'
import type { Evento, FonteId, Medida, Sinal } from '../data/types'
import { Icon, type NomeIcone } from './Icon'

/* ---------------- marca ---------------- */

export function Marca({ tamanho = 26, com = true }: { tamanho?: number; com?: boolean }) {
  return (
    <span className="marca" style={{ ['--m' as string]: `${tamanho}px` }}>
      <svg viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="var(--accent)" />
        <path d="M7 21V11m0 0 9 10.5M16 21.5V11" fill="none" stroke="var(--ink-inv)"
          strokeWidth="2.6" strokeLinecap="square" />
        <path d="M21.5 16.2h3.6" stroke="var(--accent-line)" strokeWidth="2.6" strokeLinecap="square" />
      </svg>
      {com && <span className="marca__nome">Nurai</span>}
    </span>
  )
}

/* ---------------- notação ---------------- */

export function ChipSinal({ sinal }: { sinal: Sinal }) {
  return (
    <span className={`chip chip--sinal sinal-${sinal}`}>
      <span className="chip__dot" />
      {ROTULO_SINAL[sinal]}
    </span>
  )
}

export function ChipFonte({ fonte, curto = false }: { fonte: FonteId; curto?: boolean }) {
  const f = FONTES[fonte]
  return (
    <span className="chip chip--fonte" style={{ ['--c' as string]: f.cor }}>
      <span className="chip__faixa" />
      {curto ? f.curto : f.nome}
    </span>
  )
}

/* ---------------- régua de faixa de referência ----------------
   Componente-assinatura: a mesma notação da folha de exame, e a mesma
   régua que vira a espinha da linha do tempo. Faixa só com piso ou
   só com teto ("> 40", "< 130") fica aberta do lado sem limite.     */

export function Regua({ medida }: { medida: Medida }) {
  const { faixa, marca, limites } = geometriaRegua(medida)
  const aberta = medida.refMin === undefined ? ' regua__faixa--sem-piso' : medida.refMax === undefined ? ' regua__faixa--sem-teto' : ''

  return (
    <div className={`regua sinal-${medida.sinal}`}>
      <div className="regua__topo">
        <span className="regua__nome">{medida.nome}</span>
        <span className="regua__valor num">
          {medida.valor.toLocaleString('pt-BR')}
          <span className="regua__unidade">{medida.unidade}</span>
        </span>
      </div>
      <div className="regua__pista">
        <div
          className={`regua__faixa${aberta}`}
          style={{ left: `${faixa.inicio}%`, width: `${faixa.fim - faixa.inicio}%` }}
        />
        <div className="regua__marca" style={{ left: `${marca}%` }} />
      </div>
      <div className="regua__legenda num">
        {limites.map((l) => <span key={l.texto} style={{ left: `${l.posicao}%` }}>{l.texto}</span>)}
        <span className="regua__ref">faixa de referência</span>
      </div>
    </div>
  )
}

/* ---------------- série temporal ---------------- */

export function Serie({
  nome, unidade, pontos,
}: { nome: string; unidade: string; pontos: { data: string; valor: number }[] }) {
  const valores = pontos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const span = max - min || 1
  /* R cobre meia largura do rótulo "MM/AAAA" centrado no último ponto; com 14 ele era cortado. */
  const L = 44, R = 28, T = 16, B = 26, W = 420, H = 132
  const x = (i: number) => L + (i / Math.max(pontos.length - 1, 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B)
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.valor)}`).join(' ')

  return (
    <figure className="serie">
      <figcaption className="serie__titulo label">{nome} · {unidade}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="serie__svg" role="img"
        aria-label={`${nome}: ${pontos.map((p) => `${p.data} ${p.valor}`).join(', ')}`}>
        <line x1={L} y1={y(max)} x2={W - R} y2={y(max)} className="serie__grade" />
        <line x1={L} y1={y(min)} x2={W - R} y2={y(min)} className="serie__grade" />
        <text x={L - 8} y={y(max) + 4} className="serie__eixo num" textAnchor="end">
          {max.toLocaleString('pt-BR')}
        </text>
        <text x={L - 8} y={y(min) + 4} className="serie__eixo num" textAnchor="end">
          {min.toLocaleString('pt-BR')}
        </text>
        <path d={linha} className="serie__linha" />
        {pontos.map((p, i) => (
          <g key={p.data}>
            <circle cx={x(i)} cy={y(p.valor)} r="3.5" className="serie__ponto" />
            <text x={x(i)} y={H - 8} className="serie__rotulo num" textAnchor="middle">{p.data}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* ---------------- vazio ---------------- */

export function Vazio({
  icone, titulo, texto, acao,
}: { icone: NomeIcone; titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <div className="vazio">
      <span className="vazio__icone"><Icon nome={icone} tamanho={22} /></span>
      <p className="vazio__titulo">{titulo}</p>
      <p className="vazio__texto">{texto}</p>
      {acao}
    </div>
  )
}

/* Histórico ainda sem nenhum registro: toda tela do app aponta para o mesmo primeiro passo. */
export function VazioHistorico({ titulo, texto, icone = 'anexar' }: { titulo: string; texto: string; icone?: NomeIcone }) {
  return (
    <div className="vazio-historico" data-testid={TID.estadoVazio}>
      <Vazio
        icone={icone} titulo={titulo} texto={texto}
        acao={
          <button
            type="button" className="btn" data-testid={TID.ctaPrimeiroDocumento}
            onClick={() => navegar('/app/fontes')}
          >
            <Icon nome="anexar" tamanho={16} /> Anexar primeiro documento
          </button>
        }
      />
    </div>
  )
}

/* ---------------- IA: proveniência, aviso, falha ---------------- */

export function SeloIa({ geradoPor }: { geradoPor: 'oci' | 'mock' }) {
  return (
    <span className={`selo selo--${geradoPor}`}>
      <span className="chip__dot" />
      {geradoPor === 'oci' ? 'Gerado por OCI Generative AI' : 'Gerado por IA simulada'}
    </span>
  )
}

export function AvisoIa({ children }: { children: React.ReactNode }) {
  return (
    <p className="turno__aviso">
      <Icon nome="alerta" tamanho={15} />
      {children}
    </p>
  )
}

export function Falha({
  mensagem, aoTentar, tentando = false,
}: { mensagem: string; aoTentar?: () => void; tentando?: boolean }) {
  return (
    <div className="falha" role="alert">
      <Icon nome="alerta" tamanho={15} />
      <p className="falha__texto">{mensagem}</p>
      {aoTentar && (
        <button type="button" className="btn btn--ghost falha__acao" onClick={aoTentar} disabled={tentando}>
          <Icon nome="recomecar" tamanho={14} /> {tentando ? 'Tentando…' : 'Tentar de novo'}
        </button>
      )}
    </div>
  )
}

export function Ancoras({
  ids, eventos, titulo = 'Registros que sustentam esta resposta',
}: { ids: string[]; eventos: Evento[]; titulo?: string }) {
  const encontrados = ids
    .map((id) => eventos.find((e) => e.id === id))
    .filter((e): e is Evento => Boolean(e))
  if (encontrados.length === 0) return null
  return (
    <div className="ancoras">
      <p className="label">{titulo}</p>
      <ul>
        {encontrados.map((e) => (
          <li key={e.id}>
            <button type="button" className="ancora" onClick={() => navegar(`/app/linha/${e.id}`)}>
              <span className="ancora__data num">{formatarData(e.data)}</span>
              <span className="ancora__titulo">{e.titulo}</span>
              <span className="ancora__onde">{e.instituicao}</span>
              <Icon nome="setaCurta" tamanho={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
