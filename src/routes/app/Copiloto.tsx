import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Ancoras, AvisoIa, Falha, Marca, SeloIa, Serie } from '../../components/ui'
import { SUGESTOES } from '../../data/sugestoes'
import { perguntar, tentarTurnoDeNovo, useEstado } from '../../lib/store'

export function Copiloto() {
  const { eventos, conversa } = useEstado()
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const pensando = conversa.some((t) => t.carregando)

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

            {t.carregando ? (
              <div className="turno__resposta turno__resposta--carregando" aria-live="polite">
                <span className="sr-only">Consultando o histórico</span>
                <span className="esqueleto" style={{ width: '92%' }} />
                <span className="esqueleto" style={{ width: '78%' }} />
                <span className="esqueleto" style={{ width: '86%' }} />
              </div>
            ) : t.resposta ? (
              <div className="turno__resposta">
                {t.resposta.texto.map((p, i) => <p key={i}>{p}</p>)}

                {t.resposta.serie && t.resposta.serie.pontos.length > 0 && <Serie {...t.resposta.serie} />}

                {t.resposta.aviso && <AvisoIa>{t.resposta.aviso}</AvisoIa>}

                <Ancoras ids={t.resposta.ancoras} eventos={eventos} />

                <SeloIa geradoPor={t.resposta.geradoPor} />
              </div>
            ) : (
              <div className="turno__resposta">
                <Falha
                  mensagem={t.erro ?? 'Não foi possível responder a esta pergunta.'}
                  aoTentar={pensando ? undefined : () => tentarTurnoDeNovo(t.id)}
                />
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
        <button type="submit" className="btn" disabled={!texto.trim() || pensando}>
          {pensando ? 'Consultando o histórico…' : <>Perguntar <Icon nome="seta" tamanho={16} /></>}
        </button>
      </form>
    </div>
  )
}
