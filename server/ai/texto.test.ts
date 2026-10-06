import { describe, expect, it } from 'vitest'
import { EVENTOS } from '../../src/data/seed.js'
import { limparTexto, limparTextos } from './texto.js'

describe('limparTexto', () => {
  it('remove marcadores de id entre colchetes ou parênteses', () => {
    expect(limparTexto('A glicada subiu [e18] e depois caiu (e21).')).toBe('A glicada subiu e depois caiu.')
    expect(limparTexto('Veja os registros [e22, e24] e (e09 e e23).')).toBe('Veja os registros e.')
    expect(limparTexto('Exames [e11; e21]: estáveis.')).toBe('Exames: estáveis.')
  })

  it('converte datas ISO para dd/mm/aaaa', () => {
    expect(limparTexto('Diagnóstico em 2019-03-14.')).toBe('Diagnóstico em 14/03/2019.')
  })

  it('troca ponto decimal por vírgula sem mexer em milhar', () => {
    expect(limparTexto('Glicada de 7.8% para 7.2%; creatinina 0.98 mg/dL; 1.500 passos.'))
      .toBe('Glicada de 7,8% para 7,2%; creatinina 0,98 mg/dL; 1.500 passos.')
  })

  it('troca o ponto decimal antes de qualquer unidade e em decimais menores que 1', () => {
    expect(limparTexto('Sua hemoglobina foi de 14.6 g/dL em 10/03/2026 e caiu para 12.4 g/dL.'))
      .toBe('Sua hemoglobina foi de 14,6 g/dL em 10/03/2026 e caiu para 12,4 g/dL.')
    expect(limparTexto('TSH 6.8 mUI/L, potássio 4.1 mmol/L, FC 72.5 bpm, nódulo de 1.5 cm, peso 82.3 kg, HbA1c 5.8%.'))
      .toBe('TSH 6,8 mUI/L, potássio 4,1 mmol/L, FC 72,5 bpm, nódulo de 1,5 cm, peso 82,3 kg, HbA1c 5,8%.')
    expect(limparTexto('Microalbumina 0.125 g/L e hemácias 4.85 milhões/µL.')).toBe('Microalbumina 0,125 g/L e hemácias 4,85 milhões/µL.')
  })

  it('não mexe em datas, versões, códigos, IPs nem números com milhar', () => {
    for (const texto of [
      'Coleta em 10.03.2026.', 'App na versão 1.2 e na v2.5.', 'CID J45.9 registrado.', 'Código 40.30.13.97.',
      'Endereço 192.168.0.1.', 'Metformina 1.500 mg por dia.', 'Total 1,234.5 mg.',
    ]) expect(limparTexto(texto), texto).toBe(texto)
  })

  it('não altera texto já em pt-BR nem a palavra "e" ou números de ids', () => {
    const texto = 'Em 05/03/2026 a glicada foi 7,2% e a creatinina 1,1 mg/dL.'
    expect(limparTexto(texto)).toBe(texto)
  })

  it('limparTextos descarta itens que ficaram vazios', () => {
    expect(limparTextos([' [e01] ', ' ok '])).toEqual(['ok'])
  })

  it('com os eventos, troca o id usado como nome do registro pela descrição dele', () => {
    expect(limparTexto('Em comparação com os registros anteriores, como o [e11] e o [e18], podemos ver a evolução.', EVENTOS))
      .toBe('Em comparação com os registros anteriores, como o exame de 11/08/2023 (Painel metabólico e função renal) e o exame de 14/09/2025 (Controle metabólico e albuminúria), podemos ver a evolução.')
  })

  it('ajusta artigo e preposição ao gênero do registro descrito', () => {
    expect(limparTexto('Na [e11] e no (e12) a glicada caiu.', EVENTOS)).toMatch(/^No exame de 11\/08\/2023 \(.+\) e n[oa] .+ de \d{2}\/\d{2}\/\d{4} \(.+\) a glicada caiu\.$/)
    expect(limparTexto('Comparando com [e11], a glicada subiu.', EVENTOS))
      .toBe('Comparando com o exame de 11/08/2023 (Painel metabólico e função renal), a glicada subiu.')
    expect(limparTexto('Os valores dos [e11, e21] mudaram.', EVENTOS))
      .toBe('Os valores do exame de 11/08/2023 (Painel metabólico e função renal) e do exame de 05/03/2026 (Hemograma, glicada e função renal) mudaram.')
  })

  it('com os eventos, marcador de citação depois de um fato continua só sendo removido', () => {
    expect(limparTexto('A glicada subiu [e18] e depois caiu (e21).', EVENTOS)).toBe('A glicada subiu e depois caiu.')
  })

  it('id desconhecido é removido e não deixa pontuação duplicada', () => {
    expect(limparTexto('Veja o resultado [e99] , e siga ;; ok.', EVENTOS)).toBe('Veja o resultado, e siga; ok.')
  })
})
