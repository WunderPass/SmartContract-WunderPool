const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, sunMinerToken, owner;

  beforeEach(async () => {
    const WunderSwapper = await ethers.getContractFactory('WunderSwapperBeta');
    wunderSwapper = await WunderSwapper.deploy();
    sunMinerToken = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
    [owner, _] = await ethers.getSigners();
  });
  
  describe('Swap Matic For Tokens', () => {
    it('Should revert if no Matic was send', async () => {
      await expect(wunderSwapper.buyTokens(sunMinerToken.address)).to.be.revertedWith("NOTHING TO TRADE");
    });

    it('Should swap Matic for Tokens', async () => {
      const previousBalance = await owner.getBalance();
      const tx = await wunderSwapper.buyTokens(sunMinerToken.address, {value: matic(1)});
      const {gasUsed, effectiveGasPrice} = await tx.wait();
      const gasFee = gasUsed.mul(effectiveGasPrice);
      expect((await owner.getBalance()).add(matic(1)).add(gasFee)).to.equal(previousBalance);
      expect(await sunMinerToken.balanceOf(owner.address)).to.be.gt(0);
    });

    it('Should emit the BoughtTokens event', async () => {
      const tx = await wunderSwapper.buyTokens(sunMinerToken.address, {value: matic(1)});
      await expect(tx).to.emit(wunderSwapper, "BoughtTokens");
    });
  });

  describe('Swap Tokens For Matic', () => {
    let tokenBalance;
    beforeEach(async () => {
      await wunderSwapper.buyTokens(sunMinerToken.address, {value: matic(1)});
      tokenBalance = await sunMinerToken.balanceOf(owner.address);
      await sunMinerToken.transfer(wunderSwapper.address, tokenBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(wunderSwapper.sellTokens(sunMinerToken.address, 0)).to.be.revertedWith("NOTHING TO TRADE");
    });

    it('Should revert if Balance is too low', async () => {
      await expect(wunderSwapper.sellTokens(sunMinerToken.address, tokenBalance.add(1))).to.be.revertedWith("NOT ENOUGH FUNDS");
    });

    it('Should swap Tokens for Matic', async () => {
      const maticBalance = await owner.getBalance();
      const tx = await wunderSwapper.sellTokens(sunMinerToken.address, tokenBalance);
      expect(await sunMinerToken.balanceOf(owner.address)).to.equal(0);
      expect(await owner.getBalance()).to.be.gt(maticBalance);
    });

    it('Should emit the SoldTokens event', async () => {
      const tx = await wunderSwapper.sellTokens(sunMinerToken.address, tokenBalance);
      await expect(tx).to.emit(wunderSwapper, "SoldTokens");
    });
  });

  describe('Swap Tokens For Tokens', () => {
    let planetIX, USDT, planetIXBalance, usdtBalance;
    beforeEach(async () => {
      planetIX = await ethers.getContractAt("TestToken", '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE', owner);
      USDT = await ethers.getContractAt("TestToken", '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', owner);
      await wunderSwapper.buyTokens(planetIX.address, {value: matic(1)});
      planetIXBalance = await planetIX.balanceOf(owner.address);
      usdtBalance = await USDT.balanceOf(owner.address);
      await planetIX.transfer(wunderSwapper.address, planetIXBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(wunderSwapper.swapTokens(planetIX.address, USDT.address, 0)).to.be.revertedWith("NOTHING TO TRADE");
    });

    it('Should revert if Balance is too low', async () => {
      await expect(wunderSwapper.swapTokens(planetIX.address, USDT.address, planetIXBalance.add(1))).to.be.revertedWith("NOT ENOUGH FUNDS");
    });

    it('Should swap Tokens for Tokens', async () => {
      const tx = await wunderSwapper.swapTokens(planetIX.address, USDT.address, planetIXBalance);
      expect(await planetIX.balanceOf(owner.address)).to.equal(0);
      expect(await USDT.balanceOf(owner.address)).to.be.gt(usdtBalance);
    });

    it('Should emit the SwappedTokens event', async () => {
      const tx = await wunderSwapper.swapTokens(planetIX.address, USDT.address, planetIXBalance);
      await expect(tx).to.emit(wunderSwapper, "SwappedTokens");
    });
  });
});
