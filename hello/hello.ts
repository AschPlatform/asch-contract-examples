const CURRENCY = 'XAS'

class Payment {
  address: string
  amount: bigint

  constructor(address: string, amount: bigint) {
    this.address = address
    this.amount = amount
  }
}

export default class HelloContract extends AschContract {
  private total: bigint
  private payments: Vector<Payment>
  private kvstore: Mapping<string>

  constructor() {
    super()
    this.total = BigInt(0)
    this.payments = new Vector<Payment>()
    this.kvstore = new Mapping<string>()
  }

  @payable({ isDefault: true })
  onPay(amount: bigint, currency: string) {
    assert(amount > 0, `Amount should greater than 0`)
    assert(currency === CURRENCY, `Please pay ${CURRENCY}`)

    this.total += amount
    const payment = new Payment(this.context.senderAddress, amount)
    this.payments.push(payment)
  }

  set(key: string, val: string): void {
    assert(val !== '')
    this.kvstore[key] = val
  }

  @constant
  get(key: string): string {
    return this.kvstore[key] || ''
  }

  @constant
  getPayTimes(): number {
    return this.payments.size()
  }

  @constant
  getTotal(): bigint {
    return this.total
  }
}