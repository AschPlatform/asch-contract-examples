/// <reference types="asch-contract-types" />

interface FundingInfo {
	tokenAmount: bigint
	xasAmount: bigint
    bchAmount: bigint
}

class Funding {
	// 众筹得到的token数量
	tokenAmount: bigint
	// 参与众筹XAS数量
	xasAmount: bigint
	// 参与众筹BCH数量
    bchAmount: bigint
    
    constructor() {
        this.bchAmount = BigInt(0)
        this.xasAmount = BigInt(0)
        this.tokenAmount = BigInt(0)
    }
}

// 众筹合约类
class CrowdFundgingContract extends AschContract {
	// 记录每个地址的众筹信息
	fundingOfAddress: Mapping<Funding> 
	// 兑换比例
	rateOfCurrency: Mapping<bigint>
	// 总可众筹token数量
	totalFundingToken: bigint
	// 剩余可众筹数量
	avalibleToken: bigint
	// 众筹发起人地址，发行token资产的账户地址
	sponsorAddress: string
	// 众筹得到的资产名称
	offeringCurrency: string
	
	// 初始化方法，会在合约注册时被调用

	constructor() {
		super()
		this.offeringCurrency = 'test.XXT'
		this.sponsorAddress = 'sponsor address' // 发行 XXT 资产的账户地址
		
		this.rateOfCurrency = new Mapping<bigint>()
		this.rateOfCurrency['XAS'] = BigInt(100)    // 1 XAS = 100 token
		this.rateOfCurrency['BCH'] = BigInt(30000) // 1 BCH = 30000 token
		
		this.totalFundingToken = BigInt(0)
		this.avalibleToken = BigInt(0)
		this.fundingOfAddress = new Mapping<Funding>()
	}

	// 发起人初始注入token
	@payable
	payInitialToken(amount: bigint, currency: string): void {
		assert(this.context!.senderAddress === this.sponsorAddress, `invalid sponsor address`)
		assert(currency === this.offeringCurrency, `invalid offering currency, should be ${this.offeringCurrency}`)
		assert(this.totalFundingToken === 0n, `initial ${this.offeringCurrency} has paied`)
		
		this.totalFundingToken = amount
		this.avalibleToken = amount
	}
	
	// 众筹逻辑
	@payable({ isDefault: true })
	crowdFunding(amount: bigint, currency: string): void {
		assert(amount >= 0, 'amount must great than 0')
		assert(currency === 'XAS' || currency === 'BCH', `invalid currency '${currency}', please pay XAS or BCH`)
	
		const rate = this.rateOfCurrency[currency]!
		const tokenAmount = amount * rate
		assert(this.avalibleToken >= tokenAmount, `insuffient ${this.offeringCurrency}`)
		
		this.avalibleToken = this.avalibleToken - tokenAmount
		const partnerAddress = this.context!.senderAddress
		this.updateFunding(partnerAddress, amount, currency, tokenAmount)
		// 调用ASCH链转账
		this.transfer(partnerAddress, tokenAmount, this.offeringCurrency)
	} 

	getXXT(amount: bigint): void{
		assert(amount >= 0, 'amount must greate than 0')
		assert(amount < this.avalibleToken, `insuffient XAS, amount must less than ${this.avalibleToken}`)
		const senderId = this.context!.senderAddress
		this.avalibleToken = this.avalibleToken - amount
		this.transfer(senderId, amount, 'test.XXT')
	}
	
	@constant 
	getFunding(address: string): FundingInfo {
		return this.fundingOfAddress[address]! || new Funding()
	}

	private updateFunding( address: string, amount: bigint, currency: string, tokenAmount: bigint) : void {
		const funding = this.getOrCreateFunding(address)
		funding.tokenAmount += tokenAmount
		
		if (currency === 'XAS') {
			funding.xasAmount += amount
		}
		else if (currency === 'BCH') {
			funding.bchAmount += amount
		}
	}
	
	private getOrCreateFunding( address: string ) : FundingInfo {
		if (this.fundingOfAddress[address]! === undefined) {
			this.fundingOfAddress[address]! = new Funding()
		} 
		return this.fundingOfAddress[address]!
	}
	
}