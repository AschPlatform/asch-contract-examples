import '../../mock'
import CCTime from '../contract/cctime'

describe('cctime', () => {
  it('new CCTimeContract()', () => {
    const ccTimeContract = new CCTime()

    expect(ccTimeContract.genesisAddress).toBe('GENESIS_ADDRESS')
  })
})
