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
        url: 'https://rpc.gnosischain.com',
      },
    },
    gnosis: {
      url: 'https://rpc.gnosischain.com/',
      accounts: [process.env.PRIVATE_KEY],
    },
    chiado: {
      url: 'https://rpc.chiadochain.net',
      gasPrice: 1000000000,
      accounts: [process.env.PRIVATE_KEY],
    },
    polygon: {
      url: process.env.ALCHEMY_MAINNET_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    mumbai: {
      url: 'https://rpc-mumbai.matic.today',
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
  mocha: {
    timeout: 1000000,
  },
  etherscan: {
    customChains: [
      {
        network: 'gnosis',
        chainId: 100,
        urls: {
          // Gnosisscan
          apiURL: 'https://api.gnosisscan.io/api',
          browserURL: 'https://gnosisscan.io/',
          // Blockscout
          //apiURL: "https://blockscout.com/xdai/mainnet/api",
          //browserURL: "https://blockscout.com/xdai/mainnet",
        },
      },
    ],
    apiKey: {
      polygon: process.env.POLYGONSCAN_KEY,
      gnosis: process.env.GNOSISSCAN_KEY,
    },
  },
};
