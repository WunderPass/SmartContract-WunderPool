const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof str == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

const logUsd = (bal) => {
  console.log(bal.div(10000).toNumber() / 100);
};

describe('WUNDER SWAPPER CONTRACT', () => {
  let wunderSwapper, usdc, tx, mask, usdcBalance, maskBalance, owner;

  beforeEach(async () => {
    wunderSwapper = await ethers.getContractAt(
      'WunderSwapperDelta',
      '0xC89097B68AED3168c749395AD63B2079253CA599',
      owner
    );
    usdc = await ethers.getContractAt(
      'TestToken',
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      owner
    );
    mask = await ethers.getContractAt(
      'TestToken',
      '0x2B9E7ccDF0F4e5B24757c1E1a80e311E34Cb10c7',
      owner
    );
    [owner, _] = await ethers.getSigners();
  });

  it('Should swap USDC for MASK and back', async () => {
    // usdcBalance = await usdc.balanceOf(wunderSwapper.address);
    // logUsd(usdcBalance);

    // tx = await usdc.transfer(wunderSwapper.address, usdcBalance);
    // await tx.wait();

    // tx = await wunderSwapper.sellAllTokens(usdc.address);
    // await tx.wait();

    usdcBalance = await usdc.balanceOf(owner.address);
    logUsd(usdcBalance);

    tx = await wunderSwapper.buyTokens(usdc.address, { value: matic(1) });
    await tx.wait();

    usdcBalance = await usdc.balanceOf(owner.address);
    maskBalance = await mask.balanceOf(owner.address);

    console.log('INITIAL');
    console.log(
      'usdc',
      usdcBalance.div(10000).toNumber() / 100,
      'mask',
      maskBalance.toString()
    );

    tx = await usdc.transfer(wunderSwapper.address, usdcBalance);
    await tx.wait();

    tx = await wunderSwapper.swapTokens(
      usdc.address,
      mask.address,
      usdcBalance
    );
    await tx.wait();

    usdcBalance = await usdc.balanceOf(owner.address);
    maskBalance = await mask.balanceOf(owner.address);
    console.log('SWAP');
    console.log(
      'usdc',
      usdcBalance.div(10000).toNumber() / 100,
      'mask',
      maskBalance.toString()
    );

    tx = await mask.transfer(wunderSwapper.address, maskBalance);
    await tx.wait();

    tx = await wunderSwapper.swapTokens(
      mask.address,
      usdc.address,
      maskBalance
    );
    await tx.wait();

    usdcBalance = await usdc.balanceOf(owner.address);
    maskBalance = await mask.balanceOf(owner.address);
    console.log('SWAP BACK');
    console.log(
      'usdc',
      usdcBalance.div(10000).toNumber() / 100,
      'mask',
      maskBalance.toString()
    );
  });
});
