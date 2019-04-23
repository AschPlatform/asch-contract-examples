/// <reference types="asch-contract-types" />

interface PixelInfo { 
  owner: string
  price: number
  color: number
  version: number
}

interface UserInfo {
  holding: number
  ownPixelNum: number
  bonusMask: number
  bonusSettled: number
  bonusCollected: number
}

interface PaintLogInfo {
  address: string
  color: number
  price: number
  coordinate: number
}
class PaintLog {
  address: string
  color: number
  price: number
  coordinate: number

  constructor() {
      this.address = ' '
      this.color = 0
      this.price = 0
      this.coordinate = 0
  }
}

class Pixel {
  owner: string
  price: number
  color: number
  version: number

  constructor() {
      this.color = 0
      this.price = 50
      this.owner = ' '
      this.version = 0
  }
}

class User {
  holding: number
  ownPixelNum: number
  bonusMask: number
  bonusSettled: number
  bonusCollected: number
  constructor() {
      this.holding = 0
      this.ownPixelNum = 0
      this.bonusCollected = 0
      this.bonusMask = 0
      this.bonusSettled = 0
  }
}



// 自己发行能量
// 众筹合约类
class PixelGameContract extends AschContract {

  // 全局地图
  // 长和宽
  height: number
  width: number
  // map设为以为数组
  map: Mapping<Pixel>

  // 像素初始价格
  defaultPrice: number

  // 玩家信息（余额信息）
  playersInfo: Mapping<User>
  // 日志
  logs: Vector<PaintLog>
  // 已购买像素数量
  totalPixel: number

  // 每个像素的分红值
  bonusIndex: number

  // 最后购买者
  lastBuyer: string


  // 游戏总收益
  totalIncome: number
  // 奖池金额
  jackpotIncome: number
  //
  // 币的汇率
  rate: number
  // 倍率
  ratio: number
  incomeRatio: number
  bonusRatio: number
  jackpotRatio: number

  //时间计时
  beginTime: number

  // 奖池逻辑
  totalIncrement: number
  totalIncrementTime:number
  firstGameOver: boolean

constructor() {
      super()
      // 画布长宽
      this.height = 1000
      this.width = 1000
      // 地图
      this.map = new Mapping<Pixel>()
      this.playersInfo = new Mapping<User>()
      this.logs = new Vector<PaintLog>()

      // 游戏及奖池收益
      this.totalIncome = 0
      this.jackpotIncome = 0
      // 已购像素
      this.totalPixel = 0
      // 默认价格
      this.defaultPrice = 50
      // 初始汇率
      this.rate = 1000
      this.ratio = 0.35
      this.incomeRatio = 0.75
      this.bonusRatio = 0.55
      this.jackpotRatio = 0.10  
      // 时间
      this.beginTime = this.context!.block.height

      // 初始化分红数据
      this.bonusIndex = 0

      // 初始化奖池数据
      this.firstGameOver = false
      this.totalIncrement = 0
      this.totalIncrementTime = 0

      this.lastBuyer = ' '

  }
  
  @payable({ isDefault: true })
buyCoins(amount: number, currency: string): void {
      assert(amount >= 0, 'invalid amount, please input correct amount')
      assert(currency === 'XAS', 'invalid currency, please pay XAS')

      const senderId = this.context!.senderAddress
      if(this.playersInfo[senderId] === undefined){
          this.playersInfo[senderId] = new User()
      }
      this.playersInfo[senderId]!.holding += amount * this.rate
  }
  // call 调用购买像素
  buyPixel(postions: Array<number>, color: number): void{
      assert(color >= 0, 'you input error color info')
      assert(postions.length > 0, 'this is none position')
      const senderId = this.context!.senderAddress
      assert(this.playersInfo[senderId] !== undefined, 'you have no pixel coin')

      this.updateBonus(senderId)
      // 计算本轮的所有奖励分红 totalCurrFees为收益  totalSpent为总花费  totalSpent为总买的数量
      let res = this.updatePixel(postions, senderId, color)
      let totalCurrFees = res[0]
      let totalCurrCount = res[1]
      let totalSpent = res[2]
      const player = this.playersInfo[senderId]!
      // 买家已买数量更新
      player.ownPixelNum += totalCurrCount
      // 扣除买家多分的收益
      player.bonusMask += (this.bonusIndex * totalCurrCount)
      player.holding -= totalSpent

      // 更新单像素分红价格
      this.bonusIndex += (totalCurrFees * this.bonusRatio / this.totalPixel) 
      // 更新像素点
      // this.updatePixelMapAndPlayerInfo(x, y, senderId, color)
      if(totalCurrCount > 0) {
          this.lastBuyer = senderId
      }
      //更新游戏奖池
      if(!this.firstGameOver){
          this.jackpotIncome += totalCurrFees * this.jackpotRatio
      } 

  }

  private updatePixel(postions: Array<number>, senderId: string, color: number): number[] {
      const player = this.loadOrCreatePlayer(senderId)
      let totalCurrFees = 0
      let totalCurrCount = 0
      let totalSpent = 0
      for(let i = 0; i < postions.length; i++){
          let postion = postions[i]
          assert(postion >= 0 && postion < this.width * this.height, `invalid pos postion ${postion} ${this.width * this.height}`)
          const price = this.getPixelPrice(String(postion))
  
          // 像素首次人买过
          if(this.map[String(postion)]! === undefined) {
              // 如果钱不足
              if(player.holding < this.defaultPrice + totalSpent) {
                  continue; 
              }
              const p = this.loadOrCreatePixel(String(postion))
              // 更新像素信息
              p.color = color
              p.owner = senderId
              p.price = this.defaultPrice
              p.version++

              // 买家买入这个像素
              totalSpent += price
              totalCurrFees += price
              player.ownPixelNum++

              // 地图上总像素加一
              this.totalPixel++
              
              // 创建日志
              this.createLogInfo(senderId, this.defaultPrice, color, postions[i])
          }else{
              // 如果钱不足
              const increment = price * this.ratio
              if(player.holding < price + increment + totalSpent) {
                  continue; 
              }
              
              const p = this.loadOrCreatePixel(String(postion))
              // 更新卖家信息
              const seller = this.loadOrCreatePlayer(p.owner)
              seller.holding += (p.price + increment * this.incomeRatio)
              // 补偿卖家少分的收益
              seller.bonusSettled += this.bonusIndex
              seller.ownPixelNum--

              // 更新像素信息
              p.color = color
              p.owner = senderId
              p.price = price * (1 + this.ratio)
              p.version++

              // 买入别人的像素
              totalSpent += price + increment
              totalCurrFees += price * this.ratio * this.bonusRatio
              player.ownPixelNum++

              // 创建日志
              this.createLogInfo(senderId, price + increment, color, postions[i])
          }
      }
      let res = []
      res.push(totalCurrFees)
      res.push(totalCurrCount)
      res.push(totalSpent)
      return res
  }

   // 提现
   withdrawal(): void {
      assert(this.isWithdrawable(this.context.block.height),'Cash withdrawal is not activated')
      const senderId = this.context!.senderAddress
      assert(this.playersInfo[senderId] !== undefined, 'you have no pixel coin')

      let amount = this.playersInfo[senderId]!.holding
      amount = Math.round(amount / this.rate)
      
      this.playersInfo[senderId]!.holding = amount * this.rate
      this.transfer(senderId, BigInt(amount), 'XAS')
  }

  // 清空奖池 第一轮游戏结束
  clearJackpot(): void {
      assert(this.lastBuyer !== undefined,'has none player')

      assert(this.totalIncrement < 10000 * this.rate, 'increment be greater than 10000')
      assert(this.context!.block.height - 8640 > this.totalIncrementTime, 'time error')
      if(this.totalIncrement)
      // 奖池金额转入最后一个用户
      this.playersInfo[this.lastBuyer]!.holding += this.jackpotIncome

      // 分红比率等数据更新
      this.jackpotIncome = 0
      this.bonusRatio = 0.65
      this.firstGameOver = true
  }

  // 私有方法
  private loadOrCreatePlayer(senderId: string): UserInfo {
      if(this.playersInfo[senderId] === undefined){
          this.playersInfo[senderId] = new User()
      }
      return this.playersInfo[senderId] || new User()
  }

  private loadOrCreatePixel(pos: string): PixelInfo {
      if(this.map[pos] === undefined){
          this.map[pos] = new Pixel()
      }
      return this.map[pos] || new Pixel()
  }
  private getPixelPrice(pos: string): number {
      if(this.map[pos]! === undefined) {
          return this.defaultPrice
      }else{
          return this.map[pos]!.price
      }
  }

  // 分红机制
  private updateBonus(senderId: string): void {
      // 并且计算分红
      const u = this.playersInfo[senderId]!
      const bonusUncollected = this.bonusIndex * u.ownPixelNum - u.bonusMask - u.bonusCollected + u.bonusSettled
      this.playersInfo[senderId]!.holding += bonusUncollected
      this.playersInfo[senderId]!.bonusCollected = bonusUncollected
  }

  private isWithdrawable(nowTime: number): boolean {
      return (nowTime - this.beginTime) > 8640 * 7 || this.totalPixel > 80000
  }
  private createLogInfo(address: string, price: number, color: number, postion: number): void {
      const log = { 
          address, 
          price,
          color,
          coordinate: postion
      }

      this.logs.push(log)
  }

  // 数据部分
  @constant
  getPixelMapInfo(position: number): PixelInfo {
      if(this.map[String(position)] === undefined){
          return new Pixel()
      }
      return this.map[String(position)] || new Pixel()
  }
  // 获取
  @constant
  getUserInfo(senderId: string): UserInfo {
      return this.playersInfo[senderId] || new User()
  }
  // 查询购买日志
  @constant
  getLogInfo(offset: number, limit: number): PaintLogInfo[] {
      
      assert(limit > 0 && limit <= 100, 'limit must greater than 0 and less or equal to 100')
      assert(offset >= 0, 'offset must greater or equal than 0')

      let count = this.logs.size()
      let logs = []
      for(let i = offset; i <= Math.min(offset + limit + 1, count) - 1 ; i++){
          const log:PaintLogInfo = this.logs[i]!
          logs.push(log)
      }

      return logs || []
  }

  // 查询游戏基础信息
  @constant
  getGameInfo(): number[]{
      let res = []
      res.push(this.totalPixel)
      res.push(this.bonusIndex)
      res.push(this.totalIncome)
      res.push(this.jackpotIncome)
      return res
  }

  // 获取汇率
  @constant
  getRatioInfo(): number[] {
      let res = []
      res.push(this.ratio)
      res.push(this.incomeRatio)
      res.push(this.bonusRatio)
      res.push(this.jackpotIncome)
      return res
  }
  @constant
  getLastBuyer(): string {
      return this.lastBuyer
  }
}