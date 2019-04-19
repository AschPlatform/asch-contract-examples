import { AschWeb } from 'asch-web'
import '../../mock'
import AschEX, { Order, DealOrder } from './exchange'

const BID_TYPE = 0
const ASK_TYPE = 1

interface Account {
  secret: string
  publicKey: string
  privateKey: string
  address: string
}

function getRandomAccount() {
  const secret = AschWeb.Utils.generateMnemonic()
  const keys = AschWeb.Utils.getKeys(secret)
  const address = AschWeb.Utils.getAddress(keys.publicKey)
  return {
    secret,
    address,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  }
}

function createOrder(options: any, account: Account): Order {
  const order = Object.assign({
    contract: 'asch-ex',
    pair: 'XAS/USDT',
    type: BID_TYPE,
    timestamp: Math.floor(Date.now() / 1000),
    priceNume: 1,
    priceDeno: 1,
    amount: 100n,
    filledAmount: 0n,
    expiredAt: 1000000,
    salt: 1,
    address: account.address,
    publicKey: account.publicKey,
  }, options)

  const buffer = new ByteBuffer()
  buffer.writeIString(order.contract)
    .writeIString(order.pair)
    .writeUint8(order.type)
    .writeUint32(order.timestamp)
    .writeUint32(order.priceNume)
    .writeUint8(order.priceDeno)
    .writeIString(order.amount.toString())
    .writeIString(order.filledAmount.toString())
    .writeUint32(order.salt)
    .writeIString(order.address)
    .flip()
  const hash = buffer.toHex()
  order.id = hash
  order.signature = AschWeb.Utils.signBytes(hash, account.secret)
  return order
}

describe('asch-ex-contract', () => {
  it('get name', () => {
    const c = new AschEX()
    expect(c.getName()).toBe('asch-ex')
  })

  it('should throw if deposit negative amount', () => {
    const c = new AschEX()
    expect(() => { c.deposit(-1n, 'XAS') }).toThrow()
  })

  it('success deposit', () => {
    const c = new AschEX()
    expect(c.getUserBalance('senderAddress', 'XAS')).toEqual(0n)
    c.deposit(100n, 'XAS')
    expect(c.getUserBalance('senderAddress', 'XAS')).toEqual(100n)
  })

  it('should throw if withdraw negative amount', () => {
    const c = new AschEX()
    expect(() => { c.withdraw(-1n, 'XAS') }).toThrow()
  })

  it('should throw if withdraw account has insuffient balance', () => {
    const c = new AschEX()
    expect(() => { c.withdraw(1n, 'XAS') }).toThrow()
  })

  it('success withdraw', () => {
    const c = new AschEX()
    c.deposit(100n, 'XAS')
    c.withdraw(60n, 'XAS')
    expect(c.getUserBalance('senderAddress', 'XAS')).toEqual(40n)
  })

  it.only('success deal', () => {
    const c = new AschEX()
    const alice = getRandomAccount()
    const bob = getRandomAccount()
    
    const o1 = createOrder({
      type: BID_TYPE,
      priceNume: 10,
      priceDeno: 1,
      amount: 100n,
      filledAmount: 0n,
    }, alice)
    const o2 = createOrder({
      type: ASK_TYPE,
      priceNume: 10,
      priceDeno: 1,
      amount: 100n,
      filledAmount: 0n,
    }, bob)

    const deal: DealOrder = {
      makerOrders: [ o1 ],
      takerOrder: o2,
      takeAmount: 100n,
      partialAmount: 0n,
    }

    const result = c.deal(deal)
    console.log('deal result', result)
  })
})
