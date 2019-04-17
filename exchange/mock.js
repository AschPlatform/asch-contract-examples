const aschContractCore = require('asch-contract-core')

const getContext = (function () {
  let height = 0
  return function () {
    height++
    return {
      transaction: { id: String(height), args: [] },
      senderAddress: 'senderAddress',
      block: { height, timestamp: height, version: 'v1.0' }
    }
  }
})()

class AschContract {
  constructor() {
    this._context = {
      height: 0,
      senderAddress: 'senderAddress',
      transaction: {
        id: '1234',
        args: [],
      },
      block: {
        height: 0,
        timestamp: 0,
        version: 'v1.0'
      }
    }
  }
  get context () {
    return this._context
  }

  transfer (recipientAddress, amount, currency) {}
}

global.AschContract = AschContract
global.Mapping = aschContractCore.Mapping.Mapping
global.Vector = aschContractCore.Vector.Vector
global.Crypto = aschContractCore.Crypto.Crypto
global.assert = aschContractCore.assert.assert
global.ByteBuffer = aschContractCore.ByteBuffer.ByteBuffer
global.payable = () => () => {}
global.constant = () => () => {}
