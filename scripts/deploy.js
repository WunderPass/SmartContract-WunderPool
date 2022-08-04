const fs = require('fs');
const version = 'Zeta';
const treasuryAddress = '0x4d2ca400de2fc1b905197995e8b0a05f5fd3ee0d';
const swapFees = 10;
const entryFees = 30;

const { exec } = require('child_process');

function verify(params) {
  exec(
    `npx hardhat verify --network polygon ${params}`,
    (error, stdout, stderr) => {
      console.log(stdout);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    }
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  // WunderSwapper
  const WunderSwapper = await ethers.getContractFactory(
    `WunderSwapper${version}`
  );
  const wunderSwapper = await WunderSwapper.deploy(treasuryAddress, swapFees);
  console.log(`WunderSwapper: ${wunderSwapper.address}`);

  const wunderSwapperData = {
    address: wunderSwapper.address,
    abi: wunderSwapper.interface.format('full'),
  };

  fs.writeFileSync(
    `deployed/WunderSwapper${version}.json`,
    JSON.stringify(wunderSwapperData)
  );

  // GovTokenLauncher
  const GovernanceTokenLauncher = await ethers.getContractFactory(
    `GovernanceTokenLauncher${version}`
  );
  const governanceTokenLauncher = await GovernanceTokenLauncher.deploy();
  console.log(`GovernanceTokenLauncher: ${governanceTokenLauncher.address}`);

  const governanceTokenLauncherData = {
    address: governanceTokenLauncher.address,
    abi: governanceTokenLauncher.interface.format('full'),
  };

  fs.writeFileSync(
    `deployed/GovernanceTokenLauncher${version}.json`,
    JSON.stringify(governanceTokenLauncherData)
  );

  // PoolConfig
  const PoolConfig = await ethers.getContractFactory(`PoolConfig${version}`);
  const poolConfig = await PoolConfig.deploy(treasuryAddress, entryFees);
  console.log(`PoolConfig: ${poolConfig.address}`);

  const poolConfigData = {
    address: poolConfig.address,
    abi: poolConfig.interface.format('full'),
  };

  fs.writeFileSync(
    `deployed/PoolConfig${version}.json`,
    JSON.stringify(poolConfigData)
  );

  // WunderProposal
  const WunderProposal = await ethers.getContractFactory(
    `WunderProposal${version}`
  );
  const wunderProposal = await WunderProposal.deploy(poolConfig.address);
  console.log(`WunderProposal: ${wunderProposal.address}`);

  const wunderProposalData = {
    address: wunderProposal.address,
    abi: wunderProposal.interface.format('full'),
  };

  fs.writeFileSync(
    `deployed/WunderProposal${version}.json`,
    JSON.stringify(wunderProposalData)
  );

  // PoolLauncher
  const PoolLauncher = await ethers.getContractFactory(
    `PoolLauncher${version}`
  );
  const poolLauncher = await PoolLauncher.deploy(
    wunderProposal.address,
    poolConfig.address,
    governanceTokenLauncher.address
  );
  console.log(`PoolLauncher: ${poolLauncher.address}`);

  const poolLauncherData = {
    address: poolLauncher.address,
    abi: poolLauncher.interface.format('full'),
  };

  fs.writeFileSync(
    `deployed/PoolLauncher${version}.json`,
    JSON.stringify(poolLauncherData)
  );

  // Verify
  verify(`${wunderSwapper.address} "${treasuryAddress}" "${swapFees}"`);
  verify(`${governanceTokenLauncher.address}`);
  verify(`${poolConfig.address} "${treasuryAddress}" "${entryFees}"`);
  verify(`${wunderProposal.address} "${poolConfig.address}"`);
  verify(
    `${poolLauncher.address} "${wunderProposal.address}" "${poolConfig.address}" "${governanceTokenLauncher.address}"`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
