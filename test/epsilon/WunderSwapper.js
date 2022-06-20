const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof str == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, sunMinerToken, owner;

  beforeEach(async () => {
    const WunderSwapper = await ethers.getContractFactory('WunderSwapperDelta');
    wunderSwapper = await WunderSwapper.deploy();
    sunMinerToken = await ethers.getContractAt(
      'TestToken',
      '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c',
      owner
    );
    [owner, _] = await ethers.getSigners();
  });

  describe('Swap Matic For Tokens', () => {
    it('Should revert if no Matic was send', async () => {
      await expect(
        wunderSwapper.buyTokens(sunMinerToken.address)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should swap Matic for Tokens', async () => {
      const previousBalance = await owner.getBalance();
      const tx = await wunderSwapper.buyTokens(sunMinerToken.address, {
        value: matic(1),
      });
      const { gasUsed, effectiveGasPrice } = await tx.wait();
      const gasFee = gasUsed.mul(effectiveGasPrice);
      expect((await owner.getBalance()).add(matic(1)).add(gasFee)).to.equal(
        previousBalance
      );
      expect(await sunMinerToken.balanceOf(owner.address)).to.be.gt(0);
    });

    it('Should emit the BoughtTokens event', async () => {
      const tx = await wunderSwapper.buyTokens(sunMinerToken.address, {
        value: matic(1),
      });
      await expect(tx).to.emit(wunderSwapper, 'BoughtTokens');
    });
  });

  describe('Swap Tokens For Matic', () => {
    let tokenBalance;
    beforeEach(async () => {
      await wunderSwapper.buyTokens(sunMinerToken.address, { value: matic(1) });
      tokenBalance = await sunMinerToken.balanceOf(owner.address);
      await sunMinerToken.transfer(wunderSwapper.address, tokenBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(
        wunderSwapper.sellTokens(sunMinerToken.address, 0)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should revert if Balance is too low', async () => {
      await expect(
        wunderSwapper.sellTokens(sunMinerToken.address, tokenBalance.add(1))
      ).to.be.revertedWith('NOT ENOUGH FUNDS');
    });

    it('Should swap Tokens for Matic', async () => {
      const maticBalance = await owner.getBalance();
      const tx = await wunderSwapper.sellTokens(
        sunMinerToken.address,
        tokenBalance
      );
      expect(await sunMinerToken.balanceOf(owner.address)).to.equal(0);
      expect(await owner.getBalance()).to.be.gt(maticBalance);
    });

    it('Should swap All Tokens for Matic', async () => {
      const maticBalance = await owner.getBalance();
      const tx = await wunderSwapper.sellAllTokens(sunMinerToken.address);
      expect(await sunMinerToken.balanceOf(owner.address)).to.equal(0);
      expect(await owner.getBalance()).to.be.gt(maticBalance);
    });

    it('Should emit the SoldTokens event', async () => {
      const tx = await wunderSwapper.sellTokens(
        sunMinerToken.address,
        tokenBalance
      );
      await expect(tx).to.emit(wunderSwapper, 'SoldTokens');
    });
  });

  describe('Swap Tokens For Tokens', () => {
    let planetIX, USDT, planetIXBalance, usdtBalance, smtBalance;
    beforeEach(async () => {
      planetIX = await ethers.getContractAt(
        'TestToken',
        '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE',
        owner
      );
      USDT = await ethers.getContractAt(
        'TestToken',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        owner
      );
      await wunderSwapper.buyTokens(planetIX.address, { value: matic(1) });
      planetIXBalance = await planetIX.balanceOf(owner.address);
      usdtBalance = await USDT.balanceOf(owner.address);
      smtBalance = await sunMinerToken.balanceOf(owner.address);
      await planetIX.transfer(wunderSwapper.address, planetIXBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(
        wunderSwapper.swapTokens(planetIX.address, USDT.address, 0)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should revert if Balance is too low', async () => {
      await expect(
        wunderSwapper.swapTokens(
          planetIX.address,
          USDT.address,
          planetIXBalance.add(1)
        )
      ).to.be.revertedWith('NOT ENOUGH FUNDS');
    });

    it('Should swap Tokens for Tokens', async () => {
      await wunderSwapper.swapTokens(
        planetIX.address,
        USDT.address,
        planetIXBalance
      );
      expect(await planetIX.balanceOf(owner.address)).to.equal(0);
      expect(await USDT.balanceOf(owner.address)).to.be.gt(usdtBalance);
    });

    it('Should swap All Tokens', async () => {
      await wunderSwapper.swapAllTokens(planetIX.address, USDT.address);
      expect(await planetIX.balanceOf(owner.address)).to.equal(0);
      expect(await USDT.balanceOf(owner.address)).to.be.gt(usdtBalance);
    });

    it('Should swap Tokens for Tokens Even if there is no QuickSwapPool', async () => {
      await wunderSwapper.swapTokens(
        planetIX.address,
        sunMinerToken.address,
        planetIXBalance
      );
      expect(await planetIX.balanceOf(owner.address)).to.equal(0);
      expect(await sunMinerToken.balanceOf(owner.address)).to.be.gt(smtBalance);
    });

    it('Should emit the SwappedTokens event', async () => {
      const tx = await wunderSwapper.swapTokens(
        planetIX.address,
        USDT.address,
        planetIXBalance
      );
      await expect(tx).to.emit(wunderSwapper, 'SwappedTokens');
    });
  });

  describe('Swap Popular Tokens', () => {
    let USDC, link, mana, avax, aave, usdcBalance, linkBalance, manaBalance;
    beforeEach(async () => {
      USDC = await ethers.getContractAt(
        'TestToken',
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        owner
      );
      link = await ethers.getContractAt(
        'TestToken',
        '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
        owner
      );
      mana = await ethers.getContractAt(
        'TestToken',
        '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
        owner
      );
      avax = await ethers.getContractAt(
        'TestToken',
        '0x2C89bbc92BD86F8075d1DEcc58C7F4E0107f286b',
        owner
      );
      aave = await ethers.getContractAt(
        'TestToken',
        '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
        owner
      );
      await wunderSwapper.buyTokens(USDC.address, { value: matic(3) });
      usdcBalance = await USDC.balanceOf(owner.address);
      linkBalance = await link.balanceOf(owner.address);
      manaBalance = await mana.balanceOf(owner.address);
      await USDC.transfer(wunderSwapper.address, usdcBalance);
    });

    it('Should swap USDC for LINK', async () => {
      await wunderSwapper.swapTokens(USDC.address, link.address, usdcBalance);
      expect(await USDC.balanceOf(owner.address)).to.equal(0);
      expect(await link.balanceOf(owner.address)).to.be.gt(linkBalance);
    });

    it('Should swap USDC for MANA', async () => {
      await wunderSwapper.swapTokens(USDC.address, mana.address, usdcBalance);
      expect(await USDC.balanceOf(owner.address)).to.equal(0);
      expect(await mana.balanceOf(owner.address)).to.be.gt(manaBalance);
    });

    it('Should choose the best path', async () => {
      await Promise.all(
        [mana, link, aave, avax].map(async (tkn) => {
          const maticPath = [
            USDC.address,
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            tkn.address,
          ];
          const usdPath = [USDC.address, tkn.address];
          const bestPath = await wunderSwapper.getPathFor(
            USDC.address,
            tkn.address,
            usdcBalance
          );

          const maticAmount = await wunderSwapper.getPriceWithPath(
            usdcBalance,
            maticPath
          );
          const usdAmount = await wunderSwapper.getPriceWithPath(
            usdcBalance,
            usdPath
          );
          const bestAmount = await wunderSwapper.getPriceWithPath(
            usdcBalance,
            bestPath
          );

          if (maticAmount.gt(usdAmount)) {
            expect(maticAmount).to.equal(bestAmount);
          } else {
            expect(usdAmount).to.equal(bestAmount);
          }
        })
      );
    });
  });
});
