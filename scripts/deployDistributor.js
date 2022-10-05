const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  const WunderDistributor = await ethers.getContractFactory(
    'WunderDistributorAlpha'
  );
  const contract = await WunderDistributor.deploy();
  console.log(`Token address: ${contract.address}`);

  const contractData = {
    address: contract.address,
    abi: contract.interface.format('full'),
  };

  fs.writeFileSync(
    'deployed/WunderDistributorAlpha.json',
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
