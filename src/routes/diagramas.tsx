/* Diagramas autorais do dossiê. Mesma gramática das telas: traço fino,
   cantos de 4px, tinta sobre papel, verde-clínico só onde há decisão. */

function Texto({
  x, y, linhas, anchor = 'middle', classe = 'dg__txt',
}: { x: number; y: number; linhas: string[]; anchor?: 'middle' | 'start' | 'end'; classe?: string }) {
  return (
    <>
      {linhas.map((l, i) => (
        <text key={l} x={x} y={y + i * 14} textAnchor={anchor} className={classe}>{l}</text>
      ))}
    </>
  )
}

function Caixa({
  x, y, w, h, linhas, variante = 'solida',
}: {
  x: number; y: number; w: number; h: number; linhas: string[]
  variante?: 'solida' | 'tracejada' | 'acento' | 'suave'
}) {
  const meio = y + h / 2 - ((linhas.length - 1) * 14) / 2 + 4
  return (
    <g className={`dg__caixa dg__caixa--${variante}`}>
      <rect x={x} y={y} width={w} height={h} rx="4" />
      <Texto x={x + w / 2} y={meio} linhas={linhas} />
    </g>
  )
}

/* ------------------------------------------------------------------ */

const ATORES: { x: number; y: number; linhas: string[]; derivado?: boolean }[] = [
  { x: 360, y: 60, linhas: ['Médicos e', 'equipe clínica'] },
  { x: 567, y: 132, linhas: ['Hospitais'] },
  { x: 618, y: 292, linhas: ['Laboratórios', 'e imagem'] },
  { x: 475, y: 421, linhas: ['Rede pública', 'SUS · RNDS'] },
  { x: 245, y: 421, linhas: ['Operadoras e', 'seguradoras'], derivado: true },
  { x: 102, y: 292, linhas: ['Pesquisa e', 'ensaios clínicos'], derivado: true },
  { x: 153, y: 132, linhas: ['Reguladores', 'ANPD · CFM · ANVISA'], derivado: true },
]

export function Stakeholders() {
  const cx = 360, cy = 250
  return (
    <svg viewBox="0 0 720 530" className="dg" role="img"
      aria-label="Mapa de stakeholders: o paciente no centro, a Nurai como camada de contexto, e sete atores ao redor.">
      {ATORES.map((a) => {
        const dx = a.x - cx, dy = a.y - cy
        const d = Math.hypot(dx, dy)
        return (
          <line
            key={a.linhas[0]}
            x1={cx + (dx / d) * 62} y1={cy + (dy / d) * 62}
            x2={a.x - (dx / d) * 40} y2={a.y - (dy / d) * 26}
            className={a.derivado ? 'dg__ligacao dg__ligacao--derivada' : 'dg__ligacao'}
          />
        )
      })}

      <ellipse cx={cx} cy={cy} rx="152" ry="124" className="dg__anel" />
      <g className="dg__etiqueta">
        <rect x={cx - 118} y={cy - 140} width="236" height="24" rx="4" />
        <text x={cx} y={cy - 123} textAnchor="middle">Nurai · camada de contexto e consentimento</text>
      </g>

      <circle cx={cx} cy={cy} r="58" className="dg__centro" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="dg__centro-txt">Paciente</text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="dg__centro-sub">titular do dado</text>

      {ATORES.map((a) => (
        <Caixa
          key={a.linhas.join()}
          x={a.x - 78} y={a.y - (a.linhas.length > 1 ? 24 : 17)}
          w={156} h={a.linhas.length > 1 ? 48 : 34}
          linhas={a.linhas}
          variante={a.derivado ? 'suave' : 'solida'}
        />
      ))}

      <g className="dg__legenda">
        <line x1="196" y1="497" x2="228" y2="497" className="dg__ligacao" />
        <text x="236" y="501">dado clínico, com consentimento do titular</text>
        <line x1="196" y1="516" x2="228" y2="516" className="dg__ligacao dg__ligacao--derivada" />
        <text x="236" y="520">acesso derivado — nunca o histórico bruto</text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

const ETAPAS_JORNADA = [
  ['Conectar', 'as fontes'],
  ['Linha do tempo', 'reunida'],
  ['Perguntar ao', 'copiloto'],
  ['Ver os', 'próximos passos'],
  ['Gerar o resumo', 'e compartilhar'],
]

export function Jornada() {
  const larg = 172, alt = 66, y = 148, passo = 196
  const x = (i: number) => 24 + i * passo
  return (
    <svg viewBox="0 0 1030 250" className="dg" role="img"
      aria-label="Jornada do usuário: conectar fontes, linha do tempo reunida, anexar documento em ciclo, perguntar ao copiloto, próximos passos, resumo para consulta e a decisão no consultório.">
      {ETAPAS_JORNADA.map((linhas, i) => (
        <g key={linhas.join()}>
          <Caixa x={x(i)} y={y} w={larg} h={alt} linhas={linhas}
            variante={i === ETAPAS_JORNADA.length - 1 ? 'acento' : 'solida'} />
          {i < ETAPAS_JORNADA.length - 1 && (
            <path d={`M${x(i) + larg + 4} ${y + alt / 2} H${x(i + 1) - 6}`}
              className="dg__seta" markerEnd="url(#ponta)" />
          )}
          <text x={x(i) + larg / 2} y={y + alt + 20} textAnchor="middle" className="dg__passo num">
            {String(i + 1).padStart(2, '0')}
          </text>
        </g>
      ))}

      <Caixa x={x(1)} y={34} w={larg} h={58} variante="tracejada"
        linhas={['Anexar documento', 'e conferir a extração']} />
      <path d={`M${x(1) + larg / 2 - 26} 94 V${y - 8}`} className="dg__seta" markerEnd="url(#ponta)" />
      <path d={`M${x(1) + larg / 2 + 26} ${y - 8} V94`} className="dg__seta dg__seta--fina" markerEnd="url(#ponta)" />
      <text x={x(1) + larg / 2 + 96} y={124} className="dg__nota">a cada papel novo</text>

      <defs>
        <marker id="ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 8 4 0 8Z" className="dg__ponta" />
        </marker>
      </defs>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export function Arquitetura() {
  return (
    <svg viewBox="0 0 1000 560" className="dg" role="img"
      aria-label="Arquitetura em camadas: interface no navegador, contrato de dados com API Hono, OCI Generative AI e Oracle Autonomous Database já construídos, e o restante da camada gerenciada tracejado como próxima fase.">
      <g className="dg__banda">
        <rect x="20" y="34" width="960" height="118" rx="6" />
        <text x="36" y="26" className="dg__banda-rot">No navegador · construído hoje</text>
      </g>
      <Caixa x={44} y={58} w={286} h={70} linhas={['Interface React 19 + TypeScript', 'rotas, telas, estados de vazio e erro']} />
      <Caixa x={356} y={58} w={286} h={70} linhas={['Notação clínica reutilizável', 'régua de referência, linha do tempo, série']} />
      <Caixa x={668} y={58} w={288} h={70} linhas={['Cliente da API', 'estado e IA via /api, com selo de origem']} />

      <g className="dg__banda">
        <rect x="20" y="196" width="960" height="104" rx="6" />
        <text x="36" y="188" className="dg__banda-rot">Contrato de dados · construído hoje</text>
      </g>
      <Caixa x={44} y={218} w={286} h={62} linhas={['Modelo de evento clínico', 'fonte, origem, medidas, confiança']} />
      <Caixa x={356} y={218} w={286} h={62} linhas={['Store com assinatura', 'única fonte de verdade das telas']} />
      <Caixa x={668} y={218} w={288} h={62} linhas={['API Hono na Vercel', 'valida, persiste e chama a IA']} />

      <path d="M500 300 V344" className="dg__seta" markerEnd="url(#ponta2)" />
      <text x="516" y="328" className="dg__nota">a API já usa a OCI; o tracejado vem a seguir</text>

      <g className="dg__banda dg__banda--futura">
        <rect x="20" y="356" width="960" height="182" rx="6" />
        <text x="36" y="348" className="dg__banda-rot">Camada gerenciada · traço cheio já na OCI, tracejado na próxima fase</text>
      </g>
      <Caixa x={44} y={380} w={220} h={64} variante="tracejada" linhas={['API do titular', 'autenticação e consentimento']} />
      <Caixa x={288} y={380} w={220} h={64} variante="tracejada" linhas={['Fila de ingestão', 'um documento por vez, assíncrona']} />
      <Caixa x={532} y={380} w={200} h={64} variante="tracejada" linhas={['Extração de documento', 'OCR e estruturação']} />
      <Caixa x={756} y={380} w={200} h={64} linhas={['Execução de IA', 'OCI Generative AI']} />
      <Caixa x={44} y={460} w={220} h={62} linhas={['Banco do histórico', 'Oracle Autonomous DB']} />
      <Caixa x={288} y={460} w={220} h={62} variante="tracejada" linhas={['Busca semântica', 'recuperação por significado']} />
      <Caixa x={532} y={460} w={200} h={62} variante="tracejada" linhas={['Objetos e imagem', 'PDF, foto, DICOM']} />
      <Caixa x={756} y={460} w={200} h={62} variante="tracejada" linhas={['Chaves e segredos', 'credenciais das integrações']} />

      <defs>
        <marker id="ponta2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 8 4 0 8Z" className="dg__ponta" />
        </marker>
      </defs>
    </svg>
  )
}
