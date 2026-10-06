import { useState } from 'react'
import { BotaoDemo } from '../components/BotaoDemo'
import { Campo } from '../components/Campo'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Porta } from '../components/Porta'
import { Falha } from '../components/ui'
import { ErroApi, mensagemDeErro } from '../lib/api'
import { descartarAviso, entrar, useSessao } from '../lib/store'
import { focar, focarPrimeiroErro } from '../lib/formulario'
import { TID } from '../lib/testids'

type CampoEntrar = 'email' | 'senha'
type Erros = Partial<Record<CampoEntrar, string>>

const ORDEM = [{ campo: 'email', id: 'entrar-email' }, { campo: 'senha', id: 'entrar-senha' }]

function validar(email: string, senha: string): Erros {
  return {
    ...(email.trim() === '' && { email: 'Informe o e-mail' }),
    ...(senha === '' && { senha: 'Informe a senha' }),
  }
}

/* A guarda de rotas (App) leva para o app ou para as boas-vindas assim que a sessão existir. */
export function Entrar({ volta }: { volta: string | null }) {
  const { aviso } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    const locais = validar(email, senha)
    setErros(locais)
    setErroGeral(null)
    if (Object.keys(locais).length > 0) {
      focarPrimeiroErro(ORDEM, locais)
      return
    }
    setEnviando(true)
    descartarAviso()
    try {
      await entrar(email.trim(), senha)
    } catch (erro) {
      setEnviando(false)
      if (erro instanceof ErroApi && erro.codigo === 'VALIDACAO' && Object.keys(erro.campos).length > 0) {
        setErros(erro.campos)
        focarPrimeiroErro(ORDEM, erro.campos)
        return
      }
      setErroGeral(mensagemDeErro(erro))
      if (erro instanceof ErroApi && erro.codigo === 'CREDENCIAIS_INVALIDAS') {
        setSenha('')
        focar('entrar-senha')
      }
    }
  }

  return (
    <Porta nota="Protótipo acadêmico. Use apenas dados fictícios.">
      <h1>Entrar</h1>
      <p className="porta__intro">
        {volta ? 'Entre de novo para voltar à tela em que você estava.' : 'Acesse o seu histórico reunido.'}
      </p>

      {aviso && (
        <div className="recado" role="status" data-testid={TID.avisoSessao}>
          <Icon nome="alerta" tamanho={15} />
          <p>{aviso}</p>
        </div>
      )}

      <form className="formulario" noValidate onSubmit={(e) => { void enviar(e) }}
        aria-busy={enviando} data-testid={TID.formEntrar}>
        <Campo
          id="entrar-email" rotulo="E-mail" type="email" autoComplete="email" inputMode="email"
          value={email} erro={erros.email} onChange={(e) => setEmail(e.target.value)}
          disabled={enviando} data-testid={TID.entrarEmail}
        />
        <Campo
          id="entrar-senha" rotulo="Senha" type="password" autoComplete="current-password"
          value={senha} erro={erros.senha} onChange={(e) => setSenha(e.target.value)}
          disabled={enviando} data-testid={TID.entrarSenha}
        />
        <div aria-live="assertive" data-testid={TID.erroFormulario}>
          {erroGeral && <Falha mensagem={erroGeral} />}
        </div>
        <button type="submit" className="btn btn--lg" disabled={enviando} data-testid={TID.entrarEnviar}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="porta__rodape">
        <p>
          Ainda não tem conta?{' '}
          <Link para={volta ? `/cadastro?volta=${encodeURIComponent(volta)}` : '/cadastro'} data-testid={TID.linkCadastro}>
            Criar conta
          </Link>
        </p>
        <p>Só quer conhecer? Abra uma conta de demonstração com um histórico fictício.</p>
        <BotaoDemo />
      </div>
    </Porta>
  )
}
