import { Icon } from '../components/Icon'
import { Marca } from '../components/ui'
import { Link } from '../components/Link'
import { Arquitetura, Jornada, Stakeholders } from './diagramas'
import '../styles/projeto.css'

const SECOES = [
  { id: 'parte-1', rotulo: 'Refinamento do problema' },
  { id: 'parte-2', rotulo: 'Validação estruturada' },
  { id: 'parte-3', rotulo: 'Estruturação da solução' },
  { id: 'parte-4', rotulo: 'Estrutura tecnológica' },
]

export function Projeto() {
  return (
    <div className="doc">
      <a className="skip" href="#parte-1">Pular para o conteúdo</a>

      <header className="lp__topo">
        <Link para="/" aria-label="Nurai, início"><Marca /></Link>
        <nav className="lp__nav">
          <Link para="/">Início</Link>
          <Link para="/app" className="btn btn--ghost">Abrir a demonstração</Link>
        </nav>
      </header>

      <div className="doc__capa grid-paper">
        <p className="doc__selo">Challenge STO 2026 · FIAP · ESOA4 · Fase 6</p>
        <h1>Do problema identificado ao MVP construído</h1>
        <p className="doc__linhafina">
          Refinamento do problema, instrumento de validação, definição do produto mínimo
          viável e arquitetura da solução — com o protótipo navegável que materializa cada
          decisão descrita aqui.
        </p>
        <p className="doc__equipe">
          Lúcia Boutti · Thiago Eiji · Murilo Mansano · Pedro Eugênio · Matheus Matos
        </p>
      </div>

      <div className="doc__corpo">
        <nav className="doc__indice" aria-label="Índice">
          <p className="label">Nesta página</p>
          <ol>
            {SECOES.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span className="num">{i + 1}</span> {s.rotulo}
                </a>
              </li>
            ))}
          </ol>
          <Link para="/app" className="btn">
            Abrir a demonstração <Icon nome="seta" tamanho={16} />
          </Link>
        </nav>

        <main className="doc__texto">
          {/* ---------------- PARTE 1 ---------------- */}
          <section id="parte-1">
            <p className="doc__parte">Parte 1</p>
            <h2>Refinamento do problema</h2>

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
                Figura 1 — O paciente é o titular; a Nurai é a camada de contexto. Linha cheia:
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
            <h2>Estruturação da solução</h2>

            <p className="doc__lead">
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
                Figura 2 — Da primeira conexão ao consultório. O trecho em destaque é o ciclo
                que se repete a cada novo documento; o retângulo tracejado marca o único ponto
                em que a pessoa precisa conferir antes de gravar.
              </figcaption>
            </figure>

            <h3>Diferencial competitivo</h3>
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
          </section>

          {/* ---------------- PARTE 4 ---------------- */}
          <section id="parte-4">
            <p className="doc__parte">Parte 4</p>
            <h2>Estrutura tecnológica</h2>

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
                Figura 3 — Arquitetura em três camadas. Em traço cheio, o que está construído
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
