const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof str == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, sunMinerToken, owner, trader;

  beforeEach(async () => {
    [owner, trader] = await ethers.getSigners();
    const WunderSwapper = await ethers.getContractFactory('WunderSwapperZeta');
    wunderSwapper = await WunderSwapper.deploy(owner.address, 10);
    sunMinerToken = await ethers.getContractAt(
      'TestToken',
      '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c',
      owner
    );
  });

  describe('Fee Model', () => {
    it('Treasury Wallet can update the treasury', async () => {
      expect(await wunderSwapper.treasury()).to.be.equal(owner.address);
      await wunderSwapper.changeTreasury(trader.address);
      expect(await wunderSwapper.treasury()).to.be.equal(trader.address);
    });

    it('Treasury Wallet can update the Fee', async () => {
      expect(await wunderSwapper.feePerMille()).to.be.equal(10);
      await wunderSwapper.changeFee(20);
      expect(await wunderSwapper.feePerMille()).to.be.equal(20);
    });
  });

  describe('Swap Matic For Tokens', () => {
    it('Should revert if no Matic was send', async () => {
      await expect(
        wunderSwapper.connect(trader).buyTokens(sunMinerToken.address)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should swap Matic for Tokens', async () => {
      const previousBalance = await trader.getBalance();
      const tx = await wunderSwapper
        .connect(trader)
        .buyTokens(sunMinerToken.address, {
          value: matic(1),
        });
      const { gasUsed, effectiveGasPrice } = await tx.wait();
      const gasFee = gasUsed.mul(effectiveGasPrice);
      expect((await trader.getBalance()).add(matic(1)).add(gasFee)).to.equal(
        previousBalance
      );
      expect(await sunMinerToken.balanceOf(trader.address)).to.be.gt(0);
    });

    it('Should send a 1% Fee to the owner', async () => {
      const previousBalance = await owner.getBalance();
      await wunderSwapper.connect(trader).buyTokens(sunMinerToken.address, {
        value: matic(1),
      });
      expect(previousBalance.add(matic(0.01))).to.equal(
        await owner.getBalance()
      );
    });

    it('Should emit the BoughtTokens event', async () => {
      const tx = await wunderSwapper
        .connect(trader)
        .buyTokens(sunMinerToken.address, {
          value: matic(1),
        });
      await expect(tx).to.emit(wunderSwapper, 'BoughtTokens');
    });
  });

  describe('Swap Tokens For Matic', () => {
    let tokenBalance;
    beforeEach(async () => {
      await wunderSwapper
        .connect(trader)
        .buyTokens(sunMinerToken.address, { value: matic(1) });
      tokenBalance = await sunMinerToken.balanceOf(trader.address);
      await sunMinerToken
        .connect(trader)
        .transfer(wunderSwapper.address, tokenBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(
        wunderSwapper.connect(trader).sellTokens(sunMinerToken.address, 0)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should revert if Balance is too low', async () => {
      await expect(
        wunderSwapper
          .connect(trader)
          .sellTokens(sunMinerToken.address, tokenBalance.add(1))
      ).to.be.revertedWith('NOT ENOUGH FUNDS');
    });

    it('Should swap Tokens for Matic', async () => {
      const maticBalance = await trader.getBalance();
      const tx = await wunderSwapper
        .connect(trader)
        .sellTokens(sunMinerToken.address, tokenBalance);
      expect(await sunMinerToken.balanceOf(trader.address)).to.equal(0);
      expect(await trader.getBalance()).to.be.gt(maticBalance);
    });

    it('Should swap All Tokens for Matic', async () => {
      const maticBalance = await trader.getBalance();
      const tx = await wunderSwapper
        .connect(trader)
        .sellAllTokens(sunMinerToken.address);
      expect(await sunMinerToken.balanceOf(trader.address)).to.equal(0);
      expect(await trader.getBalance()).to.be.gt(maticBalance);
    });

    it('Should send a 1% Fee to the owner', async () => {
      const previousBalance = await sunMinerToken.balanceOf(owner.address);
      await wunderSwapper.connect(trader).sellAllTokens(sunMinerToken.address);
      expect(previousBalance.add(tokenBalance.div(100))).to.equal(
        await sunMinerToken.balanceOf(owner.address)
      );
    });

    it('Should emit the SoldTokens event', async () => {
      const tx = await wunderSwapper
        .connect(trader)
        .sellTokens(sunMinerToken.address, tokenBalance);
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
      await wunderSwapper
        .connect(trader)
        .buyTokens(planetIX.address, { value: matic(1) });
      planetIXBalance = await planetIX.balanceOf(trader.address);
      usdtBalance = await USDT.balanceOf(trader.address);
      smtBalance = await sunMinerToken.balanceOf(trader.address);
      await planetIX
        .connect(trader)
        .transfer(wunderSwapper.address, planetIXBalance);
    });

    it('Should revert if Amount is zero', async () => {
      await expect(
        wunderSwapper
          .connect(trader)
          .swapTokens(planetIX.address, USDT.address, 0)
      ).to.be.revertedWith('NOTHING TO TRADE');
    });

    it('Should revert if Balance is too low', async () => {
      await expect(
        wunderSwapper
          .connect(trader)
          .swapTokens(planetIX.address, USDT.address, planetIXBalance.add(1))
      ).to.be.revertedWith('NOT ENOUGH FUNDS');
    });

    it('Should swap Tokens for Tokens', async () => {
      await wunderSwapper
        .connect(trader)
        .swapTokens(planetIX.address, USDT.address, planetIXBalance);
      expect(await planetIX.balanceOf(trader.address)).to.equal(0);
      expect(await USDT.balanceOf(trader.address)).to.be.gt(usdtBalance);
    });

    it('Should swap All Tokens', async () => {
      await wunderSwapper
        .connect(trader)
        .swapAllTokens(planetIX.address, USDT.address);
      expect(await planetIX.balanceOf(trader.address)).to.equal(0);
      expect(await USDT.balanceOf(trader.address)).to.be.gt(usdtBalance);
    });

    it('Should swap Tokens for Tokens Even if there is no QuickSwapPool', async () => {
      await wunderSwapper
        .connect(trader)
        .swapTokens(planetIX.address, sunMinerToken.address, planetIXBalance);
      expect(await planetIX.balanceOf(trader.address)).to.equal(0);
      expect(await sunMinerToken.balanceOf(trader.address)).to.be.gt(
        smtBalance
      );
    });

    it('Should send a 1% Fee to the owner', async () => {
      const previousBalance = await planetIX.balanceOf(owner.address);
      await wunderSwapper
        .connect(trader)
        .swapTokens(planetIX.address, sunMinerToken.address, planetIXBalance);
      expect(previousBalance.add(planetIXBalance.div(100))).to.equal(
        await planetIX.balanceOf(owner.address)
      );
    });

    it('Should emit the SwappedTokens event', async () => {
      const tx = await wunderSwapper
        .connect(trader)
        .swapTokens(planetIX.address, USDT.address, planetIXBalance);
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
      await wunderSwapper
        .connect(trader)
        .buyTokens(USDC.address, { value: matic(3) });
      usdcBalance = await USDC.balanceOf(trader.address);
      linkBalance = await link.balanceOf(trader.address);
      manaBalance = await mana.balanceOf(trader.address);
      await USDC.connect(trader).transfer(wunderSwapper.address, usdcBalance);
    });

    it('Should swap USDC for LINK', async () => {
      await wunderSwapper
        .connect(trader)
        .swapTokens(USDC.address, link.address, usdcBalance);
      expect(await USDC.balanceOf(trader.address)).to.equal(0);
      expect(await link.balanceOf(trader.address)).to.be.gt(linkBalance);
    });

    it('Should swap USDC for MANA', async () => {
      await wunderSwapper
        .connect(trader)
        .swapTokens(USDC.address, mana.address, usdcBalance);
      expect(await USDC.balanceOf(trader.address)).to.equal(0);
      expect(await mana.balanceOf(trader.address)).to.be.gt(manaBalance);
    });

    it('Should send a 1% Fee to the owner', async () => {
      const previousBalance = await USDC.balanceOf(owner.address);
      await wunderSwapper
        .connect(trader)
        .swapTokens(USDC.address, mana.address, usdcBalance);
      expect(previousBalance.add(usdcBalance.div(100))).to.equal(
        await USDC.balanceOf(owner.address)
      );
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
