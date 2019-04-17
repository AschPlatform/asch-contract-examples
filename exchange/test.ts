/// <reference lib="es6" />

import * as assert from 'assert'
import './mock'
import AschEX from './contract/asch-ex-contract'

const c = new AschEX()
assert.strictEqual(c.getUserBalance('senderAddress', 'XAS'), 0n)
c.context.senderAddress = 'qingfeng'
c.deposit('XAS', 10000n)
assert.strictEqual(c.getUserBalance('qingfeng', 'XAS'), 10000n)