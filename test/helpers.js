require('@nomiclabs/hardhat-waffle');

const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

function matic(str) {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

function usdc(num) {
  return ethers.utils.parseUnits(`${num}`, 6);
}

async function topUp(signer, amount) {
  const WunderSwapper = await ethers.getContractFactory('WunderSwapperGamma');
  const wunderSwapper = await WunderSwapper.deploy();
  const maticPrice = await wunderSwapper.getMaticPriceOf(usdcAddress, amount);
  await wunderSwapper.connect(signer).buyTokens(usdcAddress, {value: maticPrice});
}

async function approve(signer, address, amount) {
  const usdc = await ethers.getContractAt("TestToken", usdcAddress, signer);
  await usdc.connect(signer).approve(address, amount);
}

async function usdcBalance(address) {
  const usdc = await ethers.getContractAt("TestToken", usdcAddress);
  return await usdc.balanceOf(address);
}

module.exports = {
  usdcAddress: usdcAddress,
  matic: matic,
  usdc: usdc,
  topUp: topUp,
  approve: approve,
  usdcBalance: usdcBalance
}