import '../mock'
import CCTimeContract from '../contract/CCTime'

describe('CCTimeContract', () => {
  it('new CCTimeContract()', () => {
    const ccTimeContract = new CCTimeContract()

    expect(ccTimeContract.genesisAddress).toBe('GENESIS_ADDRESS')
  })
})
