import { BotaoDemo } from '../components/BotaoDemo'
import { Icon } from '../components/Icon'
import { ChipFonte, Marca } from '../components/ui'
import { Link } from '../components/Link'
import { descartarAviso, useSessao } from '../lib/store'
import { TID } from '../lib/testids'
import '../styles/landing.css'

const FRAGMENTOS = [
  { ano: '2019', data: '02 abr', titulo: 'Glicada 7,8%', fonte: 'sus' as const, onde: 'UBS Vila Mariana' },
  { ano: '2021', data: '09 fev', titulo: 'LDL 168 mg/dL', fonte: 'laboratorio' as const, onde: 'Laboratório Vetor' },
  { ano: '2022', data: '08 set', titulo: 'Receita de metformina', fonte: 'paciente' as const, onde: 'Papel, texto colado' },
  { ano: '2023', data: '27 jan', titulo: 'Fibrilação atrial no pronto-socorro', fonte: 'hospital' as const, onde: 'Hospital Santa Clemência' },
  { ano: '2024', data: '05 nov', titulo: 'Retinopatia leve', fonte: 'operadora' as const, onde: 'Rede credenciada' },
  { ano: '2026', data: '27 mai', titulo: 'Doppler de carótidas', fonte: 'clinica' as const, onde: 'Instituto Anhangá' },
  { ano: '2026', data: '12 jun', titulo: 'Holter — carga em 6,3%', fonte: 'paciente' as const, onde: 'Laudo impresso' },
]

const ETAPAS = [
  {
    numero: 'Reunir', icone: 'anexar' as const,
    titulo: 'Toda fonte entra, inclusive a de papel',
    texto: 'Rede pública pela RNDS, laboratórios e hospitais por integração e, do que só existe no papel, o PDF com texto ou o texto colado do documento. O que hoje mora em seis lugares passa a ter um endereço.',
    prova: '6 fontes · 24 registros no caso demonstrado',
  },
  {
    numero: 'Estruturar', icone: 'base' as const,
    titulo: 'PDF vira dado com faixa de referência',
    texto: 'Cada laudo é lido, tem seus valores extraídos com grau de confiança declarado e é ligado ao resto da história. Um resultado solto vira um ponto de uma série.',
    prova: 'Extração com confiança de 91% no laudo de Holter',
  },
  {
    numero: 'Entender', icone: 'copiloto' as const,
    titulo: 'Pergunta em português, resposta com a fonte',
    texto: 'O copiloto responde sobre a própria história e cita os registros que sustentam cada frase. Quando não sabe, diz que não sabe — não preenche o vazio.',
    prova: 'Toda resposta traz os eventos que a ancoram',
  },
  {
    numero: 'Agir', icone: 'bussola' as const,
    titulo: 'O contexto vira o próximo passo',
    texto: 'Exame duplicado identificado, retorno atrasado, reavaliação que nunca aconteceu, centro de referência e ensaio clínico elegível. Navegação para quem não tem um navegador.',
    prova: '5 pendências encontradas que nenhum médico isolado via',
  },
]

const COMPARATIVO = [
  {
    quem: 'RNDS · Conecte SUS',
    faz: 'Reúne o histórico da rede pública',
    falta: 'Adesão desigual e saúde suplementar de fora',
  },
  {
    quem: 'Portais de laboratório e hospital',
    faz: 'Guardam bem o que é da própria casa',
    falta: 'Silos: nenhum enxerga o registro do vizinho',
  },
  {
    quem: 'Apps de operadora',
    faz: 'Autorizações, rede e carteirinha',
    falta: 'Incentivo alinhado ao pagador, não ao paciente',
  },
  {
    quem: 'Copilotos clínicos de IA',
    faz: 'Ajudam o médico dentro de uma consulta',
    falta: 'Não têm o contexto longitudinal da pessoa',
  },
]

export function Landing() {
  const { status, aviso } = useSessao()
  const logado = status === 'autenticado'

  return (
    <div className="lp">
      <a className="skip" href="#/">Pular para o conteúdo</a>

      <header className="lp__topo">
        <Link para="/" aria-label="Nurai, início"><Marca /></Link>
        <nav className="lp__nav">
          <a href="#problema">O problema</a>
          <a href="#como">Como funciona</a>
          <Link para="/projeto">Dossiê do projeto</Link>
          {logado ? (
            <Link para="/app/linha" className="btn btn--ghost">Abrir meu histórico</Link>
          ) : (
            <>
              <Link para="/entrar">Entrar</Link>
              <Link para="/cadastro" className="btn btn--ghost">Criar conta</Link>
            </>
          )}
        </nav>
      </header>

      {aviso && (
        <div className="lp__recado" role="status" data-testid={TID.avisoSessao}>
          <Icon nome="check" tamanho={15} />
          <p>{aviso}</p>
          <button type="button" className="btn btn--quiet" onClick={descartarAviso}>
            <Icon nome="fechar" tamanho={14} /> <span className="sr-only">Fechar aviso</span>
          </button>
        </div>
      )}

      <main id="conteudo">
        <section className="hero grid-paper">
          <div className="hero__texto">
            <h1>
              O histórico clínico de uma pessoa inteira<br />
              cabe em <span className="hero__grifo">uma linha só</span>.
            </h1>
            <p className="hero__tese">
              Exames, laudos, internações e receitas de uma mesma pessoa vivem hoje em
              instituições que não conversam — e boa parte ainda em papel. A Nurai reúne
              esses fragmentos em torno do paciente, estrutura o que estava solto e
              transforma o contexto reunido no próximo passo do cuidado.
            </p>
            <div className="hero__acoes">
              {logado ? (
                <Link para="/app/linha" className="btn btn--lg">
                  Abrir meu histórico <Icon nome="seta" tamanho={17} />
                </Link>
              ) : (
                <>
                  <Link para="/cadastro" className="btn btn--lg">
                    Criar conta <Icon nome="seta" tamanho={17} />
                  </Link>
                  <BotaoDemo className="btn btn--lg btn--ghost" />
                  <Link para="/entrar" className="hero__entrar">Já tenho conta · Entrar</Link>
                </>
              )}
            </div>
            <p className="hero__nota">
              Protótipo navegável com back-end, IA da OCI e Oracle Database. A demonstração usa
              dados sintéticos de uma paciente fictícia — não envie dados reais.
            </p>
            <p className="hero__profissional">
              <Link para="/acesso">Sou profissional de saúde — tenho um código</Link>
            </p>
          </div>

          <div className="hero__espinha" aria-hidden="true">
            <ul className="espinha__lista">
              {FRAGMENTOS.map((f, i) => (
                <li key={f.titulo} className="fragmento" style={{ ['--i' as string]: i }}>
                  {(i === 0 || FRAGMENTOS[i - 1].ano !== f.ano) && (
                    <span className="espinha__ano num">{f.ano}</span>
                  )}
                  <div className="fragmento__cartao">
                    <span className="fragmento__no" />
                    <span className="fragmento__data num">{f.data}</span>
                    <span className="fragmento__corpo">
                      <span className="fragmento__titulo">{f.titulo}</span>
                      <span className="fragmento__onde">{f.onde}</span>
                    </span>
                    <ChipFonte fonte={f.fonte} curto />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="problema" id="problema">
          <div className="problema__enunciado">
            <h2>O problema não é falta de dado. É falta de contexto na hora da decisão.</h2>
            <p>
              Uma paciente de 58 anos com diabetes e arritmia acumulou, em sete anos, registros
              em seis instituições diferentes. Nenhum médico que a atendeu viu mais do que um
              pedaço. Os números abaixo são do caso que a demonstração usa — sintético, e
              construído a partir de um padrão que se repete em qualquer prontuário fragmentado.
            </p>
          </div>
          <dl className="folha">
            {[
              { k: 'Instituições com pedaço do histórico', v: '6', u: 'fontes', nota: 'rede pública, dois hospitais, laboratório, clínica e operadora' },
              { k: 'Registros que ninguém viu juntos', v: '24', u: 'eventos', nota: 'de março de 2019 a julho de 2026' },
              { k: 'Exame pedido de novo por falta de acesso', v: '1', u: 'em 6 semanas', nota: 'ultrassom de carótidas repetido entre rede privada e UBS' },
              { k: 'Retorno anual em atraso', v: '21', u: 'meses', nota: 'mapeamento de retina com retinopatia já diagnosticada' },
              { k: 'Reavaliação prescrita que nunca aconteceu', v: '1', u: 'pendência', nota: 'TSH pedido para 8 semanas depois, em fevereiro de 2025' },
            ].map((l) => (
              <div className="folha__linha" key={l.k}>
                <dt>{l.k}</dt>
                <dd>
                  <span className="folha__valor num">{l.v}</span>
                  <span className="folha__unidade">{l.u}</span>
                  <span className="folha__nota">{l.nota}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="como" id="como">
          <h2>Quatro movimentos, um de cada vez</h2>
          <ol className="etapas">
            {ETAPAS.map((e) => (
              <li key={e.numero} className="etapa">
                <div className="etapa__marca">
                  <Icon nome={e.icone} tamanho={20} />
                  <span className="etapa__rotulo">{e.numero}</span>
                </div>
                <div className="etapa__corpo">
                  <h3>{e.titulo}</h3>
                  <p>{e.texto}</p>
                </div>
                <p className="etapa__prova num">{e.prova}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="diferencial">
          <div className="diferencial__texto">
            <h2>Cada um resolve um pedaço. O paciente é quem junta.</h2>
            <p>
              Hoje a costura entre as partes é feita à mão, pela pessoa doente ou por quem
              cuida dela — com pasta, pen-drive e memória. A aposta da Nurai é ocupar
              exatamente esse vão: contexto unificado de verdade, navegação personalizada e
              IA que cita a fonte, com o paciente como dono do próprio dado.
            </p>
          </div>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr><th>Quem já atua</th><th>O que resolve</th><th>O que fica de fora</th></tr>
              </thead>
              <tbody>
                {COMPARATIVO.map((l) => (
                  <tr key={l.quem}>
                    <th scope="row">{l.quem}</th>
                    <td>{l.faz}</td>
                    <td>{l.falta}</td>
                  </tr>
                ))}
                <tr className="tabela__nos">
                  <th scope="row"><Marca tamanho={18} /></th>
                  <td>Reúne SUS, rede privada e papel na mesma linha do tempo, estrutura com IA e devolve próximos passos</td>
                  <td>Consentimento por instituição, revogável, com registro de todo acesso</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="fecho grid-paper">
          <h2>A demonstração abre no histórico da Helena.</h2>
          <p>
            Sete anos de registros já carregados, o copiloto pronto para responder e as
            pendências que ninguém tinha visto. Tudo fictício, pronto para explorar — sem cadastro.
          </p>
          {logado ? (
            <Link para="/app/linha" className="btn btn--lg">
              Abrir meu histórico <Icon nome="seta" tamanho={17} />
            </Link>
          ) : (
            <BotaoDemo className="btn btn--lg">
              <Icon nome="seta" tamanho={17} />
            </BotaoDemo>
          )}
        </section>
      </main>

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
