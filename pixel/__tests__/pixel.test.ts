import '../mock'
import PixelContract from '../contract/pixel'

describe('PixelContract', () => {
  it('new CCTimeContract()', () => {
    const pixelContract = new PixelContract()

    expect(pixelContract).toBe('GENESIS_ADDRESS')
  })
})
