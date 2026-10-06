interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string
  rotulo: string
  erro?: string
  dica?: React.ReactNode
  opcional?: boolean
}

/* Rótulo, dica e erro amarrados ao input por id: o leitor de tela anuncia os três. */
export function Campo({ id, rotulo, erro, dica, opcional = false, ...input }: CampoProps) {
  const idDica = dica ? `${id}-dica` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  const descricao = [idErro, idDica].filter(Boolean).join(' ') || undefined
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <label htmlFor={id} className="campo__rotulo">
        {rotulo}{opcional && <span className="campo__opcional"> (opcional)</span>}
      </label>
      <input id={id} className="field" aria-invalid={erro ? true : undefined} aria-describedby={descricao} {...input} />
      {dica && <div id={idDica} className="campo__dica">{dica}</div>}
      {erro && <p id={idErro} className="campo__erro">{erro}</p>}
    </div>
  )
}
