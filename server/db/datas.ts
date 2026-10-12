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

const FORMATO_ISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
})

/* Instante em ISO 8601 com o deslocamento de Brasília ("2026-10-06T14:32:05-03:00"), sem milissegundos. */
export function instanteIso(d = new Date()) {
  const p = Object.fromEntries(FORMATO_ISO.formatToParts(d).map((x) => [x.type, x.value]))
  const deslocamento = p.timeZoneName.replace('GMT', '') || '+00:00'
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${deslocamento}`
}
