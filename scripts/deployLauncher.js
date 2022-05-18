const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  const PoolLauncher = await ethers.getContractFactory('PoolLauncherDelta');
  const contract = await PoolLauncher.deploy(
    '0xD92C084A562B21Cc0F6098A3e97fed5357fe2947'
  );
  console.log(`Token address: ${contract.address}`);

  const contractData = {
    address: contract.address,
    abi: contract.interface.format('full'),
  };

  fs.writeFileSync(
    'deployed/PoolLauncherDelta.json',
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
