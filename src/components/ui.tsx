import { FONTES } from '../data/seed'
import { ROTULO_SINAL } from '../lib/formato'
import type { FonteId, Medida, Sinal } from '../data/types'
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
   régua que vira a espinha da linha do tempo.                        */

export function Regua({ medida }: { medida: Medida }) {
  const { refMin, refMax, valor } = medida
  const piso = Math.min(refMin, valor)
  const teto = Math.max(refMax, valor)
  const folga = (teto - piso) * 0.28 || 1
  const dominioMin = piso - folga
  const dominioMax = teto + folga
  const pos = (v: number) => ((v - dominioMin) / (dominioMax - dominioMin)) * 100

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
          className="regua__faixa"
          style={{ left: `${pos(refMin)}%`, width: `${pos(refMax) - pos(refMin)}%` }}
        />
        <div className="regua__marca" style={{ left: `${pos(valor)}%` }} />
      </div>
      <div className="regua__legenda num">
        <span style={{ left: `${pos(refMin)}%` }}>{refMin.toLocaleString('pt-BR')}</span>
        <span style={{ left: `${pos(refMax)}%` }}>{refMax.toLocaleString('pt-BR')}</span>
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
  const L = 44, R = 14, T = 16, B = 26, W = 420, H = 132
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
