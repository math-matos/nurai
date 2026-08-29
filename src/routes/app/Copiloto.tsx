import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Marca, Serie } from '../../components/ui'
import { formatarData } from '../../lib/formato'
import { SUGESTOES } from '../../data/copiloto'
import { navegar } from '../../lib/router'
import { perguntar, useEstado } from '../../lib/store'

export function Copiloto() {
  const { eventos, conversa } = useEstado()
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const pensando = conversa.some((t) => !t.resposta)

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversa])

  const enviar = (pergunta: string) => {
    if (pensando) return
    perguntar(pergunta)
    setTexto('')
  }

  return (
    <div className="copiloto">
      <div className="copiloto__fio">
        <div className="copiloto__abertura">
          <Marca tamanho={22} com={false} />
          <div>
            <p className="copiloto__saudacao">
              Posso responder sobre os <span className="num">{eventos.length}</span> registros
              que estão reunidos aqui — e só sobre eles.
            </p>
            <p className="copiloto__regra">
              Toda resposta vem com os registros que a sustentam. Quando a informação não
              existe no histórico, a resposta é dizer que não existe. Nada aqui é conduta
              médica: o copiloto organiza o contexto, quem decide é o profissional.
            </p>
          </div>
        </div>

        {conversa.length === 0 && (
          <div className="sugestoes">
            <p className="label">Perguntas para começar</p>
            <div className="sugestoes__lista">
              {SUGESTOES.map((s) => (
                <button key={s} type="button" className="sugestao" onClick={() => enviar(s)}>
                  {s}
                  <Icon nome="seta" tamanho={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {conversa.map((t) => (
          <article key={t.id} className="turno">
            <p className="turno__pergunta">
              <span className="label">Você perguntou</span>
              {t.pergunta}
            </p>

            {t.resposta ? (
              <div className="turno__resposta">
                {t.resposta.texto.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}

                {t.resposta.serie && <Serie {...t.resposta.serie} />}

                {t.resposta.aviso && (
                  <p className="turno__aviso">
                    <Icon nome="alerta" tamanho={15} />
                    {t.resposta.aviso}
                  </p>
                )}

                {t.resposta.ancoras.length > 0 && (
                  <div className="ancoras">
                    <p className="label">Registros que sustentam esta resposta</p>
                    <ul>
                      {t.resposta.ancoras.map((id) => {
                        const e = eventos.find((ev) => ev.id === id)
                        if (!e) return null
                        return (
                          <li key={id}>
                            <button
                              type="button" className="ancora"
                              onClick={() => navegar(`/app/linha/${id}`)}
                            >
                              <span className="ancora__data num">{formatarData(e.data)}</span>
                              <span className="ancora__titulo">{e.titulo}</span>
                              <span className="ancora__onde">{e.instituicao}</span>
                              <Icon nome="setaCurta" tamanho={14} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="turno__resposta turno__resposta--carregando" aria-live="polite">
                <span className="sr-only">Consultando o histórico</span>
                <span className="esqueleto" style={{ width: '92%' }} />
                <span className="esqueleto" style={{ width: '78%' }} />
                <span className="esqueleto" style={{ width: '86%' }} />
              </div>
            )}
          </article>
        ))}
        <div ref={fim} />
      </div>

      <form
        className="redigir"
        onSubmit={(e) => { e.preventDefault(); enviar(texto) }}
      >
        <input
          className="field" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte sobre exames, remédios, pendências…"
          aria-label="Sua pergunta"
        />
        <button
          type="submit"
          className={`btn${pensando ? ' btn--busy' : ''}`}
          disabled={!texto.trim() || pensando}
        >
          Perguntar <Icon nome="seta" tamanho={16} />
        </button>
      </form>
    </div>
  )
}
