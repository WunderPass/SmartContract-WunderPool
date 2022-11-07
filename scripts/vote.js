const { voteForUser } = require('../test/backend');

const poolAddress = '0x9b3d8d3a0ec3b2505aea26ad1c941e3ce8bf002d';
const proposalId = 5;
const version = 'Epsilon';
const mode = 1; // 1=YES, 2=NO

async function main() {
  if (poolAddress.length < 42) throw 'Invalid Pool Address';

  const [user] = await ethers.getSigners();

  const pool = await ethers.getContractAt(
    `WunderPool${version}`,
    poolAddress,
    user
  );

  const launcher = await ethers.getContractAt(
    `PoolLauncher${version}`,
    await pool.launcherAddress(),
    user
  );

  const wunderProposal = await ethers.getContractAt(
    `WunderProposal${version}`,
    await launcher.wunderProposal(),
    user
  );

  const { title, description } = await wunderProposal.getProposal(
    poolAddress,
    proposalId
  );

  console.log(
    `Voting ${['', 'YES', 'NO'][mode]} for Proposal "${title} - ${description}"`
  );
  await voteForUser(user, user, pool, proposalId, mode);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
