import { Icon } from '../../components/Icon'
import { useState } from 'react'
import { Falha, SeloIa, VazioHistorico } from '../../components/ui'
import { formatarData } from '../../lib/formato'
import { CENTROS, ENSAIOS } from '../../data/seed'
import type { PassosGerados } from '../../lib/api'
import { navegar } from '../../lib/router'
import { useAcoes, useEstado, usePerfil } from '../../lib/store'
import { TID } from '../../lib/testids'
import { useTom } from '../../lib/tom'
import { useRequisicao } from '../../lib/useRequisicao'

const ROTULO_PRIORIDADE = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' }

export function Cuidado() {
  const { passos, eventos } = useEstado()
  /* Centros e ensaios são do caso de exemplo: não valem para um histórico que começou do zero. */
  const exemplo = usePerfil().onboarding === 'exemplo'
  const { alternarPasso, gerarPassos } = useAcoes()
  const tom = useTom()
  const analise = useRequisicao<PassosGerados>()
  const [marcando, setMarcando] = useState<string | null>(null)
  const abertos = passos.filter((p) => !p.feito)

  const reanalisar = () => { void analise.executar(gerarPassos) }

  const marcar = async (id: string) => {
    if (marcando) return
    setMarcando(id)
    await alternarPasso(id)
    setMarcando(null)
  }

  if (eventos.length === 0) {
    return (
      <div className="cuidado">
        <VazioHistorico
          icone="bussola"
          titulo="Ainda não há o que cruzar"
          texto={`Os próximos passos nascem do cruzamento entre registros: exame repetido, retorno atrasado, reavaliação esquecida. Comece reunindo os ${tom.dono('documentos', 'mp')}.`}
        />
      </div>
    )
  }

  return (
    <div className="cuidado">
      <section className="painel">
        <div className="painel__cabeca">
          <h2>
            {abertos.length > 0
              ? <>Encontramos <span className="num">{abertos.length}</span> pontas soltas no {tom.dono('acompanhamento')}</>
              : 'Nenhuma ponta solta no momento'}
          </h2>
          <p>
            Cada item nasceu do cruzamento de registros de instituições diferentes — nenhum
            médico isolado tinha esse conjunto na tela. Marcar como resolvido é seu; conduta,
            do profissional que atende {tom.paciente}.
          </p>
          <div className="cuidado__analise">
            <button
              type="button" className="btn btn--ghost" onClick={reanalisar} disabled={analise.carregando}
              data-testid={TID.iaPassos}
            >
              <Icon nome="recomecar" tamanho={16} />
              {analise.carregando ? 'Reanalisando o histórico…' : tom.nome ? `Reanalisar o histórico de ${tom.nome}` : 'Reanalisar meu histórico'}
            </button>
            {analise.dados && !analise.carregando && <SeloIa geradoPor={analise.dados.geradoPor} />}
          </div>
          {analise.erro && <Falha mensagem={analise.erro} aoTentar={analise.repetivel ? reanalisar : undefined} tentando={analise.carregando} />}
        </div>

        <ol className="passos">
          {passos.map((p) => (
            <li key={p.id} className={`passo${p.feito ? ' passo--feito' : ''} prioridade-${p.prioridade}`}>
              <label className="passo__marcar">
                <input
                  type="checkbox" checked={p.feito} disabled={marcando === p.id}
                  onChange={() => { void marcar(p.id) }}
                />
                <span className="passo__caixa" aria-hidden="true"><Icon nome="check" tamanho={13} /></span>
                <span className="sr-only">Marcar “{p.titulo}” como resolvido</span>
              </label>

              <div className="passo__corpo">
                <div className="passo__cabeca">
                  <h3>{p.titulo}</h3>
                  <span className="chip chip--prioridade">{ROTULO_PRIORIDADE[p.prioridade]}</span>
                </div>
                <p className="passo__porque">{p.porque}</p>
                <div className="passo__pe">
                  <span className="passo__prazo"><Icon nome="calendario" tamanho={14} /> {p.prazo}</span>
                  {p.ancoras.map((id) => {
                    const e = eventos.find((ev) => ev.id === id)
                    if (!e) return null
                    return (
                      <button
                        key={id} type="button" className="chip chip--botao"
                        onClick={() => navegar(`/app/linha/${id}`)}
                      >
                        <span className="num">{formatarData(e.data)}</span> · {e.titulo}
                      </button>
                    )
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {exemplo && (
        <>
          <section className="painel">
            <div className="painel__cabeca">
              <h2>Onde tratar isso</h2>
              <p>
                Centros públicos e credenciados com foco no que o {tom.dono('histórico')} mostra, ordenados
                pela aderência ao {tom.dono('caso')} — não por convênio nem por publicidade.
              </p>
            </div>
            <ul className="centros">
              {CENTROS.map((c) => (
                <li key={c.id} className="centro">
                  <div>
                    <p className="centro__nome">{c.nome}</p>
                    <p className="centro__foco">{c.foco}</p>
                    <p className="centro__motivo"><Icon nome="bussola" tamanho={14} /> {c.motivo}</p>
                  </div>
                  <dl className="centro__dados">
                    <div><dt>Distância</dt><dd className="num">{c.distancia}</dd></div>
                    <div><dt>Cidade</dt><dd>{c.cidade}</dd></div>
                    <div><dt>Acesso</dt><dd>{c.convenio}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
    
          <section className="painel">
            <div className="painel__cabeca">
              <h2>Ensaios clínicos com critérios compatíveis</h2>
              <p>
                A elegibilidade é calculada sobre o histórico reunido. Compatibilidade não é
                convite nem inscrição: quem confirma critério e indicação é a equipe do estudo.
              </p>
            </div>
            <ul className="ensaios">
              {ENSAIOS.map((e) => (
                <li key={e.id} className="ensaio">
                  <div className="ensaio__cabeca">
                    <div>
                      <p className="ensaio__codigo num">{e.codigo}</p>
                      <h3>{e.titulo}</h3>
                      <p className="ensaio__meta">{e.fase} · {e.local}</p>
                    </div>
                    <div className="ensaio__match">
                      <span className="ensaio__pct num">{e.match}%</span>
                      <span className="ensaio__barra" aria-hidden="true">
                        <span style={{ width: `${e.match}%` }} />
                      </span>
                      <span className="ensaio__rotulo">critérios compatíveis</span>
                    </div>
                  </div>
                  <ul className="criterios">
                    {e.criterios.map((c) => (
                      <li key={c.texto} className={c.atende === true ? 'ok' : c.atende === false ? 'nao' : 'talvez'}>
                        <Icon nome={c.atende === true ? 'check' : c.atende === false ? 'fechar' : 'alerta'} tamanho={13} />
                        {c.texto}
                        {c.atende === null && <span className="criterios__nota">não consta no histórico</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
