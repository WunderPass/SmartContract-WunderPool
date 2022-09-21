const fs = require('fs');

const wunderProposal = '0xC90403e7537c0E2b98D4E73109316fCC106E9e7a';
const poolConfig = '0xB63D47962319822eABaD71765153FD2c38939d3a';
const governanceTokenLauncher = '0xbA7560522C3d9DbAE7Db1EB3fD2083Ae88FD6BE7';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  const PoolLauncher = await ethers.getContractFactory('PoolLauncherZeta');
  const contract = await PoolLauncher.deploy(
    wunderProposal,
    poolConfig,
    governanceTokenLauncher
  );
  console.log(`Token address: ${contract.address}`);

  const contractData = {
    address: contract.address,
    abi: contract.interface.format('full'),
  };

  fs.writeFileSync(
    'deployed/PoolLauncherZeta.json',
    JSON.stringify(contractData)
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
