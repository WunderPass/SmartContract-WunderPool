const fs = require('fs');
const { ethers } = require('hardhat');
const { signMessage, topUp, approve, usdc, usdcBalance } = require('./helpers');
const version = 'Epsilon';

async function main() {
    let poolLauncherFile = fs.readFileSync(`deployed/PoolLauncher${version}.json`);
    let poolLauncherJson = JSON.parse(poolLauncherFile);

    const poolLauncherAddress = poolLauncherJson.address;

    const signers = await ethers.getSigners();
    const amountToTopUpAndApprove = usdc(10); //in full USDC
    for(const signer of signers){
        await topUp(signer, amountToTopUpAndApprove);
        await approve(signer, poolLauncherAddress, amountToTopUpAndApprove);

        console.log(`Account ${signer.address} - topUp and approved to PoolLauncher: ${poolLauncherAddress}`);
    }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });