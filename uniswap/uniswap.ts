class Market {
  quotePool: bigint
  basePool: bigint

  constructor() {
    this.quotePool = BigInt(0)
    this.basePool = BigInt(0)
  }
}

export default class UniSwapContract extends AschContract {
  private markets: Mapping<Market>

  constructor() {
    super()
    this.markets = new Mapping<Market>()
  }

  createMarket(pair: string) {
    if (this.markets[pair]) {
      assert(false, 'Market already exists')
    }
    this.markets[pair] = new Market()
  }

  @payable
  depositBase(amount: bigint, token: string, pair: string) {
    const market = this.markets[pair]
    assert(market, 'Market not exists')
    const parts = pair.split('/')
    assert(token === parts[1], 'Base token not match')
    market!.basePool += amount
  }

  @payable
  depositQuote(amount: bigint, token: string, pair: string) {
    const market = this.markets[pair]
    assert(market, 'Market not exists')
    const parts = pair.split('/')
    assert(token === parts[0], 'Quote token not match')
    market!.quotePool += amount
  }

  @payable
  buy(amount: bigint, token: string, pair: string): bigint {
    assert(this.markets[pair], 'Market not exists')
    const market = this.markets[pair]!
    const parts = pair.split('/')
    assert(token === parts[1], 'Base token not match')

    const fee = amount / BigInt(500)
    const invariant = market.basePool * market.quotePool
    const newBasePool = market.basePool + amount
    const newQuotePool = invariant / (newBasePool - fee)
    const tokensOut = market.quotePool - newQuotePool
    market.basePool = newBasePool
    market.quotePool = newQuotePool
    // console.log(invariant, newBasePool, newQuotePool, tokensOut)
    this.transfer(this.context.senderAddress, tokensOut, parts[0])
    return tokensOut
  }

  @payable
  sell(amount: bigint, token: string, pair: string): bigint {
    assert(this.markets[pair], 'Market not exists')
    const market = this.markets[pair]!
    const parts = pair.split('/')
    assert(token === parts[0], 'Quote token not match')

    const fee = amount / BigInt(500)
    const invariant = market.basePool * market.quotePool
    const newQuotePool = market.quotePool + amount
    const newBasePool = invariant / (newQuotePool - fee)
    const tokensOut = market.basePool - newBasePool
    market.basePool = newBasePool
    market.quotePool = newQuotePool
    // console.log(invariant, newBasePool, newQuotePool, tokensOut)
    this.transfer(this.context.senderAddress, tokensOut, parts[1])
    return tokensOut
  }
}