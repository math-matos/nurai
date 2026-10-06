/* Roda o comando (a suíte local) num namespace de rede próprio, só com loopback.
   Por quê: o Chromium aborta todo request em voo com net::ERR_NETWORK_CHANGED, inclusive para localhost,
   quando qualquer interface do host ganha ou perde endereço — e cada container Docker que sobe ou desce
   cria/remove um veth com IPv6 link-local. Com outros projetos subindo containers na mesma máquina,
   testes falhavam ao acaso (módulos do Vite abortados, app sem montar). No namespace próprio o browser,
   a API e o Vite não veem essas mudanças. Fora do Linux (ou sem user namespace) roda direto.
   Contra um ambiente real (E2E_BASE_URL) ou com IA real (E2E_REAL=1) a suíte precisa de internet. */
import { spawnSync } from 'node:child_process'

const [comando, ...args] = process.argv.slice(2)

const local = !process.env.E2E_BASE_URL && process.env.E2E_REAL !== '1'
const isolar = local && process.platform === 'linux' && spawnSync('unshare', ['-rn', 'true']).status === 0
if (local && !isolar) console.warn('[e2e] sem namespace de rede próprio: mudanças de rede do host podem abortar requests')

const resultado = isolar
  ? spawnSync('unshare', ['-rn', 'sh', '-c', 'ip link set lo up && exec "$@"', 'sh', comando, ...args], { stdio: 'inherit' })
  : spawnSync(comando, args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(resultado.status ?? 1)
