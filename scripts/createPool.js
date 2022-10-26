const { createPool } = require('../test/backend');
const { usdc, date, approve } = require('../test/helpers');

async function main() {
  const [user] = await ethers.getSigners();
  const launcher = await ethers.getContractAt(
    'PoolLauncherEta',
    '0x8c3B8456077F0A853c667BF18F4B77E4B3Ca0cB1',
    user
  );
  const amount = usdc(1);
  const minInvest = amount;
  const maxInvest = amount;
  const members = [];
  const maxMembers = 10;
  const votingPercent = 50;
  const votingTime = 86400;
  const minYesVoters = 1;
  const public = true;
  const autoLiquidate = date() + 60;

  await approve(user, launcher.address, usdc(amount));
  const tx = await launcher.createNewPool([
    'Erster Eta Pool',
    'Erster Eta Pool Token',
    'EEPT',
    amount,
    user.address,
    members,
    minInvest,
    maxInvest,
    maxMembers,
    votingPercent,
    votingTime,
    minYesVoters,
    public,
    autoLiquidate,
  ]);
  console.log(`Created Pool: ${tx.hash}`);
  await tx.wait();
  console.log('✅ Pool Created');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
