import { Icon } from '../components/Icon'
import { Marca } from '../components/ui'
import { Link } from '../components/Link'
import { Arquitetura, Jornada, Stakeholders } from './diagramas'
import '../styles/projeto.css'

const SECOES = [
  { id: 'problema', marca: '·', rotulo: 'O problema' },
  { id: 'parte-1', marca: '1', rotulo: 'MVP funcional' },
  { id: 'tecnologia', marca: '1', rotulo: 'Tecnologia e Oracle' },
  { id: 'parte-2', marca: '2', rotulo: 'Teste e validação' },
  { id: 'parte-3', marca: '3', rotulo: 'Modelo de negócio' },
  { id: 'parte-4', marca: '4', rotulo: 'Estratégia de lançamento' },
  { id: 'parte-5', marca: '5', rotulo: 'Pitch final' },
]

export function Projeto() {
  return (
    <div className="doc">
      <a className="skip" href="#problema">Pular para o conteúdo</a>

      <header className="lp__topo">
        <Link para="/" aria-label="Nurai, início"><Marca /></Link>
        <nav className="lp__nav">
          <Link para="/">Início</Link>
          <Link para="/app" className="btn btn--ghost">Abrir a demonstração</Link>
        </nav>
      </header>

      <div className="doc__capa grid-paper">
        <p className="doc__selo">Challenge STO 2026 · FIAP · ESOA4 · Fase 7 · Documento consolidado</p>
        <h1>Nurai: do MVP validado ao plano de negócio</h1>
        <p className="doc__linhafina">
          O MVP funcional com tecnologia Oracle, os testes com o público-alvo, o modelo de
          negócio, a estratégia de lançamento e o pitch, com o sistema no ar em{' '}
          <a href="https://nurai-one.vercel.app">nurai-one.vercel.app</a> para conferir cada
          afirmação.
        </p>
        <p className="doc__equipe">
          Lúcia Boutti · Thiago Eiji · Murilo Mansano · Pedro Eugênio · Matheus Matos
        </p>
      </div>

      <div className="doc__corpo">
        <nav className="doc__indice" aria-label="Índice">
          <p className="label">Nesta página</p>
          <ol>
            {SECOES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span className="num">{s.marca}</span> {s.rotulo}
                </a>
              </li>
            ))}
          </ol>
          <Link para="/app" className="btn">
            Abrir a demonstração <Icon nome="seta" tamanho={16} />
          </Link>
        </nav>

        <main className="doc__texto">
          {/* ---------------- CONTEXTO ---------------- */}
          <section id="problema">
            <p className="doc__parte">Contexto · Fases 5 e 6</p>
            <h2>O problema</h2>

            <p className="doc__lead">
              Dos três problemas levantados na fase anterior — histórico fragmentado,
              dificuldade de navegação no sistema e lentidão na validação clínica de IA —
              a escolha é o <strong>histórico clínico fragmentado</strong>. Os outros dois
              dependem dele: não se navega o sistema de saúde sem contexto, e não se valida
              IA clínica sem dado longitudinal confiável.
            </p>

            <h3>O problema, reescrito</h3>
            <blockquote className="doc__citacao">
              Pessoas com condições crônicas acumulam registros clínicos em instituições que
              não trocam dados entre si — rede pública, laboratórios, hospitais, clínicas,
              operadoras e papel. Na hora em que uma decisão clínica precisa ser tomada,
              ninguém tem a história inteira: nem o médico, que vê o pedaço do próprio
              sistema, nem o paciente, que carrega uma pasta. O resultado é exame repetido,
              conduta tomada com informação incompleta e cuidado que se perde entre uma
              especialidade e outra.
            </blockquote>

            <h3>Público-alvo principal</h3>
            <div className="persona">
              <div className="persona__ficha">
                <p className="persona__nome">Helena Duarte Nogueira</p>
                <dl>
                  <div><dt>Idade</dt><dd className="num">58 anos</dd></div>
                  <div><dt>Onde</dt><dd>São Paulo, SP</dd></div>
                  <div><dt>Ocupação</dt><dd>Auxiliar administrativa</dd></div>
                  <div><dt>Condições</dt><dd>Diabetes tipo 2, fibrilação atrial paroxística, hipotireoidismo</dd></div>
                  <div><dt>Cuidado</dt><dd>SUS e plano de baixo custo, em paralelo</dd></div>
                  <div><dt>Tecnologia</dt><dd>Celular Android, WhatsApp diário, desconfia de app que pede dado demais</dd></div>
                </dl>
              </div>
              <div className="persona__corpo">
                <p className="persona__fala">
                  “Toda consulta nova eu conto a história inteira de novo. E sempre esqueço
                  alguma coisa que estava num papel que ficou em casa.”
                </p>
                <div className="persona__colunas">
                  <div>
                    <h4>O que ela vive hoje</h4>
                    <ul>
                      <li>Cinco médicos que não se falam, cada um com um pedaço do histórico.</li>
                      <li>Uma pasta de plástico com laudos impressos, que às vezes fica em casa.</li>
                      <li>Exame refeito porque o resultado anterior não chegou ao novo médico.</li>
                      <li>Retornos que ela não sabe que estão atrasados, porque ninguém acompanha o conjunto.</li>
                    </ul>
                  </div>
                  <div>
                    <h4>O que ela precisa</h4>
                    <ul>
                      <li>Chegar na consulta com a história inteira, sem depender da memória.</li>
                      <li>Entender o que os números significam sem precisar de tradutor.</li>
                      <li>Saber qual é o próximo passo — e qual exame não precisa refazer.</li>
                      <li>Ter certeza de que quem vê o dado dela é só quem ela autorizou.</li>
                    </ul>
                  </div>
                </div>
                <p className="persona__nota">
                  Persona secundária: <strong>o médico que a recebe</strong>, com 12 minutos de
                  consulta e contexto incompleto — beneficiário direto do resumo pré-consulta,
                  mas não o pagante nem o dono do dado.
                </p>
              </div>
            </div>

            <h3>Por que este problema tem o maior potencial estratégico</h3>
            <ol className="doc__lista-num">
              <li>
                <strong>É a fundação dos outros dois.</strong> Navegação personalizada e IA
                clinicamente confiável só existem sobre contexto longitudinal. Resolver a
                fragmentação primeiro abre as duas frentes seguintes; o inverso não é verdade.
              </li>
              <li>
                <strong>O incumbente não quer resolver.</strong> Hospitais e operadoras têm
                incentivo para reter dado, que é fonte de poder de mercado. Uma plataforma que
                parte do paciente não disputa esse ativo — ela o desbloqueia com consentimento.
              </li>
              <li>
                <strong>A régua regulatória virou a favor.</strong> LGPD estabelece o titular
                como dono do dado, e a adoção de HL7 FHIR na RNDS cria o encaixe técnico que
                não existia cinco anos atrás.
              </li>
              <li>
                <strong>O desperdício é mensurável.</strong> Exame duplicado, retorno perdido
                e reavaliação esquecida são eventos contáveis — o que dá à solução uma métrica
                de valor objetiva para paciente, operadora e sistema público.
              </li>
            </ol>
          </section>

          {/* ---------------- PARTE 1 ---------------- */}
          <section id="parte-1">
            <p className="doc__parte">Parte 1</p>
            <h2>MVP funcional</h2>

            <p className="doc__lead">
              O MVP está no ar em <a href="https://nurai-one.vercel.app">nurai-one.vercel.app</a>.
              Ele reúne o histórico clínico disperso numa linha do tempo, lê documentos com IA,
              responde com a fonte de cada informação e prepara a consulta, com o histórico salvo
              no Oracle Autonomous Database e a IA rodando na Oracle Cloud.
            </p>

            <h3>Requisitos obrigatórios</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Requisito</th><th>Como o MVP atende</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Sistema operacional</th><td>Publicado na Vercel, com cadastro, login, sessão e exclusão de conta. <code className="doc__caminho">/api/health</code> mostra o banco e a IA em uso.</td></tr>
                  <tr><th scope="row">Fluxo principal demonstrável</th><td>Anexar um laudo → conferir o que a IA leu → salvar na linha do tempo → perguntar ao Copiloto → ver o exame repetido em Próximos passos → gerar o resumo e o acesso temporário para o médico</td></tr>
                  <tr><th scope="row">Persistência</th><td>Oracle Autonomous Database: contas, registros, permissões, acessos do médico e registro de acessos</td></tr>
                  <tr><th scope="row">Interface funcional</th><td>Aplicação web responsiva, testada no computador e no celular (mais de 150 testes automáticos de ponta a ponta e mais de 480 testes unitários)</td></tr>
                  <tr><th scope="row">Tecnologia Oracle</th><td>Três serviços da Oracle Cloud: Autonomous Database, Generative AI (Llama 3.3 70B, em São Paulo) e Document Understanding, para ler PDF escaneado</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Como demonstrar</h3>
            <ol className="doc__lista-num">
              <li>Abrir <a href="https://nurai-one.vercel.app">nurai-one.vercel.app</a> e clicar em <strong>Abrir a demonstração</strong>. A conta de exemplo já tem 24 registros de fontes diferentes.</li>
              <li>Em <strong>Fontes e anexos</strong>, enviar um laudo em PDF, conferir os valores lidos e salvar.</li>
              <li>Em <strong>Perguntar ao Copiloto</strong>, perguntar "Ficou alguma coisa pendente?" e abrir uma citação.</li>
              <li>Em <strong>Resumo para consulta</strong>, gerar o acesso temporário e abrir o código numa janela anônima, como o médico.</li>
              <li>Em <strong>Acessos e consentimento</strong>, ver o registro de cada acesso e baixar o histórico.</li>
            </ol>
            <p>
              Para rodar localmente, sem nenhuma credencial: <code className="doc__caminho">pnpm install</code> e{' '}
              <code className="doc__caminho">pnpm dev:all</code>. A API sobe com banco em memória e
              IA simulada, e o mesmo fluxo funciona em <code className="doc__caminho">localhost:5173</code>.
            </p>

            <p>
              A Nurai é uma plataforma centrada no paciente que reúne o histórico clínico
              disperso em uma linha do tempo única, estrutura com IA o que estava solto — em
              PDF, imagem ou papel — e devolve esse contexto em forma de próximo passo: para o
              paciente, em linguagem que ele entende; para o médico, em uma página que cabe nos
              minutos que ele tem.
            </p>

            <h3>Produto mínimo viável</h3>
            <p>
              O corte do MVP obedece a uma regra: fica dentro o que é necessário para provar
              que contexto reunido muda uma decisão. Tudo que só melhora a experiência depois
              dessa prova fica fora.
            </p>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Funcionalidade essencial</th><th>Por que é essencial</th><th>Estado no protótipo</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Linha do tempo clínica unificada</th>
                    <td>É a prova central: fontes incompatíveis na mesma sequência, cada evento com a origem visível</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr>
                    <th scope="row">Entrada de documento com extração</th>
                    <td>Sem o papel, o histórico continua incompleto — e é o papel que a integração não alcança</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr>
                    <th scope="row">Copiloto ancorado no histórico</th>
                    <td>Transforma acervo em entendimento, e a citação da fonte é o que sustenta a confiança</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr>
                    <th scope="row">Próximos passos e navegação</th>
                    <td>É onde o contexto vira valor mensurável: exame evitado, retorno recuperado</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr>
                    <th scope="row">Resumo pré-consulta compartilhável</th>
                    <td>Leva o valor para dentro do consultório, que é onde a decisão acontece</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr>
                    <th scope="row">Consentimento e registro de acesso</th>
                    <td>Sem controle verificável do titular, nada disso é aceitável nem legal</td>
                    <td className="doc__ok">construída</td>
                  </tr>
                  <tr className="doc__fora">
                    <th scope="row">Integração real com RNDS e laboratórios</th>
                    <td>Depende de credenciamento e homologação — simulada no protótipo</td>
                    <td>fora do MVP</td>
                  </tr>
                  <tr className="doc__fora">
                    <th scope="row">Visualizador DICOM e telemedicina</th>
                    <td>Alto custo, não testa a hipótese central</td>
                    <td>fora do MVP</td>
                  </tr>
                  <tr className="doc__fora">
                    <th scope="row">Área do médico com login próprio</th>
                    <td>O acesso temporário por link resolve a mesma necessidade na fase de teste</td>
                    <td>fora do MVP</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Jornada principal do usuário</h3>
            <figure className="doc__figura">
              <div className="doc__rolagem"><Jornada /></div>
              <figcaption>
                Figura 1 — Da primeira conexão ao consultório. O trecho em destaque é o ciclo
                que se repete a cada novo documento; o retângulo tracejado marca o único ponto
                em que a pessoa precisa conferir antes de gravar.
              </figcaption>
            </figure>

          </section>

          {/* ---------------- PARTE 1 · TECNOLOGIA ---------------- */}
          <section id="tecnologia">
            <p className="doc__parte">Parte 1 · Tecnologia</p>
            <h2>Tecnologia e integração com a Oracle</h2>

            <p className="doc__lead">
              O protótipo desta entrega tem front em React com TypeScript sobre Vite e uma API
              em Hono na Vercel, que chama o OCI Generative AI (São Paulo) e grava o histórico no
              Oracle Autonomous Database. Sem credenciais, a mesma API sobe com IA simulada e
              banco em memória — o produto segue testável em qualquer máquina. O desenho abaixo
              separa o que já existe do que a fase seguinte precisa construir.
            </p>

            <figure className="doc__figura">
              <div className="doc__rolagem"><Arquitetura /></div>
              <figcaption>
                Figura 2 — Arquitetura em três camadas. Em traço cheio, o que está construído
                e rodando; em traço tracejado, a camada gerenciada que a próxima fase precisa
                ocupar para sair do protótipo.
              </figcaption>
            </figure>

            <h3>O que já está construído</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Camada</th><th>Implementação atual</th><th>Por quê</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Interface</th><td>React 19 + TypeScript, roteamento por hash, CSS próprio com tokens</td><td>Nenhum framework de UI além do React: as telas ficam leves e sob controle do time</td></tr>
                  <tr><th scope="row">Domínio</th><td>Modelo de evento clínico tipado, com fonte, origem, medidas e faixa de referência</td><td>É o mesmo formato que a API valida e o Oracle Database persiste — o modelo já nasce estável</td></tr>
                  <tr><th scope="row">Estado</th><td>Store própria com assinatura, alimentada pela API; histórico no Oracle Autonomous Database</td><td>As telas falam só com a store — a API e o banco ficam atrás dela</td></tr>
                  <tr><th scope="row">Inteligência</th><td>OCI Generative AI (Llama 3.3 70B) para extração, explicação, copiloto, resumo e pendências; OCI Document Understanding, opcional, para ler PDF escaneado; motor determinístico no modo simulado</td><td>Âncoras que não existem no histórico são descartadas: nenhuma frase sem registro que a sustente</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Como a solução escala</h3>
            <ul className="doc__lista">
              <li>
                <strong>O gargalo é ingestão, não tráfego.</strong> Cada paciente gera poucos
                eventos por mês, mas cada documento novo custa leitura, extração e ligação ao
                histórico. Escalar significa processar documento em fila assíncrona, não
                dimensionar servidor de página.
              </li>
              <li>
                <strong>Particionamento natural por titular.</strong> O dado de uma pessoa nunca
                precisa ser lido junto com o de outra. Isso permite isolar por paciente, o que
                serve tanto à escala horizontal quanto ao requisito de privacidade.
              </li>
              <li>
                <strong>Conector por instituição, não por cliente.</strong> Cada integração nova
                atende todos os pacientes daquela fonte de uma vez — o custo de aquisição de
                dado cai à medida que a base cresce.
              </li>
              <li>
                <strong>Padrões abertos como interface.</strong> Falar HL7 FHIR e DICOM significa
                que uma nova instituição entra pela mesma porta, sem código sob medida.
              </li>
              <li>
                <strong>Custo de IA controlado na origem.</strong> Extração roda uma vez por
                documento e o resultado fica estruturado. A pergunta do copiloto recupera contexto
                já processado, em vez de reler o acervo inteiro a cada vez.
              </li>
            </ul>

            <h3>A camada que a próxima fase precisa ocupar</h3>
            <p>
              A arquitetura foi desenhada com um encaixe explícito: as telas conversam com uma
              store, e não com o banco. Essa store já fala com a API; para o protótipo virar
              produto, falta o restante da camada gerenciada. O que ela precisa entregar:
            </p>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Necessidade</th><th>O que precisa garantir</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Armazenamento de documentos</th><td>Objeto durável para PDF, imagem e DICOM, com criptografia em repouso e ciclo de vida por titular</td></tr>
                  <tr><th scope="row">Banco do histórico</th><td>Persistência do evento clínico estruturado, com trilha de auditoria e isolamento por paciente</td></tr>
                  <tr><th scope="row">Busca semântica</th><td>Recuperação por significado sobre laudos, para o copiloto responder com as âncoras corretas</td></tr>
                  <tr><th scope="row">Execução de IA</th><td>Extração de documento e geração de resumo em ambiente gerenciado, com registro do que foi enviado</td></tr>
                  <tr><th scope="row">Gestão de segredos e chaves</th><td>Credenciais das integrações e chaves de criptografia fora do código, com rotação</td></tr>
                  <tr><th scope="row">Fila de ingestão</th><td>Processamento assíncrono por documento, com reprocessamento sem perda</td></tr>
                </tbody>
              </table>
            </div>
            <p className="doc__nota">
              O Challenge pede a incorporação de uma tecnologia da empresa parceira. Ela entra
              exatamente na camada gerenciada, e não na interface: OCI Generative AI e Oracle
              Autonomous Database já atendem a API. Documentos, busca semântica, fila e
              segredos gerenciados seguem como a próxima decisão de arquitetura.
            </p>
          </section>

          {/* ---------------- PARTE 2 ---------------- */}
          <section id="parte-2">
            <p className="doc__parte">Parte 2</p>
            <h2>Validação estruturada</h2>

            <div className="doc__aviso">
              <Icon nome="alerta" tamanho={17} />
              <p>
                Em 21/11/2026, a equipe testou o MVP publicado com <strong>3 pessoas do
                público-alvo</strong> (U1, U2, U3) e entrevistou <strong>1 médico</strong> (M1),
                seguindo o roteiro em <code>docs/validacao/roteiro-testes.md</code>. Os números
                abaixo vêm só dessas sessões. A amostra é pequena e próxima da equipe, então os
                resultados indicam direções, não comprovam hipóteses. O formulário e a entrevista
                em profundidade continuam prontos para a coleta em escala.
              </p>
            </div>

            <h3>Desenho da coleta</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Instrumento</th><th>Quem</th><th>Quantos</th><th>O que testa</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Formulário online</th>
                    <td>Pessoas com condição crônica ou cuidadores</td>
                    <td className="num">40 a 60</td>
                    <td>Frequência do problema e disposição de conectar fontes</td>
                  </tr>
                  <tr>
                    <th scope="row">Entrevista em profundidade</th>
                    <td>Pacientes com 3+ especialistas</td>
                    <td className="num">6 a 8</td>
                    <td>Como a pessoa organiza o histórico hoje e onde dói</td>
                  </tr>
                  <tr>
                    <th scope="row">Entrevista com profissional</th>
                    <td>Médicos de atenção primária e especialistas</td>
                    <td className="num">3 a 5</td>
                    <td>Se o resumo pré-consulta caberia nos 12 minutos reais</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Testes realizados nesta fase</h3>
            <p>
              Cada sessão durou 30 minutos (20 com o médico), com a demonstração de dados
              fictícios. A pessoa recebeu cinco tarefas, uma por vez, sem ajuda da equipe.
            </p>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Código</th><th>Perfil</th><th>Como guarda os exames hoje</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">U1</th><td>58 anos, hipertensão e diabetes, 3 especialistas, pouca familiaridade digital</td><td>Pasta de papel e fotos que a filha manda</td></tr>
                  <tr><th scope="row">U2</th><td>42 anos, cuida da mãe com condições crônicas, alta familiaridade digital</td><td>PDFs em pastas no celular e no computador</td></tr>
                  <tr><th scope="row">U3</th><td>35 anos, hipertensão, 2 especialistas, familiaridade intermediária</td><td>E-mail, aplicativo do laboratório e capturas de tela</td></tr>
                  <tr><th scope="row">M1</th><td>45 anos, clínico geral, consultas de cerca de 20 minutos</td><td>—</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Tarefa</th><th>U1</th><th>U2</th><th>U3</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">T1 · achar o exame repetido</th><td><span className="tarefa__desfecho">com ajuda</span><span className="tarefa__tempo">2min40s</span></td><td><span className="tarefa__desfecho">sozinho</span><span className="tarefa__tempo">45s</span></td><td><span className="tarefa__desfecho">sozinha</span><span className="tarefa__tempo">1min15s</span></td></tr>
                  <tr><th scope="row">T2 · anexar um laudo</th><td><span className="tarefa__desfecho">com ajuda</span><span className="tarefa__tempo">3min10s</span></td><td><span className="tarefa__desfecho">sozinho</span><span className="tarefa__tempo">1min20s</span></td><td><span className="tarefa__desfecho">sozinha</span><span className="tarefa__tempo">1min50s</span></td></tr>
                  <tr><th scope="row">T3 · perguntar ao Copiloto</th><td><span className="tarefa__desfecho">sozinha</span><span className="tarefa__tempo">1min30s</span></td><td><span className="tarefa__desfecho">sozinho</span><span className="tarefa__tempo">40s</span></td><td><span className="tarefa__desfecho">sozinha</span><span className="tarefa__tempo">55s</span></td></tr>
                  <tr><th scope="row">T4 · liberar ao médico</th><td><span className="tarefa__desfecho">com ajuda</span><span className="tarefa__tempo">3min00s</span></td><td><span className="tarefa__desfecho">sozinho</span><span className="tarefa__tempo">1min10s</span></td><td><span className="tarefa__desfecho">com ajuda</span><span className="tarefa__tempo">2min00s</span></td></tr>
                  <tr><th scope="row">T5 · baixar o histórico</th><td><span className="tarefa__desfecho tarefa__desfecho--nao">não concluiu</span><span className="tarefa__tempo">4min00s</span></td><td><span className="tarefa__desfecho">sozinho</span><span className="tarefa__tempo">50s</span></td><td><span className="tarefa__desfecho">sozinha</span><span className="tarefa__tempo">1min30s</span></td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Das 15 tarefas, <strong>10 foram concluídas sem ajuda</strong> (66,7%), 4 com ajuda
              e 1 não foi concluída. A confiança declarada nas respostas da IA ficou em 3, 5 e 4
              (média 4,0 de 5). As fichas completas, com as falas literais, estão em{' '}
              <code className="doc__caminho">docs/validacao/resultados-testes.md</code>.
            </p>

            <h3>Formulário de validação</h3>
            <ol className="questionario">
              <li><span className="questionario__q">Em quantos serviços de saúde diferentes você se consultou nos últimos dois anos?</span><span className="questionario__t">escala · 1 · 2 · 3 · 4 ou mais</span></li>
              <li><span className="questionario__q">Nos últimos dois anos, você precisou refazer algum exame porque o resultado anterior não estava disponível?</span><span className="questionario__t">sim / não / não sei · testa a hipótese do desperdício</span></li>
              <li><span className="questionario__q">Como você guarda seus exames hoje?</span><span className="questionario__t">papel · e-mail · foto no celular · portal do laboratório · não guardo</span></li>
              <li><span className="questionario__q">Já chegou a uma consulta sem um exame ou laudo que o médico pediu para levar?</span><span className="questionario__t">sim / não · testa a dor de preparação</span></li>
              <li><span className="questionario__q">Quanto tempo você leva reunindo documentos antes de uma consulta?</span><span className="questionario__t">minutos declarados · dimensiona o ganho</span></li>
              <li><span className="questionario__q">Você autorizaria um aplicativo a buscar seus exames direto no laboratório e no SUS?</span><span className="questionario__t">sim / não / depende — e por quê · testa a barreira de confiança</span></li>
              <li><span className="questionario__q">O que faria você desistir de usar uma ferramenta dessas?</span><span className="questionario__t">aberta · mapeia objeções</span></li>
              <li><span className="questionario__q">Você confiaria em um resumo do seu histórico feito por inteligência artificial para levar ao médico?</span><span className="questionario__t">escala 1–5 · testa aceitação da IA</span></li>
              <li><span className="questionario__q">Quem, além de você, deveria poder ver esse histórico?</span><span className="questionario__t">múltipla · desenha o modelo de consentimento</span></li>
              <li><span className="questionario__q">Se existisse hoje, o quanto você usaria? E pagaria por isso?</span><span className="questionario__t">escala + faixa de valor · testa desejo e disposição a pagar</span></li>
            </ol>

            <h3>Roteiro da entrevista em profundidade</h3>
            <ul className="doc__lista">
              <li><strong>Abertura.</strong> Conte a última vez que você trocou de médico ou foi a um especialista novo. O que você levou?</li>
              <li><strong>Comportamento atual.</strong> Me mostra onde estão seus exames agora. (Pedir para abrir a pasta, o e-mail, o portal — observar, não perguntar.)</li>
              <li><strong>Ponto de dor.</strong> Já aconteceu de faltar alguma informação numa consulta? O que aconteceu depois?</li>
              <li><strong>Solução atual.</strong> O que você já tentou para organizar isso? Por que parou?</li>
              <li><strong>Confiança.</strong> Se um aplicativo pedisse acesso ao seu histórico do SUS, o que passaria pela sua cabeça?</li>
              <li><strong>Reação ao protótipo.</strong> Abrir a demonstração e pedir para a pessoa encontrar sozinha o exame duplicado. Cronometrar. Não ajudar.</li>
              <li><strong>Fechamento.</strong> Se isso existisse amanhã, o que teria que ser verdade para você usar?</li>
            </ul>

            <h3>Onde registrar os aprendizados</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Hipótese inicial</th><th>O que os testes mostraram</th><th>Ajuste na proposta</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">A dor principal é guardar exames</th>
                    <td>Os três guardam exames em lugares diferentes (papel, pastas de PDF, e-mail e aplicativo), e os três contaram um caso de exame refeito ou que faltou na consulta. A dor é <strong>achar e levar</strong> o exame certo, não só guardá-lo.</td>
                    <td>O exame repetido e o resumo para consulta ganham destaque: a linha do tempo mostra o ponto de atenção mais urgente no topo.</td>
                  </tr>
                  <tr>
                    <th scope="row">As pessoas autorizam acesso automático às fontes</th>
                    <td>Um "sim" (U2) e dois "depende" (U1, U3). Todos condicionam a consentimento por instituição, saber quem acessa e poder revogar.</td>
                    <td>Mantido o consentimento por instituição e revogável. Próximo passo: escolher as fontes antes da primeira busca.</td>
                  </tr>
                  <tr>
                    <th scope="row">A IA que resume é bem recebida</th>
                    <td>Confiança média de 4,0 de 5. A citação dos registros foi elogiada (U1, U2), mas U3 não distinguiu sugestão da IA de pedido médico, e M1 só confiaria como apoio de organização.</td>
                    <td>Respostas e próximos passos passam a dizer que são sugestão, não pedido nem diagnóstico; as citações aparecem como "De onde veio".</td>
                  </tr>
                  <tr>
                    <th scope="row">O paciente é quem paga</th>
                    <td>Os três usariam. Valores citados: até R$ 15/mês se fosse simples (U1), até R$ 20/mês (U2), R$ 10/mês só por recursos extras, com base gratuita (U3). Evidência fraca: é intenção declarada, não compra.</td>
                    <td>Modelo de entrada gratuita com plano de baixo valor fica como hipótese para validar com mais pessoas.</td>
                  </tr>
                  <tr>
                    <th scope="row">O médico usaria o resumo na consulta</th>
                    <td>M1 usaria antes da consulta se o resumo fosse curto, com data, fonte e alterações em destaque, e com acesso rápido e consentido. Pediu a expiração bem visível, um comparativo entre resultados e menos texto repetido.</td>
                    <td>A expiração fica no topo da tela do médico. Comparativo visual e redução de repetição ficam para a próxima fase.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Mapa de stakeholders, atualizado</h3>
            <p>
              O mapa da fase anterior colocava o paciente no centro. O que muda aqui é o
              <strong> tipo de ligação</strong>: o que a Nurai troca com cada ator deixa de ser
              genérico e passa a ser um contrato específico — quem envia dado, quem recebe
              contexto, quem só é consultado mediante autorização explícita.
            </p>
            <figure className="doc__figura">
              <div className="doc__rolagem"><Stakeholders /></div>
              <figcaption>
                Figura 3 — O paciente é o titular; a Nurai é a camada de contexto. Linha cheia:
                troca de dado clínico mediante consentimento. Linha tracejada: acesso derivado,
                que nunca inclui o histórico bruto.
              </figcaption>
            </figure>

            <h3>Ajustes já incorporados ao protótipo</h3>
            <ul className="doc__lista">
              <li>
                <strong>Consentimento por instituição, não em bloco.</strong> A objeção mais
                previsível é entregar o histórico inteiro de uma vez — então a permissão nasce
                fatiada por fonte e por prazo, e revogável em um clique.
              </li>
              <li>
                <strong>Toda resposta da IA cita o registro.</strong> Desconfiança de IA em
                saúde não se resolve com aviso legal; resolve-se mostrando de onde veio cada
                frase. Quando não há registro, a resposta é dizer que não sabe.
              </li>
              <li>
                <strong>Papel entra como cidadão de primeira classe.</strong> Quem tem pasta de
                plástico não é exceção: é a maioria. PDF com texto e texto colado entram pelo mesmo
                fluxo das integrações, com conferência do paciente antes de gravar. PDF escaneado
                pode ser lido por OCR (OCI Document Understanding) quando o serviço está ativo;
                foto ainda não entra neste protótipo.
              </li>
            </ul>

            <h3>Registro das dificuldades e dos ajustes</h3>
            <p>
              As primeiras linhas vêm dos testes desta fase com o público-alvo e o médico (U1 a
              U3 e M1). As demais foram observadas em testes de usabilidade anteriores (códigos
              como P3). Cada dificuldade gerou uma correção, e a tabela mostra onde ela está no
              código, para que cada mudança possa ser conferida.
            </p>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Dificuldade observada</th><th>Ajuste feito</th><th>Onde está</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Não achou "Baixar meu histórico" no fim da página (U1 não concluiu; U3 só achou depois de rolar)</th>
                    <td>A exportação foi para o topo de "Acessos e consentimento"</td>
                    <td>0d51e29 · <code>Privacidade.tsx</code>, <code>privacidade.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"O JSON é bom para exportar, mas não é fácil para a maioria das pessoas" (U2); "Seria melhor se tivesse um PDF" (U3)</th>
                    <td>Botão "Versão para ler ou imprimir", que leva ao resumo para consulta, salvável em PDF</td>
                    <td>0d51e29 · <code>Privacidade.tsx</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"Onde é que ele avisa o repetido?" (U1, precisou de ajuda)</th>
                    <td>A linha do tempo mostra no topo o ponto de atenção mais urgente, com atalho para Próximos passos</td>
                    <td>0d51e29 · <code>LinhaDoTempo.tsx</code>, <code>privacidade.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"Eu já mandei o arquivo ou ainda tenho que confirmar?" (U1); salvamento pouco visível (U2)</th>
                    <td>A conferência avisa "Ainda não foi salvo"; depois de salvar, a linha do tempo confirma</td>
                    <td>0d51e29 · <code>Conferencia.tsx</code>, <code>LinhaDoTempo.tsx</code>, <code>jornada.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"Esse número pode ficar com qualquer pessoa?" (U1); "O médico vai só ver ou consegue mudar meu histórico?" (U3)</th>
                    <td>O cartão do código lista validade, quem pode usar, que o profissional só visualiza e a revogação; "Copiar" virou o botão principal (pedido de U2)</td>
                    <td>0d51e29 · <code>Resumo.tsx</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"Isso é uma sugestão ou é algo que meu médico já pediu?" (U3); "O copiloto não pode transformar hipótese em diagnóstico" (M1)</th>
                    <td>Respostas do Copiloto e Próximos passos indicam que são sugestão, não pedido médico</td>
                    <td>0d51e29 · <code>Copiloto.tsx</code>, <code>Cuidado.tsx</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"O acesso temporário é uma boa ideia, desde que eu veja claramente quando expira" (M1)</th>
                    <td>A tela do profissional mostra a expiração no topo, o tempo todo</td>
                    <td>0d51e29 · <code>AcessoMedico.tsx</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Com a tela aberta, a médica ainda abriu um registro depois que a paciente revogou o código (P3)</th>
                    <td>Abrir um registro confere o código antes; revogado, a tela se fecha sem mostrar nada</td>
                    <td>b9aceba · <code>AcessoMedico.tsx</code>, <code>medico.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Em telas estreitas, "Voltar à lista" não fechava o detalhe e o foco se perdia (P7)</th>
                    <td>O botão fecha o detalhe e devolve o foco ao item de origem</td>
                    <td>40f2985 · <code>LinhaDoTempo.tsx</code>, <code>mobile.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">O servidor apagou um registro, mas a resposta não chegou ao celular, e o segundo toque recebeu 404 (P12)</th>
                    <td>404 passa a significar "já excluído"; repetir a exclusão após falha de rede é seguro</td>
                    <td>46b8efd · <code>store.ts</code>, <code>exclusao.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">A folha do paciente dizia "Nenhuma pendência" enquanto a tela do médico mostrava o exame repetido (P13)</th>
                    <td>Paciente e médico leem os mesmos pontos em aberto, calculados no servidor</td>
                    <td>65e4eac, 2b6a113, 42bca7a · <code>Resumo.tsx</code>, <code>medico.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">A síntese com IA não citava o exame repetido que a tela do médico mostrava</th>
                    <td>Os pontos em aberto entram primeiro no resumo; o modelo completa com o restante</td>
                    <td><code>server/ai/casos/resumo.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">"Aparecida Souza (mãe)" virava "A(" no avatar</th>
                    <td>As iniciais ignoram parênteses e o que não é letra</td>
                    <td>277514b, 889111b · <code>formato.ts</code>, <code>onboarding.spec.ts</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Com responsável, os textos falavam com o cuidador como se ele fosse o paciente (N1)</th>
                    <td>Textos fixos e a voz da IA falam do paciente na terceira pessoa; o cuidador declara autorização antes de gerenciar o histórico</td>
                    <td>102b379, 575ee9f, 606fb90 · <code>voz.ts</code>, <code>cuidador.spec.ts</code></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>O MVP resolve o problema identificado?</h3>
            <p>
              <strong>Resolve o núcleo do problema, com ressalvas.</strong> O problema da Fase 5 é
              o histórico espalhado entre instituições, que leva a exames repetidos e consultas
              sem informação. Os três participantes descreveram exatamente isso: exames em papel,
              PDFs e e-mail, e um caso de exame refeito ou que faltou na consulta. Diante do MVP,
              os três conseguiram reunir, consultar e compartilhar o histórico. 14 das 15 tarefas
              foram concluídas, e o exame repetido foi encontrado pelos três (um deles com ajuda).
              O médico disse que usaria o resumo antes da consulta, desde que curto, com data e
              fonte.
            </p>
            <p>
              <strong>As ressalvas vieram de quem tem menos familiaridade digital.</strong> U1
              precisou de ajuda em três tarefas e não achou a exportação. Os pontos de atrito
              foram de localização e de clareza, não de função: onde fica cada coisa, se o laudo
              já foi salvo, quem pode usar o código e o que é sugestão da IA. Esses pontos foram
              corrigidos (commit 0d51e29), mas as correções ainda não foram testadas de novo com
              usuários.
            </p>
            <p>
              <strong>Limites desta validação.</strong> São três pessoas e um médico, do círculo
              próximo da equipe, usando dados fictícios. A disposição a pagar e a autorização de
              acesso automático são intenções declaradas. Os próximos passos são repetir as tarefas
              com quem tem pouca familiaridade digital depois das correções, aplicar o formulário
              em escala e ouvir mais médicos sobre o comparativo de resultados que M1 pediu.
            </p>
          </section>

          {/* ---------------- PARTE 3 ---------------- */}
          <section id="parte-3">
            <p className="doc__parte">Parte 3</p>
            <h2>Modelo de negócio consolidado</h2>

            <p className="doc__lead">
              A Nurai cobra de quem ganha com o histórico organizado: o paciente ou o cuidador,
              que paga pouco por mês para não perder exames e chegar preparado à consulta, e a
              clínica ou operadora que acompanha pacientes crônicos e economiza com exame
              repetido. A Nurai não vende dado de saúde: esse é o compromisso que sustenta a
              confiança.
            </p>

            <h3>Business Model Canvas</h3>
            <div className="canvas" role="list" aria-label="Business Model Canvas da Nurai">
              <div className="canvas__bloco canvas__parceiros" role="listitem">
                <h4>Parceiros-chave</h4>
                <ul>
                  <li>Oracle (OCI Generative AI, Autonomous Database, Document Understanding)</li>
                  <li>Laboratórios e clínicas que enviam resultados</li>
                  <li>Ministério da Saúde (RNDS, padrão FHIR)</li>
                  <li>Associações de pacientes crônicos</li>
                  <li>Médicos de atenção primária</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__atividades" role="listitem">
                <h4>Atividades-chave</h4>
                <ul>
                  <li>Ler e estruturar documentos com IA</li>
                  <li>Cruzar registros para achar exame repetido e retorno atrasado</li>
                  <li>Integrar fontes por padrão aberto</li>
                  <li>Garantir consentimento e auditoria (LGPD)</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__recursos" role="listitem">
                <h4>Recursos-chave</h4>
                <ul>
                  <li>Plataforma e modelo de evento clínico</li>
                  <li>Infraestrutura na OCI</li>
                  <li>Conectores por instituição</li>
                  <li>Base de usuários e confiança na marca</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__proposta" role="listitem">
                <h4>Proposta de valor</h4>
                <ul>
                  <li><strong>Paciente e cuidador:</strong> o histórico inteiro num lugar, sem exame repetido, e a consulta preparada em minutos</li>
                  <li><strong>Médico:</strong> uma página com data, fonte e pendências, que cabe na consulta</li>
                  <li><strong>Clínica e operadora:</strong> menos exame duplicado e pacientes crônicos acompanhados</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__relacionamento" role="listitem">
                <h4>Relacionamento</h4>
                <ul>
                  <li>Autoatendimento no app</li>
                  <li>Avisos de pendência e de retorno</li>
                  <li>Suporte humano no plano pago e no B2B</li>
                  <li>Transparência: registro de cada acesso</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__canais" role="listitem">
                <h4>Canais</h4>
                <ul>
                  <li>App web e celular</li>
                  <li>Indicação pelo médico (código de acesso)</li>
                  <li>Associações e grupos de cuidadores</li>
                  <li>Venda direta a clínicas e operadoras</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__segmentos" role="listitem">
                <h4>Segmentos de clientes</h4>
                <ul>
                  <li>Adultos com doença crônica que consultam 2 ou mais especialistas</li>
                  <li>Cuidadores que organizam os exames de um familiar</li>
                  <li>Clínicas de atenção primária e operadoras com programa de crônicos</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__custos" role="listitem">
                <h4>Estrutura de custos</h4>
                <ul>
                  <li>Equipe (produto, engenharia, saúde, vendas)</li>
                  <li>Nuvem e IA na OCI, proporcionais ao uso</li>
                  <li>Segurança, jurídico e encarregado de dados (LGPD)</li>
                  <li>Marketing e parcerias</li>
                </ul>
              </div>
              <div className="canvas__bloco canvas__receitas" role="listitem">
                <h4>Fontes de receita</h4>
                <ul>
                  <li>Assinatura Nurai Plus: R$ 14,90 por mês</li>
                  <li>B2B2C: R$ 4,00 por vida por mês para clínicas e operadoras</li>
                  <li>Plano gratuito como porta de entrada</li>
                </ul>
              </div>
            </div>

            <h3>Estratégia de monetização</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Oferta</th><th>Quem paga</th><th>O que inclui</th><th>Preço</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Nurai Grátis</th>
                    <td>Ninguém</td>
                    <td>Linha do tempo, até 5 documentos por mês, copiloto com limite, acesso temporário para o médico, exportação</td>
                    <td className="num">R$ 0</td>
                  </tr>
                  <tr>
                    <th scope="row">Nurai Plus</th>
                    <td>Paciente ou cuidador</td>
                    <td>Documentos ilimitados, leitura de PDF escaneado, até 3 perfis de familiares, resumo pré-consulta ilimitado, lembretes de retorno</td>
                    <td className="num">R$ 14,90/mês</td>
                  </tr>
                  <tr>
                    <th scope="row">Nurai para clínicas e operadoras</th>
                    <td>Clínica de atenção primária ou operadora</td>
                    <td>Plus para os pacientes do programa, painel de pendências agregado e anônimo, integração com o prontuário</td>
                    <td className="num">R$ 4,00/vida/mês</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>Por que esses preços.</strong> Nos testes, os três participantes disseram que
              usariam o app e citaram R$ 10 a R$ 20 por mês. A pessoa com menos familiaridade
              digital só pagaria se fosse simples, e outra preferia uma base gratuita. O Plus fica
              no meio dessa faixa, e o plano gratuito resolve a barreira de entrada. No B2B2C, o
              valor por vida se paga se evitar um exame laboratorial repetido por paciente a cada
              poucos meses, e esse é o argumento de venda para a operadora.
            </p>

            <h3>Estrutura de custos</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Custo</th><th>Tipo</th><th className="num">2027</th><th className="num">2028</th><th className="num">2029</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Equipe</th><td>fixo</td><td className="num">R$ 240 mil (5 fundadores)</td><td className="num">R$ 720 mil (8 pessoas)</td><td className="num">R$ 1,68 mi (14 pessoas)</td></tr>
                  <tr><th scope="row">Infraestrutura base (OCI, Vercel)</th><td>fixo</td><td className="num">R$ 24 mil</td><td className="num">R$ 60 mil</td><td className="num">R$ 150 mil</td></tr>
                  <tr><th scope="row">Jurídico, LGPD e segurança</th><td>fixo</td><td className="num">R$ 36 mil</td><td className="num">R$ 70 mil</td><td className="num">R$ 170 mil</td></tr>
                  <tr><th scope="row">Marketing e vendas</th><td>fixo</td><td className="num">R$ 90 mil</td><td className="num">R$ 250 mil</td><td className="num">R$ 500 mil</td></tr>
                  <tr><th scope="row">Outros (contabilidade, ferramentas)</th><td>fixo</td><td className="num">R$ 30 mil</td><td className="num">R$ 50 mil</td><td className="num">R$ 100 mil</td></tr>
                  <tr><th scope="row">IA e nuvem por uso</th><td>variável</td><td colSpan={3}>R$ 0,40 por usuário gratuito, R$ 2,00 por assinante e R$ 1,00 por vida B2B2C, por mês</td></tr>
                  <tr><th scope="row">Meios de pagamento</th><td>variável</td><td colSpan={3}>5% da receita de assinaturas</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              O custo de IA é controlado na origem: cada documento é lido uma vez, e o resultado
              fica estruturado no banco. O copiloto consulta o que já foi processado, em vez de
              reler os documentos a cada pergunta. O plano gratuito tem limite de documentos para
              que o custo por usuário que não paga continue baixo.
            </p>

            <h3>Projeção financeira simplificada</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Indicador</th><th className="num">2027</th><th className="num">2028</th><th className="num">2029</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Usuários ativos (fim do ano)</th><td className="num">8 mil</td><td className="num">40 mil</td><td className="num">150 mil</td></tr>
                  <tr><th scope="row">Conversão para o Plus</th><td className="num">4%</td><td className="num">6%</td><td className="num">7%</td></tr>
                  <tr><th scope="row">Assinantes Plus (fim do ano)</th><td className="num">320</td><td className="num">2.400</td><td className="num">10.500</td></tr>
                  <tr><th scope="row">Vidas B2B2C (média do ano)</th><td className="num">1 mil</td><td className="num">15 mil</td><td className="num">60 mil</td></tr>
                  <tr><th scope="row">Receita de assinaturas</th><td className="num">R$ 29 mil</td><td className="num">R$ 243 mil</td><td className="num">R$ 1,15 mi</td></tr>
                  <tr><th scope="row">Receita B2B2C</th><td className="num">R$ 48 mil</td><td className="num">R$ 720 mil</td><td className="num">R$ 2,88 mi</td></tr>
                  <tr><th scope="row">Receita total</th><td className="num">R$ 77 mil</td><td className="num">R$ 963 mil</td><td className="num">R$ 4,03 mi</td></tr>
                  <tr><th scope="row">Custos variáveis</th><td className="num">R$ 36 mil</td><td className="num">R$ 333 mil</td><td className="num">R$ 1,36 mi</td></tr>
                  <tr><th scope="row">Margem de contribuição</th><td className="num">53%</td><td className="num">65%</td><td className="num">66%</td></tr>
                  <tr><th scope="row">Custos fixos</th><td className="num">R$ 420 mil</td><td className="num">R$ 1,15 mi</td><td className="num">R$ 2,60 mi</td></tr>
                  <tr><th scope="row">Resultado do ano</th><td className="num">−R$ 379 mil</td><td className="num">−R$ 520 mil</td><td className="num">+R$ 76 mil</td></tr>
                  <tr><th scope="row">Resultado acumulado</th><td className="num">−R$ 379 mil</td><td className="num">−R$ 899 mil</td><td className="num">−R$ 824 mil</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>Leitura.</strong> A operação fica no azul em 2029, quando a receita de
              clínicas e operadoras passa a cobrir a equipe. Até lá, a necessidade de caixa
              acumulada chega a cerca de R$ 900 mil, que é o tamanho de uma rodada pré-semente
              (ou de editais de inovação em saúde) de R$ 1,2 milhão, com folga.
            </p>
            <p className="doc__nota">
              <strong>Premissas.</strong> Os usuários crescem de forma linear dentro de cada ano, e
              as médias anuais vêm daí. O preço e a faixa de disposição a pagar vêm dos testes
              desta fase (3 pessoas), e a conversão de 4% a 7% é típica de produtos freemium, mas
              ainda não foi medida na Nurai. Os custos por usuário são estimativas da equipe, a
              confirmar com a calculadora de preços da OCI e com o uso real em produção. É uma
              projeção para orientar decisões, não uma previsão.
            </p>

            <h3>Principais indicadores (KPIs)</h3>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Indicador</th><th>O que mede</th><th>Meta no primeiro ano</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Consultas preparadas por mês (indicador principal)</th><td>Resumos ou acessos temporários usados antes de uma consulta: é o momento em que a Nurai entrega valor</td><td>1 para cada 4 usuários ativos</td></tr>
                  <tr><th scope="row">Ativação</th><td>Quem anexa o primeiro documento em até 7 dias após o cadastro</td><td>50%</td></tr>
                  <tr><th scope="row">Retenção em 90 dias</th><td>Quem volta a usar três meses depois</td><td>35%</td></tr>
                  <tr><th scope="row">Conversão para o Plus</th><td>Usuários ativos que assinam</td><td>4%</td></tr>
                  <tr><th scope="row">Cancelamento mensal do Plus</th><td>Assinantes que cancelam no mês</td><td>até 6%</td></tr>
                  <tr><th scope="row">LTV / CAC</th><td>Valor de um assinante ao longo da vida (cerca de R$ 200, com 6% de cancelamento) sobre o custo para conquistá-lo</td><td>3 ou mais (CAC até R$ 68)</td></tr>
                  <tr><th scope="row">Exames repetidos sinalizados</th><td>Pontos de "exame repetido" encontrados e resolvidos: é o valor para a operadora</td><td>acompanhar a partir do piloto</td></tr>
                  <tr><th scope="row">Custo de IA por usuário ativo</th><td>Gasto na OCI dividido pelos usuários ativos</td><td>até R$ 0,60/mês</td></tr>
                  <tr><th scope="row">Tarefas concluídas sem ajuda</th><td>O mesmo teste desta fase, repetido a cada versão</td><td>de 67% para 85%</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Como o MVP evolui para um produto escalável</h3>
            <ol className="doc__lista-num">
              <li>
                <strong>Produção (0 a 6 meses).</strong> Documentos no OCI Object Storage, segredos
                no OCI Vault, fila para processar documentos, OCR ligado para todos, aplicativo de
                celular, e o reteste de usabilidade com pessoas de pouca familiaridade digital.
              </li>
              <li>
                <strong>Integrações (6 a 18 meses).</strong> Leitura da RNDS pelo padrão HL7 FHIR,
                conectores com os primeiros laboratórios e busca semântica para o copiloto. Cada
                conector atende todos os pacientes daquela fonte de uma vez.
              </li>
              <li>
                <strong>B2B2C (12 a 24 meses).</strong> Painel para clínicas e operadoras com
                indicadores agregados e anônimos, e integração com o prontuário do médico.
              </li>
              <li>
                <strong>Escala (24 meses em diante).</strong> Outras regiões, outras condições
                crônicas, e o comparativo visual entre resultados que o médico pediu nos testes.
              </li>
            </ol>
            <p>
              A arquitetura já foi pensada para isso, como mostra a seção de tecnologia: o dado é
              particionado por paciente, a IA roda uma vez por documento, e cada instituição entra
              pela mesma porta, por padrão aberto.
            </p>
          </section>

          {/* ---------------- PARTE 4 ---------------- */}
          <section id="parte-4">
            <p className="doc__parte">Parte 4</p>
            <h2>Estratégia de lançamento</h2>

            <h3>Público-alvo prioritário</h3>
            <p>
              <strong>Adultos de 45 a 70 anos com hipertensão ou diabetes, que consultam dois ou
              mais especialistas, e os filhos que cuidam dos exames deles</strong>, começando pela
              Grande São Paulo. Essa é a base com o problema mais frequente: segundo a Pesquisa
              Nacional de Saúde de 2019, do IBGE, 52% dos 159,1 milhões de adultos brasileiros
              tinham diagnóstico de ao menos uma doença crônica. Os testes reforçaram o papel do
              cuidador: a participante de 58 anos só usaria "com ajuda da filha", e o cuidador foi
              quem mais se dispôs a pagar.
            </p>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Recorte</th><th>Tamanho</th><th>Como foi calculado</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Mercado total</th><td className="num">≈ 83 milhões de pessoas</td><td>Adultos com ao menos uma doença crônica (52% de 159,1 milhões, PNS 2019)</td></tr>
                  <tr><th scope="row">Mercado endereçável</th><td className="num">≈ 21 milhões de pessoas</td><td>Desses, a parcela com plano de saúde (cerca de 1 em cada 4 brasileiros; 53 milhões de beneficiários, ANS, 2025), que circula entre SUS, rede privada e papel e tem maior chance de pagar</td></tr>
                  <tr><th scope="row">Meta em 3 anos</th><td className="num">150 mil usuários ativos</td><td>0,7% do mercado endereçável, com 10,5 mil assinantes e 60 mil vidas B2B2C</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Aquisição dos primeiros clientes</h3>
            <ol className="doc__lista-num">
              <li>
                <strong>O médico como canal.</strong> Cada acesso temporário apresenta a Nurai a um
                médico. Vamos procurar 20 médicos de atenção primária e cardiologistas que atendem
                crônicos, para que recomendem o app aos pacientes antes do retorno.
              </li>
              <li>
                <strong>Cuidadores onde eles já estão.</strong> Grupos de WhatsApp e Facebook de
                cuidadores, e conteúdo curto ("como organizar os exames da sua mãe em 10
                minutos").
              </li>
              <li>
                <strong>Associações de pacientes.</strong> Parcerias com associações de diabetes e
                hipertensão, com o plano Plus gratuito por 3 meses para os associados.
              </li>
              <li>
                <strong>Um piloto B2B2C.</strong> Uma clínica de atenção primária ou uma operadora
                regional com programa de crônicos, com cerca de mil vidas por 6 meses, medindo exames
                repetidos evitados.
              </li>
              <li>
                <strong>Indicação.</strong> Um mês de Plus para quem indica e para quem entra.
              </li>
            </ol>
            <p>
              <strong>Meta:</strong> mil usuários ativos e o piloto assinado nos primeiros 90
              dias, com custo de aquisição abaixo de R$ 68 por assinante.
            </p>

            <h3>Posicionamento competitivo</h3>
            <blockquote className="doc__citacao">
              Para quem tem doença crônica e se trata em vários lugares, a Nurai é o histórico de
              saúde que fica com o paciente e chega pronto à consulta. Diferente dos apps de
              laboratório, de operadora e do governo, ela junta público, privado e papel, e diz o
              que fazer com isso.
            </blockquote>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Alternativa</th><th>O que faz bem</th><th>O que não faz</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Pasta de papel, WhatsApp e e-mail</th><td>Grátis e conhecido</td><td>Se perde, não avisa nada e não chega organizado ao médico</td></tr>
                  <tr><th scope="row">App do laboratório</th><td>Resultado rápido</td><td>Mostra só aquele laboratório</td></tr>
                  <tr><th scope="row">App da operadora</th><td>Rede credenciada e carteirinha</td><td>Mostra só a própria rede e some quando o plano muda</td></tr>
                  <tr><th scope="row">Meu SUS Digital</th><td>Vacinas e registros enviados à rede nacional</td><td>Não reúne o papel do paciente e não cruza registros para apontar pendências</td></tr>
                  <tr><th scope="row">Nurai</th><td>Junta todas as fontes, lê documentos com IA, aponta exame repetido e prepara a consulta</td><td>Ainda depende do paciente para anexar o que não está integrado</td></tr>
                </tbody>
              </table>
            </div>
            <h4 className="doc__subtitulo">Diferencial competitivo, eixo a eixo</h4>
            <div className="rolagem-x">
              <table className="doc__tabela">
                <thead>
                  <tr><th>Eixo</th><th>O mercado hoje</th><th>A escolha da Nurai</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Centro de gravidade</th>
                    <td>Dado orbita a instituição que o gerou</td>
                    <td>Dado orbita a pessoa, que é titular e concede acesso</td>
                  </tr>
                  <tr>
                    <th scope="row">Cobertura</th>
                    <td>Ou o SUS, ou a rede privada, ou o próprio portal</td>
                    <td>Público, privado e papel na mesma linha do tempo</td>
                  </tr>
                  <tr>
                    <th scope="row">Papel da IA</th>
                    <td>Copiloto isolado, sem contexto longitudinal</td>
                    <td>IA sobre histórico reunido, com citação obrigatória da fonte</td>
                  </tr>
                  <tr>
                    <th scope="row">Entrega final</th>
                    <td>Armazenar e exibir</td>
                    <td>Devolver o próximo passo, e levá-lo para dentro da consulta</td>
                  </tr>
                  <tr>
                    <th scope="row">Postura com o sistema</th>
                    <td>Contornar o sistema de saúde existente</td>
                    <td>Integrar-se a ele — padrões abertos, e o médico como aliado</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>Crescimento sustentável</h3>
            <ul className="doc__lista">
              <li>
                <strong>Unidade econômica antes de escala.</strong> Só aumentar o marketing quando o
                LTV/CAC passar de 3 e o retorno do custo de aquisição ficar abaixo de 12 meses.
              </li>
              <li>
                <strong>B2B2C reduz o custo de aquisição.</strong> Um contrato com uma clínica ou
                operadora traz milhares de pacientes de uma vez, e a receita por vida financia o
                plano gratuito.
              </li>
              <li>
                <strong>Efeitos de rede.</strong> Cada médico que recebe um código conhece a Nurai,
                e cada conector novo melhora o produto para todos os pacientes daquela fonte.
              </li>
              <li>
                <strong>Custo de IA sob controle.</strong> Leitura única por documento, limite no
                plano gratuito e acompanhamento do custo por usuário ativo como KPI.
              </li>
              <li>
                <strong>Confiança como ativo.</strong> Nenhuma venda de dado, consentimento por
                instituição, registro de cada acesso e exportação a qualquer momento. Em saúde, é
                isso que faz as pessoas ficarem.
              </li>
            </ul>
          </section>

          {/* ---------------- PARTE 5 ---------------- */}
          <section id="parte-5">
            <p className="doc__parte">Parte 5</p>
            <h2>Pitch final</h2>
            <p>
              O pitch em PDF (<code className="doc__caminho">docs/entrega/pitch-nurai.pdf</code>)
              percorre os dez tópicos pedidos, na ordem: problema, solução, demonstração do MVP,
              mercado, modelo de negócio, tecnologia e integração com a Oracle, diferencial
              competitivo, estratégia de crescimento, projeções e time. O vídeo de até 7 minutos
              segue o roteiro em <code className="doc__caminho">docs/entrega/roteiro-video.md</code>,
              com a demonstração do sistema em funcionamento em{' '}
              <a href="https://nurai-one.vercel.app">nurai-one.vercel.app</a>.
            </p>
          </section>

          <section className="doc__fecho">
            <h2>O protótipo é a parte verificável desta entrega</h2>
            <p>
              Tudo que este documento afirma sobre o MVP pode ser conferido clicando. A
              demonstração abre no histórico da persona, com sete anos de registros já
              carregados.
            </p>
            <Link para="/app" className="btn btn--lg">
              Abrir a demonstração <Icon nome="seta" tamanho={17} />
            </Link>
          </section>
        </main>
      </div>

      <footer className="lp__rodape">
        <div>
          <Marca />
          <p>building tech intelligence to accelerate human health</p>
        </div>
        <div className="lp__creditos">
          <p><strong>Challenge STO 2026 · FIAP · ESOA4</strong></p>
          <p>Lúcia Boutti · Thiago Eiji · Murilo Mansano · Pedro Eugênio · Matheus Matos</p>
          <p className="lp__aviso">
            Protótipo acadêmico. Paciente, instituições e resultados são fictícios. Não é
            dispositivo médico e não substitui avaliação profissional.
          </p>
        </div>
      </footer>
    </div>
  )
}
