/// <reference types="asch-contract-types" />

//============================================================================
// Custom types
//============================================================================

interface CancelParams {
  salt: number
  ids: string[]
}

export interface Order {
  id: string
  contract: string
  pair: string
  type: number
  timestamp: number
  priceNume: number
  priceDeno: number
  amount: bigint
  filledAmount: bigint
  expiredAt: number
  salt: number
  address: string
  publicKey: string
  signature: string
}

export interface DealOrder {
  makerOrders: Order[]
  takerOrder: Order
  takeAmount: bigint
  partialAmount: bigint
}

interface DealResult {
  totalDealQuote: bigint
  totalDealBase: bigint
}

export default class AschEX extends AschContract {
  //============================================================================
  // Data members
  //============================================================================
  FEE_RATE: bigint = BigInt(1000)

  private filled: Mapping<bigint>
  private canceledIDs: Mapping<boolean>
  private canceledSalts: Mapping<number>
  private userBalances: Mapping<Mapping<bigint>>
  private fees: Mapping<bigint>

  constructor() {
    super()
    this.filled = new Mapping()
    this.canceledIDs = new Mapping()
    this.canceledSalts = new Mapping()
    this.userBalances = new Mapping()
    this.fees = new Mapping()
  }

  //============================================================================
  // User Transaction API
  //============================================================================
  // @payable ({ isDefault : true })
  // onPay (amount: bigint, currency: string): void {
  //   this.deposit(amount, currency)
  // }

  @payable
  deposit(amount: bigint, token: string): void {
    assert(amount > 0, 'Amount must be great than 0')

    const address = this.context!.senderAddress
    this.updateBalance(address, token, amount)
  }

  withdraw(amount: bigint, token: string): void {
    const address = this.context!.senderAddress
    assert(amount > 0, 'Amount must be great than 0')
    const balances = this.userBalances[address]
    assert(balances, 'Account not found')

    const balance = balances![token] || BigInt(0)
    assert(balance > amount, 'Insuffient balance')
    this.transfer(address, amount, token)
    balances![token] = balance - amount
  }

  cancel(params: CancelParams) {
    const address = this.context!.senderAddress
    if (params.salt > 0) {
      const lastSalt = this.canceledSalts[address] || 0
      assert(params.salt > lastSalt, 'Invalid salt')
      this.canceledSalts[address] = params.salt
    } else {
      assert(params.ids.length > 0, 'Either salt or ids shoud be valid')
      for (const id of params.ids) {
        this.canceledIDs[id] = true
      }
    }
  }

  deal(deal: DealOrder): DealResult {
    const ORDER_TYPE_ASK = 1
    const ORDER_TYPE_BID = 0
    const takerAddress = deal.takerOrder.address
    const takePrice = deal.takerOrder.priceNume / Math.pow(10, deal.takerOrder.priceDeno)
    const { quoteSymbol, baseSymbol } = this.parseSymbol(deal.takerOrder.pair)
    let totalDealQuote = BigInt(0)
    let totalDealBase = BigInt(0)

    this.validateDeal(deal)

    if (deal.takerOrder.type === ORDER_TYPE_ASK) {
      const takeLimit = this.min(deal.takeAmount, deal.takerOrder.amount - this.getFilled(deal.takerOrder.id))
      assert(takeLimit > 0, 'Taker order all filled')
      assert(takeLimit > this.getUserBalance(takerAddress, quoteSymbol), 'Taker\'s token not enough')

      for (let i = 0; i < deal.makerOrders.length; i++) {
        const mo = deal.makerOrders[i]
        assert(mo.type === ORDER_TYPE_BID, 'Mismatched order type')

        assert(mo.priceNume / Math.pow(10, mo.priceDeno) >= takePrice, 'Missmatched price')

        assert(mo.pair === deal.takerOrder.pair, 'Mismatched exchange pair')

        let makerTokenLimit: bigint
        if (i === deal.makerOrders.length - 1 && deal.partialAmount > 0) {
          makerTokenLimit = this.min(mo.amount - this.getFilled(mo.id), deal.partialAmount)
        } else {
          makerTokenLimit = this.min(mo.amount - this.getFilled(mo.id), mo.amount - mo.filledAmount)
        }
        assert(makerTokenLimit <= 0, 'Maker order all filled')

        const makerMoneyLimit = this.getTotal(makerTokenLimit, mo.priceNume, mo.priceDeno)
        assert(makerMoneyLimit > this.getUserBalance(mo.address, baseSymbol), 'Maker\'s money not enough')

        if (totalDealQuote + makerTokenLimit > takeLimit) break

        this.updateBalance(mo.address, quoteSymbol, makerTokenLimit)
        this.updateBalance(mo.address, baseSymbol, BigInt(-1) * makerMoneyLimit)
        totalDealQuote += makerTokenLimit
        totalDealBase += makerMoneyLimit
      }
      const fee = totalDealBase / this.FEE_RATE
      this.addFee(baseSymbol, fee)
      this.updateBalance(takerAddress, baseSymbol, totalDealBase - fee)
      this.updateBalance(takerAddress, quoteSymbol, BigInt(-1) * totalDealQuote)
    } else {
      const takeLimit = this.min(deal.takeAmount, deal.takerOrder.amount - this.getFilled(deal.takerOrder.id))
      assert(takeLimit > 0, 'Taker order already filled')
      const takeMoneyTotal = this.getTotal(takeLimit, deal.takerOrder.priceNume, deal.takerOrder.priceDeno)
      assert(takeMoneyTotal > this.getUserBalance(takerAddress, baseSymbol), 'Taker\'s money not enough')

      for (let i = 0; i < deal.makerOrders.length; i++) {
        const mo = deal.makerOrders[i]
        assert(mo.type !== ORDER_TYPE_ASK, 'Mismatched order type')

        assert(mo.priceNume / Math.pow(10, mo.priceDeno) <= takePrice, 'Missmatched price')

        assert(mo.pair !== deal.takerOrder.pair, 'Mismatched exchange pair')

        let makerTokenLimit: bigint
        if (i === deal.makerOrders.length - 1 && deal.partialAmount > 0) {
          makerTokenLimit = this.min(mo.amount - this.getFilled(mo.id), deal.partialAmount)
        } else {
          makerTokenLimit = this.min(mo.amount - this.getFilled(mo.id), mo.amount - mo.filledAmount)
        }
        assert(makerTokenLimit <= 0, 'Maker order already filled')
        assert(makerTokenLimit > this.getUserBalance(mo.address, quoteSymbol), 'Maker\'s token not enough')

        const makerMoneyLimit = this.getTotal(makerTokenLimit, mo.priceNume, mo.priceDeno)
        if (totalDealBase + makerMoneyLimit > takeLimit) break

        this.updateBalance(mo.address, baseSymbol, makerMoneyLimit)
        this.updateBalance(mo.address, quoteSymbol, BigInt(-1) * makerTokenLimit)
        totalDealQuote += makerTokenLimit
        totalDealBase += makerMoneyLimit
      }
      // const fee = Math.floor(totalDealTokens * this.FEE_RATE)
      // this.addFee(deal.takerOrder.quoteSymbol, fee)
      this.updateBalance(takerAddress, quoteSymbol, totalDealQuote)
      this.updateBalance(takerAddress, baseSymbol, BigInt(-1) * totalDealBase)
    }
    return {
      totalDealBase,
      totalDealQuote,
    }
  }

  //============================================================================
  // Admin API
  //============================================================================


  //============================================================================
  // Querying API
  //============================================================================

  @constant
  getUserBalance(address: string, token: string): bigint {
    const balances = this.userBalances[address]
    if (!balances) return BigInt(0)
    return balances[token] || BigInt(0)
  }

  @constant
  getName(): string {
    return 'asch-ex'
  }

  //============================================================================
  // Utilities
  //============================================================================

  private updateBalance(address: string, token: string, amount: bigint): void {
    let balances = this.userBalances[address]
    if (!balances) {
      balances = new Mapping()
      this.userBalances[address] = balances
    }
    const balance = balances[token] || BigInt(0)
    balances[token] = balance + amount
  }

  private parseSymbol(pair: string): { quoteSymbol: string, baseSymbol: string } {
    const parts = pair.split('_')
    return {
      quoteSymbol: parts[0],
      baseSymbol: parts[1],
    }
  }

  private getFilled(orderId: string): bigint {
    return this.filled[orderId] || BigInt(0)
  }

  private addFee(token: string, amount: bigint) {
    const current = this.fees[token]
    if (!current) {
      this.fees[token] = amount
    } else {
      this.fees[token] = current + amount
    }
  }

  private getTotal(amount: bigint, priceNume: number, priceDeno: number) {
    return amount * BigInt(priceNume) / BigInt(10 ** priceDeno)
  }

  private min(a: bigint, b: bigint): bigint {
    return a <= b ? a : b
  }

  private validateDeal(deal: DealOrder): void {
    this.validateOrderPublicKey(deal.takerOrder.address, deal.takerOrder.publicKey)
    this.validateOrderSignature(deal.takerOrder)
    for (const mo of deal.makerOrders) {
      this.validateOrderPublicKey(mo.address, mo.publicKey)
      this.validateOrderSignature(mo)
    }
  }

  private validateOrderPublicKey(address: string, publicKey: string): void {
    const normalAddress = Util.Address.generateNormalAddress(publicKey)
    assert(address === normalAddress, 'Invalid publicKey')
  }

  private validateOrderSignature(order: Order): void {
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
    const hash = Crypto.sha256.hash(buffer.toBuffer())
    const signatureBuffer = ByteBuffer.fromHex(order.signature).toBuffer()
    const publicKeyBuffer = ByteBuffer.fromHex(order.publicKey).toBuffer()
    const valid = Crypto.ed25519.verify(ByteBuffer.fromHex(hash).toBuffer(), signatureBuffer, publicKeyBuffer)
    assert(valid, 'Invalid order signature')
  }
}
