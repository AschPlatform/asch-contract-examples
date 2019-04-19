import * as crypto from 'crypto'

import '../mock'
import PuzzleContract from './puzzle'

describe('puzzle contract', () => {
  it('create and solve', () => {
    const c = new PuzzleContract()
    const question = 'what is the answer to universe?'
    expect(() => { c.solve(question, '42') }).toThrow()

    const hash = crypto.createHash('sha256').update('42').digest('hex')
    c.createPuzzle(1000n, 'XAS', question, hash)
    expect(c.solve(question, '42')).toBeTruthy()
    expect(c.isSolved(question)).toBeTruthy()
  })
})