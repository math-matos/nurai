# Nurai — verdade do produto

## O que é
Plataforma de saúde digital centrada no paciente que unifica o histórico clínico
disperso (SUS, rede privada, papel/PDF) em uma linha do tempo única, estrutura esse
dado com IA e o transforma em próximos passos de cuidado.

Origem: Challenge STO 2026 / FIAP — ESOA4. Equipe: Lúcia Boutti, Thiago Eiji,
Murilo Mansano, Pedro Eugênio, Matheus Matos.
Tese: "building tech intelligence to accelerate human health."

## Problema escolhido (dos três da Fase 5)
**Fragmentação do histórico clínico do paciente.** Exames, laudos, consultas e
relatórios cirúrgicos ficam espalhados entre laboratórios, hospitais, clínicas e
operadoras, sem nenhum sistema que os organize em torno do paciente. No Brasil a
coexistência de SUS e saúde suplementar agrava a dispersão. O problema não é falta
de dados — é falta de contexto acessível no instante da decisão clínica.

## Usuários
- **Paciente crônico / multiespecialidade** (persona principal: Helena, 58, diabetes
  tipo 2 + arritmia). Cena real: sala de espera, celular na mão, luz de dia, pasta de
  papel na bolsa. Baixa tolerância a jargão, alta necessidade de confiança.
- **Médico** recebendo o paciente com 12 minutos de consulta e contexto incompleto.
- **Cuidador/familiar** que hoje organiza a pasta manualmente.

## O que o MVP precisa provar
1. Que fragmentos de fontes incompatíveis cabem em uma linha do tempo só.
2. Que um documento solto (PDF/foto de laudo) vira dado estruturado e navegável.
3. Que sobre esse contexto a IA responde com citação da fonte — não alucina.
4. Que o paciente é dono: consentimento por instituição, revogável, com auditoria.
5. Que isso reduz desperdício concreto (exame repetido evitado) e tempo de consulta.

## Restrições
- MVP sem backend: todo estado em `localStorage`, dados sintéticos e rotulados como tais.
- Nenhuma alegação clínica ou comercial não verificável. Nada de diagnóstico automático:
  a IA organiza, resume e encaminha — decisão é do médico.
- LGPD é argumento central de produto, não rodapé.
- Camada de nuvem (incl. Oracle) fica como fase seguinte, marcada na arquitetura.

## Não é
Não é prontuário eletrônico de hospital, não é telemedicina, não é seguro de saúde,
não é substituto do médico.
