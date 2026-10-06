import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Porta } from '../components/Porta'
import { Falha } from '../components/ui'
import type { ModoOnboarding } from '../lib/api'
import { mensagemDeErro } from '../lib/api'
import { navegar } from '../lib/router'
import { concluirOnboarding, sair, useSessao } from '../lib/store'
import { TID } from '../lib/testids'

export function BoasVindas() {
  const { perfil } = useSessao()
  const [escolhendo, setEscolhendo] = useState<ModoOnboarding | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const escolher = async (modo: ModoOnboarding) => {
    if (escolhendo) return
    setEscolhendo(modo)
    setErro(null)
    try {
      await concluirOnboarding(modo)
      navegar('/app/linha')
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEscolhendo(null)
    }
  }

  const primeiroNome = perfil?.nome.split(' ')[0]

  return (
    <Porta largo>
      <h1>Boas-vindas{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
      <p className="porta__intro">
        Como você quer começar? Dá para mudar de ideia depois: no menu do app, o histórico de
        exemplo pode ser reiniciado ou apagado para você recomeçar do zero.
      </p>

      <div className="escolhas" role="group" aria-label="Ponto de partida" aria-busy={escolhendo !== null}>
        <button
          type="button" className="escolha" disabled={escolhendo !== null}
          onClick={() => { void escolher('vazio') }} data-testid={TID.onboardingVazio}
        >
          <span className="escolha__icone"><Icon nome="anexar" tamanho={20} /></span>
          <span className="escolha__titulo">Começar do zero</span>
          <span className="escolha__texto">
            O histórico começa vazio e cresce com os documentos que você anexar - laudos,
            resultados de exame, receitas. A IA lê cada um e espera a sua conferência antes de gravar.
          </span>
          <span className="escolha__acao">
            {escolhendo === 'vazio' ? 'Preparando…' : <>Começar do zero <Icon nome="seta" tamanho={15} /></>}
          </span>
        </button>

        <button
          type="button" className="escolha" disabled={escolhendo !== null}
          onClick={() => { void escolher('exemplo') }} data-testid={TID.onboardingExemplo}
        >
          <span className="escolha__icone"><Icon nome="linha" tamanho={20} /></span>
          <span className="escolha__titulo">Explorar com histórico de exemplo</span>
          <span className="escolha__texto">
            Carregamos sete anos de registros fictícios de uma paciente com diabetes e arritmia,
            para você ver a linha do tempo, o copiloto e o resumo para consulta funcionando.
            O exemplo pode ser reiniciado ou apagado a qualquer momento.
          </span>
          <span className="escolha__acao">
            {escolhendo === 'exemplo' ? 'Carregando o exemplo…' : <>Explorar o exemplo <Icon nome="seta" tamanho={15} /></>}
          </span>
        </button>
      </div>

      <div aria-live="assertive">{erro && <Falha mensagem={erro} />}</div>

      <div className="porta__rodape">
        <button type="button" className="btn btn--quiet" onClick={() => { void sair() }} disabled={escolhendo !== null}>
          Sair desta conta
        </button>
      </div>
    </Porta>
  )
}
