const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, token, owner;

  beforeEach(async () => {
    const WunderSwapper = await ethers.getContractFactory('WunderSwapper');
    wunderSwapper = await WunderSwapper.deploy();
    token = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
    [owner, _] = await ethers.getSigners();
  });
  
  describe('Swap Matic For Tokens', () => {
    it('Should revert if no Matic was send', async () => {
      await expect(wunderSwapper.buyTokens(token.address)).to.be.revertedWith("NOTHING TO TRADE");
    });

    it('Should swap Matic for Tokens', async () => {
      const previousBalance = await owner.getBalance();
      const tx = await wunderSwapper.buyTokens(token.address, {value: ethers.utils.parseEther("0.01")});
      const {gasUsed, effectiveGasPrice} = await tx.wait();
      const gasFee = gasUsed.mul(effectiveGasPrice);
      expect((await owner.getBalance()).add(ethers.utils.parseEther("0.01")).add(gasFee)).to.equal(previousBalance);
      expect(await token.balanceOf(owner.address)).to.be.gt(0);
    });

    it('Should emit the BoughtTokens event', async () => {
      const tx = await wunderSwapper.buyTokens(token.address, {value: ethers.utils.parseEther("0.01")});
      await expect(tx).to.emit(wunderSwapper, "BoughtTokens");
    });
  });

  describe('Swap Tokens For Matic', () => {
    let tokenBalance;
    beforeEach(async () => {
      await wunderSwapper.buyTokens(token.address, {value: ethers.utils.parseEther("0.01")});
      tokenBalance = await token.balanceOf(owner.address);
      await token.transfer(wunderSwapper.address, tokenBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(wunderSwapper.sellTokens(token.address, 0)).to.be.revertedWith("NOTHING TO TRADE");
    });

    it('Should revert if Balance is too low', async () => {
      await expect(wunderSwapper.sellTokens(token.address, tokenBalance.add(1))).to.be.revertedWith("NOT ENOUGH FUNDS");
    });

    it('Should swap Tokens for Matic', async () => {
      const maticBalance = await owner.getBalance();
      const tx = await wunderSwapper.sellTokens(token.address, tokenBalance);
      expect(await token.balanceOf(owner.address)).to.equal(0);
      expect(await owner.getBalance()).to.be.gt(maticBalance);
    });

    it('Should emit the SoldTokens event', async () => {
      const tx = await wunderSwapper.sellTokens(token.address, tokenBalance);
      await expect(tx).to.emit(wunderSwapper, "SoldTokens");
    });
  });

  describe('Swap Tokens For Tokens', () => {
    it('', async () => {
    });
  });
});
