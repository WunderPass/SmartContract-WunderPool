/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@nomiclabs/hardhat-waffle');
require('dotenv').config();
require('hardhat-contract-sizer');
require('@nomiclabs/hardhat-etherscan');

module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 20,
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_URL,
      },
    },
  },
  mocha: {
    timeout: 1000000,
  },
};
