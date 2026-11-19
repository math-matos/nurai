import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ChipFonte, Falha, VazioHistorico } from '../../components/ui'
import { ExcluirConta } from '../../components/ExcluirConta'
import { api, mensagemDeErro } from '../../lib/api'
import { formatarDataCurta } from '../../lib/formato'
import { isoHoje, useAcoes, useEstado, usePerfil } from '../../lib/store'
import { TID } from '../../lib/testids'
import { tomDe } from '../../lib/tom'
import { MeusDados } from './MeusDados'

export function Privacidade() {
  const { consentimentos, acessos, eventos } = useEstado()
  const perfil = usePerfil()
  const tom = tomDe(perfil)
  const { alternarConsentimento, atualizarAcessos } = useAcoes()
  const [alternando, setAlternando] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)
  const ativos = consentimentos.filter((c) => c.ativo).length

  useEffect(() => { void atualizarAcessos() }, [atualizarAcessos])

  const alternar = async (id: string) => {
    if (alternando) return
    setAlternando(id)
    await alternarConsentimento(id)
    setAlternando(null)
  }

  /* Pela API (e não por link direto): com a sessão vencida, um link salvaria o JSON de erro como se fosse o histórico. */
  const baixarHistorico = async () => {
    if (exportando) return
    setExportando(true)
    setErroExportacao(null)
    try {
      const dados = await api.exportacao()
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `nurai-historico-${isoHoje()}.json`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      void atualizarAcessos()
    } catch (erro) {
      setErroExportacao(mensagemDeErro(erro))
    } finally {
      setExportando(false)
    }
  }

  /* A exclusão fica no fim de uma página longa: o atalho do topo leva até ela. */
  const irParaConta = () => {
    const alvo = document.getElementById('excluir-conta')
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    alvo?.focus({ preventScroll: true })
  }

  return (
    <div className="privacidade">
      <p className="privacidade__atalho">
        <button type="button" className="btn-link" onClick={irParaConta} data-testid={TID.atalhoConta}>
          <Icon nome="pessoa" tamanho={15} /> Meus dados e exclusão da conta
        </button>
      </p>

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
            dela ao que já está aqui — o que já foi trazido {tom.nome ? `continua no histórico de ${tom.nome}` : 'continua sendo seu'}.
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
            <dd>
              {perfil.responsavel
                ? `O histórico e os dados de saúde são de ${perfil.nome}, titular dos dados. A conta é gerenciada por ${perfil.responsavel.nome} (${perfil.responsavel.relacao}), como responsável, e cada ação fica registrada no nome de quem a fez.`
                : 'O histórico pertence ao titular da conta.'}
              {' '}Instituições recebem acesso, nunca posse — e todo acesso é temporário por padrão.
            </dd>
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

      <section className="painel">
        <div className="painel__cabeca">
          <h2>{tom.nome ? `Baixar o histórico de ${tom.nome}` : 'Baixar meu histórico'}</h2>
          <p>
            Um arquivo JSON com o perfil, os registros, as permissões e o registro de acessos
            {tom.nome ? ` de ${tom.nome}` : ''}. Serve para guardar uma cópia ou levar o histórico
            para outro serviço. O download fica no registro de acessos.
          </p>
        </div>
        {erroExportacao && <Falha mensagem={erroExportacao} />}
        <button
          type="button" className="btn" onClick={() => { void baixarHistorico() }}
          disabled={exportando} data-testid={TID.exportarHistorico}
        >
          {exportando ? 'Preparando o arquivo…' : 'Baixar arquivo JSON'}
        </button>
      </section>

      <ExcluirConta convidado={perfil.convidado} />
    </div>
  )
}
