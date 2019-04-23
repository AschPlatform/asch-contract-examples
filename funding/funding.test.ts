import '../../mock'
import CCTime from '../contract/cctime'

describe('cctime', () => {
  it('new CrowdFundgingContract()', () => {
    const crowdFundgingContract = new CrowdFundgingContract()

    expect(crowdFundgingContract.offeringCurrency).toBe('GENESIS_ADDRESS')
    expect(crowdFundgingContract.sponsorAddress).toBe('test.XXT')
  })
})
