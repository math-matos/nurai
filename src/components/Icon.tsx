/* Conjunto autoral. Um só traço (1.6), terminações retas, grade de 24.
   Nada de emoji ou glifo como ícone. */

const CAMINHOS: Record<string, React.ReactNode> = {
  linha: <><path d="M6 3v18" /><path d="M3 7h6M3 12h6M3 17h6" /><path d="M12 7h9M12 12h6M12 17h8" /></>,
  anexar: <><path d="M12 4v13" /><path d="M6.5 9.5 12 4l5.5 5.5" /><path d="M4 20h16" /></>,
  copiloto: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></>,
  bussola: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2 5.2-2Z" /></>,
  resumo: <><path d="M6 3h9l4 4v14H6V3Z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h5" /></>,
  escudo: <><path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  busca: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>,
  filtro: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7" /></>,
  alerta: <><path d="M12 4 3 19h18L12 4Z" /><path d="M12 10v4.5M12 17h.01" /></>,
  seta: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  setaCurta: <><path d="M6 18 18 6" /><path d="M9 6h9v9" /></>,
  fechar: <><path d="m6 6 12 12M18 6 6 18" /></>,
  chevron: <><path d="m9 5 7 7-7 7" /></>,
  recomecar: <><path d="M4 12a8 8 0 1 1 2.6 5.9" /><path d="M4 19v-5h5" /></>,
  instituicao: <><path d="M3 20h18" /><path d="M5 20V9l7-4 7 4v11" /><path d="M10 20v-5h4v5" /></>,
  pessoa: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  papel: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  cadeado: <><rect x="4.5" y="10" width="15" height="10.5" rx="1.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  raio: <><path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" /></>,
  gota: <><path d="M12 3.5c3.4 3.6 5.5 6.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2.7 2.1-5.4 5.5-9Z" /></>,
  coracao: <><path d="M12 20S4 15.2 4 9.9A4.4 4.4 0 0 1 12 7.4 4.4 4.4 0 0 1 20 9.9C20 15.2 12 20 12 20Z" /></>,
  bisturi: <><path d="M4 20 14 10l6-6v6L10 20H4Z" /><path d="M10 14h.01" /></>,
  seringa: <><path d="m14 4 6 6" /><path d="m17.5 6.5-9 9L4 20l4.5-1.5 9-9" /><path d="m11 9 4 4" /></>,
  imagem: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="m4 16 4.5-4.5 3.5 3.5 3-3L20 16" /><circle cx="9" cy="9" r="1.4" /></>,
  leito: <><path d="M3 19V8" /><path d="M3 12h13a4 4 0 0 1 4 4v3" /><circle cx="8" cy="9" r="2" /></>,
  frasco: <><path d="M10 3v6.5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9.5V3" /><path d="M9 3h6M7.5 14h9" /></>,
  nuvem: <><path d="M7 18h10a3.5 3.5 0 0 0 .4-7A5.2 5.2 0 0 0 7.4 10 3.9 3.9 0 0 0 7 18Z" /></>,
  base: <><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" /></>,
  chave: <><circle cx="8" cy="12" r="4" /><path d="M12 12h8M17 12v3.5M20 12v2.5" /></>,
  olho: <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></>,
}

export type NomeIcone = keyof typeof CAMINHOS

export function Icon({
  nome, tamanho = 18, className, ...resto
}: { nome: NomeIcone; tamanho?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {CAMINHOS[nome]}
    </svg>
  )
}
