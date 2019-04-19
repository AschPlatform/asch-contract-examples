import '../mock'
import UniswapContract from './uniswap'

describe('uniswap contract', () => {
  it('create & buy & sell', () => {
    const c = new UniswapContract()
    const pair = 'X.ABC/XAS'
    c.createMarket(pair)
    c.depositBase(1000n, 'XAS', pair)
    c.depositQuote(2000000n, 'X.ABC', pair)

    console.log('buy', c.buy(20n, 'XAS', pair))
    console.log('sell', c.sell(50000n, 'X.ABC', pair))
  })
})