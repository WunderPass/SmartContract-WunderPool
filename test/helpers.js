const { deploySwapper } = require('./deployHelpers');

require('@nomiclabs/hardhat-waffle');

const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const usdcAddressGnosis = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83';

function matic(str) {
  str = typeof str == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
}

function usdc(num) {
  return ethers.utils.parseUnits(`${num}`, 6);
}

const date = (dateStr = null) => {
  return Math.floor(
    (dateStr ? Number(new Date(dateStr)) : Number(new Date())) / 1000
  );
};

async function topUp(signer, amount, gnosis = false) {
  const wunderSwapper = await deploySwapper({
    version: 'Eta',
    treasury: signer.address,
    gnosis,
  });
  const coinPrice = await wunderSwapper.getCoinPriceOf(
    gnosis ? usdcAddressGnosis : usdcAddress,
    amount
  );
  await wunderSwapper
    .connect(signer)
    .buyTokens(gnosis ? usdcAddressGnosis : usdcAddress, { value: coinPrice });
}

async function approve(signer, address, amount, gnosis = false) {
  const usdc = await ethers.getContractAt(
    'TestToken',
    gnosis ? usdcAddressGnosis : usdcAddress,
    signer
  );
  await usdc.connect(signer).approve(address, amount);
}

async function usdcBalance(address, gnosis = false) {
  const usdc = await ethers.getContractAt(
    'TestToken',
    gnosis ? usdcAddressGnosis : usdcAddress
  );
  return await usdc.balanceOf(address);
}

async function signMessage(signer, types, params, packed = true) {
  let message;
  if (packed) {
    message = ethers.utils.solidityKeccak256(types, params);
  } else {
    message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(types, params)
    );
  }
  const bytes = ethers.utils.arrayify(message);
  return await signer.signMessage(bytes);
}

module.exports = {
  usdcAddress,
  usdcAddressGnosis,
  matic,
  usdc,
  date,
  topUp,
  approve,
  usdcBalance,
  signMessage,
};
