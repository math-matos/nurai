import { describe, expect, it } from 'vitest'
import { agruparEspecialidades, chaveEspecialidade } from '../src/data/especialidades.js'

/* Abas de especialidade do Resumo: grafias diferentes da mesma especialidade viram uma aba só. */
describe('agruparEspecialidades', () => {
  it('ignora maiúsculas, acentos e espaços extras', () => {
    expect(chaveEspecialidade('  Clínica   Médica ')).toBe('clinica medica')
    expect(agruparEspecialidades(['Clínica médica', 'Clínica Médica', 'clinica medica'])).toEqual([
      { rotulo: 'Clínica médica', n: 3 },
    ])
  })

  it('junta a variante que só acrescenta palavras na mais curta', () => {
    expect(agruparEspecialidades([
      'Radiologia e Diagnóstico por Imagem', 'Cardiologia', 'Radiologia', 'radiologia e diagnóstico por imagem',
    ])).toEqual([
      { rotulo: 'Radiologia', n: 3 },
      { rotulo: 'Cardiologia', n: 1 },
    ])
  })

  it('não junta especialidades que só começam com as mesmas letras', () => {
    expect(agruparEspecialidades(['Neurologia', 'Neurologia pediátrica', 'Neurocirurgia']).map((g) => g.rotulo))
      .toEqual(['Neurologia', 'Neurocirurgia'])
  })

  it('usa a grafia preferida e descarta vazios', () => {
    expect(agruparEspecialidades(['CLÍNICA MÉDICA', undefined, '  ', 'Clinica medica'], ['Clínica médica']))
      .toEqual([{ rotulo: 'Clínica médica', n: 2 }])
  })

  it('mais frequentes primeiro, empate em ordem alfabética', () => {
    expect(agruparEspecialidades(['Oftalmologia', 'Cardiologia', 'Endocrinologia', 'Cardiologia']).map((g) => g.rotulo))
      .toEqual(['Cardiologia', 'Endocrinologia', 'Oftalmologia'])
  })
})
