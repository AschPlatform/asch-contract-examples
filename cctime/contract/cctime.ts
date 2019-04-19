/// <reference types="asch-contract-types" />

class Account {
  username: string = ''
  bio: string = ''
  createdAt: number = 0
}

class Article {
  id: string = '' // sha256(${transactionId}${timestamp}${authorId}${title}${url})
  transactionId: string = ''
  authorId: string = ''
  timestamp: number = 0
  title: string = ''
  url: string = ''
  rewardCount: number = 0
  commentCount: number = 0
  reportCount: number = 0
  score: number = 0
}

class Comment {
  id: string = '' // sha256(${transactionId}${timestamp}${authorId}${articleId})
  transactionId: string = ''
  timestamp: number = 0
  authorId: string = ''
  articleId: string = ''
  content: string = ''
  reportCount: number = 0
}

interface AccountInfo {
  username: string
  bio: string
  createdAt: number
}

interface ArticleInfo {
  id: string
  transactionId: string
  author?: AccountInfo
  timestamp: number
  title: string
  url: string
  rewardCount: number
  commentCount: number
  reportCount: number
  score: number
}

interface CommentInfo {
  id: string
  transactionId: string
  timestamp: number
  author?: AccountInfo
  articleId: string
  content: string
  reportCount: number
}

export default class CCTimeContract extends AschContract {
  genesisAddress: string
  holding: Mapping<bigint>

  reportThreshold: number
  accounts: Mapping<Account>// { accountId: account }
  usernames: Mapping<string>// { username: accountId }
  articles: Vector<Article>// [article, ...], 按时间升序（因为只有push方法，没有unshift）
  articleIndexes: Mapping<number>// { articleId: 0（文章对应articles中的下标） }
  comments: Mapping<Vector<Comment>>// { articleId: [comment, ...] }, comment 时间升序
  articleReports: Mapping<Mapping<number>>// { articleId: { reporterId: 1 } }, report 时间升序
  commentReports: Mapping<Mapping<number>>// { commentId: { reporterId: 1 } }, report 时间升序

  constructor () {
    super()

    this.genesisAddress = 'GENESIS_ADDRESS'
    this.holding = new Mapping<bigint>()
    // 测试用
    // this.holding[this.genesisAddress] = BigInt('1000000000')

    this.reportThreshold = 3
    this.accounts = new Mapping<Account>()
    this.usernames = new Mapping<string>()
    this.articles = new Vector<Article>()
    this.articleIndexes = new Mapping<number>()
    this.comments = new Mapping<Vector<Comment>>()
    this.articleReports = new Mapping<Mapping<number>>()
    this.commentReports = new Mapping<Mapping<number>>()

    console.log(Util.Address.generateNormalAddress('48075a597e721a156e2e0799de5cc0c5324dc6e7eaf1cdd46250868ec53215dd'))
  }

  // 充值
  @payable({ isDefault: true })
  onPay (amount: number, currency: string): void {
    // assert(amount > 0, 'Amount must great than 0')
    // assert(currency === 'XCT', 'Support XCT only')

    // const senderAddress = this.context.senderAddress

    // this.increaseHolding(senderAddress, amount)
  }

  // 提现
  onPayout (amount: bigint): void {
    assert(amount > 0, 'amount must greater than 0')
    const senderAddress = this.context.senderAddress
    const holding = this.getHolding(senderAddress)
    assert((holding > 0) && (amount <= holding), 'XCT not enough for payout')

    // 1. 减去用户 holding
    this.increaseHolding(senderAddress, -amount)

    // 2. 转账
    this.transfer(senderAddress, amount, 'XCT')
  }

  private increaseHolding (address: string, value: bigint | number): void {
    const holdingValue = this.holding[address] || BigInt(0)
    this.holding[address] = holdingValue + BigInt(value)
  }

  @constant
  getHolding (senderAddress: string): bigint {
    return this.holding[senderAddress] || BigInt(0)
  }

  /*************** Account ***************/
  // 创建或者更新账号
  createOrUpdateAccount (username: string, bio: string): void {
    assert(username && (username.length < 50), 'Please set your username with 50 characters')
    assert(bio && (bio.length < 256), 'Please set your bio with 256 characters')

    const senderAddress = this.context.senderAddress
    const _accountId = this.usernames[username]
    // 1. 用户名已存在，且不是自己，则拒绝更新
    if (_accountId) {
      assert(_accountId === senderAddress, 'This username already exists')
    }

    // 2. 扣费 XCT
    const holding = this.getHolding(senderAddress)
    const fee = BigInt(100)
    assert(holding > fee, 'XCT not enough for create or update account')
    this.increaseHolding(senderAddress, -fee)

    // 3. 创建or更新用户信息
    const account = this.accounts[senderAddress]
    if (account) {
      // 删除老的username映射
      this.usernames[account.username] = undefined
      account.username = username
      account.bio = bio
      // 新的username映射
      this.usernames[username] = senderAddress
    } else {
      // 创建用户
      this.accounts[senderAddress] = {
        username,
        bio,
        createdAt: this.context.block.timestamp
      }
      this.usernames[username] = senderAddress
    }
  }

  /*************** Article ***************/
  // 计算文章热度
  private calcScore (article: Article | ArticleInfo): number {
    let elapsedHours = (this.context.block.timestamp - article.timestamp) / 3600000
    return Math.sqrt(article.rewardCount + article.commentCount + 1) /
      Math.pow(elapsedHours + article.reportCount * 2 + 2, 1.8)
  }

  // 创建一篇文章
  createArticle (title: string, url: string): void {
    const senderAddress = this.context.senderAddress
    const account = this.accounts[senderAddress]
    assert(account, 'Please create an account first')
    assert(title, 'Missing title')
    assert(title.length < 256, 'Title must less or equal than 256 characters')
    assert(url, 'Missing url')
    assert(url.length < 256, 'Url must less or equal than 256 characters')

    // 1. 检查距上篇文章发表大于8小时
    const lastArticle = this.getAccountLastArticle(senderAddress)
    if (lastArticle) {
      assert(this.context.block.timestamp - lastArticle.timestamp > 28800000, 'create article too frequently')
    }

    const transactionId = this.context.transaction.id
    const authorId = this.context.senderAddress
    const timestamp = this.context.block.timestamp
    const article = {
      id: Crypto.sha256.hash(`${transactionId}${timestamp}${authorId}${title}${url}`),
      transactionId,
      authorId,
      timestamp,
      title,
      url,
      rewardCount: 0,
      commentCount: 0,
      reportCount: 0,
      score: 0
    }

    // 2. 先写入全部 articles
    this.articles.push(article)

    // 3. 存储索引
    this.articleIndexes[article.id] = this.articles.size() - 1

    // 4. 奖励作者(记账)
    const reward = BigInt(10)
    const genesisAddressHolding = this.getHolding(this.genesisAddress)
    assert(genesisAddressHolding > reward, 'XCT pool not enough')

    this.increaseHolding(senderAddress, reward)
    this.increaseHolding(this.genesisAddress, -reward)
  }

  // 获取一篇文章
  private getOneArticle (articleId: string): Article {
    const index = this.articleIndexes[articleId]!
    assert(index !== undefined, 'Cannot find this article')

    const article = this.articles[index]
    assert(article, 'Cannot find this article')

    return article!
  }

  // 获取账号最后创建的一篇文章
  private getAccountLastArticle (accountId: string): Article | undefined {
    let count = this.articles.size()
    let article: Article
    for (let i = count - 1; i >= 0; i--) {
      const _article = this.articles[i]!
      if (_article.authorId === accountId) {
        article = _article
        break
      }
    }

    return article!
  }

  // 赞赏文章
  rewardArticle (articleId: string, amount: number): void {
    const senderAddress = this.context.senderAddress
    const account = this.accounts[senderAddress]
    assert(account, 'Please create an account first')
    assert(articleId, 'Missing articleId')
    const article = this.getOneArticle(articleId)
    // assert(article, 'Cannot find this article')
    assert(amount > 10, 'Amount must greater than 10')
    const remainingAmount = this.getHolding(senderAddress)
    assert(remainingAmount > amount, 'XCT not enough for reward this article')

    // 1. 先减去用户 XCT
    this.increaseHolding(senderAddress, -amount)

    // 2. 增加文章 rewardCount
    article!.rewardCount += amount

    // 3. 打赏作者，10%手续费，记账
    const reward = BigInt(amount)
    const fee = BigInt(Math.floor(amount / 10))
    this.increaseHolding(senderAddress, -reward)
    this.increaseHolding(article!.authorId, reward - fee)
    this.increaseHolding(this.genesisAddress, fee)
  }

  // 举报文章
  reportArticle (articleId: string): void {
    const senderAddress = this.context.senderAddress
    const account = this.accounts[senderAddress]
    assert(account, 'Please create an account first')
    assert(articleId, 'Missing articleId')
    const article = this.getOneArticle(articleId)
    assert(article, 'Cannot find this article')

    // 1. 创建 report 记录
    this.articleReports[articleId] = this.articleReports[articleId] || new Mapping()

    assert(this.articleReports[articleId]![senderAddress] !== 1, 'You already reported this article')
    this.articleReports[articleId]![senderAddress] = 1

    // 2. 文章reportCount+1
    article!.reportCount += 1
  }

  // 获取所有文章(按创建时间降序，可翻页)
  @constant
  getArticlesByTime (limit: number, offset: number): ArticleInfo[] {
    assert(limit > 0 && limit <= 100, 'limit must greater than 0 and less or equal to 100')
    assert(offset >= 0, 'offset must greater or equal than 0')

    let count = this.articles.size()
    const articles = []
    for (let i = Math.min(offset + limit, count) - 1; i >= offset; i--) {
      const article: ArticleInfo = { ...this.articles[i]! }
      if (article.reportCount >= this.reportThreshold) {
        continue
      }
      article.author = this.accounts[this.articles[i]!.authorId]!
      articles.push(article)
    }

    return articles
  }

  // 获取所有文章(按热度降序，可翻页)
  @constant
  getArticlesByScore(limit: number, offset: number): ArticleInfo[] {
    assert(limit > 0 && limit <= 100, 'limit must greater than 0 and less or equal to 100')
    assert(offset >= 0, 'offset must greater or equal than 0')

    let count = Math.min(this.articles.size(), 500)
    // 1. 先取 500 条最新的
    let articles = []
    for (let i = Math.min(offset + limit, count) - 1; i >= offset; i--) {
      const article: ArticleInfo = { ...this.articles[i]! }
      if (article.reportCount >= this.reportThreshold) {
        continue
      }
      article.author = this.accounts[this.articles[i]!.authorId]!
      article.score = this.calcScore(article)

      articles.push(article)
    }

    // 2. score 降序
    articles = articles.sort((prev, next) => {
      return next.score - prev.score
    })

    // 3. 截取
    articles = articles.slice(offset, offset + limit)

    return articles
  }

  /*************** Comment ***************/
  // 创建一个留言
  createComment (articleId: string, content: string): void {
    const senderAddress = this.context.senderAddress
    const account = this.accounts[this.context.senderAddress]
    assert(account, 'Please create an account first')
    assert(articleId, 'Missing articleId')
    const article = this.getOneArticle(articleId)
    assert(article, 'Cannot find this article')
    assert(content, 'Missing content')
    assert(content.length < 1024, 'Content must less or equal 1024 characters')

    const transactionId = this.context.transaction.id
    const timestamp = this.context.block.timestamp
    const comment = {
      id: Crypto.sha256.hash(`${transactionId}${timestamp}${senderAddress}${articleId}`),
      transactionId,
      timestamp,
      authorId: senderAddress,
      articleId,
      content,
      reportCount: 0
    }

    this.comments[articleId] = this.comments[articleId] || new Vector()
    this.comments[articleId]!.push(comment)
    article.commentCount += 1
  }

  // 获取一个文章下所有留言(按创建时间降序，可翻页)
  @constant
  getOneArticleComments (articleId: string, limit: number, offset: number): CommentInfo[] {
    assert(limit > 0 && limit <= 100, 'limit must greater than 0 and less or equal to 100')
    assert(offset >= 0, 'offset must greater or equal than 0')
    assert(articleId, 'Missing articleId')
    const article = this.getOneArticle(articleId)
    assert(article, 'Cannot find this article')

    let articleComments = this.comments[articleId] || (new Vector())
    let count = articleComments.size()

    const comments = []
    for (let i = Math.min(count, offset + limit) - 1; i >= offset; i--) {
      const comment: CommentInfo = { ...articleComments[i]! }
      if (comment.reportCount >= this.reportThreshold) {
        continue
      }
      comment.author = this.accounts[articleComments[i]!.authorId]!
      comments.push(comment)
    }

    return comments
  }

  // 获取一个留言
  private getOneComment (articleId: string, commentId: string): Comment | undefined {
    assert(articleId, 'Missing articleId')
    const article = this.getOneArticle(articleId)
    assert(article, 'Cannot find this article')

    let comments = this.comments[articleId] || new Vector()
    let count = comments.size()
    let comment: Comment
    for (let i = count - 1; i >= 0; i--) {
      if (comments[i]!.id === commentId) {
        comment = comments[i]!
        break
      }
    }
    return comment!
  }

  // 举报一个留言
  reportComment (articleId: string, commentId: string): void {
    const senderAddress = this.context.senderAddress
    const account = this.accounts[senderAddress]
    assert(account, 'Please create an account first')
    assert(articleId, 'Missing articleId')
    assert(commentId, 'Missing commentId')
    const comment = this.getOneComment(articleId, commentId)
    assert(comment, 'Cannot find this comment')

    // 1. 创建 report 记录
    this.commentReports[commentId] = this.commentReports[commentId] || new Mapping()

    assert(this.commentReports[commentId]![senderAddress] !== 1, 'You already reported this comment')
    this.commentReports[commentId]![senderAddress] = 1

    // 2. 留言reportCount+1
    comment!.reportCount += 1
  }
}
