const fs = require('fs');

const treasuryAddress = '0x4d2ca400de2fc1b905197995e8b0a05f5fd3ee0d';
const swapFees = 10;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with the account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Account balance: ${balance.toString()}`);

  const WunderSwapper = await ethers.getContractFactory('WunderSwapperZeta');
  const contract = await WunderSwapper.deploy(treasuryAddress, swapFees);
  console.log(`Token address: ${contract.address}`);

  const contractData = {
    address: contract.address,
    abi: contract.interface.format('full'),
  };

  fs.writeFileSync(
    'deployed/WunderSwapperZeta.json',
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
