const chai = require('chai');
const assertArrays = require('chai-arrays');
const { ethers } = require('hardhat');
chai.use(assertArrays);
const expect = chai.expect;

const logBalances = async (usdc, token, owner, decimals, text = 'Balances') => {
  const usdcBalance = await usdc.balanceOf(owner.address);
  const tokenBalance = await token.balanceOf(owner.address);

  console.log(`\n${text}`);
  console.log(`  USDC: ${formatUnits(usdcBalance, 6)}`);
  console.log(`  Token: ${formatUnits(tokenBalance, decimals)}`);
};

const formatUnits = ethers.utils.formatUnits;

const tokenAddress = '0x2B9E7ccDF0F4e5B24757c1E1a80e311E34Cb10c7';
const testAmount = 3;

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, usdc, token, tx, owner;

  beforeEach(async () => {
    [owner, _] = await ethers.getSigners();

    wunderSwapper = await ethers.getContractAt(
      'WunderSwapperZeta',
      '0x6a7ad95F8158F59e524663C648223743DD0695E2',
      owner
    );
    usdc = await ethers.getContractAt(
      'TestToken',
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      owner
    );
    token = await ethers.getContractAt('TestToken', tokenAddress, owner);
  });

  it('Should swap USDC for MASK and back', async () => {
    const tokenDecimals = await token.decimals();
    const testAmountUsdc = ethers.BigNumber.from(testAmount).mul(1000000);
    const initialUsdcBalance = await usdc.balanceOf(owner.address);
    const initialTokenBalance = await token.balanceOf(owner.address);

    console.log(`Testing Swap with ${owner.address}`);
    await logBalances(usdc, token, owner, tokenDecimals, 'Initial Balances');

    if (initialUsdcBalance.lt(testAmountUsdc)) {
      console.log(
        `\nInitial USDC Balance not sufficient. Buying ${formatUnits(
          testAmountUsdc.sub(initialUsdcBalance),
          6
        )} USDC`
      );
      const maticPriceForUsdc = await wunderSwapper.getMaticPriceOf(
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        testAmountUsdc.sub(initialUsdcBalance)
      );
      console.log(
        `This will cost ${ethers.utils.formatEther(maticPriceForUsdc)} MATIC`
      );
      tx = await wunderSwapper.buyTokens(usdc.address, {
        value: maticPriceForUsdc.mul(11).div(10),
      });
      console.log(`\nWaiting for tx: ${tx.hash}`);
      await tx.wait();
      console.log('Done');
      await logBalances(usdc, token, owner, tokenDecimals);
    }

    console.log(`\nSwapping ${testAmount} USDC to Token`);

    tx = await usdc.approve(wunderSwapper.address, testAmountUsdc);
    console.log(`1. Approve USDC amount: ${tx.hash}`);
    await tx.wait();

    tx = await wunderSwapper.swapTokens(
      usdc.address,
      token.address,
      testAmountUsdc
    );
    console.log(`2. Swap Tokens: ${tx.hash}`);
    await tx.wait();

    await logBalances(usdc, token, owner, tokenDecimals);

    const tokenBalanceAfterSwap = await token.balanceOf(owner.address);
    const receivedTokenAmount = tokenBalanceAfterSwap.sub(initialTokenBalance);

    console.log(
      `\nReceived ${formatUnits(receivedTokenAmount, tokenDecimals)} Tokens`
    );

    console.log(
      `\nSwapping ${formatUnits(
        receivedTokenAmount,
        tokenDecimals
      )} Tokens to USDC`
    );

    tx = await token.approve(wunderSwapper.address, receivedTokenAmount);
    console.log(`1. Approve Token amount: ${tx.hash}`);
    await tx.wait();

    tx = await wunderSwapper.swapTokens(
      token.address,
      usdc.address,
      receivedTokenAmount
    );
    console.log(`2. Swap Tokens: ${tx.hash}`);
    await tx.wait();

    await logBalances(usdc, token, owner, tokenDecimals);
  });
});
