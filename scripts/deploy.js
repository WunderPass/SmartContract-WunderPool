const fs = require('fs');
const version = 'Eta';
const treasuryAddress = '0xe11e61b3A603Fb1d4d208574bfc25cF69177BB0C';
const usdcAddress = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83';
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
  // const WunderSwapper = await ethers.getContractFactory(
  //   `WunderSwapper${version}`
  // );
  // const wunderSwapper = await WunderSwapper.deploy(
  //   treasuryAddress,
  //   swapFees,
  //   '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77',
  //   '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'
  // );
  // console.log(`WunderSwapper: ${wunderSwapper.address}`);

  // const wunderSwapperData = {
  //   address: wunderSwapper.address,
  //   abi: wunderSwapper.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/WunderSwapper${version}.json`,
  //   JSON.stringify(wunderSwapperData)
  // );

  // WunderDistributor
  // const WunderDistributor = await ethers.getContractFactory(
  //   `WunderDistributorGamma`
  // );
  // const wunderDistributor = await WunderDistributor.deploy();
  // console.log(`WunderDistributor: ${wunderDistributor.address}`);

  // const wunderDistributorData = {
  //   address: wunderDistributor.address,
  //   abi: wunderDistributor.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/WunderDistributorGamma.json`,
  //   JSON.stringify(wunderDistributorData)
  // );

  // GovTokenLauncher
  // const GovernanceTokenLauncher = await ethers.getContractFactory(
  //   `GovernanceTokenLauncher${version}`
  // );
  // const governanceTokenLauncher = await GovernanceTokenLauncher.deploy([
  //   wunderDistributor.address,
  // ]);
  // console.log(`GovernanceTokenLauncher: ${governanceTokenLauncher.address}`);

  // const governanceTokenLauncherData = {
  //   address: governanceTokenLauncher.address,
  //   abi: governanceTokenLauncher.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/GovernanceTokenLauncher${version}.json`,
  //   JSON.stringify(governanceTokenLauncherData)
  // );

  // PoolConfig
  // const PoolConfig = await ethers.getContractFactory(`PoolConfig${version}`);
  // const poolConfig = await PoolConfig.deploy(treasuryAddress, entryFees);
  // console.log(`PoolConfig: ${poolConfig.address}`);

  // const poolConfigData = {
  //   address: poolConfig.address,
  //   abi: poolConfig.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/PoolConfig${version}.json`,
  //   JSON.stringify(poolConfigData)
  // );

  // WunderProposal
  // const WunderProposal = await ethers.getContractFactory(
  //   `WunderProposal${version}`
  // );
  // const wunderProposal = await WunderProposal.deploy(poolConfig.address);
  // console.log(`WunderProposal: ${wunderProposal.address}`);

  // const wunderProposalData = {
  //   address: wunderProposal.address,
  //   abi: wunderProposal.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/WunderProposal${version}.json`,
  //   JSON.stringify(wunderProposalData)
  // );

  // PoolLauncher
  // const PoolLauncher = await ethers.getContractFactory(
  //   `PoolLauncher${version}`
  // );
  // const poolLauncher = await PoolLauncher.deploy(
  //   wunderProposal.address,
  //   poolConfig.address,
  //   governanceTokenLauncher.address,
  //   usdcAddress
  // );
  // console.log(`PoolLauncher: ${poolLauncher.address}`);

  // const poolLauncherData = {
  //   address: poolLauncher.address,
  //   abi: poolLauncher.interface.format('full'),
  // };

  // fs.writeFileSync(
  //   `deployed/gnosis/PoolLauncher${version}.json`,
  //   JSON.stringify(poolLauncherData)
  // );

  // // Verify
  // console.log('Waiting until verification is possible...');
  // setTimeout(() => {
  //   verify(`${wunderSwapper.address} "${treasuryAddress}" "${swapFees}"`);
  //   verify(`${wunderDistributor.address}`);
  //   verify(`${governanceTokenLauncher.address}`);
  //   verify(`${poolConfig.address} "${treasuryAddress}" "${entryFees}"`);
  //   verify(`${wunderProposal.address} "${poolConfig.address}"`);
  //   verify(
  //     `${poolLauncher.address} "${wunderProposal.address}" "${poolConfig.address}" "${governanceTokenLauncher.address}"`
  //   );
  // }, 20000);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
