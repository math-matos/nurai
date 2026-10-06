import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Campo } from '../components/Campo'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Porta } from '../components/Porta'
import { Falha } from '../components/ui'
import { ErroApi, mensagemDeErro } from '../lib/api'
import { cadastrar, isoHoje } from '../lib/store'
import { focarPrimeiroErro } from '../lib/formulario'
import { TID } from '../lib/testids'

type CampoCadastro = 'nome' | 'email' | 'senha' | 'dataNascimento' | 'aceiteLgpd'
type Erros = Partial<Record<CampoCadastro, string>>

const SENHA_MIN = 8
const SENHA_MAX = 200

const ORDEM = [
  { campo: 'nome', id: 'cadastro-nome' },
  { campo: 'email', id: 'cadastro-email' },
  { campo: 'senha', id: 'cadastro-senha' },
  { campo: 'dataNascimento', id: 'cadastro-nascimento' },
  { campo: 'aceiteLgpd', id: 'cadastro-lgpd' },
]

interface Dados { nome: string; email: string; senha: string; dataNascimento: string; aceiteLgpd: boolean }

/* Espelha as regras do servidor (server/esquemas.ts) para avisar antes do envio; o servidor continua decidindo. */
function validar(d: Dados): Erros {
  const email = d.email.trim()
  return {
    ...(d.nome.trim() === '' && { nome: 'Informe o nome' }),
    ...(email === '' ? { email: 'Informe o e-mail' } : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && { email: 'E-mail inválido' }),
    ...(d.senha.length < SENHA_MIN && { senha: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres` }),
    ...(d.senha.length > SENHA_MAX && { senha: `A senha pode ter no máximo ${SENHA_MAX} caracteres` }),
    ...(d.dataNascimento > isoHoje() && { dataNascimento: 'A data de nascimento não pode estar no futuro' }),
    ...(!d.aceiteLgpd && { aceiteLgpd: 'Para criar a conta, é preciso concordar com o uso dos seus dados de saúde.' }),
  }
}

export function Cadastro({ volta }: { volta: string | null }) {
  const [dados, setDados] = useState<Dados>({ nome: '', email: '', senha: '', dataNascimento: '', aceiteLgpd: false })
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const mudar = <K extends keyof Dados>(campo: K, valor: Dados[K]) => {
    setDados((d) => ({ ...d, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const recusar = (novos: Erros) => {
    flushSync(() => setErros(novos))
    focarPrimeiroErro(ORDEM, novos)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErroGeral(null)
    const locais = validar(dados)
    if (Object.keys(locais).length > 0) return recusar(locais)

    setEnviando(true)
    try {
      await cadastrar({
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        senha: dados.senha,
        ...(dados.dataNascimento && { dataNascimento: dados.dataNascimento }),
        aceiteLgpd: true,
      })
    } catch (erro) {
      flushSync(() => setEnviando(false))
      if (erro instanceof ErroApi && erro.codigo === 'EMAIL_EM_USO') return recusar({ email: erro.message })
      if (erro instanceof ErroApi && erro.codigo === 'VALIDACAO' && Object.keys(erro.campos).length > 0) {
        return recusar(erro.campos)
      }
      setErroGeral(mensagemDeErro(erro))
    }
  }

  const senhaOk = dados.senha.length >= SENHA_MIN

  return (
    <Porta nota="Protótipo acadêmico. Use apenas dados fictícios — não cadastre informações reais de saúde.">
      <h1>Criar conta</h1>
      <p className="porta__intro">
        Uma conta guarda o seu histórico de saúde reunido: exames, laudos e consultas de
        instituições diferentes, numa linha só.
      </p>

      <form className="formulario" noValidate onSubmit={(e) => { void enviar(e) }}
        aria-busy={enviando} data-testid={TID.formCadastro}>
        <Campo
          id="cadastro-nome" rotulo="Nome" autoComplete="name" value={dados.nome} erro={erros.nome}
          onChange={(e) => mudar('nome', e.target.value)} disabled={enviando} data-testid={TID.cadastroNome}
        />
        <Campo
          id="cadastro-email" rotulo="E-mail" type="email" autoComplete="email" inputMode="email"
          value={dados.email} erro={erros.email} onChange={(e) => mudar('email', e.target.value)}
          disabled={enviando} data-testid={TID.cadastroEmail}
        />
        <Campo
          id="cadastro-senha" rotulo="Senha" type="password" autoComplete="new-password"
          value={dados.senha} erro={erros.senha} onChange={(e) => mudar('senha', e.target.value)}
          disabled={enviando} data-testid={TID.cadastroSenha}
          dica={
            <span className={senhaOk ? 'campo__dica--ok' : undefined}>
              {senhaOk && <Icon nome="check" tamanho={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />}
              Pelo menos {SENHA_MIN} caracteres{dados.senha ? ` · ${dados.senha.length} digitados` : ''}.
            </span>
          }
        />
        <Campo
          id="cadastro-nascimento" rotulo="Data de nascimento" type="date" opcional max={isoHoje()}
          value={dados.dataNascimento} erro={erros.dataNascimento}
          onChange={(e) => mudar('dataNascimento', e.target.value)} disabled={enviando}
          data-testid={TID.cadastroNascimento}
          dica="Usada para calcular a sua idade no resumo para consulta."
        />

        <div className={`campo${erros.aceiteLgpd ? ' campo--erro' : ''}`}>
          <label className="consentimento" htmlFor="cadastro-lgpd">
            <input
              id="cadastro-lgpd" type="checkbox" checked={dados.aceiteLgpd} disabled={enviando}
              aria-invalid={erros.aceiteLgpd ? true : undefined}
              aria-describedby={erros.aceiteLgpd ? 'cadastro-lgpd-erro' : undefined}
              onChange={(e) => mudar('aceiteLgpd', e.target.checked)} data-testid={TID.cadastroLgpd}
            />
            <span className="consentimento__texto">
              <strong>Concordo com o tratamento dos meus dados de saúde</strong>, que são dados
              sensíveis pela LGPD, com a finalidade única de reunir e organizar o meu histórico
              clínico e gerar resumos para mim. Posso editar, revogar acessos ou excluir a conta
              e todos os dados a qualquer momento.
            </span>
          </label>
          {erros.aceiteLgpd && <p id="cadastro-lgpd-erro" className="campo__erro">{erros.aceiteLgpd}</p>}
        </div>

        <div aria-live="assertive" data-testid={TID.erroFormulario}>
          {erroGeral && <Falha mensagem={erroGeral} />}
        </div>
        <button type="submit" className="btn btn--lg" disabled={enviando} data-testid={TID.cadastroEnviar}>
          {enviando ? 'Criando a conta…' : 'Criar conta'}
        </button>
      </form>

      <div className="porta__rodape">
        <p>
          Já tem conta?{' '}
          <Link para={volta ? `/entrar?volta=${encodeURIComponent(volta)}` : '/entrar'}>Entrar</Link>
        </p>
      </div>
    </Porta>
  )
}
