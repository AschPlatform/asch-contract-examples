/// <reference lib="es6" />

import '../mock'
import { AschEX } from '../contract/asch-ex-contract'

describe('asch-ex-contract', () => {
  it('get name', () => {
    const c = new AschEX()

    expect(c.getName()).toBe('asch-ex')
  })

  it('deposit', () => {
    const c = new AschEX()
    expect(c.getUserBalance('senderAddress', 'XAS')).toEqual(0n)
    c.deposit(10000n, 'XAS')
    expect(c.getUserBalance('senderAddress', 'XAS')).toEqual(10000n)
  })
})
