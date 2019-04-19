import '../mock'
import HelloContract from './hello'

describe('hello contract', () => {
  it('onPay', () => {
    const c = new HelloContract()
    expect(c.getPayTimes()).toStrictEqual(0)

    c.onPay(100n, 'XAS')
    expect(c.getPayTimes()).toStrictEqual(1)
    expect(c.getTotal()).toStrictEqual(100n)
  })

  it('onPay throws', () => {
    const c = new HelloContract()
    expect(() => { c.onPay(0n, 'XAS') }).toThrow()
    expect(() => { c.onPay(100n, 'BTC') }).toThrow()
  })

  it('set & get', () => {
    const c = new HelloContract()
    expect(c.get('k1')).toStrictEqual('')
    c.set('k1', 'v1')
    expect(c.get('k1')).toStrictEqual('v1')
  })

  it('set throws', () => {
    const c = new HelloContract()
    expect(() => { c.set('k', '') }).toThrow()
  })
})