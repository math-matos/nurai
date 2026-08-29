import { Icon } from '../../components/Icon'
import { ChipFonte } from '../../components/ui'
import { formatarDataCurta } from '../../lib/formato'
import { useAcoes, useEstado } from '../../lib/store'

export function Privacidade() {
  const { consentimentos, acessos } = useEstado()
  const { alternarConsentimento } = useAcoes()
  const ativos = consentimentos.filter((c) => c.ativo).length

  return (
    <div className="privacidade">
      <section className="painel">
        <div className="painel__cabeca">
          <h2>
            <span className="num">{ativos}</span> de <span className="num">{consentimentos.length}</span> permissões
            estão ativas agora
          </h2>
          <p>
            Cada instituição vê apenas o escopo que você concedeu, pelo tempo que você
            concedeu. Desligar uma fonte interrompe a entrada de novos registros e o acesso
            dela ao que já está aqui — o que já foi trazido continua sendo seu.
          </p>
        </div>

        <ul className="permissoes">
          {consentimentos.map((c) => (
            <li key={c.id} className={`permissao${c.ativo ? '' : ' permissao--off'}`}>
              <div className="permissao__corpo">
                <p className="permissao__nome">{c.instituicao}</p>
                <p className="permissao__escopo">{c.escopo}</p>
                <p className="permissao__desde num">
                  <Icon nome="calendario" tamanho={13} /> desde {formatarDataCurta(c.desde)}
                </p>
              </div>
              <ChipFonte fonte={c.fonte} curto />
              <label className="interruptor">
                <input
                  type="checkbox" checked={c.ativo}
                  onChange={() => alternarConsentimento(c.id)}
                />
                <span className="interruptor__trilho" aria-hidden="true"><span /></span>
                <span className="interruptor__estado">{c.ativo ? 'ativo' : 'revogado'}</span>
                <span className="sr-only">Permissão para {c.instituicao}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="painel">
        <div className="painel__cabeca">
          <h2>Registro de acessos</h2>
          <p>
            Toda leitura, sincronia e concessão fica registrada — inclusive as recusadas.
            É esse registro que transforma “o paciente é dono do dado” em algo verificável.
          </p>
        </div>

        <ol className="auditoria">
          {acessos.map((a) => (
            <li key={a.id}>
              <time className="auditoria__quando num">{a.quando}</time>
              <div className="auditoria__corpo">
                <p className="auditoria__acao">{a.acao}</p>
                <p className="auditoria__quem">{a.quem} · {a.papel}</p>
              </div>
              <p className="auditoria__itens">{a.itens}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="painel painel--nota">
        <div className="painel__cabeca">
          <h2>Como isso se sustenta na LGPD</h2>
        </div>
        <dl className="lgpd">
          <div>
            <dt>Base legal</dt>
            <dd>Consentimento específico e destacado do titular para dado de saúde, coletado por instituição e por finalidade, com registro de data e escopo.</dd>
          </div>
          <div>
            <dt>Titularidade</dt>
            <dd>O histórico pertence à paciente. Instituições recebem acesso, nunca posse — e todo acesso é temporário por padrão.</dd>
          </div>
          <div>
            <dt>Revogação</dt>
            <dd>Um clique, com efeito imediato e sem perda do que já foi reunido. A revogação também entra no registro de acessos.</dd>
          </div>
          <div>
            <dt>Portabilidade</dt>
            <dd>Exportação do histórico completo em formato aberto, para levar a qualquer outro serviço.</dd>
          </div>
          <div>
            <dt>Neste protótipo</dt>
            <dd>Nada trafega: todo o estado vive no armazenamento local do seu navegador e some quando você reinicia a demonstração.</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
