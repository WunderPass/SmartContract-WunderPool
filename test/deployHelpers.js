require('@nomiclabs/hardhat-waffle');

function routerAddress(gnosis = false) {
  if (gnosis) return '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77';
  return '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff';
}

function wrappedCoinAddress(gnosis = false) {
  if (gnosis) return '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d';
  return '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
}

async function deploySwapper({
  version = 'Eta',
  treasury,
  fee = 10,
  gnosis = false,
}) {
  const WunderSwapper = await ethers.getContractFactory(
    `WunderSwapper${version}`
  );
  if (version !== 'Eta') return await WunderSwapper.deploy();

  if (!treasury) throw 'Treasury Address is required for ETA Version';
  return await WunderSwapper.deploy(
    treasury,
    fee,
    routerAddress(gnosis),
    wrappedCoinAddress(gnosis)
  );
}

module.exports = {
  deploySwapper,
};
