import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { criarLlm } from './index.js'
import { criarLlmMock } from './mock.js'

describe('LLM mock', () => {
  it('é determinístico e se identifica como mock', async () => {
    const llm = criarLlmMock()
    const msgs = [{ role: 'user' as const, content: 'Como está meu colesterol?' }]
    expect(llm.nome).toBe('mock')
    expect(await llm.chat(msgs)).toBe(await llm.chat(msgs))
  })

  it('devolve JSON válido quando pedido', async () => {
    const r = await criarLlmMock().chat([{ role: 'user', content: 'oi' }], { json: true })
    expect(() => JSON.parse(r)).not.toThrow()
  })

  it('criarLlm usa o mock sem as variáveis OCI', () => {
    expect(criarLlm({}).nome).toBe('mock')
  })

  describe('com variáveis OCI', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const env = {
      OCI_TENANCY_OCID: 'ocid1.tenancy.oc1..t', OCI_USER_OCID: 'ocid1.user.oc1..u',
      OCI_FINGERPRINT: 'aa:bb', OCI_COMPARTMENT_OCID: 'ocid1.compartment.oc1..c',
    }

    it('usa OCI com chave escapada em uma linha', () => {
      expect(criarLlm({ ...env, OCI_PRIVATE_KEY: pem.replaceAll('\n', '\\n') }).nome).toBe('oci')
    })

    it('cai para mock se a chave for inválida', () => {
      expect(criarLlm({ ...env, OCI_PRIVATE_KEY: 'nao-e-pem' }).nome).toBe('mock')
    })
  })
})
