import { describe, expect, it } from 'vitest'
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

  it('não altera texto já em pt-BR nem a palavra "e" ou números de ids', () => {
    const texto = 'Em 05/03/2026 a glicada foi 7,2% e a creatinina 1,1 mg/dL.'
    expect(limparTexto(texto)).toBe(texto)
  })

  it('limparTextos descarta itens que ficaram vazios', () => {
    expect(limparTextos([' [e01] ', ' ok '])).toEqual(['ok'])
  })
})
