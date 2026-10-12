import { Hono } from 'hono'
import type { AmbienteApp } from '../auth/middleware.js'
import { limparCookieSessao } from '../auth/sessao.js'
import { instanteIso } from '../db/datas.js'
import { autorDe, type Perfil, type Repositorio, type RepositorioPaciente } from '../db/repo.js'
import { esquemaExclusao, esquemaOnboarding, esquemaPerfil, MENSAGEM_AUTORIZACAO } from '../esquemas.js'
import { ErroValidacao, lerCorpo } from '../http.js'

/* A declaração vai para o log de acessos: é a prova de quando o responsável assumiu o histórico do paciente. */
async function registrarAutorizacao(repoPaciente: RepositorioPaciente, perfil: Perfil) {
  await repoPaciente.registrarAcesso({
    ...autorDe(perfil), acao: `Declarou autorização para gerir o histórico de ${perfil.nome}`, itens: perfil.nome,
  })
}

/* Rotas da própria conta; o middleware de sessão já garantiu c.var.pacienteId. */
export function rotasConta(repo: Repositorio): Hono<AmbienteApp> {
  const rotas = new Hono<AmbienteApp>()

  /* Sem paciente o perfil fica como está: recomeçar do zero não desfaz o modo cuidador. Com paciente, a
     declaração de autorização é obrigatória (esquema) e registrada depois do recomeço, que limpa o log. */
  rotas.post('/onboarding', async (c) => {
    const { modo, paciente } = await lerCorpo(c, esquemaOnboarding)
    if (paciente) {
      const { nome, responsavel } = c.var.perfil
      await repo.atualizarPerfil(c.var.pacienteId, {
        nome: paciente.nome,
        dataNascimento: paciente.dataNascimento ?? '',
        responsavel: { nome: responsavel?.nome ?? nome, relacao: paciente.relacao, autorizadoEm: instanteIso() },
      })
    }
    const perfil = await repo.aplicarOnboarding(c.var.pacienteId, modo)
    if (paciente && perfil) await registrarAutorizacao(c.var.repoPaciente, perfil)
    return c.json({ perfil })
  })

  /* Definir o responsável exige a declaração enquanto a conta não a tiver; depois, trocar nome ou relação não
     pede de novo. Mandá-la outra vez renova o instante e o registro. */
  rotas.patch('/perfil', async (c) => {
    const { responsavel, ...mudancas } = await lerCorpo(c, esquemaPerfil)
    const declarou = responsavel?.autorizacao === true
    if (responsavel && !declarou && !c.var.perfil.responsavel?.autorizadoEm) {
      throw new ErroValidacao(`Dados inválidos — responsavel.autorizacao: ${MENSAGEM_AUTORIZACAO}`,
        { 'responsavel.autorizacao': MENSAGEM_AUTORIZACAO })
    }
    const perfil = await repo.atualizarPerfil(c.var.pacienteId, {
      ...mudancas,
      ...(responsavel !== undefined && {
        responsavel: responsavel && {
          nome: responsavel.nome, relacao: responsavel.relacao, ...(declarou && { autorizadoEm: instanteIso() }),
        },
      }),
    })
    if (declarou && perfil) await registrarAutorizacao(c.var.repoPaciente, perfil)
    return c.json({ perfil })
  })

  rotas.delete('/conta', async (c) => {
    await lerCorpo(c, esquemaExclusao)
    await repo.excluirPaciente(c.var.pacienteId)
    limparCookieSessao(c)
    return c.body(null, 204)
  })

  return rotas
}
