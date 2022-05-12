const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  const PoolLauncher = await ethers.getContractFactory('PoolLauncherGamma');
  const contract = await PoolLauncher.deploy();
  console.log(`Token address: ${contract.address}`);

  const contractData = {
    address: contract.address,
    abi: contract.interface.format('full')
  }

  fs.writeFileSync('deployed/PoolLauncherGamma.json', JSON.stringify(contractData));
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })