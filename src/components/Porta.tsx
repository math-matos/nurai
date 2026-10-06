import { Link } from './Link'
import { Marca } from './ui'
import '../styles/auth.css'

/* Moldura das telas fora do app: marca, volta para o início e um cartão central. */
export function Porta({ children, largo = false, nota }: { children: React.ReactNode; largo?: boolean; nota?: React.ReactNode }) {
  return (
    <div className="porta grid-paper">
      <a className="skip" href="#conteudo-porta" onClick={(e) => {
        e.preventDefault()
        document.getElementById('conteudo-porta')?.focus()
      }}>Pular para o conteúdo</a>
      <header className="porta__topo">
        <Link para="/" aria-label="Nurai, página inicial"><Marca tamanho={24} /></Link>
        <Link para="/" className="porta__voltar">Voltar ao início</Link>
      </header>
      <main className="porta__corpo">
        <div id="conteudo-porta" tabIndex={-1} className={`porta__cartao${largo ? ' porta__cartao--largo' : ''}`}>
          {children}
        </div>
        {nota && <p className="porta__nota">{nota}</p>}
      </main>
    </div>
  )
}

export function Abrindo({ texto = 'Abrindo a Nurai…' }: { texto?: string }) {
  return (
    <div className="abrindo" role="status" aria-live="polite">
      <Marca tamanho={28} com={false} />
      <p>{texto}</p>
    </div>
  )
}
