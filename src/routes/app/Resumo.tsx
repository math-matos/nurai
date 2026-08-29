import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Regua } from '../../components/ui'
import { formatarData } from '../../lib/formato'
import { MEDICACOES, PACIENTE } from '../../data/seed'
import { hoje, useAcoes, useEstado } from '../../lib/store'

type Foco = 'cardiologia' | 'endocrinologia' | 'clinica'

const FOCOS: { id: Foco; rotulo: string; medico: string; desde: string; ids: string[] }[] = [
  {
    id: 'cardiologia', rotulo: 'Cardiologia', medico: 'Dra. Renata Aguiar',
    desde: 'a consulta de 18 fev 2026', ids: ['e23', 'e22', 'e21'],
  },
  {
    id: 'endocrinologia', rotulo: 'Endocrinologia', medico: 'Dr. Paulo Sarmento',
    desde: 'a consulta de 10 fev 2025', ids: ['e18', 'e21', 'e14'],
  },
  {
    id: 'clinica', rotulo: 'Clínica médica', medico: 'UBS Vila Mariana',
    desde: 'a consulta de 08 jul 2026', ids: ['e23', 'e22', 'e21'],
  },
]

export function Resumo() {
  const { eventos, passos, compartilhamento } = useEstado()
  const { gerarCompartilhamento } = useAcoes()
  const [foco, setFoco] = useState<Foco>('cardiologia')

  const alvo = FOCOS.find((f) => f.id === foco)!
  const destaques = alvo.ids
    .map((id) => eventos.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
  const pendentes = passos.filter((p) => !p.feito)
  const fontesDistintas = new Set(eventos.map((e) => e.fonte)).size

  return (
    <div className="resumo">
      <div className="resumo__controles">
        <div className="seletor" role="group" aria-label="Especialidade de destino">
          {FOCOS.map((f) => (
            <button
              key={f.id} type="button"
              className={`seletor__opcao${foco === f.id ? ' seletor__opcao--ativa' : ''}`}
              aria-pressed={foco === f.id}
              onClick={() => setFoco(f.id)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <div className="resumo__acoes">
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
            <Icon nome="papel" tamanho={16} /> Imprimir
          </button>
          <button
            type="button" className="btn"
            onClick={() => gerarCompartilhamento(alvo.medico)}
          >
            <Icon nome="chave" tamanho={16} /> Gerar acesso temporário
          </button>
        </div>
      </div>

      {compartilhamento && (
        <div className="acesso" role="status">
          <div>
            <p className="acesso__titulo">
              Acesso de 30 dias criado para {compartilhamento.para}
            </p>
            <p className="acesso__texto">
              Ela abre exatamente esta página — e nada além dela. Você pode revogar quando
              quiser em Acessos e consentimento. Criado em {compartilhamento.criadoEm}.
            </p>
          </div>
          <p className="acesso__codigo num">{compartilhamento.codigo}</p>
        </div>
      )}

      <article className="folha-resumo">
        <header className="folha-resumo__cabeca">
          <div>
            <p className="label">Resumo pré-consulta · {alvo.rotulo}</p>
            <h2>{PACIENTE.nome}</h2>
            <p className="folha-resumo__ident num">
              {PACIENTE.idade} anos · nascimento {formatarData(PACIENTE.nascimento)} ·
              cartão SUS {PACIENTE.cartaoSus} · {PACIENTE.plano}
            </p>
          </div>
          <p className="folha-resumo__origem">
            Gerado em {hoje()} a partir de <span className="num">{eventos.length}</span> registros
            de <span className="num">{fontesDistintas}</span> fontes
          </p>
        </header>

        <section className="folha-resumo__alerta">
          <Icon nome="alerta" tamanho={16} />
          <div>
            <p className="label">Alergias</p>
            <p>{PACIENTE.alergias.join(' · ')}</p>
          </div>
        </section>

        <section className="folha-resumo__bloco">
          <h3>Condições ativas</h3>
          <ul className="lista-inline">
            {PACIENTE.condicoes.map((c) => <li key={c} className="chip">{c}</li>)}
          </ul>
        </section>

        <section className="folha-resumo__bloco">
          <h3>O que mudou desde {alvo.desde}</h3>
          <ul className="mudancas">
            {destaques.map((e) => (
              <li key={e.id}>
                <p className="mudancas__topo">
                  <time className="num" dateTime={e.data}>{formatarData(e.data)}</time>
                  <strong>{e.titulo}</strong>
                  <span>{e.instituicao}</span>
                </p>
                <p className="mudancas__texto">{e.resumo}</p>
                {e.medidas?.map((m) => <Regua key={m.nome} medida={m} />)}
              </li>
            ))}
          </ul>
        </section>

        <section className="folha-resumo__bloco">
          <h3>Medicamentos em uso contínuo</h3>
          <div className="rolagem-x">
            <table className="tabela-med">
              <thead>
                <tr><th>Medicamento</th><th>Dose</th><th>Posologia</th><th>Desde</th><th>Prescrito por</th></tr>
              </thead>
              <tbody>
                {MEDICACOES.map((m) => (
                  <tr key={m.nome}>
                    <th scope="row">{m.nome}</th>
                    <td className="num">{m.dose}</td>
                    <td>{m.posologia}</td>
                    <td className="num">{m.desde}</td>
                    <td>{m.prescritor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="folha-resumo__bloco">
          <h3>Pendências identificadas no histórico</h3>
          <ul className="pendencias">
            {pendentes.map((p) => (
              <li key={p.id}>
                <strong>{p.titulo}</strong>
                <span>{p.prazo}</span>
              </li>
            ))}
            {pendentes.length === 0 && <li>Nenhuma pendência em aberto.</li>}
          </ul>
        </section>

        <footer className="folha-resumo__pe">
          Documento gerado pela Nurai a partir do histórico da própria paciente. Dados
          sintéticos, para demonstração acadêmica. Não é laudo, não é prescrição e não
          substitui a avaliação do profissional que assina o atendimento.
        </footer>
      </article>
    </div>
  )
}
