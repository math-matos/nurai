/* O servidor roda em UTC na Vercel; os registros seguem o horário de Brasília,
   como o front gerava no navegador da paciente. */
const FORMATO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function partes(d: Date) {
  const p = Object.fromEntries(FORMATO.formatToParts(d).map((x) => [x.type, x.value]))
  return p as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>
}

export function hoje(d = new Date()) {
  const p = partes(d)
  return `${p.day}/${p.month}/${p.year}`
}

export function hojeIso(d = new Date()) {
  const p = partes(d)
  return `${p.year}-${p.month}-${p.day}`
}

export function agora(d = new Date()) {
  const p = partes(d)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
