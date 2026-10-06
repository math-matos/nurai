import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ChipFonte, VazioHistorico } from '../../components/ui'
import { formatarDataCurta } from '../../lib/formato'
import { useAcoes, useEstado, usePerfil } from '../../lib/store'
import { ExcluirConta, MeusDados } from './MeusDados'

export function Privacidade() {
  const { consentimentos, acessos, eventos } = useEstado()
  const perfil = usePerfil()
  const { alternarConsentimento, atualizarAcessos } = useAcoes()
  const [alternando, setAlternando] = useState<string | null>(null)
  const ativos = consentimentos.filter((c) => c.ativo).length

  useEffect(() => { void atualizarAcessos() }, [atualizarAcessos])

  const alternar = async (id: string) => {
    if (alternando) return
    setAlternando(id)
    await alternarConsentimento(id)
    setAlternando(null)
  }

  return (
    <div className="privacidade">
      {eventos.length === 0 && (
        <VazioHistorico
          icone="escudo"
          titulo="Ainda não há dados de saúde para proteger aqui"
          texto="As permissões e o registro de acessos ganham sentido quando o histórico tem documentos. Comece anexando um laudo ou resultado de exame."
        />
      )}

      <MeusDados key={perfil.pacienteId} perfil={perfil} />

      <section className="painel">
        <div className="painel__cabeca">
          <h2>
            {consentimentos.length > 0
              ? <><span className="num">{ativos}</span> de <span className="num">{consentimentos.length}</span> permissões estão ativas agora</>
              : 'Nenhuma instituição tem permissão no momento'}
          </h2>
          <p>
            Cada instituição vê apenas o escopo que você concedeu, pelo tempo que você
            concedeu. Desligar uma fonte interrompe a entrada de novos registros e o acesso
            dela ao que já está aqui — o que já foi trazido continua sendo seu.
          </p>
        </div>

        {consentimentos.length === 0 && (
          <p className="painel__nada">As permissões aparecem aqui quando você conecta uma instituição em Fontes e anexos.</p>
        )}
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
                  type="checkbox" checked={c.ativo} disabled={alternando === c.id}
                  onChange={() => { void alternar(c.id) }}
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

        {acessos.length === 0 && <p className="painel__nada">Nenhum acesso registrado ainda.</p>}
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
            <dd>O histórico pertence ao titular da conta. Instituições recebem acesso, nunca posse — e todo acesso é temporário por padrão.</dd>
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
            <dd>O histórico fica no servidor da demonstração (Oracle Database ou memória, conforme o selo no topo), separado por conta, e cada concessão, revogação e anexo entra neste registro. Só a conversa com o copiloto fica no seu navegador, e é apagada ao sair. Excluir a conta apaga tudo.</dd>
          </div>
        </dl>
      </section>

      <ExcluirConta convidado={perfil.convidado} />
    </div>
  )
}
