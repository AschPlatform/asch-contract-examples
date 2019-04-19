class Puzzle {
  token: string
  amount: bigint
  solved: boolean
  anwserHash: string
  
  constructor(token: string, amount: bigint, anwserHash: string) {
    this.token = token
    this.amount = amount
    this.solved = false
    this.anwserHash = anwserHash
  }
}

export default class PuzzleContract extends AschContract {
  private puzzles: Mapping<Puzzle>

  constructor() {
    super()
    this.puzzles = new Mapping<Puzzle>()
  }

  @payable
  createPuzzle(amount: bigint, token: string, question: string, anwserHash: string) {
    assert(question !== '')
    assert(anwserHash !== '')
    this.puzzles[question] = new Puzzle(token, amount, anwserHash)
  }

  solve(question: string, answer: string): boolean {
    const puzzle = this.puzzles[question]
    assert(puzzle, 'Question not exists')
    assert(!puzzle!.solved, 'Already solved')
    if (Crypto.sha256.hash(answer) === puzzle!.anwserHash) {
      puzzle!.solved = true
      this.transfer(this.context.senderAddress, puzzle!.amount, puzzle!.token)
      return true
    }
    return false
  }

  @constant
  isSolved(question: string): boolean {
    const puzzle = this.puzzles[question]
    assert(puzzle, 'Question not exists')
    return puzzle!.solved
  }
}